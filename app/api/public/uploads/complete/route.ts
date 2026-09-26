import { handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { verifyPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, sanitizeUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/** Tahap 2 unggahan langsung ke R2: validasi file mentah lalu simpan versi bersih. */
export const POST = handler(async (req: Request) => {
  const p = verifyPayload<{ id: string; kind: string; name: string }>(new URL(req.url).searchParams.get("t") ?? "");
  if (!p) throw new HttpError(403, "URL unggah tidak valid atau kedaluwarsa");
  if (await db.pendingUpload.findUnique({ where: { id: p.id } })) throw new HttpError(409, "Unggahan sudah diproses");
  const rawKey = `incoming/${p.id}`;
  const raw = await storage.get(rawKey).catch(() => {
    throw new HttpError(404, "File belum terunggah");
  });
  try {
    if (raw.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "Ukuran file melebihi 5 MB");
    const clean = await sanitizeUpload(raw, { allowPdf: true });
    const key = `pending/${p.id}.${clean.ext}`;
    await storage.put(key, clean.data, clean.mime);
    await db.pendingUpload.create({ data: { id: p.id, kind: p.kind, storage_key: key, original_name: p.name, mime: clean.mime, size: clean.data.length } });
    return json({ id: p.id, name: p.name, size: clean.data.length, mime: clean.mime, purpose: p.kind });
  } finally {
    await storage.remove(rawKey).catch(() => {});
  }
});
