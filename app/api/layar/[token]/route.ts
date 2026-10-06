import { handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { resolveDisplay } from "@/lib/display";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { displayBoard } from "@/lib/services/display-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Data papan Mode Layar (tanpa login, token link layar). */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const rl = rateLimit(`layar:${clientIp(req.headers)}`, 60, 60_000);
  if (!rl.ok) throw new HttpError(429, "Terlalu banyak permintaan");
  const link = await resolveDisplay((await params).token, true);
  if (!link) throw new HttpError(404, "Link layar tidak valid atau sudah dicabut");
  return json(await displayBoard(true), { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
});
