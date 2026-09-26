import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { adminWeek, instructorLoad } from "@/lib/services/admin-schedule";
import { mondayOf, todayJkt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const GET = handler(async (req: Request) => {
  await requireAdminApi(req);
  const u = new URL(req.url);
  const sim = u.searchParams.get("sim") === "B737" ? "B737" : "A320";
  const w = u.searchParams.get("week");
  const monday = mondayOf(w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayJkt());
  const [week, instructors] = await Promise.all([adminWeek(sim, monday), instructorLoad(monday)]);
  return json({ week, instructors });
});
