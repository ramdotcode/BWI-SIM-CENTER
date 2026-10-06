import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { reactivateInvoice } from "@/lib/services/invoices";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const b = await body(req, z.object({ due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }));
  return json(await reactivateInvoice(Number((await params).id), a, b.due));
});
