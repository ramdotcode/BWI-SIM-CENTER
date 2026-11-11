import { handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

/** Hapus pengeluaran (Super Admin). Isi catatan disimpan di activity_log. */
export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const e = await db.expense.findUnique({ where: { id: Number((await params).id) } });
  if (!e) throw new HttpError(404, "Pengeluaran tidak ditemukan");
  await db.expense.delete({ where: { id: e.id } });
  if (e.receipt_key) await storage.remove(e.receipt_key).catch(() => {});
  await logActivity({ type: "ADMIN", id: a.id }, "expense.deleted", "expense", e.id, { spent_on: e.spent_on.toISOString().slice(0, 10), category: e.category, description: e.description, payee: e.payee, amount: Number(e.amount), had_receipt: !!e.receipt_key });
  return json({ ok: true });
});
