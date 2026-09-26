import "server-only";
import type { Prisma } from "@prisma/client";
import { translator } from "./i18n/server";
import { fmtDmy, prettyPhone, ymd } from "./format";

/**
 * SATU SUMBER kolom: field formulir = kolom database = kolom Excel (sheet "Peserta").
 * Dipakai oleh halaman /admin/database dan export Excel. Urutan mengikuti spec bagian 7:
 * No. Reg, Tgl daftar, semua field form (kecuali dokumen), Simulator, Paket, Jam, Harga, status-status.
 */
export const regInclude = {
  participant: true,
  package: true,
  simulator: true,
  invoices: { orderBy: { issued_at: "desc" } },
  slots: { where: { status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW"] } }, orderBy: [{ date: "asc" }, { start_time: "asc" }] },
  access_tokens: { where: { purpose: "DASHBOARD" }, orderBy: { created_at: "desc" } },
} satisfies Prisma.RegistrationInclude;
export type RegRow = Prisma.RegistrationGetPayload<{ include: typeof regInclude }>;

export type ColType = "text" | "mono" | "date" | "money" | "number";
export type Col = { key: string; id: string; en: string; type: ColType; get: (r: RegRow) => string | number | Date | null };

const E = translator("id", "enums");
const inv = (r: RegRow) => r.invoices.find((i) => i.status !== "CANCELLED") ?? r.invoices[0];
const verifStatus = (r: RegRow) => (r.status === "PENDING_VERIFICATION" ? "Menunggu" : r.status === "REUPLOAD_REQUIRED" ? "Dok. kurang" : r.status === "CANCELLED" && !r.verified_at ? "Dibatalkan" : "Lolos");
const linkStatus = (r: RegRow) => {
  const a = r.access_tokens.find((t) => !t.revoked_at);
  if (!r.access_tokens.length) return "-";
  if (!a) return "Dicabut";
  return a.opened_at ? "Dibuka" : "Belum dibuka";
};

export const COLUMNS: Col[] = [
  { key: "reg_no", id: "No. Reg", en: "Reg. No.", type: "mono", get: (r) => r.reg_no },
  { key: "created_at", id: "Tgl daftar", en: "Registered", type: "date", get: (r) => new Date(r.created_at.getTime() + 7 * 3600_000) },
  // Langkah 1 — Data diri
  { key: "full_name", id: "Nama lengkap", en: "Full name", type: "text", get: (r) => r.participant.full_name },
  { key: "nik", id: "NIK", en: "NIK", type: "mono", get: (r) => r.participant.nik },
  { key: "passport_no", id: "Paspor", en: "Passport", type: "mono", get: (r) => r.participant.passport_no },
  { key: "birth_place", id: "Tempat lahir", en: "Place of birth", type: "text", get: (r) => r.participant.birth_place },
  { key: "birth_date", id: "Tgl lahir", en: "Date of birth", type: "date", get: (r) => r.participant.birth_date },
  { key: "gender", id: "JK", en: "Gender", type: "text", get: (r) => (r.participant.gender === "M" ? "L" : "P") },
  { key: "nationality", id: "WN", en: "Nationality", type: "text", get: (r) => (r.participant.nationality === "ID" ? "ID" : r.participant.nationality) },
  { key: "whatsapp", id: "WhatsApp", en: "WhatsApp", type: "mono", get: (r) => prettyPhone(r.participant.whatsapp) },
  { key: "email", id: "Email", en: "Email", type: "text", get: (r) => r.participant.email },
  { key: "address", id: "Alamat", en: "Address", type: "text", get: (r) => r.participant.address },
  { key: "city", id: "Kota", en: "City", type: "text", get: (r) => r.participant.city },
  { key: "province", id: "Provinsi", en: "Province", type: "text", get: (r) => r.participant.province },
  { key: "postal_code", id: "Kode pos", en: "Postal code", type: "mono", get: (r) => r.participant.postal_code },
  { key: "emergency_name", id: "Kontak darurat", en: "Emergency contact", type: "text", get: (r) => r.participant.emergency_name },
  { key: "emergency_relation", id: "Hub.", en: "Relation", type: "text", get: (r) => E(`relation.${r.participant.emergency_relation}`) },
  { key: "emergency_phone", id: "Tel. darurat", en: "Emergency phone", type: "mono", get: (r) => prettyPhone(r.participant.emergency_phone) },
  // Langkah 2 — Lisensi & medical
  { key: "licence_type", id: "Jenis lisensi", en: "Licence type", type: "text", get: (r) => r.participant.licence_type },
  { key: "licence_no", id: "No. lisensi", en: "Licence no.", type: "mono", get: (r) => r.participant.licence_no },
  { key: "licence_authority", id: "Penerbit", en: "Authority", type: "text", get: (r) => (r.participant.licence_authority === "DGCA" ? "DGCA" : E(`authority.${r.participant.licence_authority}`)) },
  { key: "licence_issued_at", id: "Tgl terbit", en: "Issued", type: "date", get: (r) => r.participant.licence_issued_at },
  { key: "instrument_rating", id: "IR", en: "IR", type: "text", get: (r) => (r.participant.instrument_rating ? E(`instrumentRating.${r.participant.instrument_rating}`) : "") },
  { key: "type_ratings", id: "Type rating", en: "Type rating", type: "text", get: (r) => r.participant.type_ratings.join(", ") || "-" },
  { key: "total_hours", id: "Total jam", en: "Total hours", type: "number", get: (r) => Number(r.participant.total_hours) },
  { key: "hours_on_type", id: "Jam tipe", en: "Hours on type", type: "number", get: (r) => (r.participant.hours_on_type != null ? Number(r.participant.hours_on_type) : null) },
  { key: "icao_english", id: "ICAO Eng", en: "ICAO Eng", type: "text", get: (r) => r.participant.icao_english ?? "" },
  { key: "organization", id: "Instansi", en: "Organization", type: "text", get: (r) => r.participant.organization },
  { key: "position", id: "Posisi", en: "Position", type: "text", get: (r) => (r.participant.position ? E(`position.${r.participant.position}`) : "") },
  { key: "medical_class", id: "Medical", en: "Medical", type: "text", get: (r) => E(`medicalClass.${r.participant.medical_class}`) },
  { key: "medical_no", id: "No. medical", en: "Medical no.", type: "mono", get: (r) => r.participant.medical_no },
  { key: "medical_valid_until", id: "Medical s/d", en: "Medical until", type: "date", get: (r) => r.participant.medical_valid_until },
  { key: "medical_center", id: "Balai kesehatan", en: "Medical centre", type: "text", get: (r) => r.participant.medical_center },
  // Langkah 4 — Paket & jadwal
  { key: "simulator", id: "Simulator", en: "Simulator", type: "text", get: (r) => r.simulator.code },
  { key: "package", id: "Paket", en: "Package", type: "text", get: (r) => r.package.short_id },
  { key: "hours", id: "Jam", en: "Hours", type: "number", get: (r) => r.hours_snapshot },
  { key: "price", id: "Harga", en: "Price", type: "money", get: (r) => Number(r.price_snapshot) },
  { key: "pref_date_from", id: "Pref. dari", en: "Pref. from", type: "date", get: (r) => r.pref_date_from },
  { key: "pref_date_to", id: "Pref. sampai", en: "Pref. to", type: "date", get: (r) => r.pref_date_to },
  { key: "pref_time", id: "Pref. waktu", en: "Pref. time", type: "text", get: (r) => E(`prefTimeShort.${r.pref_time}`) },
  { key: "purpose", id: "Tujuan", en: "Purpose", type: "text", get: (r) => (r.purpose ? E(`purpose.${r.purpose}`) : "") },
  { key: "notes", id: "Catatan", en: "Notes", type: "text", get: (r) => r.notes },
  // Status
  { key: "verif_status", id: "Status verif.", en: "Verification", type: "text", get: verifStatus },
  { key: "pay_status", id: "Status bayar", en: "Payment", type: "text", get: (r) => (inv(r) ? E(`invoiceStatus.${inv(r)!.status}`) : "-") },
  { key: "invoice_no", id: "No. invoice", en: "Invoice no.", type: "mono", get: (r) => inv(r)?.invoice_no ?? "-" },
  { key: "paid_at", id: "Tgl lunas", en: "Paid on", type: "date", get: (r) => (inv(r)?.paid_at ? new Date(inv(r)!.paid_at!.getTime() + 7 * 3600_000) : null) },
  { key: "sessions", id: "Sesi terjadwal", en: "Sessions", type: "text", get: (r) => r.slots.map((s) => `${fmtDmy(s.date).slice(0, 5)} ${s.start_time}`).join(", ") || "-" },
  { key: "link_status", id: "Akses link", en: "Link access", type: "text", get: linkStatus },
];

export function cellText(c: Col, r: RegRow): string {
  const v = c.get(r);
  if (v == null || v === "") return "";
  if (v instanceof Date) return fmtDmy(v);
  if (c.type === "money") return Number(v).toLocaleString("id-ID");
  return String(v);
}
export { ymd };
