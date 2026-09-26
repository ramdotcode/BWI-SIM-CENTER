import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { confirmWa } from "@/lib/services/invoices";
import { claimUpload } from "@/lib/claim";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ at: z.string().optional(), proof_upload: z.string().optional(), note: z.string().max(500).optional() }));
  const key = await claimUpload(b.proof_upload, ["PAYMENT_PROOF"]);
  await confirmWa(Number((await params).id), a, { at: b.at, proof_key: key, note: b.note || undefined });
  return json({ ok: true });
});
