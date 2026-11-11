import { getTranslations } from "next-intl/server";
import { financeData } from "@/lib/services/finance";
import { fmtTsDate, monthLong, num, rupiahShort } from "@/lib/format";
import { Big, MonthBars } from "./MonthBars";

/** Tab Pemasukan — rekap invoice lunas dikurangi refund (isi halaman Keuangan sebelum revisi Nov 2026). */
export async function IncomeTab({ year, cy, l }: { year: number; cy: number; l: "id" | "en" }) {
  const t = await getTranslations("admin.finance");
  const d = await financeData(year);
  const count = year === cy ? d.curMonth + 1 : 12;
  const colors = ["var(--teal)", "var(--teal-mid)", "var(--b737)", "var(--lime)", "var(--ok)", "var(--warn)"];
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{t("kpiYtd")}</span><Big text={rupiahShort(d.kpi.ytd, l)} /><span className="d">{t("kpiYtdD", { n: d.kpi.ytdCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiMonth", { month: `${monthLong(d.curMonth, l)} ${year}` })}</span><Big text={rupiahShort(d.kpi.month.net, l)} /><span className="d">{t("kpiMonthD", { issued: d.kpi.month.issued, paid: d.kpi.month.paidCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiAr")}</span><Big text={rupiahShort(d.kpi.receivable, l)} color="var(--warn)" /><span className="d">{t("kpiArD", { n: d.kpi.receivableCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiAvg", { h: d.kpi.slotHours })}</span><Big text={rupiahShort(d.kpi.avgPerSession, l)} /><span className="d">{t("kpiAvgD")}</span></div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", marginBottom: 18 }}>
        <div className="card">
          <div className="hd"><h3>{t("chartTitle")}</h3><span className="small muted">{t("chartUnit", { year })}</span></div>
          <div className="bd chart">
            <MonthBars series={[{ label: t("tabIncome"), values: d.months.map((m) => m.net) }]} count={count} highlight={year === cy ? d.curMonth : null} l={l} aria={t("chartTitle")} />
          </div>
        </div>
        <div className="card">
          <div className="hd"><h3>{t("mixTitle")}</h3><span className="small muted">YTD</span></div>
          <div className="bd stack" style={{ gap: 12 }}>
            {d.mix.map((m, i) => (
              <div className="stack" style={{ gap: 5 }} key={m.code}>
                <div className="row between small"><span>{l === "id" ? m.name_id : m.name_en}</span><b className="mono">{m.pct}%</b></div>
                <div className="prog"><i style={{ width: `${m.pct}%`, background: colors[i % colors.length] }} /></div>
              </div>
            ))}
            <div className="row between small" style={{ marginTop: 6, paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
              <span className="muted">{t("ratio")}</span>
              <b className="mono">{d.ratio.A320}% : {d.ratio.B737}%</b>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="hd"><h3>{t("recent")}</h3><span className="small muted">{t("recentD")}</span></div>
        <div className="tbl">
          <table>
            <thead><tr><th>{t("colPaidAt")}</th><th>{t("colNo")}</th><th>{t("colParticipant")}</th><th>{t("colSim")}</th><th>{t("colPackage")}</th><th style={{ textAlign: "right" }}>{t("colAmount")}</th><th>{t("colVerifier")}</th><th>{t("colProof")}</th></tr></thead>
            <tbody>
              {d.recent.map((r) => (
                <tr key={r.id}>
                  <td className="small">{fmtTsDate(r.paid_at, l)}</td>
                  <td className="mono">{r.no.replace("BWI/", "")}</td>
                  <td>{r.name}</td>
                  <td><span className={`chip ${r.sim.toLowerCase()}`}>{r.sim}</span></td>
                  <td>{r.pkg}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{num(r.amount)}{r.refund ? <div className="small" style={{ color: "var(--bad)" }}>−{num(r.refund)} {t("refund")}</div> : null}</td>
                  <td className="small">{r.verifier}</td>
                  <td className="small">{r.proof ? <a href={`/api/admin/uploads/proof:${r.id}`} target="_blank" rel="noopener noreferrer">⤓</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
