import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { storage, verifyFileToken } from "@/lib/storage";
import { fileTypeFromBuffer } from "file-type";

export const runtime = "nodejs";

/** Penyajian file privat (driver local) lewat URL bertanda tangan ≤ 5 menit. */
export const GET = handler(async (req: Request) => {
  const p = verifyFileToken(new URL(req.url).searchParams.get("t") ?? "");
  if (!p) throw new HttpError(403, "Tautan file tidak valid atau kedaluwarsa");
  const buf = await storage.get(p.k).catch(() => {
    throw new HttpError(404, "File tidak ditemukan");
  });
  const mime = p.m ?? (await fileTypeFromBuffer(buf))?.mime ?? "application/octet-stream";
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-disposition": p.d ? `attachment; filename="${p.d.replace(/"/g, "")}"` : "inline",
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
});
