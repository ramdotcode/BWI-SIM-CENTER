import "server-only";
import { db } from "../db";
import { getSettings, slotStarts } from "../settings";
import { addDays, dateOnly, mondayOf, todayJkt, ymd } from "../format";
import { viewStatus, type PublicSlot } from "../slot-view";
import { usage, weekSlots, isPast } from "./slots";
import { invSlug } from "../ui";

/** Kalender mingguan dari sudut pandang peserta (atau publik bila mine=null). Tanpa nama peserta lain. */
export async function participantWeek(simCode: string, monday: string, mine: number | null) {
  const s = await getSettings();
  const slots = await weekSlots(simCode, monday);
  const out: (PublicSlot & { past: boolean })[] = slots.map((x) => ({
    sim: simCode,
    date: ymd(x.date),
    start: x.start_time,
    end: x.end_time,
    v: viewStatus(x.status, x.registration_id, mine),
    instructor: mine && x.registration_id === mine && s.show_instructor_to_participant ? (x.instructor?.name ?? null) : null,
    past: isPast(x),
  }));
  return { monday, sim: simCode, times: slotStarts(s), slots: out };
}

export type FeedItem = { at: string; kind: "booked" | "freed" | "maint" | "maint_clear" | "mine" | "note"; sim?: string; date?: string; start?: string; text?: string };

/** Feed aktivitas: perubahan slot terbaru (tersamar) + notifikasi dashboard milik sendiri. */
export async function participantFeed(regId: number, simId: number, locale: "id" | "en" = "id") {
  const since = new Date(Date.now() - 7 * 86400_000);
  const [hist, notes] = await Promise.all([
    db.slotHistory.findMany({
      where: { at: { gte: since }, slot: { simulator_id: simId } },
      include: { slot: { include: { simulator: true } } },
      orderBy: { at: "desc" },
      take: 20,
    }),
    db.notification.findMany({ where: { registration_id: regId, channel: "DASHBOARD" }, orderBy: { created_at: "desc" }, take: 10 }),
  ]);
  const items: FeedItem[] = [];
  for (const h of hist) {
    const base = { at: h.at.toISOString(), sim: h.slot.simulator.code, date: ymd(h.slot.date), start: h.slot.start_time };
    if (h.to_registration_id === regId || h.from_registration_id === regId) continue; // milik sendiri → dari notifikasi
    if (h.to_status === "SCHEDULED") items.push({ ...base, kind: "booked" });
    else if (h.to_status === "MAINTENANCE") items.push({ ...base, kind: "maint" });
    else if (h.from_status === "MAINTENANCE" && h.to_status === "AVAILABLE") items.push({ ...base, kind: "maint_clear" });
    else if (h.to_status === "AVAILABLE") items.push({ ...base, kind: "freed" });
  }
  for (const n of notes) {
    const p = n.payload as Record<string, string | undefined>;
    items.push({ at: n.created_at.toISOString(), kind: "note", text: String(p?.[`text_${locale}`] ?? p?.text ?? "") });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
}

export async function participantDashboard(regId: number, locale: "id" | "en" = "id") {
  const s = await getSettings();
  const reg = await db.registration.findUniqueOrThrow({
    where: { id: regId },
    include: {
      participant: true,
      package: true,
      simulator: true,
      invoices: { orderBy: { issued_at: "desc" } },
      documents: { where: { superseded: false }, orderBy: { kind: "asc" } },
      slots: { where: { status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] } }, include: { instructor: true }, orderBy: [{ date: "asc" }, { start_time: "asc" }] },
    },
  });
  const u = await usage(db, regId, s, reg.hours_snapshot);
  const now = new Date();
  const next = reg.slots.find((x) => x.status === "SCHEDULED" && !isPast(x, now)) ?? null;
  const today = todayJkt();
  const monday = mondayOf(next ? ymd(next.date) : today);
  const [week, feed] = await Promise.all([participantWeek(reg.simulator.code, monday, regId), participantFeed(regId, reg.simulator_id, locale)]);
  const P = reg.participant;
  const inv = reg.invoices.find((i) => i.status !== "CANCELLED") ?? reg.invoices[0] ?? null;
  return {
    today,
    settings: { slot_minutes: s.slot_minutes, ops_start: s.ops_start, ops_end: s.ops_end, wa_admin_number: s.wa_admin_number, show_instructor: s.show_instructor_to_participant, report_enabled: s.session_report_enabled },
    reg: {
      id: reg.id,
      reg_no: reg.reg_no,
      status: reg.status,
      sim: reg.simulator.code,
      bay: reg.simulator.bay,
      level: reg.simulator.level,
      pkg: { id: reg.package.name_id, en: reg.package.name_en, short_id: reg.package.short_id, short_en: reg.package.short_en },
      hours: reg.hours_snapshot,
      schedule_sent: !!reg.schedule_sent_at,
      verified: !["PENDING_VERIFICATION", "REUPLOAD_REQUIRED"].includes(reg.status),
      reupload: reg.status === "REUPLOAD_REQUIRED",
    },
    participant: {
      name: P.full_name,
      email: P.email,
      whatsapp: P.whatsapp,
      licence: `${P.licence_type} · ${P.licence_no}`,
      licence_type: P.licence_type,
      medical: `${P.medical_class} · ${ymd(P.medical_valid_until)}`,
      city: P.city,
    },
    usage: u,
    next: next ? { date: ymd(next.date), start: next.start_time, end: next.end_time, instructor: s.show_instructor_to_participant ? (next.instructor?.name ?? null) : null } : null,
    sessions: reg.slots.map((x) => ({
      id: x.id,
      date: ymd(x.date),
      start: x.start_time,
      end: x.end_time,
      status: x.status,
      instructor: s.show_instructor_to_participant ? (x.instructor?.name ?? null) : null,
      report: s.session_report_enabled && !!x.report_storage_key,
    })),
    invoices: reg.invoices.map((i) => ({ no: i.invoice_no, slug: invSlug(i.invoice_no), status: i.status, total: Number(i.total), issued: i.issued_at.toISOString(), due: i.due_at.toISOString(), paid: i.paid_at?.toISOString() ?? null })),
    invoiceStatus: inv?.status ?? null,
    documents: reg.documents.map((d) => ({ id: d.id, kind: d.kind, name: d.original_name, size: d.size, review: d.review, uploaded: d.uploaded_at.toISOString() })),
    week,
    feed,
  };
}
export type DashboardData = Awaited<ReturnType<typeof participantDashboard>>;

export function clampWeek(week: string | null, today: string) {
  const w = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? mondayOf(week) : mondayOf(today);
  const min = addDays(mondayOf(today), -7 * 8);
  const max = addDays(mondayOf(today), 7 * 14);
  return w < min ? min : w > max ? max : w;
}
export { dateOnly };
