import type { InvoiceStatus, Prisma } from "@prisma/client";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtShortTs, fmtTsDate, monthLong, num, rupiahShort, todayJkt, wibInstant } from "@/lib/format";
import { INV_PILL } from "@/lib/ui";
import { FilterSelect, SearchBox } from "@/components/admin/FilterBar";
import { InvoiceActions } from "@/components/admin/InvoiceActions";
import { requireAdminPage } from "@/lib/auth";

const STATUSES: InvoiceStatus[] = ["UNPAID", "AWAITING_VERIFICATION", "PAID", "OVERDUE", "EXPIRED", "CANCELLED"];

export default async function Pembayaran({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.pay");
  const te = await getTranslations("enums");
  const tc = await getTranslations("common");
  const s = await getSettings();
  const me = await requireAdminPage();
  const cur = todayJkt().slice(0, 7);
  const m = sp.inv || sp.m === "all" ? "all" : /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : cur;
  const range = m === "all" ? undefined : { gte: wibInstant(`${m}-01`), lt: wibInstant(nextMonth(m)) };
  const st = STATUSES.includes(sp.st as InvoiceStatus) ? (sp.st as InvoiceStatus) : undefined;
  const q = sp.q?.trim();
  const where: Prisma.InvoiceWhereInput = {
    ...(range ? { issued_at: range } : {}),
    ...(st ? { status: st } : {}),
    ...(q ? { OR: [{ invoice_no: { contains: q, mode: "insensitive" } }, { registration: { participant: { full_name: { contains: q, mode: "insensitive" } } } }, { registration: { reg_no: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [rows, monthAll] = await Promise.all([
    db.invoice.findMany({ where, include: { registration: { include: { participant: true, package: true, simulator: true } } }, orderBy: { issued_at: "desc" }, take: 200 }),
    db.invoice.findMany({ where: range ? { issued_at: range } : {}, select: { status: true, total: true } }),
  ]);
  const sum = (xs: { total: bigint }[]) => xs.reduce((a, x) => a + Number(x.total), 0);
  const by = (f: (x: { status: InvoiceStatus }) => boolean) => monthAll.filter(f);
  const paid = by((x) => x.status === "PAID");
  const waiting = by((x) => x.status === "UNPAID" || x.status === "AWAITING_VERIFICATION");
  const overdue = by((x) => x.status === "OVERDUE");
  const months = recentMonths(cur, 12);
  const openId = Number(sp.inv ?? 0);
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <FilterSelect name="st" label={t("colStatus")} value={st ?? ""} options={[["", tc("all")], ...STATUSES.map((x) => [x, te(`invoiceStatus.${x}`)] as [string, string])]} />
          <FilterSelect name="m" label={t("month")} value={m} options={[...months.map((x) => [x, `${monthLong(Number(x.slice(5)) - 1, l)} ${x.slice(0, 4)}`] as [string, string]), ["all", tc("all")]]} />
          <SearchBox placeholder={tc("search")} width={200} />
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{m === "all" ? t("colIssued") : t("kpiIssued")}</span><span className="v">{monthAll.length}</span><span className="d">Rp {rupiahShort(sum(monthAll), l)}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiPaid")}</span><span className="v" style={{ color: "var(--ok)" }}>{paid.length}</span><span className="d">Rp {rupiahShort(sum(paid), l)}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiWaiting")}</span><span className="v" style={{ color: "var(--warn)" }}>{waiting.length}</span><span className="d">Rp {rupiahShort(sum(waiting), l)}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiOverdue")}</span><span className="v" style={{ color: "var(--bad)" }}>{overdue.length}</span><span className="d">Rp {rupiahShort(sum(overdue), l)}</span></div>
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="bd"><div className="empty">{tc("noData")}</div></div> : (
          <div className="tbl">
            <table>
              <thead><tr><th>{t("colNo")}</th><th>{t("colParticipant")}</th><th>{t("colPackage")}</th><th style={{ textAlign: "right" }}>{t("colTotal")}</th><th>{t("colIssued")}</th><th>{t("colDue")}</th><th>{t("colWa")}</th><th>{t("colStatus")}</th><th /></tr></thead>
              <tbody>
                {rows.map((i) => {
                  const r = i.registration;
                  const late = ["OVERDUE", "EXPIRED"].includes(i.status);
                  return (
                    <tr key={i.id} style={openId === i.id ? { background: "var(--lime-soft)" } : undefined}>
                      <td className="mono">{i.invoice_no.replace("BWI/", "")}</td>
                      <td><b>{r.participant.full_name}</b><div className="small muted mono">{r.reg_no}</div></td>
                      <td><span className={`chip ${r.simulator.code.toLowerCase()}`}>{r.simulator.code}</span> {r.package.short_id} {r.hours_snapshot}{l === "id" ? "j" : "h"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{num(i.total)}{i.amount_received != null && i.amount_received !== i.total ? <div className="small" style={{ color: "var(--warn)" }}>{t("received", { amount: num(i.amount_received) })}</div> : null}{i.refund_amount ? <div className="small" style={{ color: "var(--bad)" }}>−{num(i.refund_amount)}</div> : null}</td>
                      <td className="small">{fmtTsDate(i.issued_at, l, { year: false })}</td>
                      <td className="small" style={late ? { color: "var(--bad)" } : undefined}>{fmtTsDate(i.due_at, l, { year: false })}</td>
                      <td>{i.wa_confirmed_at ? <span className="small">{fmtShortTs(i.wa_confirmed_at, l)}{i.proof_storage_key ? <> · <a href={`/api/admin/uploads/proof:${i.id}`} target="_blank" rel="noopener noreferrer">{l === "id" ? "bukti" : "receipt"}</a></> : null}</span> : <span className="small faint">—</span>}</td>
                      <td><span className={`pill ${INV_PILL[i.status]}`}>{te(`invoiceStatus.${i.status}`)}</span>{i.paid_at ? <div className="small muted">{fmtDate(new Date(i.paid_at.getTime() + 7 * 3600_000), l, { year: false })}</div> : null}</td>
                      <td>
                        <InvoiceActions
                          dueDays={s.invoice_due_days}
                          isSA={me.role === "SUPER_ADMIN"}
                          hasProof={!!i.proof_storage_key}
                          inv={{ id: i.id, no: i.invoice_no, status: i.status, total: Number(i.total), amount_received: i.amount_received != null ? Number(i.amount_received) : null, name: r.participant.full_name, whatsapp: r.participant.whatsapp, due: i.due_at.toISOString(), reg_id: r.id, reg_status: r.status, open: openId === i.id }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y! + 1}-01-01` : `${y}-${String(mo! + 1).padStart(2, "0")}-01`;
}
function recentMonths(cur: string, n: number) {
  const out: string[] = [];
  let [y, m] = cur.split("-").map(Number) as [number, number];
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return out;
}
