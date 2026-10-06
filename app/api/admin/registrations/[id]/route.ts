import { handler, json } from "@/lib/api";
import { HttpError, requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { usage } from "@/lib/services/slots";
import { ymd } from "@/lib/format";

/** Detail pendaftar untuk drawer verifikasi. URL dokumen lewat /api/admin/documents/:id (dicatat di log). */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const id = Number((await params).id);
  const s = await getSettings();
  const r = await db.registration.findUnique({
    where: { id },
    include: { participant: true, package: true, simulator: true, documents: { orderBy: [{ kind: "asc" }, { version: "desc" }] }, invoices: { orderBy: { issued_at: "desc" } } },
  });
  if (!r) throw new HttpError(404, "Tidak ditemukan");
  const history = await db.registration.findMany({ where: { participant_id: r.participant_id, NOT: { id } }, include: { package: true, simulator: true }, orderBy: { created_at: "desc" } });
  const u = await usage(db, id, s, r.hours_snapshot);
  const verifier = r.verified_by ? await db.adminUser.findUnique({ where: { id: r.verified_by }, select: { name: true } }) : null;
  const vat = Math.round((Number(r.price_snapshot) * s.vat_percent) / 100);
  return json({
    id: r.id,
    reg_no: r.reg_no,
    status: r.status,
    created_at: r.created_at,
    reupload_count: r.reupload_count,
    rejection_note: r.rejection_note,
    manual_threshold: s.reupload_manual_threshold,
    verifier: verifier?.name ?? null,
    verified_at: r.verified_at,
    participant_id: r.participant_id,
    can_export: a.role === "SUPER_ADMIN",
    p: { ...r.participant, birth_date: ymd(r.participant.birth_date), licence_issued_at: ymd(r.participant.licence_issued_at), medical_valid_until: ymd(r.participant.medical_valid_until), icao_valid_until: r.participant.icao_valid_until ? ymd(r.participant.icao_valid_until) : null, total_hours: String(r.participant.total_hours), hours_on_type: r.participant.hours_on_type ? String(r.participant.hours_on_type) : null },
    sim: r.simulator.code,
    pkg: { name_id: r.package.name_id, name_en: r.package.name_en, short: r.package.short_id },
    hours: r.hours_snapshot,
    price: Number(r.price_snapshot),
    invoice_total: Number(r.price_snapshot) + vat,
    pref: { from: r.pref_date_from ? ymd(r.pref_date_from) : null, to: r.pref_date_to ? ymd(r.pref_date_to) : null, time: r.pref_time, purpose: r.purpose, notes: r.notes },
    documents: r.documents.map((d) => ({ id: d.id, kind: d.kind, name: d.original_name, mime: d.mime, size: d.size, version: d.version, review: d.review, note: d.review_note, superseded: d.superseded, url: `/api/admin/documents/${d.id}` })),
    invoices: r.invoices.map((i) => ({ id: i.id, no: i.invoice_no, status: i.status, total: Number(i.total) })),
    history: history.map((h) => ({ reg_no: h.reg_no, status: h.status, sim: h.simulator.code, pkg: h.package.short_id, created_at: h.created_at })),
    usage: u,
  });
});
