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
