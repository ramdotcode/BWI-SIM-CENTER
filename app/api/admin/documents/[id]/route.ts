import { handler } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { logDocumentAccess } from "@/lib/services/registrations";
import { rateLimit } from "@/lib/rate-limit";

/** Akses dokumen identitas oleh admin: dicatat di activity_log, redirect ke URL bertanda tangan 5 menit. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const doc = await db.document.findUnique({ where: { id: Number((await params).id) } });
  if (!doc) throw new HttpError(404, "Dokumen tidak ditemukan");
  // Catat maksimal sekali per 10 menit per admin per dokumen (thumbnail + zoom tidak membanjiri log).
  if (rateLimit(`doclog:${a.id}:${doc.id}`, 1, 10 * 60_000).ok) await logDocumentAccess(a, doc.id, doc.registration_id);
  return Response.redirect(new URL(await storage.signedUrl(doc.storage_key, 300, { mime: doc.mime }), req.url), 302);
});
