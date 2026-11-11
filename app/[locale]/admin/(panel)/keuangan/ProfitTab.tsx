import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { profitLossData } from "@/lib/services/expenses";
import { monthLong, num, rupiahShort } from "@/lib/format";
import { Big, MonthBars } from "./MonthBars";

const neg = (v: number) => (v < 0 ? { color: "var(--bad)" } : undefined);
const money = (v: number) => (v < 0 ? `−${num(-v)}` : num(v));

/** Tab Gabungan / Laba rugi: pemasukan bersih − pengeluaran, pajak dari Pengaturan → Keuangan. */
export async function ProfitTab({ year, l }: { year: number; l: "id" | "en" }) {
  const t = await getTranslations("admin.finance");
  const d = await profitLossData(year);
  const rows = d.months.slice(0, d.shownMonths);
  const taxLabel = d.tax.pct > 0 ? t(d.tax.base === "REVENUE" ? "taxOnRevenue" : "taxOnProfit", { pct: String(d.tax.pct).replace(".", l === "id" ? "," : ".") }) : t("taxOff");
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{t("plRevenue")}</span><Big text={rupiahShort(d.total.revenue, l)} /><span className="d">{t("plRevenueD")}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("plExpense")}</span><Big text={rupiahShort(d.total.expense, l)} color="var(--bad)" /><span className="d">{t("plExpenseD")}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("plProfit")}</span><Big text={rupiahShort(d.total.profit, l)} color={d.total.profit < 0 ? "var(--bad)" : "var(--ok)"} /><span className="d">{d.total.margin == null ? "—" : t("plMargin", { pct: String(d.total.margin).replace(".", l === "id" ? "," : ".") })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("plAfter")}</span><Big text={rupiahShort(d.total.after, l)} color={d.total.after < 0 ? "var(--bad)" : undefined} /><span className="d">{taxLabel}{d.total.tax ? ` · Rp ${num(d.total.tax)}` : ""}</span></div>
      </div>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h3>{t("plChart")}</h3><span className="small muted">{t("chartUnit", { year })}</span></div>
        <div className="bd chart">
          <MonthBars series={[{ label: t("tabIncome"), color: "var(--teal)", values: d.months.map((m) => m.revenue) }, { label: t("tabExpense"), color: "var(--bad)", values: d.months.map((m) => m.expense) }]} count={d.shownMonths} highlight={null} l={l} aria={t("plChart")} />
        </div>
      </div>
      <div className="card">
        <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
          <h3>{t("plTable", { year })}</h3>
          <span className="small muted">{taxLabel} · <Link href="/admin/pengaturan">{t("taxSettings")}</Link></span>
        </div>
        <div className="tbl">
          <table>
            <thead>
              <tr>
                <th>{t("month")}</th>
                <th style={{ textAlign: "right" }}>{t("tabIncome")}</th>
                <th style={{ textAlign: "right" }}>{t("tabExpense")}</th>
                <th style={{ textAlign: "right" }}>{t("plProfit")}</th>
                <th style={{ textAlign: "right" }}>{t("plTax")}</th>
                <th style={{ textAlign: "right" }}>{t("plAfter")}</th>
                <th style={{ textAlign: "right" }}>{t("plMarginCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7}><div className="empty">{t("expEmpty")}</div></td></tr>}
              {rows.map((m, i) => (
                <tr key={i}>
                  <td>{monthLong(i, l)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(m.revenue)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(m.expense)}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 600, ...neg(m.profit) }}>{money(m.profit)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(m.tax)}</td>
                  <td className="mono" style={{ textAlign: "right", ...neg(m.after) }}>{money(m.after)}</td>
                  <td className="mono small" style={{ textAlign: "right", ...neg(m.margin ?? 0) }}>{m.margin == null ? "—" : `${m.margin}%`}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr style={{ borderTop: "2px solid var(--line)", fontWeight: 700 }}>
                  <td>{t("plTotal", { year })}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(d.total.revenue)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(d.total.expense)}</td>
                  <td className="mono" style={{ textAlign: "right", ...neg(d.total.profit) }}>{money(d.total.profit)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(d.total.tax)}</td>
                  <td className="mono" style={{ textAlign: "right", ...neg(d.total.after) }}>{money(d.total.after)}</td>
                  <td className="mono small" style={{ textAlign: "right", ...neg(d.total.margin ?? 0) }}>{d.total.margin == null ? "—" : `${d.total.margin}%`}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {d.tax.differs && <div className="bd small muted">{t("taxAnnualNote")}</div>}
      </div>
    </>
  );
}
