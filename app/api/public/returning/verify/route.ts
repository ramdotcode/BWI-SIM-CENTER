import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { sha256, safeEqual } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { prettyPhone, ymd } from "@/lib/format";
import { logActivity } from "@/lib/activity";

/** Verifikasi OTP → kembalikan data diri & lisensi terakhir (tanpa dokumen: dokumen wajib diunggah baru). */
export const POST = handler(async (req: Request) => {
  const b = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), code: z.string().regex(/^\d{6}$/) }));
  if (!rateLimit(`otpv:${clientIp(req.headers)}`, 20, 60 * 60_000).ok) throw new HttpError(429, "Terlalu banyak percobaan");
  const otp = await db.otpCode.findFirst({ where: { email: b.email, used_at: null, expires_at: { gt: new Date() } }, orderBy: { created_at: "desc" } });
  if (!otp || otp.attempts >= 5) throw new HttpError(422, "Kode salah atau kedaluwarsa", "bad_code");
  if (!safeEqual(otp.code_hash, sha256(`${b.email}:${b.code}`))) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(422, "Kode salah atau kedaluwarsa", "bad_code");
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { used_at: new Date() } });
  const p = await db.participant.findFirst({ where: { email: b.email }, orderBy: { updated_at: "desc" }, include: { registrations: { select: { reg_no: true, status: true }, orderBy: { created_at: "desc" } } } });
  if (!p) throw new HttpError(404, "Data tidak ditemukan");
  await logActivity({ type: "PARTICIPANT", id: p.id }, "participant.prefill_otp", "participant", p.id, {});
  return json({
    history: p.registrations,
    data: {
      full_name: p.full_name, nik: p.nik, passport_no: p.passport_no ?? "", birth_place: p.birth_place, birth_date: ymd(p.birth_date), gender: p.gender, nationality: p.nationality,
      whatsapp: prettyPhone(p.whatsapp), email: p.email, address: p.address, city: p.city, province: p.province, postal_code: p.postal_code ?? "",
      emergency_name: p.emergency_name, emergency_relation: p.emergency_relation, emergency_phone: prettyPhone(p.emergency_phone),
      licence_type: p.licence_type, licence_no: p.licence_no, licence_authority: p.licence_authority, licence_issued_at: ymd(p.licence_issued_at),
      instrument_rating: p.instrument_rating ?? "", type_ratings: p.type_ratings, total_hours: String(p.total_hours), hours_on_type: p.hours_on_type ? String(p.hours_on_type) : "",
      icao_english: p.icao_english ?? "", organization: p.organization ?? "", position: p.position ?? "", medical_class: p.medical_class, medical_no: p.medical_no,
      medical_valid_until: ymd(p.medical_valid_until),
    },
  });
});
