import { z } from "zod";
import { addDays, todayJkt } from "./format";

// Satu sumber: field formulir = kolom database = kolom Excel. Dipakai di client & server.

/** Dokumen yang bisa diunggah di form. LICENCE_FRONT = lisensi semua halaman (CR-04). */
export const DOC_KINDS = ["KTP", "PASSPORT", "MEDICAL", "LICENCE_FRONT", "PHOTO"] as const;
/** Termasuk jenis lama (LICENCE_RATING, sebelum CR-04) — untuk validasi tolak/unggah ulang pendaftaran lama. */
export const ALL_DOC_KINDS = [...DOC_KINDS, "LICENCE_RATING"] as const;
/** Wajib selain dokumen identitas (KTP atau paspor, sesuai jenis identitas). */
export const REQUIRED_DOCS = ["MEDICAL", "LICENCE_FRONT", "PHOTO"] as const;
export const ID_TYPES = ["KTP", "PASSPORT"] as const;
export const AUTHORITIES = ["DGCA", "FAA", "EASA", "CASA", "OTHER"] as const;
export const TYPE_RATINGS = ["A320", "B737NG", "OTHER"] as const;
export const POSITIONS = ["FRESH_GRADUATE", "FO", "CAPTAIN", "INSTRUCTOR", "CADET"] as const;
export const PURPOSES = ["PPC", "SKILL_TEST", "AIRLINE_SELECTION", "RECURRENT", "FAMILIARIZATION"] as const;
export const NATIONALITIES = ["ID", "OTHER"] as const;
/** ICAO English level yang wajib mencantumkan masa berlaku (Level 6 umumnya seumur hidup). */
export const ICAO_NEEDS_VALIDITY = ["L4", "L5"] as const;

export const idDocKind = (idType: unknown) => (idType === "PASSPORT" ? "PASSPORT" : "KTP");
export const requiredDocs = (idType: unknown): string[] => [idDocKind(idType), ...REQUIRED_DOCS];
/** Kelengkapan dokumen wajib (identitas KTP/paspor + medical + lisensi + foto) dari daftar jenis yang ada. */
export function docProgress(kinds: string[]): { n: number; total: number } {
  const id = kinds.includes("KTP") || kinds.includes("PASSPORT") ? 1 : 0;
  return { n: id + REQUIRED_DOCS.filter((k) => kinds.includes(k)).length, total: REQUIRED_DOCS.length + 1 };
}

const req = (msg = "required") => z.string().trim().min(1, msg);
const opt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
/** Pilihan opsional: "— Pilih —" (string kosong) = tidak diisi. */
const optEnum = <const T extends readonly [string, ...string[]]>(vals: T) => z.preprocess((v) => (v === "" ? undefined : v), z.enum(vals).optional());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date");
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(date.optional());
const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s\-().]{7,20}$/, "phone");
const hours = z
  .string()
  .trim()
  .regex(/^\d{1,5}([.,]\d)?$/, "hours");

type Ctx = z.RefinementCtx;
const issue = (ctx: Ctx, path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

export const step1 = z.object({
  full_name: req().max(120),
  id_type: z.enum(ID_TYPES).default("KTP"),
  nik: opt,
  passport_no: opt.pipe(z.string().max(30).optional()),
  birth_place: req().max(80),
  birth_date: date,
  gender: z.enum(["M", "F"]),
  nationality: z.enum(NATIONALITIES),
  nationality_other: opt.pipe(z.string().max(40).optional()),
  whatsapp: phone,
  email: z.string().trim().toLowerCase().email("email").max(160),
  address: req().max(240),
  city: req().max(80),
  province: req().max(80),
  postal_code: opt,
});
function checkStep1(v: z.infer<typeof step1>, ctx: Ctx) {
  if (v.id_type === "KTP" && !/^\d{16}$/.test(v.nik ?? "")) issue(ctx, "nik", "nik");
  if (v.id_type === "PASSPORT" && !v.passport_no) issue(ctx, "passport_no", "required");
  if (v.nationality === "OTHER" && !v.nationality_other) issue(ctx, "nationality_other", "required");
}

export const step2 = z.object({
  licence_type: z.enum(["SPL", "PPL", "CPL", "ATPL", "MPL"]),
  licence_no: req().max(60),
  licence_authority: z.enum(AUTHORITIES),
  licence_authority_other: opt.pipe(z.string().max(60).optional()),
  licence_issued_at: date,
  instrument_rating: optEnum(["VALID", "EXPIRED", "NONE"]),
  type_ratings: z.array(z.enum(TYPE_RATINGS)).default([]),
  type_rating_other: opt.pipe(z.string().max(80).optional()),
  total_hours: hours,
  hours_on_type: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(hours.optional()),
  icao_english: optEnum(["L4", "L5", "L6", "NONE"]),
  icao_valid_until: optDate,
  organization: opt,
  position: optEnum(POSITIONS),
  medical_class: z.enum(["C1", "C2"]),
  medical_no: req().max(60),
  medical_valid_until: date,
});
function checkStep2(v: z.infer<typeof step2>, ctx: Ctx) {
  const today = todayJkt();
  if (v.licence_authority === "OTHER" && !v.licence_authority_other) issue(ctx, "licence_authority_other", "required");
  if (v.type_ratings.includes("OTHER") && !v.type_rating_other) issue(ctx, "type_rating_other", "required");
  // Masa berlaku yang sudah lewat → tidak bisa lanjut (CR-04).
  if (v.medical_valid_until < today) issue(ctx, "medical_valid_until", "expired");
  const icaoNeedsDate = (ICAO_NEEDS_VALIDITY as readonly string[]).includes(v.icao_english ?? "");
  if (icaoNeedsDate && !v.icao_valid_until) issue(ctx, "icao_valid_until", "required");
  if (v.icao_english && v.icao_english !== "NONE" && v.icao_valid_until && v.icao_valid_until < today) issue(ctx, "icao_valid_until", "expired");
}

export const step3 = z.object({
  documents: z.record(z.string(), z.string().min(8)),
});

/** Tanggal awal preferensi paling cepat H+N dari hari daftar (H+1 = besok; pembayaran H-1 = hari ini). */
export const PREF_MIN_LEAD_DAYS = 1; // mulai besok → bayar hari ini (H-1)
/** Jatuh tempo pembayaran = H-1 tanggal awal preferensi ("YYYY-MM-DD"). */
export const payByDate = (prefFrom: string) => addDays(prefFrom, -1);

const step4Shape = {
  simulator: z.enum(["A320", "B737"]),
  package: req(),
  pref_date_from: date,
  pref_date_to: optDate,
  pref_time: z.enum(["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"]).default("FLEXIBLE"),
  purpose: optEnum(PURPOSES),
  notes: opt.pipe(z.string().max(1000).optional()),
};
function checkStep4(v: { pref_date_from?: string; pref_date_to?: string }, ctx: Ctx) {
  if (v.pref_date_from && v.pref_date_from < addDays(todayJkt(), PREF_MIN_LEAD_DAYS)) issue(ctx, "pref_date_from", "minLead");
  if (v.pref_date_from && v.pref_date_to && v.pref_date_from > v.pref_date_to) issue(ctx, "pref_date_to", "range");
}

export const step1Check = step1.superRefine(checkStep1);
export const step2Check = step2.superRefine(checkStep2);
export const step4 = z.object(step4Shape).superRefine(checkStep4);

export const registrationSchema = z
  .object({ ...step1.shape, ...step2.shape, ...step3.shape, ...step4Shape, agree: z.literal(true), locale: z.enum(["id", "en"]).default("id") })
  .superRefine((v, ctx) => {
    checkStep1(v, ctx);
    checkStep2(v, ctx);
    checkStep4(v, ctx);
    for (const k of requiredDocs(v.id_type)) if (!v.documents[k]) issue(ctx, "documents", "documents");
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Nilai akhir yang disimpan untuk field "Lainnya" (teks bebas). */
export function resolveOther(input: RegistrationInput) {
  return {
    nationality: input.nationality === "OTHER" ? input.nationality_other! : "ID",
    licence_authority: input.licence_authority === "OTHER" ? input.licence_authority_other! : input.licence_authority,
    type_ratings: input.type_ratings.flatMap((t) => (t === "OTHER" ? (input.type_rating_other ? [input.type_rating_other] : []) : [t])),
  };
}

/** Kebalikan resolveOther: nilai tersimpan → isian form (dipakai prefill peserta lama). */
export function splitOther(p: { nationality: string; licence_authority: string; type_ratings: string[] }) {
  const known = (TYPE_RATINGS as readonly string[]).filter((t) => t !== "OTHER");
  const otherTr = p.type_ratings.filter((t) => !known.includes(t) && t !== "NONE");
  const auth = (AUTHORITIES as readonly string[]).includes(p.licence_authority) && p.licence_authority !== "OTHER";
  return {
    nationality: p.nationality === "ID" ? "ID" : "OTHER",
    nationality_other: p.nationality === "ID" || p.nationality === "OTHER" ? "" : p.nationality,
    licence_authority: auth ? p.licence_authority : "OTHER",
    licence_authority_other: auth || p.licence_authority === "OTHER" ? "" : p.licence_authority,
    type_ratings: [...p.type_ratings.filter((t) => known.includes(t)), ...(otherTr.length ? ["OTHER"] : [])],
    type_rating_other: otherTr.join(", "),
  };
}

/** Peringatan lintas-field (bukan blokir): medical/ILP berakhir sebelum akhir preferensi jadwal. */
export function medicalWarning(v: { medical_valid_until?: string; pref_date_to?: string }): boolean {
  return !!(v.medical_valid_until && v.pref_date_to && v.medical_valid_until < v.pref_date_to);
}
export function icaoWarning(v: { icao_valid_until?: string; pref_date_to?: string }): boolean {
  return !!(v.icao_valid_until && v.pref_date_to && v.icao_valid_until < v.pref_date_to);
}

export const STEP_FIELDS: Record<number, readonly string[]> = {
  1: Object.keys(step1.shape),
  2: Object.keys(step2.shape),
  3: ["documents"],
  4: Object.keys(step4Shape),
  5: ["agree"],
};
