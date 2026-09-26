import "server-only";
import { db } from "../db";
import { getSettings, slotStarts } from "../settings";
import { addDays, dateOnly, shortName, ymd } from "../format";
import { isPast, schedulingQueue, weekSlots } from "./slots";

export async function adminWeek(sim: string, monday: string) {
  const s = await getSettings();
  const slots = await weekSlots(sim, monday);
  return {
    monday,
    sim,
    times: slotStarts(s),
    slots: slots.map((x) => ({
      id: x.id,
      date: ymd(x.date),
      start: x.start_time,
      end: x.end_time,
      status: x.status,
      past: isPast(x),
      reg_id: x.registration_id,
      reg_no: x.registration?.reg_no ?? null,
      name: x.registration ? x.registration.participant.full_name : null,
      short: x.registration ? shortName(x.registration.participant.full_name) : null,
      pkg: x.registration ? `${x.registration.package.short_id} ${x.registration.hours_snapshot}j` : null,
      instructor_id: x.instructor_id,
      instructor: x.instructor?.name ?? null,
      reason: x.maintenance_reason,
      result_note: x.result_note,
      report: !!x.report_storage_key,
      medical_until: x.registration ? ymd(x.registration.participant.medical_valid_until) : null,
    })),
  };
}
export type AdminWeek = Awaited<ReturnType<typeof adminWeek>>;

export async function adminQueue() {
  const q = await schedulingQueue();
  return q.map((x) => ({
    reg_id: x.reg.id,
    reg_no: x.reg.reg_no,
    name: x.reg.participant.full_name,
    email: x.reg.participant.email,
    sim: x.reg.simulator.code,
    pkg: x.reg.package.short_id,
    pkg_en: x.reg.package.short_en,
    hours: x.reg.hours_snapshot,
    needed: x.needed,
    assigned: x.assigned,
    scheduled: x.scheduled,
    done: x.done,
    remaining: x.remaining,
    paid_at: x.paid_at?.toISOString() ?? null,
    pref_from: x.reg.pref_date_from ? ymd(x.reg.pref_date_from) : null,
    pref_to: x.reg.pref_date_to ? ymd(x.reg.pref_date_to) : null,
    pref_time: x.reg.pref_time,
    affected: x.reg.affected_by_maintenance,
    schedule_sent_at: x.reg.schedule_sent_at?.toISOString() ?? null,
    medical_until: ymd(x.reg.participant.medical_valid_until),
    status: x.reg.status,
  }));
}
export type QueueItem = Awaited<ReturnType<typeof adminQueue>>[number];

export async function instructorLoad(monday: string) {
  const ins = await db.instructor.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const counts = await db.slot.groupBy({ by: ["instructor_id"], where: { date: { gte: dateOnly(monday), lte: dateOnly(addDays(monday, 6)) }, status: { in: ["SCHEDULED", "COMPLETED"] }, instructor_id: { not: null } }, _count: true });
  return ins.map((i) => ({ id: i.id, name: i.name, sims: i.simulator_codes, slots: counts.find((c) => c.instructor_id === i.id)?._count ?? 0 }));
}
