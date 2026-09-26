import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { participantFromToken } from "@/lib/participant";
import { storage } from "@/lib/storage";
import { getSettings } from "@/lib/settings";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string; slotId: string }> }) => {
  const p = await params;
  const t = await participantFromToken(req.headers, p.token);
  const s = await getSettings();
  const slot = await db.slot.findUnique({ where: { id: Number(p.slotId) } });
  if (!s.session_report_enabled || !slot || slot.registration_id !== t.registration_id || !slot.report_storage_key) throw new HttpError(404, "Laporan tidak ditemukan");
  return Response.redirect(new URL(await storage.signedUrl(slot.report_storage_key, 300, { mime: "application/pdf" }), req.url), 302);
});
