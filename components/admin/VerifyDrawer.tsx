"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { Drawer, Lightbox } from "../Overlay";
import { useToast } from "../Toast";
import { api, fmtSize } from "../upload";
import { fmtDate, fmtShortTs, prettyPhone, rupiah, todayJkt } from "@/lib/format";
import { REG_PILL } from "@/lib/ui";

const KNOWN_AUTH = ["DGCA", "FAA", "EASA", "CASA", "OTHER"];

type Detail = {
  id: number; reg_no: string; status: string; created_at: string; participant_id: number; can_export: boolean; reupload_count: number; rejection_note: string | null; manual_threshold: number; verifier: string | null; verified_at: string | null;
  p: Record<string, string | null | string[]> & { full_name: string; email: string; whatsapp: string; medical_valid_until: string; type_ratings: string[] };
  sim: string; pkg: { name_id: string; name_en: string; short: string }; hours: number; price: number; invoice_total: number;
  pref: { from: string | null; to: string | null; time: string; purpose: string | null; notes: string | null };
  documents: { id: number; kind: string; name: string; mime: string; size: number; version: number; review: string; note: string | null; superseded: boolean; url: string }[];
  invoices: { id: number; no: string; status: string; total: number }[];
  history: { reg_no: string; status: string; sim: string; pkg: string; created_at: string }[];
};

export function VerifyDrawer() {
  const sp = useSearchParams();
  const reg = sp.get("reg");
  const router = useRouter();
  const path = usePathname();
  const t = useTranslations("admin.verify");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const tp = useTranslations("admin.people");
  const l = useLocale() as "id" | "en";
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [checks, setChecks] = useState([false, false, false, false]);
  const [note, setNote] = useState("");
  const [kinds, setKinds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<{ src: string; mime: string } | null>(null);

  useEffect(() => {
    setD(null);
    setChecks([false, false, false, false]);
    setNote("");
    setKinds([]);
    if (!reg) return;
    api<Detail>(`/api/admin/registrations/${reg}`).then(setD).catch((e) => toast(e.message));
  }, [reg, toast]);

  const close = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("reg");
    router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  if (!reg) return null;

  const current = d?.documents.filter((x) => !x.superseded) ?? [];
  const old = d?.documents.filter((x) => x.superseded) ?? [];
  const pending = d?.status === "PENDING_VERIFICATION";
  const medWarn = d && d.pref.to && d.p.medical_valid_until < d.pref.to;
  const today = todayJkt();
  const medExpired = !!d && d.p.medical_valid_until < today;
  const icaoUntil = (d?.p.icao_valid_until as string | null) ?? null;
  const icaoBad = !!icaoUntil && (icaoUntil < today || (!!d?.pref.to && icaoUntil < d.pref.to));

  async function approve() {
    if (!checks.every(Boolean)) return toast(t("needChecklist"));
    setBusy(true);
    try {
      const r = await api<{ invoice_no: string; email: string }>(`/api/admin/registrations/${reg}/approve`, { body: {} });
      toast(t("approved", { no: r.invoice_no, email: r.email }));
      close();
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }
  async function reject() {
    if (!note.trim() || !kinds.length) return toast(t("needNote"));
    setBusy(true);
    try {
      await api(`/api/admin/registrations/${reg}/reject`, { body: { note, kinds } });
      toast(t("rejected"));
      close();
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  const kv = (rows: [string, React.ReactNode][]) => (
    <div className="kv">
      {rows.map(([k, v]) => (
        <span key={k} style={{ display: "contents" }}>
          <span className="k">{k}</span>
          <span className="v">{v || "—"}</span>
        </span>
      ))}
    </div>
  );

  return (
    <>
      <Drawer
        open
        onClose={close}
        head={
          <div>
            <div className="eyebrow">{d ? t("drawerIn", { reg: d.reg_no, ts: fmtShortTs(new Date(d.created_at), l) }) : tc("loading")}</div>
            <h3>{d?.p.full_name ?? "…"}</h3>
            {d && <span className={`pill ${REG_PILL[d.status]}`} style={{ marginTop: 6 }}>{te(`registrationStatus.${d.status}` as "registrationStatus.PAID")}</span>}
          </div>
        }
        footer={
          d && pending ? (
            <>
              <button className="btn bad" disabled={busy} onClick={reject}>{t("reject")}</button>
              <button className="btn ok" disabled={busy} aria-busy={busy} onClick={approve}>{t("approve")}</button>
            </>
          ) : d ? (
            <button className="btn ghost" onClick={close}>{tc("close")}</button>
          ) : null
        }
      >
        {!d ? (
          <div className="empty">{tc("loading")}</div>
        ) : (
          <>
            {d.reupload_count > 0 && (
              <div className={`banner ${d.reupload_count >= d.manual_threshold ? "bad" : "warn"}`}>
                {t("reuploadCount", { n: d.reupload_count })}
                {d.reupload_count >= d.manual_threshold ? ` · ${t("manualContact", { n: d.manual_threshold })}` : ""}
                {d.rejection_note ? ` · “${d.rejection_note}”` : ""}
              </div>
            )}
            <div className="card pad">
              <div className="row between" style={{ marginBottom: 10 }}>
                <div className="eyebrow">{t("docsTitle")}</div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="small faint">{t("docAccessLogged")}</span>
                  {d.can_export && <a className="btn xs xls" href={`/api/admin/participants/${d.participant_id}/export`} download title={tp("downloadTitle")}>{tp("drawerBtn")}</a>}
                  {d.can_export && <a className="btn xs ghost" href={`/api/admin/participants/${d.participant_id}/pdf`} download title={tp("downloadPdfTitle")}>{tp("downloadPdf")}</a>}
                </div>
              </div>
              <div className="docgrid">
                {current.map((doc) => (
                  <div key={doc.id} className={`doc ${doc.review === "REJECTED" ? "rej" : ""}`}>
                    <div className="img" onClick={() => setZoom({ src: doc.url, mime: doc.mime })} role="button" tabIndex={0} aria-label={t("zoom")}>
                      <span className="kind">{doc.kind === "LICENCE_FRONT" ? "LICENCE" : doc.kind.replace("LICENCE_", "LIC ")}</span>
                      {doc.mime === "application/pdf" ? (
                        <span>📄 PDF</span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- dokumen privat via URL bertanda tangan
                        <img src={doc.url} alt={doc.kind} loading="lazy" />
                      )}
                    </div>
                    <div className="cap">
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={doc.name}>
                        {te(`docKind.${doc.kind}` as "docKind.KTP")} <span className="faint">· {t("versionN", { n: doc.version })} · {fmtSize(doc.size)}</span>
                      </span>
                      <button className="btn xs ghost" onClick={() => setZoom({ src: doc.url, mime: doc.mime })}>{t("zoom")}</button>
                    </div>
                  </div>
                ))}
              </div>
              {old.length > 0 && (
                <div className="small muted" style={{ marginTop: 10 }}>
                  {old.map((o) => (
                    <a key={o.id} href={o.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>
                      {o.kind} {t("versionN", { n: o.version })} ({te(`docReview.${o.review}` as "docReview.OK")})
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="grid g2">
              <div className="card pad">
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t("matchTitle")}</div>
                {kv([
                  [t("nameOnForm"), d.p.full_name],
                  [l === "id" ? "Jenis lisensi" : "Licence type", d.p.licence_type as string],
                  [t("number"), <span className="mono" key="n">{d.p.licence_no}</span>],
                  [t("issuer"), d.p.licence_authority ? (KNOWN_AUTH.includes(d.p.licence_authority as string) ? te(`authority.${d.p.licence_authority}` as "authority.DGCA") : (d.p.licence_authority as string)) : ""],
                  [t("issuedAt"), fmtDate(d.p.licence_issued_at as string, l)],
                  [t("ir"), d.p.instrument_rating ? te(`instrumentRating.${d.p.instrument_rating}` as "instrumentRating.VALID") : ""],
                  ["Type rating", (d.p.type_ratings ?? []).join(", ")],
                  [t("totalHours"), <span className="mono" key="h">{d.p.total_hours}</span>],
                ])}
              </div>
              <div className="card pad">
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t("medTitle")}</div>
                {kv([
                  ["Medical", <>{te(`medicalClass.${d.p.medical_class}` as "medicalClass.C1")} · <span className="mono">{d.p.medical_no}</span></>],
                  [t("validUntil"), <span key="m" style={{ color: medWarn || medExpired ? "var(--bad)" : "var(--ok)" }}>{fmtDate(d.p.medical_valid_until, l)} {medWarn || medExpired ? "⚠" : "✓"}</span>],
                  ["ICAO English", d.p.icao_english ? <span key="i" style={icaoBad ? { color: "var(--bad)" } : undefined}>{te(`icao.${d.p.icao_english}` as "icao.L4")}{icaoUntil ? ` · ${fmtDate(icaoUntil, l)}` : ""}{icaoBad ? " ⚠" : ""}</span> : ""],
                  d.p.nik ? ["NIK", <span className="mono" key="nik">{d.p.nik}</span>] : [te("docKind.PASSPORT"), <span className="mono" key="nik">{d.p.passport_no}</span>],
                  [t("born"), `${d.p.birth_place}, ${fmtDate(d.p.birth_date as string, l)}`],
                  ["WA", <span className="mono" key="wa">{prettyPhone(d.p.whatsapp)}</span>],
                  ["Email", d.p.email],
                  [l === "id" ? "Instansi" : "Organization", d.p.organization as string],
                ])}
              </div>
            </div>
            {medWarn && <div className="banner warn">{t("medicalWarn", { date: fmtDate(d.p.medical_valid_until, l), to: fmtDate(d.pref.to!, l) })}</div>}
            {pending && (
              <div className="card pad">
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t("checklist")}</div>
                <div className="stack" style={{ gap: 8, fontSize: 14 }}>
                  {[t("c1"), t("c2"), t("c3"), t("c4")].map((c, i) => (
                    <label className="row" key={c}>
                      <input type="checkbox" checked={checks[i]} onChange={(e) => setChecks((x) => x.map((v, j) => (j === i ? e.target.checked : v)))} />
                      {c}
                    </label>
                  ))}
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <span className="flabel">{t("rejectDocs")}</span>
                  <div className="chips">
                    {current.map((doc) => (
                      <button type="button" key={doc.kind} className={`chk ${kinds.includes(doc.kind) ? "on" : ""}`} onClick={() => setKinds((k) => (k.includes(doc.kind) ? k.filter((x) => x !== doc.kind) : [...k, doc.kind]))}>
                        {te(`docKind.${doc.kind}` as "docKind.KTP")}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="field" style={{ marginTop: 12 }}>
                  <span className="flabel">{t("noteLabel")}</span>
                  <textarea className="in" rows={2} placeholder={t("notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
            )}
            <div className="card pad" style={{ background: "var(--teal-tint)" }}>
              <div className="row between wrap">
                <div>
                  <div className="eyebrow">{t("pkgChosen")}</div>
                  <b>
                    {l === "id" ? d.pkg.name_id : d.pkg.name_en} – {tc(`sim.${d.sim as "A320"}`)} · {tc("hours", { n: d.hours })}
                  </b>
                  <div className="small muted">
                    {te(`prefTimeShort.${d.pref.time as "MORNING"}`)} · {d.pref.from ? fmtDate(d.pref.from, l) : "—"} – {d.pref.to ? fmtDate(d.pref.to, l) : "—"}
                    {d.pref.purpose ? ` · ${te(`purpose.${d.pref.purpose as "PPC"}`)}` : ""}
                  </div>
                  {d.pref.notes && <div className="small" style={{ marginTop: 6 }}>“{d.pref.notes}”</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="eyebrow">{t("invoiceWill")}</div>
                  <div style={{ fontFamily: "var(--display)", fontSize: 26, color: "var(--teal-deep)" }}>{rupiah(d.invoices[0]?.total ?? d.invoice_total)}</div>
                  {d.invoices[0] && <div className="small mono muted">{d.invoices[0].no} · {te(`invoiceStatus.${d.invoices[0].status}` as "invoiceStatus.PAID")}</div>}
                </div>
              </div>
            </div>
            <div className="card pad">
              <div className="eyebrow" style={{ marginBottom: 8 }}>{t("history")}</div>
              {d.history.length === 0 ? (
                <div className="small muted">{t("historyEmpty")}</div>
              ) : (
                d.history.map((h) => (
                  <div key={h.reg_no} className="row between small" style={{ padding: "4px 0" }}>
                    <span className="mono">{h.reg_no}</span>
                    <span><span className={`chip ${h.sim.toLowerCase()}`}>{h.sim}</span> {h.pkg}</span>
                    <span className={`pill xs ${REG_PILL[h.status]}`}>{te(`registrationStatus.${h.status}` as "registrationStatus.PAID")}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Drawer>
      <Lightbox src={zoom?.src ?? null} mime={zoom?.mime} onClose={() => setZoom(null)} />
    </>
  );
}
