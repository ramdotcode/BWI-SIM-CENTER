import "server-only";
import { HttpError } from "./auth";
import { clientIp, rateLimit } from "./rate-limit";
import { resolveToken } from "./tokens";

/** Validasi magic link + rate limit (60 req/menit/IP). */
export async function participantFromToken(headers: Headers, token: string, touch = false) {
  const rl = rateLimit(`d:${clientIp(headers)}`, 60, 60_000);
  if (!rl.ok) throw new HttpError(429, "Terlalu banyak permintaan");
  const t = await resolveToken(decodeURIComponent(token), "DASHBOARD", touch);
  if (!t) throw new HttpError(404, "Link tidak valid atau sudah dicabut");
  return t;
}
