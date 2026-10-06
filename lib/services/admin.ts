import "server-only";
import { db } from "../db";
import { getSettings } from "../settings";
import { addDays, dateOnly, mondayOf, nowTimeJkt, todayJkt, ymd } from "../format";
import { schedulingQueue } from "./slots";

export async function homeData() {
  const s = await getSettings();
  const today = todayJkt();
  const mon = mondayOf(today);
  const prevMon = addDays(mon, -7);
  const now = new Date();

  const [pendingVerify, reupload, invoicesOpen, weekSlots, prevWeekSlots, todaySlots, waOutbox, queue] = await Promise.all([
    db.registration.findMany({ where: { status: "PENDING_VERIFICATION" }, include: { participant: true, package: true, simulator: true }, orderBy: { created_at: "asc" } }),
    db.registration.findMany({ where: { status: "REUPLOAD_REQUIRED", reupload_count: { gte: s.reupload_manual_threshold } }, include: { participant: true, package: true, simulator: true } }),
    db.invoice.findMany({ where: { status: { in: ["UNPAID", "AWAITING_VERIFICATION", "OVERDUE", "EXPIRED"] } }, include: { registration: { include: { participant: true, package: true, simulator: true } } }, orderBy: { issued_at: "asc" } }),
    db.slot.findMany({ where: { date: { gte: dateOnly(mon), lte: dateOnly(addDays(mon, 6)) } }, include: { simulator: true } }),
    db.slot.findMany({ where: { date: { gte: dateOnly(prevMon), lte: dateOnly(addDays(prevMon, 6)) } }, select: { status: true } }),
    db.slot.findMany({
      where: { date: dateOnly(today), status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW", "MAINTENANCE"] } },
      include: { simulator: true, instructor: true, registration: { include: { participant: true } } },
      orderBy: [{ start_time: "asc" }, { simulator_id: "asc" }],
    }),
    db.notification.findMany({ where: { channel: "WA", status: "MANUAL" }, include: { registration: { include: { participant: true } } }, orderBy: { created_at: "desc" }, take: 12 }),
    schedulingQueue(),
  ]);

  const busy = (st: string) => ["SCHEDULED", "COMPLETED", "NO_SHOW"].includes(st);
  const util = (xs: { status: string }[]) => {
    const cap = xs.filter((x) => x.status !== "MAINTENANCE").length;
    return cap ? xs.filter((x) => busy(x.status)).length / cap : 0;
  };
  const u = util(weekSlots);
  const up = util(prevWeekSlots);
  const unpaid = invoicesOpen.filter((i) => ["UNPAID", "AWAITING_VERIFICATION", "OVERDUE"].includes(i.status));

  type Row = { key: string; name: string; ref: string; stage: string; pill: string; sim: string; pkg: string; hours: number; since: Date; href: string; action: "check" | "follow" | "view" | "schedule" };
  const rows: Row[] = [];
  for (const r of pendingVerify) rows.push({ key: `v${r.id}`, name: r.participant.full_name, ref: r.reg_no, stage: "stageVerify", pill: "warn", sim: r.simulator.code, pkg: r.package.short_id, hours: r.hours_snapshot, since: r.created_at, href: `/admin/verifikasi?reg=${r.id}`, action: "check" });
  for (const r of reupload) rows.push({ key: `r${r.id}`, name: r.participant.full_name, ref: r.reg_no, stage: "stageReupload", pill: "bad", sim: r.simulator.code, pkg: r.package.short_id, hours: r.hours_snapshot, since: r.updated_at, href: `/admin/verifikasi?reg=${r.id}`, action: "follow" });
  for (const i of invoicesOpen) {
    const r = i.registration;
    const map = { UNPAID: ["stagePay", "info", "view"], AWAITING_VERIFICATION: ["stageAwait", "warn", "check"], OVERDUE: ["stageOverdue", "bad", "follow"], EXPIRED: ["stageExpired", "bad", "follow"] } as const;
    const [stage, pill, action] = map[i.status as keyof typeof map];
    if (i.status === "UNPAID") continue; // menunggu peserta, belum perlu tindakan admin
    rows.push({ key: `i${i.id}`, name: r.participant.full_name, ref: i.invoice_no.replace("BWI/", ""), stage, pill, sim: r.simulator.code, pkg: r.package.short_id, hours: r.hours_snapshot, since: i.wa_confirmed_at ?? i.overdue_at ?? i.due_at, href: `/admin/pembayaran?inv=${i.id}`, action });
  }
  for (const q of queue) {
    if (q.remaining > 0) rows.push({ key: `q${q.reg.id}`, name: q.reg.participant.full_name, ref: q.reg.reg_no, stage: "stageSchedule", pill: "ok", sim: q.reg.simulator.code, pkg: q.reg.package.short_id, hours: q.reg.hours_snapshot, since: q.paid_at ?? q.reg.updated_at, href: `/admin/jadwal?reg=${q.reg.id}`, action: "schedule" });
    else if (!q.reg.schedule_sent_at && q.scheduled > 0) rows.push({ key: `s${q.reg.id}`, name: q.reg.participant.full_name, ref: q.reg.reg_no, stage: "stageSend", pill: "teal", sim: q.reg.simulator.code, pkg: q.reg.package.short_id, hours: q.reg.hours_snapshot, since: q.reg.updated_at, href: `/admin/jadwal?reg=${q.reg.id}`, action: "schedule" });
  }
  rows.sort((a, b) => a.since.getTime() - b.since.getTime());

  const nowT = nowTimeJkt();
  return {
    kpi: {
      verify: pendingVerify.length,
      verifyOldest: pendingVerify[0]?.created_at ?? null,
      payCount: unpaid.length,
      paySum: unpaid.reduce((a, i) => a + Number(i.total), 0),
      overdue: invoicesOpen.filter((i) => i.status === "OVERDUE").length,
      weekA: weekSlots.filter((x) => busy(x.status) && x.simulator.code === "A320").length,
      weekB: weekSlots.filter((x) => busy(x.status) && x.simulator.code === "B737").length,
      util: Math.round(u * 100),
      utilDelta: Math.round((u - up) * 100),
    },
    rows,
    today: todaySlots.map((x) => ({
      id: x.id,
      sim: x.simulator.code,
      start: x.start_time,
      end: x.end_time,
      status: x.status,
      phase: x.status === "MAINTENANCE" ? "maint" : x.status !== "SCHEDULED" ? "done" : nowT >= x.end_time ? "done" : nowT >= x.start_time ? "live" : "upcoming",
      who: x.registration?.participant.full_name ?? null,
      instructor: x.instructor?.name ?? null,
      reason: x.maintenance_reason,
      block_kind: x.block_kind,
    })),
    wa: waOutbox.map((n) => ({ id: n.id, template: n.template, name: n.registration?.participant.full_name ?? "", reg: n.registration?.reg_no ?? "", at: n.created_at, link: String((n.payload as { link?: string })?.link ?? ""), text: String((n.payload as { text?: string })?.text ?? "") })),
    now,
    date: ymd(dateOnly(today)),
  };
}
