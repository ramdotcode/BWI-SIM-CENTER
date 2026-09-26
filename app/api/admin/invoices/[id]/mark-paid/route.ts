import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { markPaid } from "@/lib/services/invoices";
import { claimUpload } from "@/lib/claim";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ amount: z.number().positive(), paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), proof_upload: z.string().optional(), note: z.string().max(500).optional(), accept_difference: z.boolean().optional() }));
  const key = await claimUpload(b.proof_upload, ["PAYMENT_PROOF"]);
  return json(await markPaid(Number((await params).id), a, { amount: b.amount, paid_at: b.paid_at, proof_key: key, note: b.note || undefined, accept_difference: b.accept_difference }));
});
