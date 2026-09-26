import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { participantFromToken } from "@/lib/participant";
import { storage } from "@/lib/storage";

/** Dokumen milik sendiri saja, via URL bertanda tangan 5 menit. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string; id: string }> }) => {
  const p = await params;
  const t = await participantFromToken(req.headers, p.token);
  const doc = await db.document.findUnique({ where: { id: Number(p.id) } });
  if (!doc || doc.registration_id !== t.registration_id) throw new HttpError(404, "Dokumen tidak ditemukan");
  return Response.redirect(new URL(await storage.signedUrl(doc.storage_key, 300, { mime: doc.mime }), req.url), 302);
});
