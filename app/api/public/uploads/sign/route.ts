import { z } from "zod";
import { randomUUID } from "node:crypto";
import { body, handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { signPayload } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ALL_DOC_KINDS } from "@/lib/schemas";
import { tooLarge, uploadLimit } from "@/lib/uploads";
import { storage } from "@/lib/storage";

const schema = z.object({
  kind: z.enum([...ALL_DOC_KINDS, "PAYMENT_PROOF", "REFUND_PROOF", "SESSION_REPORT"]),
  name: z.string().min(1).max(200),
  size: z.number().int().positive(),
  mime: z.string().max(100),
});

/**
 * URL unggah bertanda tangan (10 menit).
 * - local: browser PUT ke /api/public/uploads/put (server memvalidasi langsung).
 * - s3 (R2, Vercel): browser PUT langsung ke bucket (key "incoming/…"), lalu POST /complete →
 *   server mengambil file, mime sniffing + strip EXIF, menyimpan versi bersih, menghapus file mentah.
 */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`sign:${clientIp(req.headers)}`, 60, 10 * 60_000);
  if (!rl.ok) throw new HttpError(429, "Terlalu banyak unggahan, coba lagi nanti");
  const b = await body(req, schema);
  const lim = await uploadLimit();
  if (b.size > lim.bytes) throw tooLarge(lim.mb);
  if (!["image/jpeg", "image/png", "application/pdf"].includes(b.mime)) throw new HttpError(415, "Format harus JPG, PNG, atau PDF");
  const id = randomUUID();
  const t = signPayload({ id, kind: b.kind, name: b.name.slice(0, 120), mime: b.mime, size: b.size }, 600);
  if (storage.mode === "s3" && storage.presignPut) {
    const url = await storage.presignPut(`incoming/${id}`, b.mime, b.size);
    return json({ id, mode: "direct", url, complete: `/api/public/uploads/complete?t=${encodeURIComponent(t)}` });
  }
  return json({ id, mode: "server", url: `/api/public/uploads/put?t=${encodeURIComponent(t)}` });
});
