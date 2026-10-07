"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Modal } from "../Overlay";
import { useToast } from "../Toast";
import { ACCEPT, api, uploadFile } from "../upload";
import { fmtDate, rupiah, todayJkt } from "@/lib/format";

export type InvRow = { id: number; no: string; status: string; total: number; amount_received: number | null; name: string; whatsapp: string; due: string; reg_id: number; reg_status: string; open?: boolean };

function Proof({ kind, onDone, label }: { kind: string; onDone: (id: string | undefined) => void; label: string }) {
  const [st, setSt] = useState<string>("");
  return (
    <label className="field">
      <span className="flabel">{label}</span>
      <input
        className="in"
        type="file"
        accept={ACCEPT}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return onDone(undefined);
          setSt("…");
          try {
            const u = await uploadFile(f, kind);
            onDone(u.id);
            setSt("✓");
          } catch (err) {
            setSt((err as Error).message);
            onDone(undefined);
          }
        }}
      />
      {st && <span className="hint">{st}</span>}
    </label>
  );
}

export function InvoiceActions({ inv, dueDays, isSA, hasProof }: { inv: InvRow; dueDays: number; isSA: boolean; hasProof: boolean }) {
  const t = useTranslations("admin.pay");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  // Menu dirender position:fixed agar tidak terpotong oleh .tbl (overflow-x:auto).
  const [pos, setPos] = useState<{ top: number | "auto"; bottom: number | "auto"; right: number }>({ top: 0, bottom: "auto", right: 0 });
  // Lewat tempo/kedaluwarsa (masukan klien Okt 2026): tanpa tombol di baris; di menu ⋯ ada "Kirim ulang invoice"
  // & "Tandai lunas". Hanya Super Admin; wajib kirim ulang (jatuh tempo baru) dulu, baru bisa ditandai lunas.
  const late = ["OVERDUE", "EXPIRED"].includes(inv.status);
  const payable = ["UNPAID", "AWAITING_VERIFICATION"].includes(inv.status);
  const [modal, setModal] = useState<null | "paid" | "wa" | "react" | "cancel">(inv.open && payable ? "paid" : null);
  const [newDue, setNewDue] = useState(() => { const d = new Date(Date.now() + 7 * 3600_000 + dueDays * 86400_000); return d.toISOString().slice(0, 10); });
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(String(inv.amount_received ?? inv.total));
  const [paidAt, setPaidAt] = useState(todayJkt());
  const [proof, setProof] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [accept, setAccept] = useState(false);
  const [waAt, setWaAt] = useState("");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState("0");
  const [refundAt, setRefundAt] = useState(todayJkt());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    const close = () => setMenu(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const toggleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - r.right);
    setPos(window.innerHeight - r.bottom < 320 ? { top: "auto", bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, bottom: "auto", right });
    setMenu((m) => !m);
  };

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) toast(msg);
      setModal(null);
      setMenu(false);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const open = payable;
  const diff = Number(amount || 0) - inv.total;
  const followText = t("followText", { name: inv.name, no: inv.no, total: rupiah(inv.total), due: fmtDate(new Date(new Date(inv.due).getTime() + 7 * 3600_000), l) });
  const followHref = `https://wa.me/${inv.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(followText)}`;
  const primary = payable ? (
    <button className="btn xs ok" onClick={() => setModal("paid")}>{t("markPaid")}</button>
  ) : inv.status === "PAID" && ["PAID", "SCHEDULED", "IN_PROGRESS"].includes(inv.reg_status) ? (
    <a className="btn xs ghost" href={`${l === "en" ? "/en" : ""}/admin/jadwal?reg=${inv.reg_id}`}>{t("schedule")}</a>
  ) : null;
  const lateAction = (fn: () => void) => () => {
    setMenu(false);
    if (!isSA) return toast(t("saOnlyLate"));
    fn();
  };

  return (
    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
      {primary}
      <div className="menu" ref={ref}>
        <button className="btn xs ghost" aria-haspopup="menu" aria-expanded={menu} onClick={toggleMenu}>⋯</button>
        {menu && (
          <div className="pop" role="menu" style={{ position: "fixed", ...pos }}>
            {payable && <button onClick={() => { setModal("paid"); setMenu(false); }}>{t("markPaid")}</button>}
            {open && <button onClick={() => { setModal("wa"); setMenu(false); }}>{t("confirmWa")}</button>}
            {!late && inv.status !== "CANCELLED" && <button onClick={() => run(async () => { await api(`/api/admin/invoices/${inv.id}/resend`, { body: {} }); return t("toastResent"); })}>{t("resend")}</button>}
            {open && <a href={followHref} target="_blank" rel="noopener noreferrer">{t("followUp")}</a>}
            {late && <button onClick={lateAction(() => setModal("react"))}>{t("reactivate")}</button>}
            {late && <button onClick={lateAction(() => toast(t("reissueFirst")))}>{t("markPaid")}</button>}
            <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">{t("pdf")}</a>
            {inv.status !== "CANCELLED" && inv.reg_status !== "COMPLETED" && (
              <>
                <hr />
                <button className="danger" onClick={() => { setModal("cancel"); setMenu(false); }}>{t("cancel")}</button>
              </>
            )}
          </div>
        )}
      </div>

      <Modal
        open={modal === "paid"}
        onClose={() => setModal(null)}
        title={`${t("mPaidTitle")} · ${inv.no}`}
        footer={<><button className="btn ghost" onClick={() => setModal(null)}>{tc("cancel")}</button><button className="btn ok" disabled={busy || !amount || (!proof && !hasProof)} onClick={() => run(async () => { const r = await api<{ paid: boolean; invoice_no: string }>(`/api/admin/invoices/${inv.id}/mark-paid`, { body: { amount: Number(amount), paid_at: paidAt, proof_upload: proof, note: note || undefined, accept_difference: accept } }); return r.paid ? t("toastPaid", { no: r.invoice_no }) : t("toastPartial"); })}>{t("markPaid")}</button></>}
      >
        <div className="row between" style={{ padding: "12px 14px", background: "var(--teal-tint)", borderRadius: 8 }}>
          <b>{inv.name}</b>
          <span style={{ fontFamily: "var(--display)", fontSize: 22 }}>{rupiah(inv.total)}</span>
        </div>
        <div className="fgrid">
          <label className="field"><span className="flabel">{t("amount")}</span><input className="in mono" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></label>
          <label className="field"><span className="flabel">{t("paidAt")}</span><input className="in" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></label>
        </div>
        {diff !== 0 && (
          <>
            <div className="banner warn">{t("diffWarn", { total: rupiah(inv.total), diff: rupiah(diff) })}</div>
            <label className="row small"><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />{t("acceptDiff")}</label>
          </>
        )}
        <Proof kind="PAYMENT_PROOF" onDone={setProof} label={hasProof ? t("proofHave") : t("proofReq")} />
        <label className="field"><span className="flabel">{t("note")}</span><input className="in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </Modal>

      <Modal
        open={modal === "wa"}
        onClose={() => setModal(null)}
        title={t("mWaTitle")}
        footer={<><button className="btn ghost" onClick={() => setModal(null)}>{tc("cancel")}</button><button className="btn" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/invoices/${inv.id}/confirm-wa`, { body: { at: waAt ? new Date(waAt).toISOString() : undefined, proof_upload: proof, note: note || undefined } }); return t("toastWa"); })}>{tc("save")}</button></>}
      >
        <label className="field"><span className="flabel">{t("waAt")}</span><input className="in" type="datetime-local" value={waAt} onChange={(e) => setWaAt(e.target.value)} /></label>
        <Proof kind="PAYMENT_PROOF" onDone={setProof} label={t("proof")} />
        <label className="field"><span className="flabel">{t("note")}</span><input className="in" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </Modal>

      <Modal
        open={modal === "react"}
        onClose={() => setModal(null)}
        title={t("mReactTitle")}
        footer={<><button className="btn ghost" onClick={() => setModal(null)}>{tc("cancel")}</button><button className="btn" disabled={busy || !newDue} onClick={() => run(async () => { const r = await api<{ due: string }>(`/api/admin/invoices/${inv.id}/reactivate`, { body: { due: newDue } }); return t("toastReact", { date: r.due }); })}>{t("reactivate")}</button></>}
      >
        <p>{t("reactDesc")}</p>
        <label className="field"><span className="flabel">{t("newDue")}</span><input className="in" type="date" min={todayJkt()} value={newDue} onChange={(e) => setNewDue(e.target.value)} /></label>
      </Modal>

      <Modal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        title={t("mCancelTitle")}
        footer={<><button className="btn ghost" onClick={() => setModal(null)}>{tc("cancel")}</button><button className="btn bad" disabled={busy || reason.trim().length < 3} onClick={() => run(async () => { await api(`/api/admin/invoices/${inv.id}/cancel`, { body: { reason, refund_amount: Number(refund || 0), refund_at: refundAt, refund_upload: proof } }); return t("toastCancel"); })}>{t("cancel")}</button></>}
      >
        <div className="banner bad">{t("cancelWarn")}</div>
        <label className="field"><span className="flabel">{t("cancelReason")}</span><textarea className="in" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        {inv.status === "PAID" && (
          <>
            <div className="fgrid">
              <label className="field"><span className="flabel">{t("refundAmount")}</span><input className="in mono" inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="field"><span className="flabel">{t("refundAt")}</span><input className="in" type="date" value={refundAt} onChange={(e) => setRefundAt(e.target.value)} /></label>
            </div>
            <Proof kind="REFUND_PROOF" onDone={setProof} label={t("refundProof")} />
          </>
        )}
      </Modal>
    </div>
  );
}
