"use client";
import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";
import { LangSwitch } from "../LangSwitch";
import { WeekCalendar, WeekNav, type CalCell } from "../WeekCalendar";
import { useAgo, useRealtime } from "../useRealtime";
import type { DashboardData, FeedItem } from "@/lib/services/dashboard";
import type { ViewStatus } from "@/lib/slot-view";
import { dateOnly, dayShort, fmtDate, fmtDateTime, fmtTime, initials, monthShort, rupiah, shortName } from "@/lib/format";
import { INV_PILL } from "@/lib/ui";
import { fmtSize } from "../upload";

type Ev = { type: "slot"; sim: string; date: string; start: string; end: string; v: ViewStatus; mine?: boolean; prevMine?: boolean; status?: string; instructor?: string | null; at: string };

const ICONS = {
  cal: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  list: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>,
  inv: <><path d="M6 2h9l5 5v15H6z" /><path d="M9 13h6M9 17h6" /></>,
  docs: <path d="M4 7h16M4 12h16M4 17h10" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

export function ParticipantDashboard({ token, initial }: { token: string; initial: DashboardData }) {
  const t = useTranslations("dash");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const ti = useTranslations("invoice");
  const l = useLocale() as "id" | "en";
  const [d, setD] = useState(initial);
  const [sim, setSim] = useState(initial.reg.sim);
  const [week, setWeek] = useState(initial.week);
  const [feed, setFeed] = useState<FeedItem[]>(initial.feed);
  const [flash, setFlash] = useState<string | null>(null);
  const [newest, setNewest] = useState<string | null>(null);

  const loadWeek = useCallback(
    async (s: string, monday: string) => {
      const r = await fetch(`/api/d/${encodeURIComponent(token)}/calendar?sim=${s}&week=${monday}`);
      if (r.ok) setWeek(await r.json());
    },
    [token],
  );
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/d/${encodeURIComponent(token)}/dashboard?l=${l}`);
    if (r.ok) {
      const j: DashboardData = await r.json();
      setD(j);
      setFeed(j.feed);
    }
    await loadWeek(sim, week.monday);
  }, [token, sim, week.monday, loadWeek, l]);

  const { last } = useRealtime<Ev>(
    `d:${token}`,
    (e) => {
      if (e.type !== "slot") return;
      if (e.sim === sim) {
        setWeek((w) => ({ ...w, slots: w.slots.map((x) => (x.date === e.date && x.start === e.start ? { ...x, v: e.v, instructor: e.mine ? (e.instructor ?? null) : null } : x)) }));
        setFlash(`${e.date}|${e.start}`);
        setTimeout(() => setFlash(null), 1000);
      }
      const kind: FeedItem["kind"] = e.mine || e.prevMine ? "mine" : e.v === "maint" ? "maint" : e.v === "free" ? "freed" : "booked";
      const item: FeedItem = { at: e.at, kind, sim: e.sim, date: e.date, start: e.start, text: e.mine || e.prevMine ? (e.prevMine ? "released" : e.status === "SCHEDULED" ? "assigned" : `result:${e.status}`) : undefined };
      setFeed((f) => [item, ...f].slice(0, 14));
      setNewest(e.at);
      if (e.mine || e.prevMine) refresh();
    },
    refresh,
  );
  const ago = useAgo(last);
  const agoTxt = ago < 3 ? tc("justNow") : tc("secAgo", { s: ago });

  const pkgName = l === "id" ? d.reg.pkg.id : d.reg.pkg.en;
  const pkgShort = l === "id" ? d.reg.pkg.short_id : d.reg.pkg.short_en;
  const slotH = d.settings.slot_minutes / 60;
  const doneHours = d.usage.done * slotH;
  const nowIso = new Date().toISOString();

  const cellFor = (date: string, start: string): CalCell => {
    const x = week.slots.find((s) => s.date === date && s.start === start);
    const v = x?.v ?? "free";
    const b = week.sim === "B737" ? "b737" : "";
    const past = x?.past ? "past" : "";
    const map: Record<ViewStatus, CalCell> = {
      free: { cls: `slot free ${past}`, lab: t("legendFree") },
      busy: { cls: `slot busy ${b} ${past}`, lab: t("slotBusy") },
      mine: { cls: `slot mine ${b} ${past}`, lab: t("slotMine"), sub: x?.instructor ?? undefined },
      maint: { cls: `slot maint ${past}`, lab: t("legendMaint") },
      done: { cls: `slot done ${past}`, lab: te("slotStatus.COMPLETED"), sub: x?.instructor ?? undefined },
      noshow: { cls: `slot noshow ${past}`, lab: te("slotStatus.NO_SHOW") },
    };
    return map[v];
  };

  const when = (date?: string, start?: string) => {
    if (!date) return "";
    const x = dateOnly(date);
    return `${dayShort(x.getUTCDay(), l)} ${x.getUTCDate()} ${monthShort(x.getUTCMonth(), l)}${start ? ` ${fmtTime(start, l)}` : ""}`;
  };
  const feedText = (f: FeedItem) => {
    const w = when(f.date, f.start);
    if (f.kind === "note") return f.text ?? "";
    if (f.kind === "mine") {
      if (f.text === "released") return t("feedMineReleased", { when: w });
      if (f.text?.startsWith("result:")) return t("feedMineResult", { when: w, status: te(`slotStatus.${f.text.slice(7)}` as "slotStatus.COMPLETED") });
      return t("feedMineAssigned", { when: w });
    }
    if (f.kind === "maint") return t("feedMaint", { sim: f.sim!, when: w });
    if (f.kind === "maint_clear") return t("feedMaintClear", { sim: f.sim!, when: w });
    if (f.kind === "freed") return t("feedFreed", { sim: f.sim!, when: w });
    return t("feedBooked", { sim: f.sim!, when: w });
  };
  const hhmm = (iso: string) => {
    const x = new Date(new Date(iso).getTime() + 7 * 3600_000);
    return fmtTime(`${String(x.getUTCHours()).padStart(2, "0")}:${String(x.getUTCMinutes()).padStart(2, "0")}`, l);
  };

  const waNumber = d.settings.wa_admin_number.replace(/\D/g, "");
  const reschedText = d.next
    ? t("rescheduleText", { name: d.participant.name, reg: d.reg.reg_no, when: `${fmtDate(d.next.date, l, { weekday: true })} ${fmtTime(d.next.start, l)}` })
    : t("rescheduleGeneric", { name: d.participant.name, reg: d.reg.reg_no });
  const reschedHref = `https://wa.me/${waNumber}?text=${encodeURIComponent(reschedText)}`;

  const payPill = d.invoiceStatus ? (d.invoiceStatus === "PAID" ? ["ok", te("invoiceStatus.PAID")] : [INV_PILL[d.invoiceStatus] ?? "warn", te(`invoiceStatus.${d.invoiceStatus}` as "invoiceStatus.PAID")]) : ["neutral", t("stNot")];
  const schedPill = d.usage.assigned >= d.usage.needed ? ["ok", t("stSet")] : d.usage.assigned > 0 ? ["teal", t("stPartial")] : ["neutral", t("stNot")];
  const verPill = d.reg.reupload ? ["bad", t("stRejected")] : d.reg.verified ? ["ok", t("stPassed")] : ["warn", t("stWaiting")];
  const invShort = d.invoices[0]?.no.split("/").slice(-1)[0];

  const nav = useMemo(
    () => [
      ["jadwal", t("navSchedule"), ICONS.cal],
      ["sesi", t("navSessions"), ICONS.list],
      ["invoice", t("navInvoice"), ICONS.inv],
      ["dokumen", t("navDocs"), ICONS.docs],
      ["profil", t("navProfile"), ICONS.user],
    ] as const,
    [t],
  );

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bwi-aviation.png" alt="BWI" />
          <div>
            <div className="who">Sim Center</div>
            <div className="sub">{t("side")}</div>
          </div>
        </div>
        {nav.map(([id, label, ic], i) => (
          <a key={id} href={`#${id}`} className={`nav ${i === 0 ? "on" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ic}</svg>
            {label}
          </a>
        ))}
        <div className="row" style={{ justifyContent: "center", marginTop: "auto", padding: "6px 0" }}>
          <Suspense><LangSwitch /></Suspense>
        </div>
        <div className="user" style={{ marginTop: 0 }}>
          <span className="avatar">{initials(d.participant.name)}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{shortName(d.participant.name)}</div>
            <div className="small muted">
              {d.participant.licence_type} · {d.reg.reg_no} · {t("viaLink")}
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <div className="eyebrow">{t("welcome")}</div>
            <h2>{t("title")}</h2>
          </div>
          <div className="row wrap">
            <span className="live small" style={{ color: "var(--ok)" }}>
              {tc("liveUpdated", { ago: agoTxt })}
            </span>
            <a className="btn ghost sm" href={reschedHref} target="_blank" rel="noopener noreferrer">{t("reschedule")}</a>
          </div>
        </div>

        {d.reg.status === "CANCELLED" && <div className="banner bad" style={{ marginBottom: 14 }}>{t("cancelled")}</div>}
        {d.reg.status === "EXPIRED" && <div className="banner warn" style={{ marginBottom: 14 }}>{t("expired")}</div>}

        <div className="grid dash-grid-3" style={{ gridTemplateColumns: "1fr 1fr 1.4fr", marginBottom: 18 }}>
          <div className="sess">
            {d.next ? (
              <>
                <div>
                  <div className="dt">{String(dateOnly(d.next.date).getUTCDate()).padStart(2, "0")}</div>
                  <div className="dm">
                    {dayShort(dateOnly(d.next.date).getUTCDay(), l)} · {monthShort(dateOnly(d.next.date).getUTCMonth(), l)}
                  </div>
                </div>
                <div className="info">
                  <span className="dm">{t("nextSession")}</span>
                  <b>
                    {fmtTime(d.next.start, l)} – {fmtTime(d.next.end, l)} WIB
                  </b>
                  <span style={{ fontSize: 13, color: "#C6DBE0" }}>
                    {d.reg.sim} FTD · {d.reg.bay}
                    {d.next.instructor ? ` · ${d.next.instructor}` : ""}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="dt">—</div>
                  <div className="dm">{t("noneYet")}</div>
                </div>
                <div className="info">
                  <span className="dm">{t("nextSession")}</span>
                  <b>{t("waitingSchedule")}</b>
                  <span style={{ fontSize: 13, color: "#C6DBE0" }}>{t("waitingScheduleD")}</span>
                </div>
              </>
            )}
          </div>
          <div className="card kpi">
            <span className="eyebrow">
              {pkgShort} {d.reg.sim}
            </span>
            <span className="v">
              {doneHours}
              <span style={{ fontSize: 18, color: "var(--faint)" }}> / {tc("hours", { n: d.reg.hours })}</span>
            </span>
            <div className="prog">
              <i style={{ width: `${Math.min(100, (d.usage.done / d.usage.needed) * 100)}%` }} />
            </div>
            <span className="d">{t("progressLine", { scheduled: d.usage.scheduled + d.usage.completed, done: d.usage.completed })}</span>
          </div>
          <div className="card pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="eyebrow">{t("status")}</span>
            <div className="row between"><span className="small">{t("stVerify")}</span><span className={`pill ${verPill[0]}`}>{verPill[1]}</span></div>
            <div className="row between"><span className="small">{t("stPay")} {invShort ? <span className="mono faint">INV/{invShort}</span> : null}</span><span className={`pill ${payPill[0]}`}>{payPill[1]}</span></div>
            <div className="row between"><span className="small">{t("stSched")}</span><span className={`pill ${schedPill[0]}`}>{schedPill[1]}</span></div>
          </div>
        </div>

        <div className="card dash-sec" id="jadwal">
          <div className="hd">
            <div className="row wrap">
              <div className="simtabs">
                {(["A320", "B737"] as const).map((s) => (
                  <button key={s} className={sim === s ? "on" : ""} onClick={() => { setSim(s); loadWeek(s, week.monday); }}>{tc(`sim.${s}`)}</button>
                ))}
              </div>
              <span className="small muted">{d.reg.sim === sim ? `${d.reg.bay} · ${d.reg.level}` : ""}</span>
            </div>
            <WeekNav monday={week.monday} l={l} onChange={(m) => loadWeek(sim, m)} prevLabel={tc("prevWeek")} nextLabel={tc("nextWeek")} />
          </div>
          <div className="bd">
            <WeekCalendar monday={week.monday} times={week.times} workDays={week.work_days} today={d.today} l={l} cellFor={cellFor} flash={flash} />
            <div className="row between wrap" style={{ marginTop: 14 }}>
              <div className="legend">
                <span><i className="f" />{t("legendFree")}</span>
                <span><i className="b" />{t("legendBusy")}</span>
                <span><i className="m" />{t("legendMine")}</span>
                <span><i className="mt" />{t("legendMaint")}</span>
              </div>
              <span className="small faint">{t("calFoot", { h: slotH, start: fmtTime(d.settings.ops_start, l), end: fmtTime(d.settings.ops_end, l) })}</span>
            </div>
          </div>
        </div>

        <div className="grid g2" style={{ marginTop: 18 }}>
          <div className="card">
            <div className="hd"><h3>{t("feedTitle")}</h3><span className="live small" style={{ color: "var(--ok)" }}>{tc("live")}</span></div>
            <div className="bd" style={{ paddingTop: 6 }}>
              {feed.length === 0 ? <div className="empty">{t("feedEmpty")}</div> : (
                <div className="feed">
                  {feed.map((f, i) => (
                    <div key={`${f.at}-${i}`} className={`it ${f.at === newest || (i === 0 && !newest) ? "new" : ""}`}>
                      <i />
                      <span>{feedText(f)}</span>
                      <span className="t">{f.at.slice(0, 10) === nowIso.slice(0, 10) ? hhmm(f.at) : fmtDate(new Date(new Date(f.at).getTime() + 7 * 3600_000), l, { year: false })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="card dash-sec" id="sesi">
            <div className="hd"><h3>{t("sessionsTitle")}</h3><span className="small muted">{pkgShort} {d.reg.sim} · {tc("hours", { n: d.reg.hours })}</span></div>
            <div className="bd" style={{ paddingTop: 8 }}>
              {d.sessions.length === 0 ? <div className="empty">{t("sessionsEmpty")}</div> : (
                <div className="tbl">
                  <table>
                    <thead><tr><th>{t("colNo")}</th><th>{t("colDate")}</th><th>{t("colTime")}</th>{d.settings.show_instructor && <th>{t("colInstructor")}</th>}<th>{t("colStatus")}</th></tr></thead>
                    <tbody>
                      {d.sessions.map((s, i) => (
                        <tr key={s.id}>
                          <td className="mono">{i + 1}</td>
                          <td>{fmtDate(s.date, l, { weekday: true })}</td>
                          <td className="mono">{fmtTime(s.start, l)}–{fmtTime(s.end, l)}</td>
                          {d.settings.show_instructor && <td>{s.instructor ?? "—"}</td>}
                          <td>
                            <span className={`pill ${s.status === "SCHEDULED" ? "info" : s.status === "COMPLETED" ? "ok" : s.status === "NO_SHOW" ? "bad" : "neutral"}`}>{te(`slotStatus.${s.status}` as "slotStatus.SCHEDULED")}</span>
                            {s.report && <a className="btn xs ghost" style={{ marginLeft: 6 }} href={`/api/d/${encodeURIComponent(token)}/report/${s.id}`} target="_blank" rel="noopener noreferrer">{t("colReport")}</a>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="callout" style={{ marginTop: 12 }}>{t("attendNote")}</div>
            </div>
          </div>
        </div>

        <div className="grid g2" style={{ marginTop: 18 }}>
          <div className="card dash-sec" id="invoice">
            <div className="hd"><h3>{t("invoicesTitle")}</h3></div>
            <div className="bd stack" style={{ gap: 10 }}>
              {d.invoices.length === 0 ? <div className="empty">{tc("noData")}</div> : d.invoices.map((i) => (
                <div key={i.no} className="row between wrap" style={{ padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8 }}>
                  <div>
                    <div className="mono" style={{ fontWeight: 600 }}>{i.no}</div>
                    <div className="small muted">{rupiah(i.total)} · {ti("due")} {fmtDate(new Date(new Date(i.due).getTime() + 7 * 3600_000), l)}</div>
                  </div>
                  <div className="row">
                    <span className={`pill ${INV_PILL[i.status]}`}>{te(`invoiceStatus.${i.status}` as "invoiceStatus.PAID")}</span>
                    <a className="btn xs ghost" href={`${l === "en" ? "/en" : ""}/d/${encodeURIComponent(token)}/invoice/${i.slug}`}>{t("viewInvoice")}</a>
                    <a className="btn xs ghost" href={`/api/d/${encodeURIComponent(token)}/invoice/${i.slug}.pdf`} target="_blank" rel="noopener noreferrer">PDF</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card dash-sec" id="dokumen">
            <div className="hd"><h3>{t("docsTitle")}</h3></div>
            <div className="bd stack" style={{ gap: 8 }}>
              {d.documents.map((doc) => (
                <div key={doc.id} className="row between" style={{ padding: "8px 10px", border: "1px solid var(--line-soft)", borderRadius: 8 }}>
                  <div className="small">
                    <b>{te(`docKind.${doc.kind}` as "docKind.KTP")}</b>
                    <div className="faint">{doc.name} · {fmtSize(doc.size)}</div>
                  </div>
                  <div className="row">
                    <span className={`pill xs ${doc.review === "OK" ? "ok" : doc.review === "REJECTED" ? "bad" : "warn"}`}>{te(`docReview.${doc.review}` as "docReview.OK")}</span>
                    <a className="btn xs ghost" href={`/api/d/${encodeURIComponent(token)}/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">{tc("view")}</a>
                  </div>
                </div>
              ))}
              <p className="small faint">{t("docsNote")}</p>
            </div>
          </div>
        </div>

        <div className="card pad dash-sec" id="profil" style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{t("profileTitle")}</div>
          <div className="kv">
            <span className="k">{t("pName")}</span><span className="v">{d.participant.name}</span>
            <span className="k">Email</span><span className="v">{d.participant.email}</span>
            <span className="k">WhatsApp</span><span className="v mono">{d.participant.whatsapp}</span>
            <span className="k">{t("pLicence")}</span><span className="v mono">{d.participant.licence}</span>
            <span className="k">Medical</span><span className="v mono">{d.participant.medical}</span>
            <span className="k">{t("pPackage")}</span><span className="v">{pkgName} · {tc(`sim.${d.reg.sim as "A320"}`)}</span>
          </div>
          <div className="callout info" style={{ marginTop: 14 }}>{t("privacy")} <span className="faint small">· {t("lastUpdate")} {fmtDateTime(new Date(), l)}</span></div>
        </div>
      </div>
    </div>
  );
}
