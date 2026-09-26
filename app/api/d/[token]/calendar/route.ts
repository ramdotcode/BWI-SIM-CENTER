import { handler, json } from "@/lib/api";
import { participantFromToken } from "@/lib/participant";
import { clampWeek, participantWeek } from "@/lib/services/dashboard";
import { todayJkt } from "@/lib/format";

export const dynamic = "force-dynamic";
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const t = await participantFromToken(req.headers, (await params).token);
  const u = new URL(req.url);
  const sim = u.searchParams.get("sim") === "B737" ? "B737" : "A320";
  return json(await participantWeek(sim, clampWeek(u.searchParams.get("week"), todayJkt()), t.registration_id));
});
