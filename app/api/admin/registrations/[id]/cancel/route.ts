import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { cancelRegistration } from "@/lib/services/registrations";
import { claimUpload } from "@/lib/claim";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ reason: z.string().trim().min(3).max(500), refund_amount: z.number().min(0).optional(), refund_at: z.string().optional(), refund_upload: z.string().optional() }));
  const key = await claimUpload(b.refund_upload, ["REFUND_PROOF"]);
  await cancelRegistration(Number((await params).id), a, { reason: b.reason, refund_amount: b.refund_amount || undefined, refund_at: b.refund_at, refund_proof_key: key });
  return json({ ok: true });
});
