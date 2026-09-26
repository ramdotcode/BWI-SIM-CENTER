import { setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { mondayOf, todayJkt, ymd } from "@/lib/format";
import { adminQueue, adminWeek, instructorLoad } from "@/lib/services/admin-schedule";
import { ScheduleBoard } from "@/components/admin/ScheduleBoard";

export default async function Jadwal({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const s = await getSettings();
  const today = todayJkt();
  const regId = sp.reg ? Number(sp.reg) : null;
  const reg = regId ? await db.registration.findUnique({ where: { id: regId }, include: { simulator: true } }) : null;
  const sim = sp.sim === "B737" || sp.sim === "A320" ? sp.sim : (reg?.simulator.code ?? "A320");
  const prefFrom = reg?.pref_date_from ? ymd(reg.pref_date_from) : null;
  const monday = mondayOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : prefFrom && prefFrom > today ? prefFrom : today);
  const [week, queue, load, all] = await Promise.all([adminWeek(sim, monday), adminQueue(), instructorLoad(monday), db.instructor.findMany({ where: { active: true }, orderBy: { name: "asc" } })]);
  return (
    <ScheduleBoard
      initialWeek={JSON.parse(JSON.stringify(week))}
      initialQueue={queue}
      initialInstructors={load}
      allInstructors={all.map((i) => ({ id: i.id, name: i.name, sims: i.simulator_codes, slots: 0 }))}
      today={today}
      slotMinutes={s.slot_minutes}
      initialReg={reg?.id ?? null}
      reportEnabled={s.session_report_enabled}
    />
  );
}
