import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/** Tandai pesan WA manual (Q7 fase 1) sudah dikirim admin. */
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const id = Number((await params).id);
  await db.notification.update({ where: { id, channel: "WA" }, data: { status: "SENT", sent_at: new Date() } });
  await logActivity({ type: "ADMIN", id: a.id }, "notification.wa_sent_manual", "notification", id);
  return json({ ok: true });
});
