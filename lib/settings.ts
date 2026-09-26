import "server-only";
import { db } from "./db";

/**
 * Semua nilai bisnis ada di tabel `settings` (bukan hardcode).
 * Nilai default di bawah = asumsi DUMMY yang menunggu konfirmasi client (Q1–Q12, lihat README).
 */
export const SETTING_DEFAULTS = {
  slot_minutes: 120, // Q1
  ops_start: "06:00", // Q1
  ops_end: "22:00", // Q1
  show_instructor_to_participant: true, // Q2
  invoice_due_days: 3, // Q3
  invoice_expire_days: 3, // Q3
  vat_percent: 0, // Q4
  reschedule_free_hours: 48, // Q5
  no_show_policy: "HOURS_FORFEITED" as "HOURS_FORFEITED" | "HOURS_RETURNED", // Q5
  refund_policy: "PER_CASE" as "PER_CASE" | "FULL" | "NONE", // Q6
  wa_mode: "MANUAL_PREFILL" as "MANUAL_PREFILL" | "API", // Q7
  dashboard_otp: false, // Q8
  domain: "bwi-sim.id", // Q9
  sender_email_billing: "billing@bwiaviation.id", // Q9
  sender_email_schedule: "schedule@bwiaviation.id", // Q9
  sender_name: "BWI Aviation Sim Center",
  default_locale: "id" as "id" | "en", // Q10
  session_report_enabled: true, // Q11
  send_link_on_paid: false, // kirim link dashboard saat lunas (default: saat email jadwal)
  slot_horizon_days: 90,
  token_inactive_after_days: 90,
  reupload_token_days: 7,
  reupload_manual_threshold: 3,
  document_retention_months: 24,
  bank_name: "BCA",
  bank_account: "123-456-7890",
  bank_holder: "PT BWI Aviation Indonesia",
  wa_admin_number: "+6281234567890",
  admin_notify_emails: ["ops@bwiaviation.id"] as string[],
  company_name: "PT BWI Aviation Indonesia",
  company_address: "Sim Center – Kawasan PPI Curug, Tangerang, Banten 15820",
  location_name: "Sim Center BWI × PPI Curug, Tangerang",
  office_hours: "08.00–17.00 WIB",
};

export type Settings = typeof SETTING_DEFAULTS;
export type SettingKey = keyof Settings;

/** Label & tipe untuk halaman Pengaturan (SA). `q` = nomor pertanyaan client. */
export const SETTING_META: Record<SettingKey, { type: "number" | "string" | "boolean" | "time" | "enum" | "list"; group: string; q?: string; options?: string[] }> = {
  slot_minutes: { type: "number", group: "ops", q: "Q1" },
  ops_start: { type: "time", group: "ops", q: "Q1" },
  ops_end: { type: "time", group: "ops", q: "Q1" },
  slot_horizon_days: { type: "number", group: "ops" },
  show_instructor_to_participant: { type: "boolean", group: "ops", q: "Q2" },
  reschedule_free_hours: { type: "number", group: "ops", q: "Q5" },
  no_show_policy: { type: "enum", group: "ops", q: "Q5", options: ["HOURS_FORFEITED", "HOURS_RETURNED"] },
  session_report_enabled: { type: "boolean", group: "ops", q: "Q11" },
  invoice_due_days: { type: "number", group: "billing", q: "Q3" },
  invoice_expire_days: { type: "number", group: "billing", q: "Q3" },
  vat_percent: { type: "number", group: "billing", q: "Q4" },
  refund_policy: { type: "enum", group: "billing", q: "Q6", options: ["PER_CASE", "FULL", "NONE"] },
  bank_name: { type: "string", group: "billing" },
  bank_account: { type: "string", group: "billing" },
  bank_holder: { type: "string", group: "billing" },
  company_name: { type: "string", group: "billing" },
  company_address: { type: "string", group: "billing" },
  wa_mode: { type: "enum", group: "notify", q: "Q7", options: ["MANUAL_PREFILL", "API"] },
  wa_admin_number: { type: "string", group: "notify" },
  sender_name: { type: "string", group: "notify" },
  sender_email_billing: { type: "string", group: "notify", q: "Q9" },
  sender_email_schedule: { type: "string", group: "notify", q: "Q9" },
  admin_notify_emails: { type: "list", group: "notify" },
  office_hours: { type: "string", group: "notify" },
  location_name: { type: "string", group: "notify" },
  dashboard_otp: { type: "boolean", group: "access", q: "Q8" },
  send_link_on_paid: { type: "boolean", group: "access" },
  token_inactive_after_days: { type: "number", group: "access" },
  reupload_token_days: { type: "number", group: "access" },
  reupload_manual_threshold: { type: "number", group: "access" },
  document_retention_months: { type: "number", group: "access" },
  domain: { type: "string", group: "general", q: "Q9" },
  default_locale: { type: "enum", group: "general", q: "Q10", options: ["id", "en"] },
};

const g = globalThis as unknown as { __settings?: { at: number; v: Settings } };

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && g.__settings && Date.now() - g.__settings.at < 10_000) return g.__settings.v;
  const rows = await db.setting.findMany();
  const v = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in v) v[r.key] = r.value;
  g.__settings = { at: Date.now(), v: v as Settings };
  return v as Settings;
}

export async function setSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
  }
  g.__settings = undefined;
}

/** Jam-jam mulai slot per hari, mis. ["06:00","08:00",…,"20:00"] */
export function slotStarts(s: Pick<Settings, "slot_minutes" | "ops_start" | "ops_end">): { start: string; end: string }[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: { start: string; end: string }[] = [];
  for (let m = toMin(s.ops_start); m + s.slot_minutes <= toMin(s.ops_end); m += s.slot_minutes) out.push({ start: fmt(m), end: fmt(m + s.slot_minutes) });
  return out;
}

export function slotsNeeded(hours: number, slotMinutes: number): number {
  return Math.max(1, Math.ceil((hours * 60) / slotMinutes));
}
