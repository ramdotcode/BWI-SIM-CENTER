import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { approveRegistration } from "@/lib/services/registrations";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const id = Number((await params).id);
  const inv = await approveRegistration(id, a);
  const r = await db.registration.findUniqueOrThrow({ where: { id }, include: { participant: true } });
  return json({ invoice_no: inv.invoice_no, email: r.participant.email });
});
