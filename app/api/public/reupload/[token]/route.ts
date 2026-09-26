import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { resolveToken } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { submitReupload } from "@/lib/services/registrations";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  if (!rateLimit(`reup:${clientIp(req.headers)}`, 20, 60 * 60_000).ok) throw new HttpError(429, "Terlalu banyak permintaan");
  const t = await resolveToken(decodeURIComponent((await params).token), "REUPLOAD");
  if (!t) throw new HttpError(404, "Link tidak valid atau kedaluwarsa");
  const b = await body(req, z.object({ files: z.record(z.string(), z.string()) }));
  await submitReupload(t.id, t.registration_id, b.files);
  return json({ ok: true });
});
