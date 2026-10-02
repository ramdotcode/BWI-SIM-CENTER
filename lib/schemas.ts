import { z } from "zod";

// Satu sumber: field formulir = kolom database = kolom Excel. Dipakai di client & server.

export const DOC_KINDS = ["KTP", "MEDICAL", "LICENCE_FRONT", "LICENCE_RATING", "PHOTO", "PASSPORT"] as const;
export const REQUIRED_DOCS = ["KTP", "MEDICAL", "LICENCE_FRONT", "LICENCE_RATING", "PHOTO"] as const;
export const RELATIONS = ["SPOUSE", "PARENT", "SIBLING", "OTHER"] as const;
export const AUTHORITIES = ["DGCA", "FAA", "EASA", "CASA", "OTHER"] as const;
export const TYPE_RATINGS = ["A320", "B737NG", "ATR72", "OTHER", "NONE"] as const;
export const POSITIONS = ["FRESH_GRADUATE", "FO", "CAPTAIN", "INSTRUCTOR", "CADET"] as const;
export const PURPOSES = ["PPC", "SKILL_TEST", "AIRLINE_SELECTION", "RECURRENT", "FAMILIARIZATION"] as const;
export const NATIONALITIES = ["ID", "OTHER"] as const;

const req = (msg = "required") => z.string().trim().min(1, msg);
const opt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
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

export const step1 = z.object({
  full_name: req().max(120),
  nik: z.string().trim().regex(/^\d{16}$/, "nik"),
  passport_no: opt,
  birth_place: req().max(80),
  birth_date: date,
  gender: z.enum(["M", "F"]),
  nationality: req().max(40),
  whatsapp: phone,
  email: z.string().trim().toLowerCase().email("email").max(160),
  address: req().max(240),
  city: req().max(80),
  province: req().max(80),
  postal_code: opt,
  emergency_name: req().max(120),
  emergency_relation: z.enum(RELATIONS),
  emergency_phone: phone,
});

export const step2 = z.object({
  licence_type: z.enum(["SPL", "PPL", "CPL", "ATPL", "MPL"]),
  licence_no: req().max(60),
  licence_authority: z.enum(AUTHORITIES),
  licence_issued_at: date,
  instrument_rating: z.enum(["VALID", "EXPIRED", "NONE"]).optional(),
  type_ratings: z.array(z.enum(TYPE_RATINGS)).default([]),
  total_hours: hours,
  hours_on_type: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(hours.optional()),
  icao_english: z.enum(["L4", "L5", "L6", "NONE"]).optional(),
  organization: opt,
  position: z.enum(POSITIONS).optional(),
  medical_class: z.enum(["C1", "C2"]),
  medical_no: req().max(60),
  medical_valid_until: date,
});

export const step3 = z.object({
  documents: z
    .record(z.string(), z.string().min(8))
    .refine((d) => REQUIRED_DOCS.every((k) => d[k]), "documents"),
});

export const step4 = z
  .object({
    simulator: z.enum(["A320", "B737"]),
    package: req(),
    pref_date_from: optDate,
    pref_date_to: optDate,
    pref_time: z.enum(["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"]).default("FLEXIBLE"),
    purpose: z.enum(PURPOSES).optional(),
    notes: opt.pipe(z.string().max(1000).optional()),
  })
  .refine((v) => !v.pref_date_from || !v.pref_date_to || v.pref_date_from <= v.pref_date_to, { message: "range", path: ["pref_date_to"] });

export const registrationSchema = z
  .object({ ...step1.shape, ...step2.shape, ...step3.shape, simulator: z.enum(["A320", "B737"]), package: req(), pref_date_from: optDate, pref_date_to: optDate, pref_time: z.enum(["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"]).default("FLEXIBLE"), purpose: z.enum(PURPOSES).optional(), notes: opt, agree: z.literal(true), locale: z.enum(["id", "en"]).default("id") })
  .refine((v) => !v.pref_date_from || !v.pref_date_to || v.pref_date_from <= v.pref_date_to, { message: "range", path: ["pref_date_to"] });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Peringatan lintas-field (bukan blokir): medical berakhir sebelum akhir preferensi jadwal. */
export function medicalWarning(v: { medical_valid_until?: string; pref_date_to?: string }): boolean {
  return !!(v.medical_valid_until && v.pref_date_to && v.medical_valid_until < v.pref_date_to);
}

export const STEP_FIELDS: Record<number, readonly string[]> = {
  1: Object.keys(step1.shape),
  2: Object.keys(step2.shape),
  3: ["documents"],
  4: ["simulator", "package", "pref_date_from", "pref_date_to", "pref_time", "purpose", "notes"],
  5: ["agree"],
};
