// Pemetaan status → kelas pill (dipakai client & server).
export const REG_PILL: Record<string, string> = {
  PENDING_VERIFICATION: "warn", REUPLOAD_REQUIRED: "bad", PENDING_PAYMENT: "info", EXPIRED: "bad", PAID: "ok", SCHEDULED: "teal", IN_PROGRESS: "teal", COMPLETED: "ok", CANCELLED: "neutral",
};
export const INV_PILL: Record<string, string> = { UNPAID: "neutral", AWAITING_VERIFICATION: "warn", PAID: "ok", OVERDUE: "bad", EXPIRED: "bad", CANCELLED: "neutral" };
export const SLOT_PILL: Record<string, string> = { AVAILABLE: "ok", SCHEDULED: "info", MAINTENANCE: "warn", COMPLETED: "ok", NO_SHOW: "bad", CANCELLED: "neutral" };
export const simChip = (code: string) => `chip ${code.toLowerCase()}`;
export const invSlug = (no: string) => no.replaceAll("/", "-");
export const invFromSlug = (slug: string) => slug.replaceAll("-", "/");
