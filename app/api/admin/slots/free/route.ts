import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, dateOnly, todayJkt, ymd } from "@/lib/format";
import { ensureSlots, isPast } from "@/lib/services/slots";

/** Slot kosong mendatang (14 hari) untuk tujuan "Pindahkan". */
export const GET = handler(async (req: Request) => {
  await requireAdminApi(req);
  const u = new URL(req.url);
  const sim = u.searchParams.get("sim") === "B737" ? "B737" : "A320";
  const from = u.searchParams.get("from") ?? todayJkt();
  const to = addDays(from, 14);
  await ensureSlots(from, to);
  const slots = await db.slot.findMany({ where: { simulator: { code: sim }, status: "AVAILABLE", date: { gte: dateOnly(from), lte: dateOnly(to) } }, orderBy: [{ date: "asc" }, { start_time: "asc" }] });
  return json(slots.filter((x) => !isPast(x)).map((x) => ({ id: x.id, date: ymd(x.date), start: x.start_time, end: x.end_time })));
});
