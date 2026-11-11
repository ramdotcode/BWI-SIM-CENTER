import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { claimUpload } from "@/lib/claim";
import { storage } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { dateOnly } from "@/lib/format";

export const runtime = "nodejs";

const schema = z.object({
  id: z.number().int().positive().optional(),
  spent_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(2).max(300),
  payee: z.string().trim().max(120).optional(),
  amount: z.number().int().positive().max(1e13),
  receipt_upload: z.string().optional(),
  remove_receipt: z.boolean().optional(),
});

/** Catat / ubah pengeluaran (Super Admin). Lampiran nota opsional (unggah EXPENSE_RECEIPT). */
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const b = await body(req, schema);
  const d = dateOnly(b.spent_on);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2020) throw new HttpError(422, "Tanggal tidak valid");
  const old = b.id ? await db.expense.findUnique({ where: { id: b.id } }) : null;
  if (b.id && !old) throw new HttpError(404, "Pengeluaran tidak ditemukan");
  // Kategori dari daftar di Pengaturan; kategori lama pada catatan yang diedit tetap boleh.
  const cats = (await getSettings()).expense_categories;
  if (!cats.includes(b.category) && old?.category !== b.category) throw new HttpError(422, "Kategori tidak ada di daftar (Pengaturan → Keuangan)");
  const key = await claimUpload(b.receipt_upload, ["EXPENSE_RECEIPT"]);
  const receiptName = key ? (await db.pendingUpload.findUnique({ where: { id: b.receipt_upload! } }))?.original_name ?? null : null;
  const data = {
    spent_on: d,
    category: b.category,
    description: b.description,
    payee: b.payee || null,
    amount: BigInt(b.amount),
    ...(key ? { receipt_key: key, receipt_name: receiptName } : b.remove_receipt ? { receipt_key: null, receipt_name: null } : {}),
  };
  const e = old ? await db.expense.update({ where: { id: old.id }, data: { ...data, updated_by: a.id } }) : await db.expense.create({ data: { ...data, created_by: a.id } });
  // Nota lama yang diganti/dihapus ikut dibuang dari storage.
  if (old?.receipt_key && old.receipt_key !== e.receipt_key) await storage.remove(old.receipt_key).catch(() => {});
  await logActivity({ type: "ADMIN", id: a.id }, old ? "expense.updated" : "expense.created", "expense", e.id, { spent_on: b.spent_on, category: b.category, description: b.description, amount: b.amount, receipt: !!e.receipt_key, ...(old ? { before: { spent_on: old.spent_on.toISOString().slice(0, 10), category: old.category, amount: Number(old.amount) } } : {}) });
  return json({ id: e.id });
});
