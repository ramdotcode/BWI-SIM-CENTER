import "server-only";
import type { Prisma, SlotStatus } from "@prisma/client";
import { db, type DbOrTx, type Tx } from "../db";
import { HttpError, type AdminCtx } from "../auth";
import { getSettings, slotStarts, slotsNeeded, type Settings } from "../settings";
import { logActivity } from "../activity";
import { addDays, dateOnly, fmtDate, fmtTime, shortName, todayJkt, wibInstant, ymd } from "../format";
import { notify } from "../notify";
import { publish, type SlotEvent } from "../realtime";
import { assertReg, assertSlot, SCHEDULABLE } from "../state-machine";

const slotInclude = {
  simulator: true,
  instructor: true,
  registration: { include: { participant: true, package: true } },
} satisfies Prisma.SlotInclude;
export type SlotFull = Prisma.SlotGetPayload<{ include: typeof slotInclude }>;

/** Buat slot AVAILABLE untuk rentang tanggal (idempotent). Dipakai lazy saat kalender dibuka & job harian. */
export async function ensureSlots(from: string, to: string, s?: Settings) {
  s ??= await getSettings();
  const sims = await db.simulator.findMany({ where: { active: true } });
  const starts = slotStarts(s);
  const data: Prisma.SlotCreateManyInput[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) for (const sim of sims) for (const t of starts) data.push({ simulator_id: sim.id, date: dateOnly(d), start_time: t.start, end_time: t.end });
  if (data.length) await db.slot.createMany({ data, skipDuplicates: true });
  return data.length;
}

export async function weekSlots(simCode: string, monday: string) {
  const s = await getSettings();
  const sunday = addDays(monday, 6);
  await ensureSlots(monday, sunday, s);
  const starts = new Set(slotStarts(s).map((t) => t.start));
  const slots = await db.slot.findMany({
    where: { simulator: { code: simCode }, date: { gte: dateOnly(monday), lte: dateOnly(sunday) } },
    include: slotInclude,
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
  // Slot di luar jam operasional sekarang (mis. setting berubah) tetap tampil hanya jika terisi.
  return slots.filter((x) => starts.has(x.start_time) || x.status !== "AVAILABLE");
}

export function isPast(slot: { date: Date; start_time: string }, now = new Date()) {
  return wibInstant(slot.date, slot.start_time) <= now;
}

/** Hitung pemakaian slot pendaftaran. NO_SHOW dihitung terpakai jika no_show_policy = HOURS_FORFEITED (Q5). */
export async function usage(tx: DbOrTx, regId: number, s: Settings, hours?: number) {
  const reg = hours == null ? await tx.registration.findUniqueOrThrow({ where: { id: regId }, select: { hours_snapshot: true } }) : { hours_snapshot: hours };
  const counts = await tx.slot.groupBy({ by: ["status"], where: { registration_id: regId }, _count: true });
  const c = (st: SlotStatus) => counts.find((x) => x.status === st)?._count ?? 0;
  const noShowUsed = s.no_show_policy === "HOURS_FORFEITED" ? c("NO_SHOW") : 0;
  const needed = slotsNeeded(reg.hours_snapshot, s.slot_minutes);
  return { needed, scheduled: c("SCHEDULED"), done: c("COMPLETED") + noShowUsed, completed: c("COMPLETED"), assigned: c("SCHEDULED") + c("COMPLETED") + noShowUsed };
}

/** Sinkronkan status pendaftaran dengan pemakaian slot. */
export async function recomputeRegStatus(tx: Tx, regId: number, s: Settings) {
  const reg = await tx.registration.findUniqueOrThrow({ where: { id: regId } });
  if (!SCHEDULABLE.includes(reg.status) && reg.status !== "COMPLETED") return reg.status;
  const u = await usage(tx, regId, s, reg.hours_snapshot);
  const next = u.done >= u.needed ? "COMPLETED" : u.done > 0 ? "IN_PROGRESS" : u.assigned >= u.needed ? "SCHEDULED" : "PAID";
  if (next !== reg.status) {
    assertReg(reg.status, next);
    await tx.registration.update({ where: { id: regId }, data: { status: next, ...(u.assigned >= u.needed ? { affected_by_maintenance: false } : {}) } });
  }
  return next;
}

function toEvent(slot: SlotFull, action: SlotEvent["action"], prevReg?: number | null): Omit<SlotEvent, "at"> {
  return {
    type: "slot",
    sim: slot.simulator.code,
    date: ymd(slot.date),
    start: slot.start_time,
    end: slot.end_time,
    status: slot.status,
    action,
    registration_id: slot.registration_id,
    prev_registration_id: prevReg ?? null,
    participant: slot.registration ? shortName(slot.registration.participant.full_name) : null,
    instructor: slot.instructor?.name ?? null,
    reason: slot.maintenance_reason,
  };
}

async function history(tx: Tx, slotId: number, from: SlotStatus, to: SlotStatus, fromReg: number | null, toReg: number | null, by: number | null, note?: string) {
  await tx.slotHistory.create({ data: { slot_id: slotId, from_status: from, to_status: to, from_registration_id: fromReg, to_registration_id: toReg, by, note: note ?? null } });
}

export function slotLabel(slot: { date: Date; start_time: string; end_time: string }, l: "id" | "en" = "id") {
  return `${fmtDate(slot.date, l, { weekday: true })} · ${fmtTime(slot.start_time, l)}–${fmtTime(slot.end_time, l)}`;
}

/** Kandidat modal "Jadwalkan": pendaftaran lunas dengan slot tersisa pada simulator yang sama. */
export async function schedulingQueue(simCode?: string) {
  const s = await getSettings();
  const regs = await db.registration.findMany({
    where: { status: { in: SCHEDULABLE }, ...(simCode ? { simulator: { code: simCode } } : {}) },
    include: { participant: true, package: true, simulator: true, invoices: { where: { status: "PAID" }, orderBy: { paid_at: "desc" }, take: 1 } },
    orderBy: { created_at: "asc" },
  });
  const out = [];
  for (const r of regs) {
    const u = await usage(db, r.id, s, r.hours_snapshot);
    out.push({ reg: r, ...u, remaining: Math.max(0, u.needed - u.assigned), paid_at: r.invoices[0]?.paid_at ?? null });
  }
  return out;
}

/** Langkah 9: admin menjadwalkan slot (opsional isi otomatis slot berikutnya di hari yang sama). */
export async function assignSlots(admin: AdminCtx, opts: { slotId: number; registrationId: number; instructorId: number | null; autofill: boolean; notify: boolean }) {
  const s = await getSettings();
  const now = new Date();
  const { assigned, reg, warnings } = await db.$transaction(async (tx) => {
    const first = await tx.slot.findUnique({ where: { id: opts.slotId }, include: { simulator: true } });
    if (!first) throw new HttpError(404, "Slot tidak ditemukan");
    const reg = await tx.registration.findUnique({ where: { id: opts.registrationId }, include: { participant: true, simulator: true } });
    if (!reg || !SCHEDULABLE.includes(reg.status)) throw new HttpError(409, "Peserta belum lunas / tidak aktif");
    if (reg.simulator_id !== first.simulator_id) throw new HttpError(422, "Simulator slot berbeda dengan paket peserta");
    if (opts.instructorId) {
      const ins = await tx.instructor.findUnique({ where: { id: opts.instructorId } });
      if (!ins || !ins.active || !ins.simulator_codes.includes(first.simulator.code)) throw new HttpError(422, "Instruktur tidak tersedia untuk simulator ini");
    }
    const u = await usage(tx, reg.id, s, reg.hours_snapshot);
    let remaining = u.needed - u.assigned;
    if (remaining <= 0) throw new HttpError(409, "Paket peserta sudah terjadwal penuh");

    const candidates = opts.autofill
      ? await tx.slot.findMany({ where: { simulator_id: first.simulator_id, date: first.date, start_time: { gte: first.start_time }, status: "AVAILABLE" }, orderBy: { start_time: "asc" } })
      : [first];
    const picked = candidates.filter((c) => c.id === first.id || opts.autofill).slice(0, remaining);
    if (!picked.some((p) => p.id === first.id)) throw new HttpError(409, "Slot sudah tidak kosong");

    const assigned: number[] = [];
    for (const sl of picked) {
      if (isPast(sl, now)) {
        if (sl.id === first.id) throw new HttpError(409, "Slot sudah lewat");
        continue;
      }
      if (opts.instructorId) {
        const clash = await tx.slot.count({ where: { instructor_id: opts.instructorId, date: sl.date, start_time: sl.start_time, status: "SCHEDULED", NOT: { id: sl.id } } });
        if (clash) {
          if (sl.id === first.id) throw new HttpError(409, "Instruktur sudah mengajar di slot ini (simulator lain)");
          continue;
        }
      }
      // Optimistic concurrency: hanya berhasil jika slot masih AVAILABLE.
      const r = await tx.slot.updateMany({
        where: { id: sl.id, status: "AVAILABLE" },
        data: { status: "SCHEDULED", registration_id: reg.id, instructor_id: opts.instructorId, updated_by: admin.id, maintenance_reason: null },
      });
      if (r.count !== 1) {
        if (sl.id === first.id) throw new HttpError(409, "Slot baru saja diisi admin lain");
        continue;
      }
      await history(tx, sl.id, "AVAILABLE", "SCHEDULED", null, reg.id, admin.id);
      assigned.push(sl.id);
      if (--remaining <= 0) break;
    }
    await recomputeRegStatus(tx, reg.id, s);
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.assigned", "registration", reg.id, { slots: assigned, instructor: opts.instructorId }, tx);
    const warnings: string[] = [];
    if (reg.participant.medical_valid_until < first.date) warnings.push("medical_expires_before_slot");
    return { assigned, reg, warnings };
  });
  const full = await db.slot.findMany({ where: { id: { in: assigned } }, include: slotInclude });
  for (const sl of full) await publish(toEvent(sl, "assigned"));
  if (opts.notify && reg.schedule_sent_at) await notify("schedule_changed", reg.id);
  return { assigned: assigned.length, name: reg.participant.full_name, warnings };
}

/** Lepas slot (reschedule via WA / pembatalan sesi). Pendaftaran kembali ke antrean. */
export async function releaseSlot(admin: AdminCtx, slotId: number, opts: { reason?: string; notify: boolean }) {
  const s = await getSettings();
  const { slot, regId, schedSent } = await db.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id: slotId }, include: { registration: true } });
    if (!slot || slot.status !== "SCHEDULED" || !slot.registration_id) throw new HttpError(409, "Slot tidak sedang terjadwal");
    assertSlot(slot.status, "AVAILABLE");
    await tx.slot.update({ where: { id: slotId }, data: { status: "AVAILABLE", registration_id: null, instructor_id: null, updated_by: admin.id, reminder_h0_at: null, reminder_h1_at: null } });
    await history(tx, slotId, "SCHEDULED", "AVAILABLE", slot.registration_id, null, admin.id, opts.reason);
    await recomputeRegStatus(tx, slot.registration_id, s);
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.released", "slot", slotId, { registration_id: slot.registration_id, reason: opts.reason }, tx);
    return { slot, regId: slot.registration_id, schedSent: slot.registration?.schedule_sent_at };
  });
  const full = await db.slot.findUniqueOrThrow({ where: { id: slot.id }, include: slotInclude });
  await publish(toEvent(full, "released", regId));
  if (opts.notify && schedSent) await notify("schedule_changed", regId, { extra: { note: opts.reason } });
}

/** E-05: pindahkan slot peserta ke slot kosong lain (instruktur ikut bila cocok). */
export async function moveSlot(admin: AdminCtx, slotId: number, targetId: number, opts: { notify: boolean; instructorId?: number | null }) {
  const s = await getSettings();
  const { regId, schedSent } = await db.$transaction(async (tx) => {
    const src = await tx.slot.findUnique({ where: { id: slotId }, include: { registration: true, simulator: true, instructor: true } });
    const dst = await tx.slot.findUnique({ where: { id: targetId }, include: { simulator: true } });
    if (!src || src.status !== "SCHEDULED" || !src.registration_id) throw new HttpError(409, "Slot asal tidak terjadwal");
    if (!dst || dst.status !== "AVAILABLE") throw new HttpError(409, "Slot tujuan tidak kosong");
    if (isPast(dst)) throw new HttpError(409, "Slot tujuan sudah lewat");
    if (dst.simulator_id !== src.simulator_id) throw new HttpError(422, "Slot tujuan harus di simulator yang sama");
    const ins = opts.instructorId !== undefined ? opts.instructorId : src.instructor_id;
    if (ins) {
      const clash = await tx.slot.count({ where: { instructor_id: ins, date: dst.date, start_time: dst.start_time, status: "SCHEDULED" } });
      if (clash) throw new HttpError(409, "Instruktur bentrok di slot tujuan");
    }
    const r = await tx.slot.updateMany({ where: { id: dst.id, status: "AVAILABLE" }, data: { status: "SCHEDULED", registration_id: src.registration_id, instructor_id: ins, updated_by: admin.id } });
    if (r.count !== 1) throw new HttpError(409, "Slot tujuan baru saja diisi");
    await tx.slot.update({ where: { id: src.id }, data: { status: "AVAILABLE", registration_id: null, instructor_id: null, updated_by: admin.id, reminder_h0_at: null, reminder_h1_at: null } });
    await history(tx, src.id, "SCHEDULED", "AVAILABLE", src.registration_id, null, admin.id, `Dipindah ke ${ymd(dst.date)} ${dst.start_time}`);
    await history(tx, dst.id, "AVAILABLE", "SCHEDULED", null, src.registration_id, admin.id, `Dipindah dari ${ymd(src.date)} ${src.start_time}`);
    await recomputeRegStatus(tx, src.registration_id, s);
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.moved", "registration", src.registration_id, { from: src.id, to: dst.id }, tx);
    return { regId: src.registration_id, schedSent: src.registration?.schedule_sent_at };
  });
  const [a, b] = await Promise.all([db.slot.findUniqueOrThrow({ where: { id: slotId }, include: slotInclude }), db.slot.findUniqueOrThrow({ where: { id: targetId }, include: slotInclude })]);
  await publish(toEvent(a, "released", regId));
  await publish(toEvent(b, "moved"));
  if (opts.notify && schedSent) await notify("schedule_changed", regId, { extra: { note: `${slotLabel(a)} → ${slotLabel(b)}` } });
}

/** Rentang slot untuk maintenance: tampilkan peserta terdampak dulu (confirm=false), lalu terapkan. */
export async function blockMaintenance(admin: AdminCtx, opts: { simCode: string; date: string; from: string; to: string; reason: string; confirm: boolean }) {
  const s = await getSettings();
  await ensureSlots(opts.date, opts.date, s);
  const slots = await db.slot.findMany({
    where: { simulator: { code: opts.simCode }, date: dateOnly(opts.date), start_time: { gte: opts.from, lt: opts.to } },
    include: slotInclude,
    orderBy: { start_time: "asc" },
  });
  if (!slots.length) throw new HttpError(422, "Tidak ada slot pada rentang tersebut");
  const affected = slots.filter((x) => x.status === "SCHEDULED" && x.registration);
  if (!opts.confirm) {
    return {
      applied: false,
      count: slots.filter((x) => x.status === "AVAILABLE" || x.status === "SCHEDULED").length,
      affected: affected.map((x) => ({ slot: slotLabel(x), name: x.registration!.participant.full_name, reg_no: x.registration!.reg_no })),
    };
  }
  const touched: { id: number; prevReg: number | null }[] = [];
  const affectedRegs = new Set<number>();
  await db.$transaction(async (tx) => {
    for (const sl of slots) {
      if (sl.status !== "AVAILABLE" && sl.status !== "SCHEDULED") continue;
      if (isPast(sl)) continue;
      await tx.slot.update({ where: { id: sl.id }, data: { status: "MAINTENANCE", registration_id: null, instructor_id: null, maintenance_reason: opts.reason, updated_by: admin.id } });
      await history(tx, sl.id, sl.status, "MAINTENANCE", sl.registration_id, null, admin.id, opts.reason);
      touched.push({ id: sl.id, prevReg: sl.registration_id });
      if (sl.registration_id) affectedRegs.add(sl.registration_id);
    }
    for (const rid of affectedRegs) {
      await tx.registration.update({ where: { id: rid }, data: { affected_by_maintenance: true } });
      await recomputeRegStatus(tx, rid, s);
    }
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.maintenance", "simulator", opts.simCode, { date: opts.date, from: opts.from, to: opts.to, reason: opts.reason, affected: [...affectedRegs] }, tx);
  });
  const full = await db.slot.findMany({ where: { id: { in: touched.map((t) => t.id) } }, include: slotInclude });
  for (const sl of full) await publish(toEvent(sl, "maintenance", touched.find((t) => t.id === sl.id)?.prevReg));
  for (const rid of affectedRegs) {
    const r = await db.registration.findUnique({ where: { id: rid } });
    await notify("schedule_changed", rid, { channels: r?.schedule_sent_at ? ["EMAIL", "WA", "DASHBOARD"] : ["WA", "DASHBOARD"], extra: { note: `maintenance ${opts.reason}` } });
  }
  return { applied: true, count: touched.length, affected: [...affectedRegs].length };
}

export async function clearMaintenance(admin: AdminCtx, slotId: number) {
  const slot = await db.$transaction(async (tx) => {
    const sl = await tx.slot.findUnique({ where: { id: slotId } });
    if (!sl || sl.status !== "MAINTENANCE") throw new HttpError(409, "Slot tidak sedang maintenance");
    await tx.slot.update({ where: { id: slotId }, data: { status: "AVAILABLE", maintenance_reason: null, updated_by: admin.id } });
    await history(tx, slotId, "MAINTENANCE", "AVAILABLE", null, null, admin.id);
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.maintenance_cleared", "slot", slotId, {}, tx);
    return sl;
  });
  const full = await db.slot.findUniqueOrThrow({ where: { id: slot.id }, include: slotInclude });
  await publish(toEvent(full, "maintenance_cleared"));
}

/** Langkah 12: tandai hasil sesi. COMPLETED menambah progres; semua selesai → COMPLETED. */
export async function recordResult(admin: AdminCtx, slotId: number, opts: { status: "COMPLETED" | "NO_SHOW" | "CANCELLED"; note?: string; report_key?: string }) {
  const s = await getSettings();
  const { regId, slot } = await db.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!slot || !slot.registration_id) throw new HttpError(409, "Slot tidak memiliki peserta");
    if (!["SCHEDULED", "COMPLETED", "NO_SHOW"].includes(slot.status)) throw new HttpError(409, "Slot tidak bisa ditandai");
    if (!isPast(slot)) throw new HttpError(409, "Sesi belum dimulai");
    assertSlot("SCHEDULED", opts.status); // koreksi hasil (COMPLETED↔NO_SHOW) diperbolehkan
    await tx.slot.update({ where: { id: slotId }, data: { status: opts.status, result_note: opts.note ?? null, report_storage_key: opts.report_key ?? slot.report_storage_key, updated_by: admin.id } });
    await history(tx, slotId, slot.status, opts.status, slot.registration_id, slot.registration_id, admin.id, opts.note);
    await recomputeRegStatus(tx, slot.registration_id, s);
    await logActivity({ type: "ADMIN", id: admin.id }, "slot.result", "slot", slotId, { status: opts.status }, tx);
    return { regId: slot.registration_id, slot };
  });
  const full = await db.slot.findUniqueOrThrow({ where: { id: slotId }, include: slotInclude });
  await publish(toEvent(full, "result"));
  const reg = await db.registration.findUniqueOrThrow({ where: { id: regId }, include: { participant: true } });
  const l = reg.participant.locale;
  const statusLabel = { COMPLETED: l === "id" ? "Selesai" : "Completed", NO_SHOW: l === "id" ? "Tidak hadir" : "No-show", CANCELLED: l === "id" ? "Dibatalkan" : "Cancelled" }[opts.status];
  await notify("session_completed", regId, { channels: opts.status === "COMPLETED" ? ["EMAIL", "DASHBOARD"] : ["DASHBOARD"], extra: { slotLabel: slotLabel(slot, l), resultStatus: statusLabel, note: opts.note } });
}

/** Lepas semua slot mendatang milik pendaftaran (pembatalan). Mengembalikan event untuk dipublish setelah commit. */
export async function releaseFutureSlots(tx: Tx, regId: number, by: number, note: string) {
  const now = new Date();
  const slots = await tx.slot.findMany({ where: { registration_id: regId, status: "SCHEDULED" }, include: slotInclude });
  const events: Omit<SlotEvent, "at">[] = [];
  for (const sl of slots) {
    if (isPast(sl, now)) continue;
    await tx.slot.update({ where: { id: sl.id }, data: { status: "AVAILABLE", registration_id: null, instructor_id: null, updated_by: by } });
    await history(tx, sl.id, "SCHEDULED", "AVAILABLE", regId, null, by, note);
    events.push({ ...toEvent({ ...sl, status: "AVAILABLE", registration_id: null, registration: null, instructor: null }, "released", regId) });
  }
  return events;
}

/** Langkah 10: kirim email jadwal + link dashboard + .ics (boleh parsial). */
export async function sendSchedule(admin: AdminCtx, regId: number) {
  const s = await getSettings();
  const reg = await db.registration.findUnique({ where: { id: regId }, include: { participant: true } });
  if (!reg || !SCHEDULABLE.includes(reg.status)) throw new HttpError(409, "Pendaftaran tidak aktif");
  const u = await usage(db, regId, s, reg.hours_snapshot);
  if (u.assigned === 0) throw new HttpError(409, "Belum ada slot terjadwal");
  const first = !reg.schedule_sent_at;
  await notify(first ? "schedule_assigned" : "schedule_changed", regId, { extra: { partial: u.assigned < u.needed } });
  await db.registration.update({ where: { id: regId }, data: { schedule_sent_at: new Date() } });
  await logActivity({ type: "ADMIN", id: admin.id }, "schedule.sent", "registration", regId, { partial: u.assigned < u.needed, slots: u.assigned });
  await publish({ type: "admin", kind: "registration", id: regId });
  return { email: reg.participant.email, partial: u.assigned < u.needed };
}

export const TODAY = () => todayJkt();
