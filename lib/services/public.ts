import "server-only";
import { db } from "../db";
import { getSettings, isWorkDay, slotStarts } from "../settings";
import { addDays, dateOnly, todayJkt, ymd } from "../format";
import { ensureSlots, isPast } from "./slots";
import { viewStatus, type ViewStatus } from "../slot-view";

/** Papan publik hari ini: per jam × simulator, tanpa nama. */
export async function todayBoard() {
  const s = await getSettings();
  const today = todayJkt();
  await ensureSlots(today, today, s);
  const sims = await db.simulator.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const slots = await db.slot.findMany({ where: { date: dateOnly(today) }, include: { simulator: true } });
  const closed = !isWorkDay(s, today);
  const rows = (closed ? [] : slotStarts(s)).map((t) => ({
    start: t.start,
    end: t.end,
    cells: Object.fromEntries(
      sims.map((sim) => {
        const sl = slots.find((x) => x.simulator_id === sim.id && x.start_time === t.start);
        const v: ViewStatus | "past" = !sl ? "free" : isPast(sl) && sl.status === "AVAILABLE" ? "past" : viewStatus(sl.status, sl.registration_id);
        return [sim.code, v];
      }),
    ) as Record<string, ViewStatus | "past">,
  }));
  return { date: today, closed, sims: sims.map((x) => x.code), rows, settings: { slot_minutes: s.slot_minutes, ops_start: s.ops_start, ops_end: s.ops_end, work_days: s.work_days } };
}
export type TodayBoard = Awaited<ReturnType<typeof todayBoard>>;

export async function activePackages() {
  return db.package.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
}

/**
 * Ketersediaan per tanggal untuk kalender preferensi di form (CR-04): besok s/d horizon slot.
 * Tanpa nama/detail — hanya jumlah sesi yang masih kosong per hari kerja.
 */
export async function availabilityDays(simCode: string) {
  const s = await getSettings();
  const from = addDays(todayJkt(), 1);
  const to = addDays(todayJkt(), s.slot_horizon_days);
  const sim = await db.simulator.findFirst({ where: { code: simCode, active: true } });
  const starts = slotStarts(s).map((x) => x.start);
  const taken = sim
    ? await db.slot.groupBy({
        by: ["date"],
        where: { simulator_id: sim.id, date: { gte: dateOnly(from), lte: dateOnly(to) }, start_time: { in: starts }, status: { not: "AVAILABLE" } },
        _count: { _all: true },
      })
    : [];
  const takenBy = new Map(taken.map((x) => [ymd(x.date), x._count._all]));
  const days: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkDay(s, d)) days[d] = Math.max(0, starts.length - (takenBy.get(d) ?? 0));
  return { from, to, perDay: starts.length, days };
}
export type AvailabilityDays = Awaited<ReturnType<typeof availabilityDays>>;
