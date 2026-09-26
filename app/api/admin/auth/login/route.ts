import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { assertSameOrigin, checkPassword, dummyHash, HttpError, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export const POST = handler(async (req: Request) => {
  await assertSameOrigin();
  const b = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }));
  const rl = rateLimit(`login:${clientIp(req.headers)}:${b.email}`, 8, 15 * 60_000);
  if (!rl.ok) throw new HttpError(429, `locked:${rl.retryAfter}`, "locked");
  const a = await db.adminUser.findUnique({ where: { email: b.email } });
  // Selalu jalankan bcrypt agar waktu respons tidak membocorkan keberadaan email.
  const ok = await checkPassword(b.password, a?.password_hash ?? (await dummyHash()));
  if (!a || !a.active || !ok) throw new HttpError(401, "bad", "bad_credentials");
  await startSession(a);
  await db.adminUser.update({ where: { id: a.id }, data: { last_login_at: new Date() } });
  await logActivity({ type: "ADMIN", id: a.id }, "admin.login", "admin_user", a.id, { ip: clientIp(req.headers) });
  return json({ ok: true, role: a.role });
});
