import "server-only";
import { db } from "../db";
import { getSettings } from "../settings";
import { logActivity, SYSTEM } from "../activity";
import { addDays, dateOnly, fmtTime, todayJkt, nowTimeJkt, fmtDate } from "../format";
import { notify } from "../notify";
import { publish } from "../realtime";
import { storage } from "../storage";
import { ensureSlots } from "../services/slots";

/** generate-slots — harian 00:10 WIB: slot N hari ke depan untuk simulator aktif. */
export async function generateSlots() {
  const s = await getSettings(true);
  const today = todayJkt();
  const n = await ensureSlots(today, addDays(today, s.slot_horizon_days), s);
  return { checked: n };
}

/** invoice-reminders — harian 09:00: H-1 jatuh tempo, masih UNPAID/AWAITING → invoice_reminder. */
export async function invoiceReminders() {
  const tomorrow = addDays(todayJkt(), 1);
  const from = new Date(`${tomorrow}T00:00:00+07:00`);
  const to = new Date(`${addDays(tomorrow, 1)}T00:00:00+07:00`);
  const invs = await db.invoice.findMany({ where: { status: "UNPAID", due_at: { gte: from, lt: to }, reminder_sent_at: null } });
  for (const inv of invs) {
    await notify("invoice_reminder", inv.registration_id);
    await db.invoice.update({ where: { id: inv.id }, data: { reminder_sent_at: new Date() } });
  }
  return { reminded: invs.length };
}

/** expire-invoices — harian 00:20: lewat due → OVERDUE (+tanda admin); OVERDUE > expire_days → EXPIRED, registrasi EXPIRED. */
export async function expireInvoices() {
  const s = await getSettings(true);
  const now = new Date();
  const overdue = await db.invoice.findMany({ where: { status: { in: ["UNPAID", "AWAITING_VERIFICATION"] }, due_at: { lt: now } } });
  for (const inv of overdue) {
    await db.invoice.update({ where: { id: inv.id }, data: { status: "OVERDUE", overdue_at: now } });
    await notify("invoice_overdue_admin", inv.registration_id);
    await logActivity(SYSTEM, "invoice.overdue", "invoice", inv.id, { invoice_no: inv.invoice_no });
  }
  const limit = new Date(now.getTime() - s.invoice_expire_days * 86400_000);
  // Pengaman: invoice yang sudah punya konfirmasi WA / bukti tidak dikedaluwarsakan otomatis (ditangani admin).
  const expiring = await db.invoice.findMany({ where: { status: "OVERDUE", due_at: { lt: limit }, wa_confirmed_at: null }, include: { registration: true } });
  for (const inv of expiring) {
    await db.$transaction([
      db.invoice.update({ where: { id: inv.id }, data: { status: "EXPIRED" } }),
      ...(inv.registration.status === "PENDING_PAYMENT" ? [db.registration.update({ where: { id: inv.registration_id }, data: { status: "EXPIRED" } })] : []),
    ]);
    await logActivity(SYSTEM, "invoice.expired", "invoice", inv.id, { invoice_no: inv.invoice_no });
  }
  if (overdue.length || expiring.length) await publish({ type: "admin", kind: "invoice" });
  return { overdue: overdue.length, expired: expiring.length };
}

/** session-reminders — 17:00 (H-1) & 08:00 (H-0) → WA + dashboard. */
export async function sessionReminders(which?: "H-1" | "H-0") {
  const today = todayJkt();
  const mode = which ?? (nowTimeJkt() >= "12:00" ? "H-1" : "H-0");
  const date = mode === "H-1" ? addDays(today, 1) : today;
  const field = mode === "H-1" ? "reminder_h1_at" : "reminder_h0_at";
  const slots = await db.slot.findMany({ where: { date: dateOnly(date), status: "SCHEDULED", registration_id: { not: null }, [field]: null }, include: { registration: { include: { participant: true } } }, orderBy: { start_time: "asc" } });
  for (const sl of slots) {
    const l = sl.registration!.participant.locale;
    const label = `${fmtDate(sl.date, l, { weekday: true })} · ${fmtTime(sl.start_time, l)}–${fmtTime(sl.end_time, l)} WIB`;
    await notify("session_reminder", sl.registration_id!, { extra: { slotLabel: label, when: mode } });
    await db.slot.update({ where: { id: sl.id }, data: { [field]: new Date() } });
  }
  return { mode, reminded: slots.length };
}

/** deactivate-tokens — mingguan: token pendaftaran COMPLETED/CANCELLED > N hari → revoked. */
export async function deactivateTokens() {
  const s = await getSettings(true);
  const limit = new Date(Date.now() - s.token_inactive_after_days * 86400_000);
  const r = await db.accessToken.updateMany({
    where: { revoked_at: null, purpose: "DASHBOARD", registration: { status: { in: ["COMPLETED", "CANCELLED"] }, updated_at: { lt: limit } } },
    data: { revoked_at: new Date() },
  });
  return { revoked: r.count };
}

/** cleanup — harian: token unggah ulang > 7 hari, unggahan yatim > 24 jam, OTP lama, dokumen > retensi. */
export async function cleanup() {
  const s = await getSettings(true);
  const now = Date.now();
  const tok = await db.accessToken.updateMany({ where: { purpose: "REUPLOAD", revoked_at: null, expires_at: { lt: new Date() } }, data: { revoked_at: new Date() } });
  const orphans = await db.pendingUpload.findMany({ where: { claimed: false, created_at: { lt: new Date(now - 86400_000) } } });
  for (const o of orphans) await storage.remove(o.storage_key).catch(() => {});
  await db.pendingUpload.deleteMany({ where: { OR: [{ id: { in: orphans.map((o) => o.id) } }, { claimed: true, created_at: { lt: new Date(now - 86400_000) } }] } });
  await db.otpCode.deleteMany({ where: { created_at: { lt: new Date(now - 86400_000) } } });
  // Retensi dokumen identitas (setting document_retention_months; default 24 — konfirmasi client).
  const retention = new Date(now - s.document_retention_months * 30 * 86400_000);
  const oldDocs = await db.document.findMany({ where: { registration: { status: { in: ["COMPLETED", "CANCELLED"] }, updated_at: { lt: retention } } }, take: 500 });
  for (const d of oldDocs) await storage.remove(d.storage_key).catch(() => {});
  if (oldDocs.length) await db.document.deleteMany({ where: { id: { in: oldDocs.map((d) => d.id) } } });
  return { reupload_tokens: tok.count, orphan_uploads: orphans.length, documents_purged: oldDocs.length };
}

export const JOBS = {
  "generate-slots": generateSlots,
  reminders: invoiceReminders,
  "invoice-reminders": invoiceReminders,
  "expire-invoices": expireInvoices,
  "session-reminders": () => sessionReminders(),
  "session-reminders-h1": () => sessionReminders("H-1"),
  "session-reminders-h0": () => sessionReminders("H-0"),
  "deactivate-tokens": deactivateTokens,
  cleanup,
  "cleanup-reupload-tokens": cleanup,
} as const;
export type JobName = keyof typeof JOBS;

export async function runJob(name: JobName) {
  const started = Date.now();
  const result = await JOBS[name]();
  await logActivity(SYSTEM, `job.${name}`, "job", name, { ...result, ms: Date.now() - started });
  return result;
}
