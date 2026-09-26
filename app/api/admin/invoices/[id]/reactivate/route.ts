import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { reactivateInvoice } from "@/lib/services/invoices";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  return json(await reactivateInvoice(Number((await params).id), a));
});
