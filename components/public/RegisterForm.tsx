"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { AUTHORITIES, DOC_KINDS, NATIONALITIES, POSITIONS, PURPOSES, RELATIONS, REQUIRED_DOCS, TYPE_RATINGS, medicalWarning, step1, step2, step4 } from "@/lib/schemas";
import { fmtDate, rupiah } from "@/lib/format";
import { ACCEPT, api, fmtSize, uploadFile, type Uploaded } from "../upload";
import { useToast } from "../Toast";

type Pkg = { code: string; name: string; short: string; hours: number; price: number };
type Values = Record<string, string | string[]>;
type DocState = Record<string, (Uploaded & { at: number }) | { uploading: true; name: string } | { error: string; name: string } | undefined>;

const DRAFT_KEY = "bwi-sim-draft-v1";
const DOC_ICON: Record<string, string> = { KTP: "🪪", MEDICAL: "🩺", LICENCE_FRONT: "📄", LICENCE_RATING: "📑", PHOTO: "📷", PASSPORT: "🛂" };

const EMPTY: Values = {
  full_name: "", nik: "", passport_no: "", birth_place: "", birth_date: "", gender: "", nationality: "ID", whatsapp: "", email: "", address: "", city: "", province: "", postal_code: "",
  emergency_name: "", emergency_relation: "", emergency_phone: "", licence_type: "", licence_no: "", licence_authority: "DGCA", licence_issued_at: "", instrument_rating: "", type_ratings: [],
  total_hours: "", hours_on_type: "", icao_english: "", organization: "", position: "", medical_class: "", medical_no: "", medical_valid_until: "", medical_center: "",
  simulator: "A320", package: "", pref_date_from: "", pref_date_to: "", pref_time: "FLEXIBLE", purpose: "", notes: "",
};

function readDraft(): { v: Values; docs: DocState; step: number } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // Unggahan sementara berlaku 24 jam di server → buang yang > 20 jam.
    const docs: DocState = {};
    for (const [k, x] of Object.entries((d.docs ?? {}) as DocState)) if (x && "id" in x && Date.now() - x.at < 20 * 3600_000) docs[k] = x;
    return { v: { ...EMPTY, ...d.v }, docs, step: d.step ?? 1 };
  } catch {
    return null;
  }
}

export function RegisterForm({ packages, slotHours, initialPkg, initialSim }: { packages: Pkg[]; slotHours: number; initialPkg?: string; initialSim?: string }) {
  const t = useTranslations("form");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Values>(() => ({ ...EMPTY, package: initialPkg ?? packages[0]?.code ?? "", simulator: initialSim === "B737" ? "B737" : "A320" }));
  const [docs, setDocs] = useState<DocState>({});
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setV({ ...d.v, ...(initialPkg ? { package: initialPkg } : {}), ...(initialSim ? { simulator: initialSim } : {}) });
      setDocs(d.docs);
      setStep(Math.min(d.step, 4));
    }
    setLoaded(true);
  }, [initialPkg, initialSim]);
  useEffect(() => {
    if (!loaded) return;
    const docsOk = Object.fromEntries(Object.entries(docs).filter(([, x]) => x && "id" in x));
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ v, docs: docsOk, step }));
    } catch {}
  }, [v, docs, step, loaded]);

  const set = (k: string, val: string | string[]) => {
    setV((o) => ({ ...o, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
  };
  const pkg = packages.find((p) => p.code === v.package) ?? packages[0];

  function errMsg(code: string) {
    const known = ["required", "nik", "email", "phone", "date", "hours", "range", "documents", "agree"];
    return t(`errors.${known.includes(code) ? code : "generic"}` as "errors.required");
  }
  function validate(n: number): boolean {
    const e: Record<string, string> = {};
    const schema = n === 1 ? step1 : n === 2 ? step2 : n === 4 ? step4 : null;
    if (schema) {
      const r = schema.safeParse(v);
      if (!r.success) for (const i of r.error.issues) e[String(i.path[0])] ??= errMsg(i.code === "invalid_type" || i.code === "invalid_value" ? "required" : i.message);
    }
    if (n === 3) for (const k of REQUIRED_DOCS) if (!(docs[k] && "id" in docs[k]!)) e[k] = errMsg("documents");
    if (n === 5 && !agree) e.agree = errMsg("agree");
    setErrors(e);
    if (Object.keys(e).length) {
      toast(t("fixErrors"));
      setTimeout(() => document.querySelector(".invalid, .upload.bad")?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
    }
    return !Object.keys(e).length;
  }
  function go(n: number) {
    if (n > step) for (let i = step; i < n; i++) if (!validate(i)) return setStep(i);
    setStep(n);
    topRef.current?.scrollIntoView({ block: "start" });
  }
  async function onFile(kind: string, f: File | undefined) {
    if (!f) return;
    setDocs((d) => ({ ...d, [kind]: { uploading: true, name: f.name } }));
    try {
      const up = await uploadFile(f, kind);
      setDocs((d) => ({ ...d, [kind]: { ...up, at: Date.now() } }));
      setErrors((e) => ({ ...e, [kind]: "" }));
    } catch (err) {
      setDocs((d) => ({ ...d, [kind]: { error: (err as Error).message, name: f.name } }));
    }
  }
  async function submit() {
    for (let i = 1; i <= 5; i++) if (!validate(i)) return setStep(i);
    setBusy(true);
    try {
      const documents = Object.fromEntries(Object.entries(docs).flatMap(([k, x]) => (x && "id" in x ? [[k, x.id]] : [])));
      const r = await api<{ reg_no: string }>("/api/public/registrations", { body: { ...v, documents, agree: true, locale: l } });
      localStorage.removeItem(DRAFT_KEY);
      router.push(`/daftar/terkirim/${r.reg_no}`);
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  const medWarn = medicalWarning({ medical_valid_until: v.medical_valid_until as string, pref_date_to: v.pref_date_to as string });

  // ---------- field helpers ----------
  const inp = (k: string, extra: Record<string, unknown> = {}) => ({
    id: `f_${k}`,
    name: k,
    className: `in ${extra.mono ? "mono" : ""} ${errors[k] ? "invalid" : ""}`,
    value: (v[k] as string) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    "aria-invalid": !!errors[k],
  });
  const sel = (k: string, opts: readonly string[], label: (o: string) => string, withEmpty = true) => (
    <select {...inp(k)}>
      {withEmpty && <option value="">{t("select")}</option>}
      {opts.map((o) => (
        <option key={o} value={o}>
          {label(o)}
        </option>
      ))}
    </select>
  );

  const stepNames = [t("step1"), t("step2"), t("step3"), t("step4"), t("step5")];

  const review = useMemo(() => {
    const kv = (o: [string, ReactNode][]) => o.map(([k, x]) => [<span className="k" key={k + "k"}>{k}</span>, <span className="v" key={k + "v"}>{x}</span>]);
    return {
      p: kv([
        [t("rvName"), v.full_name as string],
        ["NIK", <span className="mono" key="n">{v.nik as string}</span>],
        [t("rvBorn"), `${v.birth_place}, ${v.birth_date ? fmtDate(v.birth_date as string, l) : ""}`],
        ["WhatsApp", <span className="mono" key="w">{v.whatsapp as string}</span>],
        [t("email"), v.email as string],
        [t("city"), v.city as string],
      ]),
      lic: kv([
        [t("licence_type"), v.licence_type as string],
        [t("licence_no"), <span className="mono" key="l">{v.licence_no as string}</span>],
        [t("licence_authority"), v.licence_authority ? te(`authority.${v.licence_authority}` as "authority.DGCA") : ""],
        [t("total_hours"), <span className="mono" key="h">{v.total_hours as string}</span>],
        ["Medical", `${v.medical_class ? te(`medicalClass.${v.medical_class}` as "medicalClass.C1") : ""} · s/d ${v.medical_valid_until ? fmtDate(v.medical_valid_until as string, l) : ""}`],
        [t("rvDocs"), `${Object.values(docs).filter((d) => d && "id" in d).length} ✓`],
      ]),
    };
  }, [v, docs, t, te, l]);

  return (
    <div ref={topRef}>
      <div className="steps-h" role="tablist">
        {stepNames.map((n, i) => (
          <button type="button" key={n} className={`st ${step === i + 1 ? "now" : ""} ${step > i + 1 ? "done" : ""}`} onClick={() => go(i + 1)} style={{ border: 0, background: step === i + 1 ? undefined : "transparent", textAlign: "left", font: "inherit" }}>
            <span className="n">{step > i + 1 ? "✓" : i + 1}</span>
            {n}
          </button>
        ))}
      </div>

      <form className="card pad" onSubmit={(e) => e.preventDefault()} noValidate>
        {step === 1 && (
          <div className="fgrid">
            <Returning onLoaded={(d) => { setV((o) => ({ ...o, ...d })); toast(t("returningDone")); }} />
            <div className="sect">{t("secIdentity")}</div>
            <F k="full_name" err={errors.full_name} label={t("full_name")} req full><input {...inp("full_name")} autoComplete="name" /></F>
            <F k="nik" err={errors.nik} label={t("nik")} req hint={t("nikHint")}><input {...inp("nik", { mono: true })} inputMode="numeric" maxLength={16} /></F>
            <F k="passport_no" err={errors.passport_no} label={<>{t("passport_no")} <span className="hint">{tc("optional")}</span></>}><input {...inp("passport_no", { mono: true })} /></F>
            <F k="birth_place" err={errors.birth_place} label={t("birth_place")} req><input {...inp("birth_place")} /></F>
            <F k="birth_date" err={errors.birth_date} label={t("birth_date")} req><input {...inp("birth_date")} type="date" /></F>
            <F k="gender" err={errors.gender} label={t("gender")} req>{sel("gender", ["M", "F"], (o) => te(`gender.${o}` as "gender.M"))}</F>
            <F k="nationality" err={errors.nationality} label={t("nationality")} req>{sel("nationality", NATIONALITIES, (o) => te(`nationality.${o}` as "nationality.ID"), false)}</F>
            <div className="sect">{t("secContact")}</div>
            <F k="whatsapp" err={errors.whatsapp} label={t("whatsapp")} req hint={t("whatsappHint")}><input {...inp("whatsapp", { mono: true })} inputMode="tel" autoComplete="tel" placeholder="0812-…" /></F>
            <F k="email" err={errors.email} label={t("email")} req hint={t("emailHint")}><input {...inp("email")} type="email" autoComplete="email" /></F>
            <F k="address" err={errors.address} label={t("address")} req full><input {...inp("address")} autoComplete="street-address" /></F>
            <F k="city" err={errors.city} label={t("city")} req><input {...inp("city")} /></F>
            <F k="province" err={errors.province} label={t("province")} req><input {...inp("province")} /></F>
            <F k="postal_code" err={errors.postal_code} label={t("postal_code")}><input {...inp("postal_code", { mono: true })} inputMode="numeric" /></F>
            <div className="sect">{t("secEmergency")}</div>
            <F k="emergency_name" err={errors.emergency_name} label={t("emergency_name")} req><input {...inp("emergency_name")} /></F>
            <F k="emergency_relation" err={errors.emergency_relation} label={t("emergency_relation")} req>{sel("emergency_relation", RELATIONS, (o) => te(`relation.${o}` as "relation.SPOUSE"))}</F>
            <F k="emergency_phone" err={errors.emergency_phone} label={t("emergency_phone")} req><input {...inp("emergency_phone", { mono: true })} inputMode="tel" /></F>
          </div>
        )}

        {step === 2 && (
          <div className="fgrid">
            <div className="sect">{t("secLicence")}</div>
            <F k="licence_type" err={errors.licence_type} label={t("licence_type")} req>{sel("licence_type", ["CPL", "ATPL", "PPL", "MPL", "SPL"], (o) => te(`licenceType.${o}` as "licenceType.CPL"))}</F>
            <F k="licence_no" err={errors.licence_no} label={t("licence_no")} req><input {...inp("licence_no", { mono: true })} /></F>
            <F k="licence_authority" err={errors.licence_authority} label={t("licence_authority")} req>{sel("licence_authority", AUTHORITIES, (o) => te(`authority.${o}` as "authority.DGCA"), false)}</F>
            <F k="licence_issued_at" err={errors.licence_issued_at} label={t("licence_issued_at")} req><input {...inp("licence_issued_at")} type="date" /></F>
            <F k="instrument_rating" err={errors.instrument_rating} label={t("instrument_rating")}>{sel("instrument_rating", ["VALID", "EXPIRED", "NONE"], (o) => te(`instrumentRating.${o}` as "instrumentRating.VALID"))}</F>
            <F k="type_ratings" err={errors.type_ratings} label={t("type_ratings")}>
              <div className="chips">
                {TYPE_RATINGS.map((o) => {
                  const cur = v.type_ratings as string[];
                  const on = cur.includes(o);
                  return (
                    <button type="button" key={o} className={`chk ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set("type_ratings", o === "NONE" ? (on ? [] : ["NONE"]) : on ? cur.filter((x) => x !== o) : [...cur.filter((x) => x !== "NONE"), o])}>
                      {te(`typeRating.${o}` as "typeRating.A320")}
                    </button>
                  );
                })}
              </div>
            </F>
            <F k="total_hours" err={errors.total_hours} label={t("total_hours")} req hint={t("totalHoursHint")}><input {...inp("total_hours", { mono: true })} inputMode="decimal" /></F>
            <F k="hours_on_type" err={errors.hours_on_type} label={t("hours_on_type")}><input {...inp("hours_on_type", { mono: true })} inputMode="decimal" /></F>
            <F k="icao_english" err={errors.icao_english} label={t("icao_english")}>{sel("icao_english", ["L4", "L5", "L6", "NONE"], (o) => te(`icao.${o}` as "icao.L4"))}</F>
            <F k="organization" err={errors.organization} label={t("organization")}><input {...inp("organization")} /></F>
            <F k="position" err={errors.position} label={t("position")}>{sel("position", POSITIONS, (o) => te(`position.${o}` as "position.FO"))}</F>
            <div className="sect">{t("secMedical")}</div>
            <F k="medical_class" err={errors.medical_class} label={t("medical_class")} req>{sel("medical_class", ["C1", "C2"], (o) => te(`medicalClass.${o}` as "medicalClass.C1"))}</F>
            <F k="medical_no" err={errors.medical_no} label={t("medical_no")} req><input {...inp("medical_no", { mono: true })} /></F>
            <F k="medical_valid_until" err={errors.medical_valid_until} label={t("medical_valid_until")} req><input {...inp("medical_valid_until")} type="date" /></F>
            <F k="medical_center" err={errors.medical_center} label={t("medical_center")}><input {...inp("medical_center")} /></F>
          </div>
        )}

        {step === 3 && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="sect" style={{ border: 0, margin: 0 }}>
              {t("docsTitle")} <span className="small muted" style={{ fontFamily: "var(--font)", fontWeight: 400 }}>{t("docsHint")}</span>
            </div>
            {DOC_KINDS.map((k) => {
              const d = docs[k];
              const req = (REQUIRED_DOCS as readonly string[]).includes(k);
              const ok = d && "id" in d;
              return (
                <label key={k} className={`upload ${ok ? "done" : ""} ${errors[k] || (d && "error" in d) ? "bad" : ""}`} style={{ position: "relative", cursor: "pointer" }}>
                  <div className="ic" aria-hidden>{DOC_ICON[k]}</div>
                  <div className="grow">
                    <b>{te(`docKind.${k}` as "docKind.KTP")}</b> {req ? <span className="req" style={{ color: "var(--bad)" }}>*</span> : <span className="small muted">{tc("optional")}</span>}
                    <div className="small muted">
                      {ok ? `${d.name} · ${fmtSize(d.size)}` : d && "uploading" in d ? `${d.name} · ${t("uploading")}` : d && "error" in d ? `${t("uploadFailed")}: ${d.error}` : t(`doc${k}` as "docKTP")}
                    </div>
                  </div>
                  {ok ? <span className="pill ok">{t("uploaded")}</span> : null}
                  <span className="btn ghost sm">{ok ? t("replaceFile") : t("chooseFile")}</span>
                  <input type="file" accept={ACCEPT} onChange={(e) => onFile(k, e.target.files?.[0])} />
                </label>
              );
            })}
            <div className="callout">{t("docsCallout")}</div>
          </div>
        )}

        {step === 4 && (
          <div className="stack" style={{ gap: 18 }}>
            <div>
              <div className="sect" style={{ border: 0, margin: "0 0 10px" }}>{t("secSim")}</div>
              <div className="grid g2" role="radiogroup">
                {(["A320", "B737"] as const).map((s) => (
                  <div key={s} role="radio" tabIndex={0} aria-checked={v.simulator === s} className={`radio-card ${v.simulator === s ? "sel" : ""}`} onClick={() => set("simulator", s)} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && set("simulator", s)}>
                    <span className={`chip ${s.toLowerCase()}`} style={{ alignSelf: "flex-start" }}>{s}</span>
                    <span className="t">{tc(`simFtd.${s}`)}</span>
                    <span className="small muted">{t(s === "A320" ? "simA320Desc" : "simB737Desc")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="sect" style={{ border: 0, margin: "0 0 10px" }}>{t("secPkg")}</div>
              <div className="grid g2" role="radiogroup">
                {packages.map((p) => (
                  <div key={p.code} role="radio" tabIndex={0} aria-checked={v.package === p.code} className={`radio-card ${v.package === p.code ? "sel" : ""}`} onClick={() => set("package", p.code)} onKeyDown={(e) => (e.key === " " || e.key === "Enter") && set("package", p.code)}>
                    <span className="t">{p.name}</span>
                    <span className="small muted">{t("pkgMeta", { h: p.hours, s: Math.ceil(p.hours / slotHours), slot: slotHours })}</span>
                    <span className="price">{rupiah(p.price)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="fgrid">
              <div className="sect">
                {t("secPref")} <span className="small muted" style={{ fontFamily: "var(--font)", fontWeight: 400 }}>{t("secPrefHint")}</span>
              </div>
              <F k="pref_date_from" err={errors.pref_date_from} label={t("pref_date_from")}><input {...inp("pref_date_from")} type="date" /></F>
              <F k="pref_date_to" err={errors.pref_date_to} label={t("pref_date_to")}><input {...inp("pref_date_to")} type="date" /></F>
              <F k="pref_time" err={errors.pref_time} label={t("pref_time")}>{sel("pref_time", ["MORNING", "AFTERNOON", "FLEXIBLE"], (o) => te(`prefTime.${o}` as "prefTime.MORNING"), false)}</F>
              <F k="purpose" err={errors.purpose} label={t("purpose")}>{sel("purpose", PURPOSES, (o) => te(`purpose.${o}` as "purpose.PPC"))}</F>
              <F k="notes" err={errors.notes} label={t("notes")} full><textarea {...inp("notes")} rows={3} maxLength={1000} /></F>
              {medWarn && <div className="callout full" style={{ gridColumn: "1/-1" }}>{t("medicalWarn", { date: fmtDate(v.medical_valid_until as string, l) })}</div>}
            </div>
          </div>
        )}

        {step === 5 && pkg && (
          <div className="stack" style={{ gap: 18 }}>
            <div className="grid g2">
              <div className="card pad" style={{ boxShadow: "none" }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t("rvParticipant")}</div>
                <div className="kv">{review.p}</div>
              </div>
              <div className="card pad" style={{ boxShadow: "none" }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>{t("rvLicence")}</div>
                <div className="kv">{review.lic}</div>
              </div>
            </div>
            <div className="card pad" style={{ boxShadow: "none", background: "var(--teal-tint)" }}>
              <div className="row between wrap">
                <div>
                  <div className="eyebrow">{t("rvPkg")}</div>
                  <h3 style={{ marginTop: 4 }}>{pkg.name} · {tc(`sim.${v.simulator as "A320"}`)}</h3>
                  <div className="small muted">
                    {t("rvPrefLine", {
                      h: pkg.hours,
                      s: Math.ceil(pkg.hours / slotHours),
                      slot: slotHours,
                      time: te(`prefTimeShort.${v.pref_time as "MORNING"}`),
                      from: v.pref_date_from ? fmtDate(v.pref_date_from as string, l) : "—",
                      to: v.pref_date_to ? fmtDate(v.pref_date_to as string, l) : "—",
                    })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="eyebrow">{t("rvTotal")}</div>
                  <div style={{ fontFamily: "var(--display)", fontSize: 32, color: "var(--teal-deep)" }}>{rupiah(pkg.price)}</div>
                  <div className="small muted">{t("rvPayNote")}</div>
                </div>
              </div>
            </div>
            {medWarn && <div className="callout">{t("medicalWarn", { date: fmtDate(v.medical_valid_until as string, l) })}</div>}
            <label className="row" style={{ alignItems: "flex-start", gap: 10, fontSize: 14 }}>
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: "" })); }} style={{ marginTop: 4 }} />
              <span>{t("agree")}{errors.agree && <span className="err" style={{ display: "block", color: "var(--bad)", fontSize: 12, fontWeight: 600 }}>{errors.agree}</span>}</span>
            </label>
          </div>
        )}

        <div className="row between wrap" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--line-soft)" }}>
          <button type="button" className="btn ghost" onClick={() => go(step - 1)} style={{ visibility: step === 1 ? "hidden" : "visible" }}>{tc("back")}</button>
          <span className="small muted">{t("stepOf", { n: step })} · <span className="faint">{t("draftSaved")}</span></span>
          {step < 5 ? (
            <button type="button" className="btn" onClick={() => go(step + 1)}>{tc("next")}</button>
          ) : (
            <button type="button" className="btn lime" onClick={submit} disabled={busy} aria-busy={busy}>{busy ? t("submitting") : t("submit")}</button>
          )}
        </div>
      </form>
    </div>
  );
}

function F({ k, label, req, hint, full, err, children }: { k: string; label: ReactNode; req?: boolean; hint?: ReactNode; full?: boolean; err?: string; children: ReactNode }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={`f_${k}`}>
        {label} {req ? <span className="req">*</span> : null}
      </label>
      {children}
      {err ? <span className="err">{err}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/** E-08: peserta lama — OTP email → prefill data diri & lisensi. */
function Returning({ onLoaded }: { onLoaded: (d: Values) => void }) {
  const t = useTranslations("form");
  const l = useLocale();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <div className="full callout info row between wrap" style={{ gridColumn: "1/-1" }}>
        <span><b>{t("returningTitle")}</b> {t("returningDesc")}</span>
        <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>{t("returningVerify")} →</button>
      </div>
    );
  return (
    <div className="full card pad" style={{ gridColumn: "1/-1", boxShadow: "none", background: "var(--teal-tint)" }}>
      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        <div className="field grow">
          <label>{t("returningEmail")}</label>
          <input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="button" className="btn sm" disabled={busy || !email} onClick={async () => {
          setBusy(true);
          try { await api("/api/public/returning/request", { body: { email, locale: l } }); setSent(true); toast(t("returningSent")); } catch (e) { toast((e as Error).message); }
          setBusy(false);
        }}>{t("returningSend")}</button>
        {sent && (
          <>
            <div className="field" style={{ width: 140 }}>
              <label>{t("returningCode")}</label>
              <input className="in mono" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            <button type="button" className="btn lime sm" disabled={busy || code.length !== 6} onClick={async () => {
              setBusy(true);
              try { const r = await api<{ data: Values }>("/api/public/returning/verify", { body: { email, code } }); onLoaded(r.data); setOpen(false); } catch { toast(t("returningBad")); }
              setBusy(false);
            }}>{t("returningVerify")}</button>
          </>
        )}
      </div>
      {sent && <div className="small muted" style={{ marginTop: 8 }}>{t("returningSent")}</div>}
    </div>
  );
}
