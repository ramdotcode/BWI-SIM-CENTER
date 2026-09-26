import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { requireAdminPage } from "@/lib/auth";
import { financeData } from "@/lib/services/finance";
import { fmtTsDate, monthLong, monthShort, num, rupiahShort, todayJkt } from "@/lib/format";
import { FilterSelect } from "@/components/admin/FilterBar";

export default async function Keuangan({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPage("SUPER_ADMIN");
  const sp = await searchParams;
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.finance");
  const tr = await getTranslations("enums.role");
  const cy = Number(todayJkt().slice(0, 4));
  const year = Number(sp.year) || cy;
  const d = await financeData(year);
  const [big, unitBig] = rupiahShort(d.kpi.ytd, l).split(" ");
  const [mv, mu] = rupiahShort(d.kpi.month.net, l).split(" ");
  const [ar, au] = rupiahShort(d.kpi.receivable, l).split(" ");
  const [av, avu] = rupiahShort(d.kpi.avgPerSession, l).split(" ");
  const shown = d.months.slice(0, year === cy ? d.curMonth + 1 : 12);
  const max = Math.max(1, ...shown.map((m) => m.net / 1e6));
  const W = 640, H = 260, pl = 44, pb = 34, pt = 16, pr = 10;
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const bw = (W - pl - pr) / Math.max(shown.length, 1);
  const colors = ["var(--teal)", "var(--teal-mid)", "var(--b737)", "var(--lime)", "var(--ok)", "var(--warn)"];
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow"><span className="role sa">{tr("SUPER_ADMIN")}</span></div>
          <h2 style={{ marginTop: 6 }}>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <FilterSelect name="year" label={t("period")} value={String(year)} options={d.years.map((y) => [String(y), String(y)])} />
          <a className="btn xls sm" href={`/api/admin/export/finance.xlsx?year=${year}`}>{t("export")}</a>
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{t("kpiYtd")}</span><span className="v">{big} <span style={{ fontSize: 18, color: "var(--faint)" }}>{unitBig}</span></span><span className="d">{t("kpiYtdD", { n: d.kpi.ytdCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiMonth", { month: `${monthLong(d.curMonth, l)} ${year}` })}</span><span className="v">{mv} <span style={{ fontSize: 18, color: "var(--faint)" }}>{mu}</span></span><span className="d">{t("kpiMonthD", { issued: d.kpi.month.issued, paid: d.kpi.month.paidCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiAr")}</span><span className="v" style={{ color: "var(--warn)" }}>{ar} <span style={{ fontSize: 18, color: "var(--faint)" }}>{au}</span></span><span className="d">{t("kpiArD", { n: d.kpi.receivableCount })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiAvg", { h: d.kpi.slotHours })}</span><span className="v">{av} <span style={{ fontSize: 18, color: "var(--faint)" }}>{avu}</span></span><span className="d">{t("kpiAvgD")}</span></div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", marginBottom: 18 }}>
        <div className="card">
          <div className="hd"><h3>{t("chartTitle")}</h3><span className="small muted">{t("chartUnit", { year })}</span></div>
          <div className="bd chart">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("chartTitle")}>
              {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => {
                const y = pt + (H - pt - pb) * (1 - v / top);
                return (
                  <g key={v}>
                    <line className="axis" x1={pl} x2={W - pr} y1={y} y2={y} />
                    <text className="lbl" x={pl - 8} y={y + 4} textAnchor="end">{v}</text>
                  </g>
                );
              })}
              {shown.map((m, i) => {
                const v = m.net / 1e6;
                const x = pl + i * bw + bw * 0.2, w = bw * 0.6, h = (H - pt - pb) * (Math.max(0, v) / top), y = pt + (H - pt - pb) - h;
                return (
                  <g key={i}>
                    <rect className={`bar ${i === shown.length - 1 && year === cy ? "cur" : ""}`} x={x} y={y} width={w} height={h} rx={3}><title>{`${monthLong(i, l)}: Rp ${num(m.net)}`}</title></rect>
                    <text className="lbl" x={x + w / 2} y={H - pb + 16} textAnchor="middle">{monthShort(i, l)}</text>
                    <text className="lbl" x={x + w / 2} y={y - 5} textAnchor="middle" style={{ fill: "var(--ink)", fontWeight: 600 }}>{Math.round(v)}</text>
                  </g>
                );
              })}
            </svg>
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

function niceStep(max: number) {
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
