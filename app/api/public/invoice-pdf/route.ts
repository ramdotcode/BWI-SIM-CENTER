import { handler } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { verifyPayload } from "@/lib/crypto";
import { db } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/pdf/invoice";

export const runtime = "nodejs";

/** Tautan PDF invoice bertanda tangan dari email (berlaku 30 hari). */
export const GET = handler(async (req: Request) => {
  const p = verifyPayload<{ inv: number }>(new URL(req.url).searchParams.get("t") ?? "");
  if (!p) throw new HttpError(403, "Tautan tidak valid atau kedaluwarsa");
  const inv = await db.invoice.findUnique({ where: { id: p.inv }, include: { registration: { include: { participant: true } } } });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  const pdf = await renderInvoicePdf(inv.id, inv.registration.participant.locale);
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${inv.invoice_no.replaceAll("/", "-")}.pdf"`, "cache-control": "private, no-store", "referrer-policy": "no-referrer" } });
});
