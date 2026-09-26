import type { InvoiceStatus, RegistrationStatus, SlotStatus } from "@prisma/client";
import { HttpError } from "./auth";

/** Transisi status yang sah. Semua perubahan status melewati assert* di bawah. */
export const REG_FLOW: Record<RegistrationStatus, RegistrationStatus[]> = {
  PENDING_VERIFICATION: ["PENDING_PAYMENT", "REUPLOAD_REQUIRED", "CANCELLED"],
  REUPLOAD_REQUIRED: ["PENDING_VERIFICATION", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "EXPIRED", "CANCELLED"],
  EXPIRED: ["PENDING_PAYMENT", "CANCELLED"],
  PAID: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  SCHEDULED: ["PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["PAID", "SCHEDULED", "COMPLETED", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS", "SCHEDULED", "PAID"], // koreksi hasil sesi
  CANCELLED: [],
};

export const INVOICE_FLOW: Record<InvoiceStatus, InvoiceStatus[]> = {
  UNPAID: ["AWAITING_VERIFICATION", "PAID", "OVERDUE", "CANCELLED"],
  AWAITING_VERIFICATION: ["PAID", "OVERDUE", "CANCELLED", "AWAITING_VERIFICATION"],
  OVERDUE: ["AWAITING_VERIFICATION", "PAID", "EXPIRED", "CANCELLED"],
  EXPIRED: ["UNPAID", "CANCELLED"],
  PAID: ["CANCELLED"],
  CANCELLED: [],
};

export const SLOT_FLOW: Record<SlotStatus, SlotStatus[]> = {
  AVAILABLE: ["SCHEDULED", "MAINTENANCE"],
  SCHEDULED: ["AVAILABLE", "MAINTENANCE", "COMPLETED", "NO_SHOW", "CANCELLED"],
  MAINTENANCE: ["AVAILABLE"],
  COMPLETED: ["SCHEDULED"],
  NO_SHOW: ["SCHEDULED"],
  CANCELLED: ["AVAILABLE"],
};

function assertIn<T extends string>(flow: Record<T, T[]>, from: T, to: T, what: string) {
  if (from === to && !flow[from].includes(to)) return;
  if (!flow[from].includes(to)) throw new HttpError(409, `Transisi ${what} tidak sah: ${from} → ${to}`, "bad_transition");
}
export const assertReg = (from: RegistrationStatus, to: RegistrationStatus) => assertIn(REG_FLOW, from, to, "pendaftaran");
export const assertInvoice = (from: InvoiceStatus, to: InvoiceStatus) => assertIn(INVOICE_FLOW, from, to, "invoice");
export const assertSlot = (from: SlotStatus, to: SlotStatus) => assertIn(SLOT_FLOW, from, to, "slot");

/** Status yang dianggap "aktif menjadwalkan" (boleh diberi slot). */
export const SCHEDULABLE: RegistrationStatus[] = ["PAID", "SCHEDULED", "IN_PROGRESS"];
/** Status invoice yang dihitung sebagai piutang. */
export const RECEIVABLE: InvoiceStatus[] = ["UNPAID", "AWAITING_VERIFICATION", "OVERDUE"];
