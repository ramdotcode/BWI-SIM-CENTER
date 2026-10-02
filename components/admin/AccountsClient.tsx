"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Modal } from "../Overlay";
import { useToast } from "../Toast";
import { api } from "../upload";

type AdminRow = { id: number; name: string; email: string; role: "ADMIN" | "SUPER_ADMIN"; active: boolean };

export function AdminEditor({ row, canEdit, label, self }: { row?: AdminRow; canEdit: boolean; label: string; self?: boolean }) {
  const t = useTranslations("admin.accounts");
  const tc = useTranslations("common");
  const te = useTranslations("enums.role");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<AdminRow & { password: string }>({ id: row?.id ?? 0, name: row?.name ?? "", email: row?.email ?? "", role: row?.role ?? "ADMIN", active: row?.active ?? true, password: "" });
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  const save = async (patch?: Partial<typeof f>) => {
    const v = { ...f, ...patch };
    setBusy(true);
    try {
      await api("/api/admin/admins", { body: { id: v.id || undefined, name: v.name, email: v.email, role: v.role, active: v.active, password: v.password || undefined } });
      toast(tc("save") + " ✓");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      {row && (
        <button className={`switch ${row.active ? "on" : ""}`} aria-label={t("colActive")} disabled={self} onClick={() => save({ active: !row.active })} style={{ marginRight: 10, verticalAlign: "middle" }} />
      )}
      <button className={row ? "btn xs ghost" : "btn sm"} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("mAdminTitle")} footer={<><button className="btn ghost" onClick={() => setOpen(false)}>{tc("cancel")}</button><button className="btn" disabled={busy} onClick={() => save()}>{tc("save")}</button></>}>
        <label className="field"><span className="flabel">{t("name")}</span><input className="in" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field"><span className="flabel">{t("email")}</span><input className="in" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field"><span className="flabel">{t("role")}</span><select className="in" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as AdminRow["role"] })}><option value="ADMIN">{te("ADMIN")}</option><option value="SUPER_ADMIN">{te("SUPER_ADMIN")}</option></select></label>
        <label className="field"><span className="flabel">{t("password")}</span><input className="in" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><span className="hint">{t("passwordHint")}</span></label>
        <label className="row small"><input type="checkbox" checked={f.active} disabled={self} onChange={(e) => setF({ ...f, active: e.target.checked })} />{t("colActive")}</label>
      </Modal>
    </>
  );
}

export function LinkActions({ regId }: { regId: number }) {
  const t = useTranslations("admin.accounts");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const go = async (kind: "resend" | "rotate") => {
    if (kind === "rotate" && !confirm(t("rotateConfirm"))) return;
    setBusy(true);
    try {
      const r = await api<{ email: string }>(`/api/admin/tokens/${regId}/${kind}`, { body: {} });
      toast(kind === "resend" ? t("toastResent", { email: r.email }) : t("toastRotated"));
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
      <button className="btn xs ghost" disabled={busy} onClick={() => go("resend")}>{t("resend")}</button>
      <button className="btn xs bad" disabled={busy} onClick={() => go("rotate")}>{t("rotate")}</button>
    </div>
  );
}

export type DisplayRow = { id: string; label: string; show_names: boolean; path: string | null; created: string; seen: string | null };

/** Tab "Layar": buat, salin, buka, dan cabut link Mode Layar (Super Admin). */
export function DisplayLinks({ rows }: { rows: DisplayRow[] }) {
  const t = useTranslations("accountsDisplay");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [names, setNames] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = async (url: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(msg);
    } catch {
      window.prompt(t("copy"), url);
    }
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const urlOf = (id: string) => api<{ url: string }>(`/api/admin/displays/${id}`).then((r) => r.url);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between wrap" style={{ padding: "12px 14px 0" }}>
        <p className="small muted" style={{ maxWidth: "70ch", margin: 0 }}>{t("intro")}</p>
        <button className="btn sm" onClick={() => { setLabel(""); setNames(false); setOpen(true); }}>{t("add")}</button>
      </div>
      <div className="tbl">
        <table>
          <thead><tr><th>{t("colLabel")}</th><th>{t("colMode")}</th><th>{t("colCreated")}</th><th>{t("colSeen")}</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="muted small">{t("empty")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.label}</b><div className="small mono muted">{r.path ?? t("secretLink")}</div></td>
                <td><span className={`pill ${r.show_names ? "warn" : "neutral"}`}>{r.show_names ? t("modeNames") : t("modeAnon")}</span></td>
                <td className="small">{r.created}</td>
                <td className="small">{r.seen ?? <span className="faint">{t("never")}</span>}</td>
                <td>
                  <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    <button className="btn xs ghost" disabled={busy} onClick={() => run(async () => copy(await urlOf(r.id), t("copied")))}>{t("copy")}</button>
                    <button className="btn xs ghost" disabled={busy} onClick={() => run(async () => { window.open(await urlOf(r.id), "_blank", "noopener,noreferrer"); })}>{t("open")}</button>
                    <button className="btn xs bad" disabled={busy} onClick={() => confirm(t("confirmRevoke", { label: r.label })) && run(async () => { await api(`/api/admin/displays/${r.id}`, { method: "DELETE" }); })}>{t("revoke")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ padding: "0 14px 12px", margin: 0 }}>{t("howTo")}</p>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("mTitle")}
        footer={<><button className="btn ghost" onClick={() => setOpen(false)}>{tc("cancel")}</button><button className="btn" disabled={busy || !label.trim()} onClick={() => run(async () => { const r = await api<{ url: string }>("/api/admin/displays", { body: { label, show_names: names } }); setOpen(false); await copy(r.url, t("created")); })}>{t("add")}</button></>}
      >
        <label className="field"><span className="flabel">{t("label")}</span><input className="in" value={label} maxLength={60} placeholder={t("labelPh")} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} style={{ marginTop: 3 }} />
          <span><b>{t("showNames")}</b><div className="small muted">{t("showNamesWarn")}</div></span>
        </label>
      </Modal>
    </div>
  );
}
