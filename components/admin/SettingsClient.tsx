"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Modal } from "../Overlay";
import { useToast } from "../Toast";
import { api } from "../upload";
import { dayShort, rupiah } from "@/lib/format";

type Meta = { type: string; group: string; q?: string; options?: string[] };

export function SettingsForm({ values, meta }: { values: Record<string, unknown>; meta: Record<string, Meta> }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState<Record<string, unknown>>(values);
  const [busy, setBusy] = useState(false);
  const groups = ["ops", "billing", "notify", "access", "general"];
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/admin/settings", { body: v });
      toast(t("saved"));
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="callout">{t("qNote")}</div>
      {groups.map((g) => (
        <div key={g} className="card pad">
          <div className="sect" style={{ marginBottom: 12 }}>{t(`groups.${g}` as "groups.ops")}</div>
          <div className="fgrid">
            {Object.entries(meta)
              .filter(([, m]) => m.group === g)
              .map(([k, m]) => {
                const Field = m.type === "days" ? "div" : "label"; // tombol di dalam <label> ikut terpicu saat label diklik
                return (
                <Field className="field" key={k}>
                  <span className="flabel">
                    {t(`keys.${k}` as "keys.session_times")} {m.q && <span className="pill warn xs" title={t("pending")}>{m.q}</span>}
                  </span>
                  {m.type === "boolean" ? (
                    <button type="button" className={`switch ${v[k] ? "on" : ""}`} aria-pressed={!!v[k]} onClick={() => setV({ ...v, [k]: !v[k] })} />
                  ) : m.type === "enum" ? (
                    <select className="in" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: e.target.value })}>
                      {m.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : m.type === "days" ? (
                    <div className="chips" role="group">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                        const cur = v[k] as number[];
                        const on = cur.includes(d);
                        return (
                          <button type="button" key={d} className={`chk ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setV({ ...v, [k]: on ? cur.filter((x) => x !== d) : [...cur, d].sort() })}>
                            {dayShort(d % 7, l)}
                          </button>
                        );
                      })}
                    </div>
                  ) : m.type === "sessions" ? (
                    <input className="in mono" value={(v[k] as string[]).join(", ")} onChange={(e) => setV({ ...v, [k]: e.target.value.split(",").map((x) => x.trim()) })} />
                  ) : m.type === "list" ? (
                    <input className="in" value={(v[k] as string[]).join(", ")} onChange={(e) => setV({ ...v, [k]: e.target.value.split(",").map((x) => x.trim()) })} />
                  ) : (
                    <input className={`in ${m.type === "number" || m.type === "time" ? "mono" : ""}`} type={m.type === "time" ? "time" : "text"} inputMode={m.type === "number" ? "numeric" : undefined} value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: m.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value })} />
                  )}
                  {k === "dashboard_otp" && <span className="hint">{t("otpNote")}</span>}
                  {k === "session_times" && <span className="hint">{t("sessionsNote")}</span>}
                  {k === "work_days" && <span className="hint">{t("workDaysNote")}</span>}
                </Field>
                );
              })}
          </div>
        </div>
      ))}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn" disabled={busy} onClick={save}>{tc("save")}</button>
      </div>
    </div>
  );
}

type Pkg = { id?: number; code: string; name_id: string; name_en: string; short_id: string; short_en: string; hours: number; price_idr: number; description_id: string; description_en: string; bullets_id: string[]; bullets_en: string[]; highlight: boolean; active: boolean; sort: number };

/** Paket diisi dalam JUMLAH SESI (slot); jam = sesi × durasi sesi (setting session_times), disimpan sebagai `hours`. */
export function PackagesEditor({ packages, slotMinutes }: { packages: Pkg[]; slotMinutes: number }) {
  const slotH = slotMinutes / 60;
  const sessionsOf = (hours: number) => Math.max(1, Math.ceil((hours * 60) / slotMinutes));
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [edit, setEdit] = useState<Pkg | null>(null);
  const [busy, setBusy] = useState(false);
  const blank: Pkg = { code: "", name_id: "", name_en: "", short_id: "", short_en: "", hours: Math.round(slotH), price_idr: 0, description_id: "", description_en: "", bullets_id: [], bullets_en: [], highlight: false, active: true, sort: packages.length + 1 };
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await api("/api/admin/packages", { body: edit });
      toast(t("saved"));
      setEdit(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const F = (k: keyof Pkg, label: string, type: "text" | "number" | "area" | "lines" = "text") => (
    <label className={`field ${type === "area" || type === "lines" ? "full" : ""}`}>
      <span className="flabel">{label}</span>
      {type === "area" ? (
        <textarea className="in" rows={2} value={String(edit![k])} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value })} />
      ) : type === "lines" ? (
        <textarea className="in" rows={4} value={(edit![k] as string[]).join("\n")} onChange={(e) => setEdit({ ...edit!, [k]: e.target.value.split("\n") })} />
      ) : (
        <input className={`in ${type === "number" ? "mono" : ""}`} value={String(edit![k])} inputMode={type === "number" ? "numeric" : undefined} onChange={(e) => setEdit({ ...edit!, [k]: type === "number" ? Number(e.target.value.replace(/\D/g, "")) : e.target.value })} />
      )}
    </label>
  );
  return (
    <div className="card">
      <div className="hd">
        <span className="small muted">{t("priceNote")}</span>
        <button className="btn sm" onClick={() => setEdit(blank)}>{t("addPackage")}</button>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>{t("code")}</th><th>{t("nameId")}</th><th style={{ textAlign: "right" }}>{t("sessions")}</th><th style={{ textAlign: "right" }}>{t("price")}</th><th>{t("active")}</th><th /></tr></thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td><b>{p.name_id}</b>{p.highlight && <span className="pill teal xs" style={{ marginLeft: 6 }}>★</span>}<div className="small muted">{p.name_en}</div></td>
                <td className="mono" style={{ textAlign: "right" }}>{sessionsOf(p.hours)} <span className="muted small">({t("hoursShort", { h: p.hours })})</span></td>
                <td className="mono" style={{ textAlign: "right" }}>{rupiah(p.price_idr)}</td>
                <td><span className={`pill ${p.active ? "ok" : "neutral"}`}>{p.active ? tc("yes") : tc("no")}</span></td>
                <td><button className="btn xs ghost" onClick={() => setEdit(p)}>{tc("edit")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t("tabPackages")} wide footer={<><button className="btn ghost" onClick={() => setEdit(null)}>{tc("cancel")}</button><button className="btn" disabled={busy} onClick={save}>{tc("save")}</button></>}>
        {edit && (
          <div className="fgrid">
            {F("code", t("code"))}
            {F("sort", t("sort"), "number")}
            {F("name_id", t("nameId"))}
            {F("name_en", t("nameEn"))}
            {F("short_id", t("shortId"))}
            {F("short_en", t("shortEn"))}
            <label className="field">
              <span className="flabel">{t("sessions")}</span>
              <input className="in mono" inputMode="numeric" value={String(sessionsOf(edit.hours))} onChange={(e) => { const n = Math.max(1, Math.min(50, Number(e.target.value.replace(/\D/g, "")) || 1)); setEdit({ ...edit, hours: Math.round(n * slotH) }); }} />
              <span className="hint">{t("sessionsHint", { slot: slotH, h: edit.hours })}</span>
            </label>
            {F("price_idr", t("price"), "number")}
            {F("description_id", t("descId"), "area")}
            {F("description_en", t("descEn"), "area")}
            {F("bullets_id", t("bulletsId"), "lines")}
            {F("bullets_en", t("bulletsEn"), "lines")}
            <label className="row small"><input type="checkbox" checked={edit.highlight} onChange={(e) => setEdit({ ...edit, highlight: e.target.checked })} />{t("highlight")}</label>
            <label className="row small"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />{t("active")}</label>
          </div>
        )}
      </Modal>
    </div>
  );
}

type Ins = { id?: number; name: string; simulator_codes: string[]; active: boolean };
export function InstructorsEditor({ instructors }: { instructors: Ins[] }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [edit, setEdit] = useState<Ins | null>(null);
  const save = async (x: Ins) => {
    try {
      await api("/api/admin/instructors", { body: x });
      toast(t("saved"));
      setEdit(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="card">
      <div className="hd"><span /><button className="btn sm" onClick={() => setEdit({ name: "", simulator_codes: ["A320"], active: true })}>{t("addInstructor")}</button></div>
      <div className="tbl">
        <table>
          <thead><tr><th>{t("nameId").replace(" (ID)", "")}</th><th>{t("sims")}</th><th>{t("active")}</th><th /></tr></thead>
          <tbody>
            {instructors.map((i) => (
              <tr key={i.id}>
                <td><b>{i.name}</b></td>
                <td>{i.simulator_codes.map((s) => <span key={s} className={`chip ${s.toLowerCase()}`} style={{ marginRight: 4 }}>{s}</span>)}</td>
                <td><button className={`switch ${i.active ? "on" : ""}`} onClick={() => save({ ...i, active: !i.active })} aria-label={t("active")} /></td>
                <td><button className="btn xs ghost" onClick={() => setEdit(i)}>{tc("edit")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t("tabInstructors")} footer={<><button className="btn ghost" onClick={() => setEdit(null)}>{tc("cancel")}</button><button className="btn" onClick={() => edit && save(edit)}>{tc("save")}</button></>}>
        {edit && (
          <>
            <label className="field"><span className="flabel">{t("nameId").replace(" (ID)", "")}</span><input className="in" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <div className="chips">
              {["A320", "B737"].map((s) => (
                <button key={s} type="button" className={`chk ${edit.simulator_codes.includes(s) ? "on" : ""}`} onClick={() => setEdit({ ...edit, simulator_codes: edit.simulator_codes.includes(s) ? edit.simulator_codes.filter((x) => x !== s) : [...edit.simulator_codes, s] })}>{s}</button>
              ))}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

type Sim = { id: number; code: string; name: string; bay: string; level: string; active: boolean };
export function SimulatorsEditor({ sims }: { sims: Sim[] }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState(sims);
  const save = async (s: Sim) => {
    try {
      await api("/api/admin/simulators", { body: s });
      toast(t("saved"));
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  };
  return (
    <div className="card">
      <div className="tbl">
        <table>
          <thead><tr><th>{t("code")}</th><th>{t("nameId").replace(" (ID)", "")}</th><th>{t("bay")}</th><th>{t("level")}</th><th>{t("active")}</th><th /></tr></thead>
          <tbody>
            {rows.map((s, i) => {
              const up = (patch: Partial<Sim>) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              return (
                <tr key={s.id}>
                  <td><span className={`chip ${s.code.toLowerCase()}`}>{s.code}</span></td>
                  <td><input className="in" value={s.name} onChange={(e) => up({ name: e.target.value })} /></td>
                  <td><input className="in" value={s.bay} onChange={(e) => up({ bay: e.target.value })} style={{ width: 100 }} /></td>
                  <td><input className="in" value={s.level} onChange={(e) => up({ level: e.target.value })} style={{ width: 130 }} /></td>
                  <td><button className={`switch ${s.active ? "on" : ""}`} onClick={() => up({ active: !s.active })} aria-label={t("active")} /></td>
                  <td><button className="btn xs" onClick={() => save(s)}>{tc("save")}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
