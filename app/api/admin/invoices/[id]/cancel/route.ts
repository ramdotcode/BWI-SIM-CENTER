import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelRegistration } from "@/lib/services/registrations";
import { claimUpload } from "@/lib/claim";

/** E-09: batalkan pendaftaran dari sisi invoice (+refund opsional). */
export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ reason: z.string().trim().min(3).max(500), refund_amount: z.number().min(0).optional(), refund_at: z.string().optional(), refund_upload: z.string().optional() }));
  const inv = await db.invoice.findUnique({ where: { id: Number((await params).id) } });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  if (b.refund_amount && b.refund_amount > Number(inv.amount_received ?? inv.total)) throw new HttpError(422, "Refund melebihi nominal yang diterima");
  const key = await claimUpload(b.refund_upload, ["REFUND_PROOF"]);
  await cancelRegistration(inv.registration_id, a, { reason: b.reason, refund_amount: b.refund_amount || undefined, refund_at: b.refund_at, refund_proof_key: key });
  return json({ ok: true });
});
