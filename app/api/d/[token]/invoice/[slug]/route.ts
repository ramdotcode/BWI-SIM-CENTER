import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { participantFromToken } from "@/lib/participant";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { invFromSlug } from "@/lib/ui";

export const runtime = "nodejs";
export const GET = handler(async (req: Request, { params }: { params: Promise<{ token: string; slug: string }> }) => {
  const p = await params;
  const t = await participantFromToken(req.headers, p.token);
  const no = invFromSlug(p.slug.replace(/\.pdf$/, ""));
  const inv = await db.invoice.findUnique({ where: { invoice_no: no }, include: { registration: { include: { participant: true } } } });
  if (!inv || inv.registration_id !== t.registration_id) throw new HttpError(404, "Invoice tidak ditemukan");
  const pdf = await renderInvoicePdf(inv.id, inv.registration.participant.locale);
  const dl = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `${dl ? "attachment" : "inline"}; filename="${p.slug.replace(/\.pdf$/, "")}.pdf"`, "cache-control": "private, no-store" } });
});
