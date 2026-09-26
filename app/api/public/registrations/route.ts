import { cookies } from "next/headers";
import { body, handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { signPayload } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { registrationSchema } from "@/lib/schemas";
import { submitRegistration } from "@/lib/services/registrations";

export const runtime = "nodejs";

/** Submit formulir 5 langkah (tanpa akun). */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`reg:${clientIp(req.headers)}`, 10, 60 * 60_000);
  if (!rl.ok) throw new HttpError(429, "Terlalu banyak pendaftaran dari perangkat ini, coba lagi nanti");
  const input = await body(req, registrationSchema);
  const r = await submitRegistration(input);
  (await cookies()).set("bwi_submitted", signPayload({ reg: r.reg_no, name: r.name, email: r.email }, 60 * 60), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600, secure: process.env.NODE_ENV === "production" });
  return json({ reg_no: r.reg_no });
});
