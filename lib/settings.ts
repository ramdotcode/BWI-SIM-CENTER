import "server-only";
import { db } from "./db";

/**
 * Semua nilai bisnis ada di tabel `settings` (bukan hardcode).
 * Nilai default di bawah = asumsi DUMMY yang menunggu konfirmasi client (Q1–Q12, lihat README).
 */
export const SETTING_DEFAULTS = {
  // Q1 (dijawab klien 1 Okt 2026): 2 sesi/hari, Senin–Jumat. Semua sesi harus sama panjang.
  session_times: ["07:30-11:30", "11:45-15:45"] as string[],
  work_days: [1, 2, 3, 4, 5] as number[], // ISO: 1 = Senin … 7 = Minggu
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
  document_retention_days: 730, // hapus otomatis dokumen pendaftaran selesai/batal/kedaluwarsa setelah N hari; 0 = tidak pernah (CR-05)
  upload_max_mb: 5, // batas ukuran 1 file unggahan (1–20 MB, CR-05)
  bank_name: "BCA",
  bank_account: "4972372777",
  bank_holder: "PT BWI Trivindo Mandiri",
  wa_admin_number: "+6281110301000",
  admin_notify_emails: ["ops@bwiaviation.id"] as string[],
  company_name: "PT BWI Aviation Indonesia",
  company_address: "Jl. Horizon Broadway Blok M1 No. 11, RT 006/RW 009, Kel. Sampora, Kec. Cisauk, Kab. Tangerang, Banten",
  contact_email: "business@bwiaviation.com", // ditampilkan di invoice (bukan alamat pengirim email)
  location_name: "Sim Center BWI × PPI Curug, Tangerang",
  office_hours: "08.00–17.00 WIB",
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
/** Nilai turunan dari session_times (tidak disimpan): durasi sesi & rentang jam operasional. */
export type Settings = typeof SETTING_DEFAULTS & { slot_minutes: number; ops_start: string; ops_end: string };

/** Label & tipe untuk halaman Pengaturan (SA). `q` = nomor pertanyaan client. */
export const SETTING_META: Record<SettingKey, { type: "number" | "string" | "boolean" | "time" | "enum" | "list" | "sessions" | "days"; group: string; q?: string; options?: string[] }> = {
  session_times: { type: "sessions", group: "ops" }, // Q1 dijawab klien 1 Okt 2026
  work_days: { type: "days", group: "ops" },
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
  contact_email: { type: "string", group: "billing" },
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
  document_retention_days: { type: "number", group: "access" },
  upload_max_mb: { type: "number", group: "access" },
  domain: { type: "string", group: "general", q: "Q9" },
  default_locale: { type: "enum", group: "general", q: "Q10", options: ["id", "en"] },
};

const g = globalThis as unknown as { __settings?: { at: number; v: Settings } };

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && g.__settings && Date.now() - g.__settings.at < 10_000) return g.__settings.v;
  const rows = await db.setting.findMany();
  const v = { ...SETTING_DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in v) v[r.key] = r.value;
  const out = deriveSettings(v as typeof SETTING_DEFAULTS);
  g.__settings = { at: Date.now(), v: out };
  return out;
}

export function deriveSettings(base: typeof SETTING_DEFAULTS): Settings {
  const ss = parseSessions(base.session_times);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return { ...base, slot_minutes: ss.length ? toMin(ss[0]!.end) - toMin(ss[0]!.start) : 0, ops_start: ss[0]?.start ?? "00:00", ops_end: ss.at(-1)?.end ?? "00:00" };
}

export async function setSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
  }
  g.__settings = undefined;
}

/** "07:30-11:30" → { start, end }, urut jam mulai. Entri yang formatnya salah diabaikan. */
export function parseSessions(list: string[]): { start: string; end: string }[] {
  return list
    .map((x) => /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(x.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ start: m[1]!, end: m[2]! }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Sesi per hari dari setting session_times, mis. [{ start: "07:30", end: "11:30" }, …] */
export function slotStarts(s: Pick<Settings, "session_times">): { start: string; end: string }[] {
  return parseSessions(s.session_times);
}

/** Hari operasional? `date` = "YYYY-MM-DD" (tanggal Asia/Jakarta). */
export function isWorkDay(s: Pick<Settings, "work_days">, date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return s.work_days.includes(dow);
}

export function slotsNeeded(hours: number, slotMinutes: number): number {
  return Math.max(1, Math.ceil((hours * 60) / slotMinutes));
}
