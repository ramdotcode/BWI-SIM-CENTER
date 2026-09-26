import { handler, json } from "@/lib/api";
import { participantFromToken } from "@/lib/participant";
import { participantDashboard } from "@/lib/services/dashboard";

export const dynamic = "force-dynamic";
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const t = await participantFromToken(req.headers, (await params).token);
  const l = new URL(req.url).searchParams.get("l") === "en" ? "en" : "id";
  return json(await participantDashboard(t.registration_id, l));
});
