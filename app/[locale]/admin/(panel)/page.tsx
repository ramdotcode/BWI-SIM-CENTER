import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { homeData } from "@/lib/services/admin";
import { fmtDate, fmtTime, relAgo, rupiahShort, waitDur } from "@/lib/format";
import { WaOutbox } from "@/components/admin/WaOutbox";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = (await getLocale()) as "id" | "en";
  const t = await getTranslations("admin.home");
  const d = await homeData();
  const btn = { check: ["", t("btnCheck")], follow: ["ghost", t("btnFollow")], view: ["ghost", t("btnView")], schedule: ["ghost", t("btnSchedule")] } as const;
  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{fmtDate(d.date, l, { weekday: true })}</div>
          <h2>{t("title")}</h2>
        </div>
        <div className="row">
          <Link href="/admin/jadwal" className="btn ghost sm">{t("manageSched")}</Link>
          <Link href="/admin/verifikasi" className="btn sm">
            {t("verifyQueue")} <span style={{ background: "var(--lime)", color: "var(--teal-deep)", padding: "0 7px", borderRadius: 999, fontSize: 11 }}>{d.kpi.verify}</span>
          </Link>
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card kpi"><span className="eyebrow">{t("kpiVerify")}</span><span className="v">{d.kpi.verify}</span><span className="d">{d.kpi.verifyOldest ? t("kpiVerifyD", { ago: relAgo(d.kpi.verifyOldest, l) }) : "—"}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiPay")}</span><span className="v">{d.kpi.payCount}</span><span className="d">{t("kpiPayD", { amount: `Rp ${rupiahShort(d.kpi.paySum, l)}`, n: d.kpi.overdue })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiWeek")}</span><span className="v">{d.kpi.weekA + d.kpi.weekB}</span><span className="d">{t("kpiWeekD", { a: d.kpi.weekA, b: d.kpi.weekB })}</span></div>
        <div className="card kpi"><span className="eyebrow">{t("kpiUtil")}</span><span className="v">{d.kpi.util}%</span><span className="d"><b style={{ color: d.kpi.utilDelta >= 0 ? "var(--ok)" : "var(--bad)" }}>{d.kpi.utilDelta >= 0 ? "+" : ""}{d.kpi.utilDelta}%</b> {t("kpiUtilD", { delta: "" }).trim()}</span></div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", alignItems: "start" }}>
        <div className="card">
          <div className="hd"><h3>{t("actionTitle")}</h3><span className="small muted">{t("actionSort")}</span></div>
          {d.rows.length === 0 ? <div className="bd"><div className="empty">{t("nothing")}</div></div> : (
            <div className="tbl">
              <table>
                <thead><tr><th>{t("colParticipant")}</th><th>{t("colStage")}</th><th>{t("colPackage")}</th><th>{t("colWaiting")}</th><th /></tr></thead>
                <tbody>
                  {d.rows.slice(0, 12).map((r) => (
                    <tr key={r.key}>
                      <td><b>{r.name}</b><div className="small muted mono">{r.ref}</div></td>
                      <td><span className={`pill ${r.pill}`}>{t(r.stage as "stageVerify")}</span></td>
                      <td><span className={`chip ${r.sim.toLowerCase()}`}>{r.sim}</span> {r.pkg} {r.hours}{l === "id" ? "j" : "h"}</td>
                      <td className="mono">{waitDur(r.since, l, d.now)}</td>
                      <td><Link href={r.href} className={`btn xs ${btn[r.action][0]}`}>{btn[r.action][1]}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div className="card">
            <div className="hd"><h3>{t("todayTitle")}</h3><span className="live small" style={{ color: "var(--ok)" }}>LIVE</span></div>
            <div className="bd stack" style={{ gap: 10 }}>
              {d.today.length === 0 && <div className="empty">{t("todayEmpty")}</div>}
              {d.today.map((x) => {
                const box = x.phase === "live" ? { border: "1px solid var(--teal)", background: "var(--teal-tint)" } : x.phase === "maint" ? { border: "1px solid #F0D9A0", background: "var(--warn-soft)" } : { border: "1px solid var(--line)" };
                const pill = x.phase === "live" ? ["teal", t("inProgress")] : x.phase === "maint" ? ["warn", "Maint."] : x.phase === "done" ? ["ok", x.status === "NO_SHOW" ? "No-show" : l === "id" ? "Selesai" : "Done"] : ["neutral", t("upcoming")];
                return (
                  <div key={x.id} className="row between" style={{ padding: "10px 12px", borderRadius: 8, ...box }}>
                    <div>
                      <span className={`chip ${x.sim.toLowerCase()}`}>{x.sim}</span> <b>{fmtTime(x.start, l)}–{fmtTime(x.end, l)}</b>
                      <div className="small muted">{x.who ? `${x.who}${x.instructor ? ` · ${x.instructor}` : ""}` : x.reason}</div>
                    </div>
                    <span className={`pill ${pill[0]}`}>{pill[1]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <WaOutbox items={JSON.parse(JSON.stringify(d.wa))} />
        </div>
      </div>
    </>
  );
}
