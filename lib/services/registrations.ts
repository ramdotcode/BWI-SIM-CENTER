import "server-only";
import type { DocumentKind, Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError, type AdminCtx } from "../auth";
import { getSettings } from "../settings";
import { nextRegNo } from "../counters";
import { logActivity, SYSTEM } from "../activity";
import { createToken, reuploadUrl } from "../tokens";
import { dateOnly, normalizePhone, todayJkt } from "../format";
import { notify } from "../notify";
import { publish } from "../realtime";
import { assertReg } from "../state-machine";
import { requiredDocs, resolveOther, type RegistrationInput } from "../schemas";
import { issueInvoice } from "./invoices";
import { releaseFutureSlots } from "./slots";
import { translator } from "../i18n/server";

/** Langkah 2–3 alur: form publik → participant (upsert by NIK, atau no. paspor bila identitas = paspor) + REG + dokumen + token + notifikasi. */
export async function submitRegistration(input: RegistrationInput) {
  const pkg = await db.package.findFirst({ where: { code: input.package, active: true } });
  const sim = await db.simulator.findFirst({ where: { code: input.simulator, active: true } });
  if (!pkg || !sim) throw new HttpError(422, "Paket atau simulator tidak tersedia", "bad_package");

  const uploadIds = Object.values(input.documents);
  const uploads = await db.pendingUpload.findMany({ where: { id: { in: uploadIds }, claimed: false } });
  const byId = new Map(uploads.map((u) => [u.id, u]));
  for (const [kind, uid] of Object.entries(input.documents)) {
    const u = byId.get(uid);
    if (!u || u.kind !== kind) throw new HttpError(422, `Dokumen ${kind} tidak valid atau sudah dipakai, unggah ulang`, "bad_upload");
  }
  if (!requiredDocs(input.id_type).every((k) => input.documents[k])) throw new HttpError(422, "Dokumen wajib belum lengkap", "missing_docs");
  const today = todayJkt();
  if (input.medical_valid_until < today) throw new HttpError(422, "Medical sudah tidak berlaku", "medical_expired");
  if (input.icao_valid_until && input.icao_english !== "NONE" && input.icao_valid_until < today) throw new HttpError(422, "ICAO English Proficiency sudah tidak berlaku", "icao_expired");
  const other = resolveOther(input);
  const nik = input.id_type === "KTP" ? input.nik! : null;

  const pdata = {
    full_name: input.full_name,
    passport_no: input.passport_no ?? null,
    birth_place: input.birth_place,
    birth_date: dateOnly(input.birth_date),
    gender: input.gender,
    nationality: other.nationality,
    whatsapp: normalizePhone(input.whatsapp),
    email: input.email,
    address: input.address,
    city: input.city,
    province: input.province,
    postal_code: input.postal_code ?? null,
    licence_type: input.licence_type,
    licence_no: input.licence_no,
    licence_authority: other.licence_authority,
    licence_issued_at: dateOnly(input.licence_issued_at),
    instrument_rating: input.instrument_rating ?? null,
    type_ratings: other.type_ratings,
    total_hours: input.total_hours.replace(",", "."),
    hours_on_type: input.hours_on_type ? input.hours_on_type.replace(",", ".") : null,
    icao_english: input.icao_english ?? null,
    icao_valid_until: input.icao_valid_until && input.icao_english && input.icao_english !== "NONE" ? dateOnly(input.icao_valid_until) : null,
    organization: input.organization ?? null,
    position: input.position ?? null,
    medical_class: input.medical_class,
    medical_no: input.medical_no,
    medical_valid_until: dateOnly(input.medical_valid_until),
    locale: input.locale,
  } satisfies Omit<Prisma.ParticipantCreateInput, "nik">;

  const year = Number(todayJkt().slice(0, 4));
  const result = await db.$transaction(async (tx) => {
    const existing = nik
      ? await tx.participant.findUnique({ where: { nik } })
      : await tx.participant.findFirst({ where: { nik: null, passport_no: { equals: input.passport_no!, mode: "insensitive" } }, orderBy: { updated_at: "desc" } });
    const participant = existing
      ? await tx.participant.update({ where: { id: existing.id }, data: pdata })
      : await tx.participant.create({ data: { ...pdata, nik } });
    const reg_no = await nextRegNo(tx, year);
    const reg = await tx.registration.create({
      data: {
        reg_no,
        participant_id: participant.id,
        simulator_id: sim.id,
        package_id: pkg.id,
        hours_snapshot: pkg.hours,
        price_snapshot: pkg.price_idr,
        package_name_snapshot: pkg.name_id,
        pref_date_from: input.pref_date_from ? dateOnly(input.pref_date_from) : null,
        pref_date_to: input.pref_date_to ? dateOnly(input.pref_date_to) : null,
        pref_time: input.pref_time,
        purpose: input.purpose ?? null,
        notes: input.notes ?? null,
      },
    });
    for (const [kind, uid] of Object.entries(input.documents)) {
      const u = byId.get(uid)!;
      await tx.document.create({ data: { registration_id: reg.id, kind: kind as DocumentKind, storage_key: u.storage_key, original_name: u.original_name, mime: u.mime, size: u.size } });
    }
    await tx.pendingUpload.updateMany({ where: { id: { in: uploadIds } }, data: { claimed: true } });
    await createToken(tx, reg.id, reg_no, "DASHBOARD");
    await logActivity({ type: "PARTICIPANT", id: participant.id }, existing ? "registration.submitted_returning" : "registration.submitted", "registration", reg.id, { reg_no, package: pkg.code, sim: sim.code }, tx);
    return { reg, participant, returning: !!existing };
  });

  await notify("registration_received", result.reg.id);
  await notify("admin_new_registration", result.reg.id);
  await publish({ type: "admin", kind: "registration", id: result.reg.id });
  return { reg_no: result.reg.reg_no, id: result.reg.id, name: result.participant.full_name, email: result.participant.email };
}

/** Langkah 4–5: setujui dokumen → invoice terbit otomatis & terkirim. */
export async function approveRegistration(regId: number, admin: AdminCtx) {
  const s = await getSettings();
  const out = await db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: regId } });
    if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
    assertReg(reg.status, "PENDING_PAYMENT");
    await tx.document.updateMany({ where: { registration_id: regId, superseded: false }, data: { review: "OK", review_note: null } });
    await tx.registration.update({ where: { id: regId }, data: { status: "PENDING_PAYMENT", verified_by: admin.id, verified_at: new Date(), rejection_note: null } });
    const inv = await issueInvoice(tx, reg, s);
    await logActivity({ type: "ADMIN", id: admin.id }, "registration.approved", "registration", regId, { invoice_no: inv.invoice_no }, tx);
    return inv;
  });
  await notify("invoice_issued", regId);
  await publish({ type: "admin", kind: "registration", id: regId });
  return out;
}

/** E-01: tolak dokumen (catatan wajib) → link unggah ulang 7 hari, REG sama. */
export async function rejectRegistration(regId: number, admin: AdminCtx, note: string, kinds: DocumentKind[]) {
  if (!note.trim() || kinds.length === 0) throw new HttpError(422, "Catatan & dokumen yang ditolak wajib diisi");
  const s = await getSettings();
  const { raw, reg } = await db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: regId }, include: { participant: true } });
    if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
    assertReg(reg.status, "REUPLOAD_REQUIRED");
    await tx.document.updateMany({ where: { registration_id: regId, superseded: false, kind: { in: kinds } }, data: { review: "REJECTED", review_note: note } });
    await tx.document.updateMany({ where: { registration_id: regId, superseded: false, kind: { notIn: kinds } }, data: { review: "OK" } });
    await tx.registration.update({ where: { id: regId }, data: { status: "REUPLOAD_REQUIRED", rejection_note: note, verified_by: admin.id } });
    await tx.accessToken.updateMany({ where: { registration_id: regId, purpose: "REUPLOAD", revoked_at: null }, data: { revoked_at: new Date() } });
    const raw = await createToken(tx, regId, reg.reg_no, "REUPLOAD", new Date(Date.now() + s.reupload_token_days * 86400_000));
    await logActivity({ type: "ADMIN", id: admin.id }, "registration.rejected", "registration", regId, { note, kinds }, tx);
    return { raw, reg };
  });
  const t = translator(reg.participant.locale, "enums.docKind");
  await notify("documents_rejected", regId, { extra: { note, rejectedKinds: kinds.map((k) => t(k)), reuploadLink: reuploadUrl(raw, reg.participant.locale) } });
  await publish({ type: "admin", kind: "registration", id: regId });
}

/** Unggah ulang oleh peserta (token REUPLOAD). */
export async function submitReupload(tokenId: number, regId: number, files: Record<string, string>) {
  const reg = await db.registration.findUnique({ where: { id: regId }, include: { documents: { where: { superseded: false } } } });
  if (!reg || reg.status !== "REUPLOAD_REQUIRED") throw new HttpError(409, "Pendaftaran tidak sedang menunggu unggah ulang");
  const rejected = reg.documents.filter((d) => d.review === "REJECTED");
  if (!rejected.every((d) => files[d.kind])) throw new HttpError(422, "Semua dokumen yang ditolak wajib diunggah ulang");
  const uploads = await db.pendingUpload.findMany({ where: { id: { in: Object.values(files) }, claimed: false } });
  const byId = new Map(uploads.map((u) => [u.id, u]));
  await db.$transaction(async (tx) => {
    for (const d of rejected) {
      const u = byId.get(files[d.kind]!);
      if (!u || u.kind !== d.kind) throw new HttpError(422, `Unggahan ${d.kind} tidak valid`);
      await tx.document.update({ where: { id: d.id }, data: { superseded: true } });
      await tx.document.create({ data: { registration_id: regId, kind: d.kind, storage_key: u.storage_key, original_name: u.original_name, mime: u.mime, size: u.size, version: d.version + 1 } });
    }
    await tx.pendingUpload.updateMany({ where: { id: { in: Object.values(files) } }, data: { claimed: true } });
    assertReg(reg.status, "PENDING_VERIFICATION");
    await tx.registration.update({ where: { id: regId }, data: { status: "PENDING_VERIFICATION", reupload_count: { increment: 1 } } });
    await tx.accessToken.update({ where: { id: tokenId }, data: { revoked_at: new Date() } });
    await logActivity({ type: "PARTICIPANT", id: reg.participant_id }, "registration.reuploaded", "registration", regId, { kinds: rejected.map((d) => d.kind) }, tx);
  });
  await notify("admin_new_registration", regId);
  await publish({ type: "admin", kind: "registration", id: regId });
}

/** E-09: pembatalan (termasuk setelah lunas) + refund; slot mendatang dilepas. */
export async function cancelRegistration(regId: number, admin: AdminCtx, opts: { reason: string; refund_amount?: number; refund_at?: string; refund_proof_key?: string }) {
  if (!opts.reason.trim()) throw new HttpError(422, "Alasan pembatalan wajib diisi");
  const released = await db.$transaction(async (tx) => {
    const reg = await tx.registration.findUnique({ where: { id: regId }, include: { invoices: true } });
    if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
    assertReg(reg.status, "CANCELLED");
    await tx.registration.update({ where: { id: regId }, data: { status: "CANCELLED", cancelled_reason: opts.reason } });
    for (const inv of reg.invoices.filter((i) => i.status !== "CANCELLED")) {
      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          status: "CANCELLED",
          cancelled_at: new Date(),
          note: [inv.note, opts.reason].filter(Boolean).join(" · "),
          refund_amount: opts.refund_amount ? BigInt(Math.round(opts.refund_amount)) : null,
          refund_at: opts.refund_amount ? (opts.refund_at ? new Date(`${opts.refund_at}T12:00:00+07:00`) : new Date()) : null,
          refund_proof_key: opts.refund_proof_key ?? null,
        },
      });
    }
    const rel = await releaseFutureSlots(tx, regId, admin.id, `Dibatalkan: ${opts.reason}`);
    await logActivity({ type: "ADMIN", id: admin.id }, "registration.cancelled", "registration", regId, { reason: opts.reason, refund: opts.refund_amount ?? 0, released: rel.length }, tx);
    return rel;
  });
  for (const ev of released) await publish(ev);
  await publish({ type: "admin", kind: "registration", id: regId });
}

export async function logDocumentAccess(admin: AdminCtx, docId: number, regId: number) {
  await logActivity({ type: "ADMIN", id: admin.id }, "document.viewed", "document", docId, { registration_id: regId });
}

export { SYSTEM };
