"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Modal } from "../Overlay";
import { useToast } from "../Toast";
import { ACCEPT, api, uploadFile } from "../upload";
import { fmtDate, num, todayJkt } from "@/lib/format";

export type ExpenseRow = { id: number; spent_on: string; category: string; description: string; payee: string; amount: number; receipt: string | null; by: string };
type Form = { id?: number; spent_on: string; category: string; description: string; payee: string; amount: string; receipt: string | null; upload?: string; remove?: boolean };

/** Daftar pengeluaran + tambah/ubah/hapus (Super Admin). Lampiran nota opsional. */
export function ExpensesTable({ rows, total, categories, defaultDate }: { rows: ExpenseRow[]; total: number; categories: string[]; defaultDate?: string }) {
  const t = useTranslations("admin.finance");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState<Form | null>(null);
  const [del, setDel] = useState<ExpenseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState("");

  const blank = (): Form => ({ spent_on: defaultDate ?? todayJkt(), category: categories[0] ?? "", description: "", payee: "", amount: "", receipt: null });
  const open = (r?: ExpenseRow) => {
    setUp("");
    setF(r ? { id: r.id, spent_on: r.spent_on, category: r.category, description: r.description, payee: r.payee, amount: String(r.amount), receipt: r.receipt } : blank());
  };
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      toast(await fn());
      setF(null);
      setDel(null);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const save = () =>
    run(async () => {
      await api("/api/admin/expenses", { body: { id: f!.id, spent_on: f!.spent_on, category: f!.category, description: f!.description, payee: f!.payee || undefined, amount: Number(f!.amount), receipt_upload: f!.upload, remove_receipt: f!.remove || undefined } });
      return f!.id ? t("expToastUpdated") : t("expToastAdded");
    });
  const cats = f && f.category && !categories.includes(f.category) ? [...categories, f.category] : categories;
  const valid = !!f && /^\d{4}-\d{2}-\d{2}$/.test(f.spent_on) && !!f.category && f.description.trim().length >= 2 && Number(f.amount) > 0 && up !== "…";

  return (
    <>
      <div className="bd row between wrap" style={{ gap: 10, paddingTop: 0 }}>
        <span className="small muted">{t("expListD", { n: rows.length, total: num(total) })}</span>
        <button className="btn sm" onClick={() => open()}>{t("expAdd")}</button>
      </div>
      <div className="tbl">
        <table>
          <thead>
            <tr><th>{t("colDate")}</th><th>{t("category")}</th><th>{t("colDesc")}</th><th>{t("colPayee")}</th><th style={{ textAlign: "right" }}>{t("colAmount")}</th><th>{t("colReceipt")}</th><th>{t("colBy")}</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8}><div className="empty">{t("expEmpty")}</div></td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="small" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.spent_on, l)}</td>
                <td><span className="pill neutral" style={{ whiteSpace: "nowrap" }}>{r.category}</span></td>
                <td style={{ minWidth: 200 }}>{r.description}</td>
                <td className="small">{r.payee || "—"}</td>
                <td className="mono" style={{ textAlign: "right" }}>{num(r.amount)}</td>
                <td className="small">{r.receipt ? <a href={`/api/admin/uploads/expense:${r.id}`} target="_blank" rel="noopener noreferrer" title={r.receipt}>⤓</a> : "—"}</td>
                <td className="small">{r.by}</td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <button className="btn ghost xs" onClick={() => open(r)}>{tc("edit")}</button>{" "}
                  <button className="btn bad xs" onClick={() => setDel(r)} aria-label={t("expDelete")}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!f}
        onClose={() => setF(null)}
        title={f?.id ? t("expEdit") : t("expAdd")}
        footer={<><button className="btn ghost" onClick={() => setF(null)}>{tc("cancel")}</button><button className="btn" disabled={busy || !valid} onClick={save}>{tc("save")}</button></>}
      >
        {f && (
          <div className="fgrid">
            <label className="field">
              <span className="flabel">{t("colDate")}</span>
              <input className="in mono" type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} />
            </label>
            <label className="field">
              <span className="flabel">{t("category")}</span>
              <select className="in" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="hint">{t("expCatHint")}</span>
            </label>
            <label className="field full">
              <span className="flabel">{t("colDesc")}</span>
              <input className="in" value={f.description} maxLength={300} placeholder={t("expDescPh")} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <label className="field">
              <span className="flabel">{t("colPayee")} <span className="muted">({tc("optional")})</span></span>
              <input className="in" value={f.payee} maxLength={120} onChange={(e) => setF({ ...f, payee: e.target.value })} />
            </label>
            <label className="field">
              <span className="flabel">{t("colAmountRp")}</span>
              <input className="in mono" inputMode="numeric" value={f.amount ? num(Number(f.amount)) : ""} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "").slice(0, 13) })} />
            </label>
            <label className="field full">
              <span className="flabel">{t("colReceipt")} <span className="muted">({tc("optional")})</span></span>
              <input
                className="in"
                type="file"
                accept={ACCEPT}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return setF((x) => (x ? { ...x, upload: undefined } : x));
                  setUp("…");
                  try {
                    const u = await uploadFile(file, "EXPENSE_RECEIPT");
                    setF((x) => (x ? { ...x, upload: u.id, remove: false } : x));
                    setUp("✓ " + file.name);
                  } catch (err) {
                    setUp((err as Error).message);
                    setF((x) => (x ? { ...x, upload: undefined } : x));
                  }
                }}
              />
              {up ? <span className="hint">{up}</span> : f.receipt && !f.remove ? (
                <span className="hint">
                  {t("expHaveReceipt", { name: f.receipt })} · <button type="button" style={{ color: "var(--bad)", background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }} onClick={() => setF({ ...f, remove: true })}>{t("expRemoveReceipt")}</button>
                </span>
              ) : <span className="hint">{t("expReceiptHint")}</span>}
            </label>
          </div>
        )}
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title={t("expDelete")}
        footer={<><button className="btn ghost" onClick={() => setDel(null)}>{tc("cancel")}</button><button className="btn bad" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/expenses/${del!.id}`, { method: "DELETE" }); return t("expToastDeleted"); })}>{t("expDelete")}</button></>}
      >
        {del && <p>{t("expDeleteQ", { desc: del.description, amount: num(del.amount), date: fmtDate(del.spent_on, l) })}</p>}
      </Modal>
    </>
  );
}
