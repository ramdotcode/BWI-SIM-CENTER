import { handler } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";

/** Lihat file tersimpan (bukti transfer/refund, laporan sesi) berdasarkan storage key milik invoice/slot. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminApi(req);
  const [kind, idStr] = decodeURIComponent((await params).id).split(":");
  const id = Number(idStr);
  let key: string | null | undefined;
  if (kind === "proof") key = (await db.invoice.findUnique({ where: { id } }))?.proof_storage_key;
  else if (kind === "refund") key = (await db.invoice.findUnique({ where: { id } }))?.refund_proof_key;
  else if (kind === "report") key = (await db.slot.findUnique({ where: { id } }))?.report_storage_key;
  if (!key) throw new HttpError(404, "File tidak ditemukan");
  return Response.redirect(new URL(await storage.signedUrl(key, 300), req.url), 302);
});
