import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { participantFromToken } from "@/lib/participant";
import { HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtTsDate, num, prettyPhone, rupiah } from "@/lib/format";
import { invFromSlug } from "@/lib/ui";
import { waLink } from "@/lib/notify/wa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Halaman invoice (HTML, sesuai mockup layar 5) + unduh PDF. */
export default async function InvoicePage({ params }: { params: Promise<{ locale: string; token: string; invoice_no: string }> }) {
  const { locale, token, invoice_no } = await params;
  setRequestLocale(locale);
  let regId: number;
  try {
    regId = (await participantFromToken(await headers(), token)).registration_id;
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const inv = await db.invoice.findUnique({ where: { invoice_no: invFromSlug(invoice_no) }, include: { registration: { include: { participant: true, package: true, simulator: true } } } });
  if (!inv || inv.registration_id !== regId) notFound();
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("invoice");
  const td = await getTranslations("dash");
  const s = await getSettings();
  const r = inv.registration;
  const p = r.participant;
  const stamp = inv.status === "PAID" ? t("stampPaid") : inv.status === "CANCELLED" ? t("stampCancelled") : inv.status === "EXPIRED" ? t("stampExpired") : t("stampUnpaid");
  const confirm = waLink(s.wa_admin_number, t("waText", { name: p.full_name, no: inv.invoice_no, total: rupiah(inv.total) }));
  const tok = encodeURIComponent(decodeURIComponent(token));
  return (
    <div className="invwrap">
      <div className="actions no-print">
        <Link href={`/d/${tok}`} className="btn ghost sm" style={{ marginRight: "auto" }}>{td("backDash")}</Link>
        <a className="btn ghost sm" href={`/api/d/${tok}/invoice/${invoice_no}.pdf?download`}>⤓ PDF</a>
        {inv.status !== "PAID" && inv.status !== "CANCELLED" && <a className="btn wa sm" href={confirm} target="_blank" rel="noopener noreferrer">{t("confirmWa")}</a>}
      </div>
      <div className="inv">
        <div className={`stamp ${inv.status === "PAID" ? "paid" : ""}`}>{stamp}</div>
        <div className="top">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/bwi-aviation.png" alt="BWI Aviation" />
            <div className="small muted" style={{ marginTop: 8, lineHeight: 1.4 }}>
              {s.company_name}<br />{s.company_address}<br />{s.contact_email} · {prettyPhone(s.wa_admin_number)}
            </div>
          </div>
          <div className="ttl">
            <h2>{t("title")}</h2>
            <div className="no">{inv.invoice_no}</div>
            <div className="small muted" style={{ marginTop: 6 }}>{t("refReg", { reg: r.reg_no })}</div>
          </div>
        </div>
        <div className="meta">
          <div>
            <div className="k">{t("billedTo")}</div>
            <div className="v">{p.full_name}</div>
            <div className="v l">{p.nik ? `NIK ${p.nik}` : `${l === "id" ? "Paspor" : "Passport"} ${p.passport_no ?? ""}`}<br />{p.address}, {p.city} {p.postal_code}<br />{p.email} · {prettyPhone(p.whatsapp)}</div>
          </div>
          <div>
            <div className="k">{t("issued")}</div><div className="v">{fmtTsDate(inv.issued_at, l)}</div>
            <div className="k" style={{ marginTop: 12 }}>{t("due")}</div><div className="v">{fmtTsDate(inv.due_at, l)}</div>
          </div>
          <div>
            <div className="k">{t("licence")}</div><div className="v">{p.licence_type} · {p.licence_no}</div>
            <div className="k" style={{ marginTop: 12 }}>{t("method")}</div><div className="v">{t("methodVal")}</div>
          </div>
        </div>
        <div className="tbl">
          <table>
            <thead><tr><th>{t("colDesc")}</th><th style={{ textAlign: "right" }}>{t("colHours")}</th><th style={{ textAlign: "right" }}>{t("colPrice")}</th><th style={{ textAlign: "right" }}>{t("colAmount")}</th></tr></thead>
            <tbody>
              <tr>
                <td><b>{l === "id" ? r.package.name_id : r.package.name_en}</b><div className="small muted">{t("itemSub", { sim: `${r.simulator.code === "A320" ? "Airbus A320" : "Boeing 737NG"} FTD` })}</div></td>
                <td style={{ textAlign: "right" }} className="mono">{r.hours_snapshot}</td>
                <td style={{ textAlign: "right" }} className="mono">{num(inv.subtotal)}</td>
                <td style={{ textAlign: "right" }} className="mono">{num(inv.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="tot">
          <table>
            <tbody>
              <tr><td className="muted">{t("subtotal")}</td><td style={{ textAlign: "right" }} className="mono">{rupiah(inv.subtotal)}</td></tr>
              <tr><td className="muted">{t("vat")} {s.vat_percent}%</td><td style={{ textAlign: "right" }} className="mono">{rupiah(inv.vat)}</td></tr>
              <tr className="g"><td>{t("total")}</td><td style={{ textAlign: "right" }} className="mono">{rupiah(inv.total)}</td></tr>
              {inv.paid_at && <tr><td colSpan={2} className="small" style={{ textAlign: "right", color: "var(--ok)" }}>{t("paidOn", { date: fmtTsDate(inv.paid_at, l) })}</td></tr>}
              {inv.refund_amount && <tr><td colSpan={2} className="small muted" style={{ textAlign: "right" }}>{t("refunded", { amount: rupiah(inv.refund_amount), date: inv.refund_at ? fmtTsDate(inv.refund_at, l) : "" })}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pay">
          <div className="bx"><div className="k">{t("bankTo")}</div><div className="acc">{s.bank_name} {s.bank_account}</div><div className="small muted">a.n. {s.bank_holder}</div></div>
          <div className="bx"><div className="k">{t("confirmPay")}</div><div style={{ fontWeight: 600 }}>WhatsApp {prettyPhone(s.wa_admin_number)}</div><div className="small muted">{t("confirmPayD")}</div></div>
        </div>
        <div className="small faint" style={{ marginTop: 22, borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>{t("terms", { h: s.reschedule_free_hours })}</div>
      </div>
    </div>
  );
}
