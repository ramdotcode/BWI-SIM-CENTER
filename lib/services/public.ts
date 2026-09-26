import "server-only";
import { db } from "../db";
import { getSettings, slotStarts } from "../settings";
import { dateOnly, todayJkt } from "../format";
import { ensureSlots, isPast } from "./slots";
import { viewStatus, type ViewStatus } from "../slot-view";

/** Papan publik hari ini: per jam × simulator, tanpa nama. */
export async function todayBoard() {
  const s = await getSettings();
  const today = todayJkt();
  await ensureSlots(today, today, s);
  const sims = await db.simulator.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const slots = await db.slot.findMany({ where: { date: dateOnly(today) }, include: { simulator: true } });
  const rows = slotStarts(s).map((t) => ({
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
  return { date: today, sims: sims.map((x) => x.code), rows, settings: { slot_minutes: s.slot_minutes, ops_start: s.ops_start, ops_end: s.ops_end } };
}
export type TodayBoard = Awaited<ReturnType<typeof todayBoard>>;

export async function activePackages() {
  return db.package.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
}
