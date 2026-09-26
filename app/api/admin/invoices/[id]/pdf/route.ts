import { handler } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

export const runtime = "nodejs";
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminApi(req);
  const inv = await db.invoice.findUnique({ where: { id: Number((await params).id) }, include: { registration: { include: { participant: true } } } });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  const l = new URL(req.url).searchParams.get("l") === "en" ? "en" : inv.registration.participant.locale;
  const pdf = await renderInvoicePdf(inv.id, l);
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${inv.invoice_no.replaceAll("/", "-")}.pdf"`, "cache-control": "private, no-store" } });
});
