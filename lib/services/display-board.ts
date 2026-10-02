import "server-only";
import { db } from "../db";
import { getSettings, isWorkDay, slotStarts } from "../settings";
import { addDays, dateOnly, shortName, todayJkt, wibInstant, ymd } from "../format";
import { ensureSlots } from "./slots";

export type DisplayCellStatus = "free" | "past" | "busy" | "live" | "done" | "noshow" | "maint";
export type DisplayCell = { st: DisplayCellStatus; name?: string | null; instructor?: string | null; pkg?: string | null; reason?: string | null };

/**
 * Data papan Mode Layar: hari ini + beberapa hari kerja berikutnya, per simulator × sesi.
 * Nama peserta, instruktur, paket, dan alasan maintenance hanya dikirim bila link mengizinkan (show_names).
 */
export async function displayBoard(showNames: boolean, upcoming = 4) {
  const s = await getSettings();
  const now = new Date();
  const today = todayJkt();
  const dates = [today];
  for (let d = addDays(today, 1); dates.length < upcoming + 1; d = addDays(d, 1)) if (isWorkDay(s, d)) dates.push(d);
  await ensureSlots(today, dates.at(-1)!, s);

  const [sims, slots] = await Promise.all([
    db.simulator.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.slot.findMany({
      where: { date: { in: dates.map(dateOnly) } },
      // Ramping: layar diambil ulang berkala — kirim hanya kolom yang ditampilkan.
      select: {
        simulator_id: true, date: true, start_time: true, status: true, maintenance_reason: true,
        instructor: { select: { name: true } },
        registration: { select: { participant: { select: { full_name: true } }, package: { select: { short_id: true } } } },
      },
    }),
  ]);
  const times = slotStarts(s);

  const cell = (simId: number, date: string, t: { start: string; end: string }): DisplayCell => {
    const sl = slots.find((x) => x.simulator_id === simId && ymd(x.date) === date && x.start_time === t.start);
    const started = wibInstant(dateOnly(date), t.start) <= now;
    const ended = wibInstant(dateOnly(date), t.end) <= now;
    if (!sl || sl.status === "AVAILABLE" || sl.status === "CANCELLED") return { st: started ? "past" : "free" };
    if (sl.status === "MAINTENANCE") return { st: "maint", reason: showNames ? sl.maintenance_reason : null };
    const who = showNames && sl.registration
      ? { name: shortName(sl.registration.participant.full_name), instructor: sl.instructor?.name ?? null, pkg: sl.registration.package.short_id }
      : {};
    if (sl.status === "COMPLETED") return { st: "done", ...who };
    if (sl.status === "NO_SHOW") return { st: "noshow", ...who };
    return { st: started && !ended ? "live" : "busy", ...who };
  };

  return {
    now: now.toISOString(),
    today,
    showNames,
    sims: sims.map((x) => ({ code: x.code, name: x.name, bay: x.bay })),
    times,
    workDays: s.work_days,
    opsStart: s.ops_start,
    opsEnd: s.ops_end,
    slotHours: s.slot_minutes / 60,
    days: dates.map((date) => ({
      date,
      closed: !isWorkDay(s, date),
      cells: Object.fromEntries(sims.map((sim) => [sim.code, Object.fromEntries(times.map((t) => [t.start, cell(sim.id, date, t)]))])) as Record<string, Record<string, DisplayCell>>,
    })),
  };
}
export type DisplayBoardData = Awaited<ReturnType<typeof displayBoard>>;
