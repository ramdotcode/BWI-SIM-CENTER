import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { resendInvoice } from "@/lib/services/invoices";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  await resendInvoice(Number((await params).id), a);
  return json({ ok: true });
});
