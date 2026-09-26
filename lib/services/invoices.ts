import "server-only";
import type { Registration } from "@prisma/client";
import { db, type Tx } from "../db";
import { HttpError, type AdminCtx } from "../auth";
import { getSettings, type Settings } from "../settings";
import { nextInvoiceNo } from "../counters";
import { logActivity } from "../activity";
import { addDays, todayJkt, wibInstant, fmtTsDate } from "../format";
import { notify } from "../notify";
import { publish } from "../realtime";
import { assertInvoice, assertReg } from "../state-machine";

/** Jatuh tempo = akhir hari (23:59:59 WIB) pada hari ini + N hari. */
export function dueFromToday(days: number): Date {
  return new Date(wibInstant(addDays(todayJkt(), days), "23:59").getTime() + 59_000);
}

/** Nomor BWI/INV/YYYY/MM/NNNN, counter per bulan (atomik), tidak dipakai ulang. */
export async function issueInvoice(tx: Tx, reg: Registration, s: Settings) {
  const today = todayJkt();
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const invoice_no = await nextInvoiceNo(tx, y, m);
  const subtotal = reg.price_snapshot;
  const vat = BigInt(Math.round((Number(subtotal) * s.vat_percent) / 100));
  return tx.invoice.create({
    data: { invoice_no, registration_id: reg.id, due_at: dueFromToday(s.invoice_due_days), subtotal, vat, total: subtotal + vat, status: "UNPAID" },
  });
}

async function getInv(tx: Tx, id: number) {
  const inv = await tx.invoice.findUnique({ where: { id }, include: { registration: true } });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  return inv;
}

/** Catat konfirmasi WA (+ bukti) → AWAITING_VERIFICATION. */
export async function confirmWa(id: number, admin: AdminCtx, opts: { at?: string; proof_key?: string; note?: string }) {
  const inv = await db.$transaction(async (tx) => {
    const inv = await getInv(tx, id);
    assertInvoice(inv.status, "AWAITING_VERIFICATION");
    const at = opts.at ? new Date(opts.at) : new Date();
    await tx.invoice.update({ where: { id }, data: { status: "AWAITING_VERIFICATION", wa_confirmed_at: at, proof_storage_key: opts.proof_key ?? inv.proof_storage_key, note: opts.note ?? inv.note } });
    await logActivity({ type: "ADMIN", id: admin.id }, "invoice.wa_confirmed", "invoice", id, { invoice_no: inv.invoice_no }, tx);
    return inv;
  });
  await publish({ type: "admin", kind: "invoice", id: inv.id });
}

/**
 * Tandai lunas. Nominal ≠ total → catat amount_received, tetap AWAITING (E-03),
 * kecuali admin menyatakan selisih sudah ditangani (accept_difference).
 */
export async function markPaid(id: number, admin: AdminCtx, opts: { amount: number; paid_at: string; proof_key?: string; note?: string; accept_difference?: boolean }) {
  const res = await db.$transaction(async (tx) => {
    const inv = await getInv(tx, id);
    const amount = BigInt(Math.round(opts.amount));
    const paidAt = new Date(`${opts.paid_at}T12:00:00+07:00`);
    const matches = amount === inv.total;
    if (!matches && !opts.accept_difference) {
      assertInvoice(inv.status, "AWAITING_VERIFICATION");
      await tx.invoice.update({
        where: { id },
        data: { status: "AWAITING_VERIFICATION", amount_received: amount, wa_confirmed_at: inv.wa_confirmed_at ?? new Date(), proof_storage_key: opts.proof_key ?? inv.proof_storage_key, note: opts.note ?? `Nominal diterima ${amount} ≠ total ${inv.total}` },
      });
      await logActivity({ type: "ADMIN", id: admin.id }, "invoice.amount_mismatch", "invoice", id, { amount, total: inv.total }, tx);
      return { paid: false, inv };
    }
    assertInvoice(inv.status, "PAID");
    if (inv.registration.status !== "PENDING_PAYMENT") throw new HttpError(409, "Pendaftaran tidak sedang menunggu pembayaran (aktifkan ulang invoice terlebih dahulu)");
    await tx.invoice.update({
      where: { id },
      data: { status: "PAID", amount_received: amount, paid_at: paidAt, verified_by: admin.id, proof_storage_key: opts.proof_key ?? inv.proof_storage_key, note: opts.note ?? inv.note, wa_confirmed_at: inv.wa_confirmed_at ?? new Date() },
    });
    assertReg(inv.registration.status, "PAID");
    await tx.registration.update({ where: { id: inv.registration_id }, data: { status: "PAID" } });
    await logActivity({ type: "ADMIN", id: admin.id }, "invoice.paid", "invoice", id, { invoice_no: inv.invoice_no, amount, diff: !matches }, tx);
    return { paid: true, inv };
  });
  if (res.paid) await notify("payment_verified", res.inv.registration_id);
  await publish({ type: "admin", kind: "invoice", id });
  return { paid: res.paid, invoice_no: res.inv.invoice_no };
}

export async function resendInvoice(id: number, admin: AdminCtx) {
  const inv = await db.invoice.findUnique({ where: { id } });
  if (!inv) throw new HttpError(404, "Invoice tidak ditemukan");
  if (!["UNPAID", "AWAITING_VERIFICATION", "OVERDUE", "PAID"].includes(inv.status)) throw new HttpError(409, "Invoice tidak aktif");
  await notify(inv.status === "PAID" ? "payment_verified" : "invoice_issued", inv.registration_id, { channels: ["EMAIL", "WA"] });
  await logActivity({ type: "ADMIN", id: admin.id }, "invoice.resent", "invoice", id, { invoice_no: inv.invoice_no });
}

/** E-02: OVERDUE/EXPIRED → UNPAID dengan jatuh tempo baru, nomor tetap. */
export async function reactivateInvoice(id: number, admin: AdminCtx) {
  const s = await getSettings();
  const inv = await db.$transaction(async (tx) => {
    const inv = await getInv(tx, id);
    if (!["OVERDUE", "EXPIRED"].includes(inv.status)) throw new HttpError(409, "Hanya invoice lewat tempo / kedaluwarsa yang bisa diaktifkan ulang");
    const due = dueFromToday(s.invoice_due_days);
    await tx.invoice.update({ where: { id }, data: { status: "UNPAID", due_at: due, overdue_at: null, reminder_sent_at: null } });
    if (inv.registration.status === "EXPIRED") {
      assertReg("EXPIRED", "PENDING_PAYMENT");
      await tx.registration.update({ where: { id: inv.registration_id }, data: { status: "PENDING_PAYMENT" } });
    }
    await logActivity({ type: "ADMIN", id: admin.id }, "invoice.reactivated", "invoice", id, { invoice_no: inv.invoice_no, due }, tx);
    return { ...inv, due_at: due };
  });
  await notify("invoice_issued", inv.registration_id);
  await publish({ type: "admin", kind: "invoice", id });
  return { due: fmtTsDate(inv.due_at, "id") };
}
