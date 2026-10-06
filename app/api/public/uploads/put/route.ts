import { handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { verifyPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { sanitizeUpload, tooLarge, uploadLimit } from "@/lib/uploads";

export const runtime = "nodejs";

export const PUT = handler(async (req: Request) => {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const p = verifyPayload<{ id: string; kind: string; name: string }>(t);
  if (!p) throw new HttpError(403, "URL unggah tidak valid atau kedaluwarsa");
  if (await db.pendingUpload.findUnique({ where: { id: p.id } })) throw new HttpError(409, "URL unggah sudah dipakai");
  const len = Number(req.headers.get("content-length") ?? 0);
  const lim = await uploadLimit();
  if (len > lim.bytes) throw tooLarge(lim.mb);
  const buf = Buffer.from(await req.arrayBuffer());
  const clean = await sanitizeUpload(buf, { allowPdf: true });
  const key = `pending/${p.id}.${clean.ext}`;
  await storage.put(key, clean.data, clean.mime);
  // Dokumen peserta, bukti bayar/refund, dan laporan sesi semuanya masuk PendingUpload lalu "diklaim" oleh aksi terkait.
  await db.pendingUpload.create({ data: { id: p.id, kind: p.kind, storage_key: key, original_name: p.name, mime: clean.mime, size: clean.data.length } });
  return json({ id: p.id, name: p.name, size: clean.data.length, mime: clean.mime, purpose: p.kind });
});
