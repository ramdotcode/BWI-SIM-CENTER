import { z } from "zod";
import { randomInt } from "node:crypto";
import { body, handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendOtpEmail } from "@/lib/notify";

/** E-08: peserta lama minta kode OTP ke email untuk prefill. Respons selalu sama (tidak membocorkan keberadaan email). */
export const POST = handler(async (req: Request) => {
  const b = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), locale: z.enum(["id", "en"]).default("id") }));
  const ip = clientIp(req.headers);
  if (!rateLimit(`otp:ip:${ip}`, 10, 60 * 60_000).ok || !rateLimit(`otp:em:${b.email}`, 3, 30 * 60_000).ok) throw new HttpError(429, "Terlalu banyak permintaan kode, coba lagi nanti");
  const exists = await db.participant.findFirst({ where: { email: b.email }, select: { id: true } });
  if (exists) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.otpCode.create({ data: { email: b.email, code_hash: sha256(`${b.email}:${code}`), expires_at: new Date(Date.now() + 10 * 60_000) } });
    await sendOtpEmail(b.email, code, b.locale).catch((e) => console.error("[otp] gagal kirim", e));
  }
  return json({ ok: true });
});
