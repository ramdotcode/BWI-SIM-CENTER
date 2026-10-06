"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { WeekCalendar, WeekNav, type CalCell } from "../WeekCalendar";
import { Modal } from "../Overlay";
import { useToast } from "../Toast";
import { useRealtime } from "../useRealtime";
import { ACCEPT, api, uploadFile } from "../upload";
import { fmtDate, fmtShortTs, fmtTime, mondayOf, shortName } from "@/lib/format";
import type { AdminWeek, QueueItem } from "@/lib/services/admin-schedule";

type Slot = AdminWeek["slots"][number];
type Ins = { id: number; name: string; sims: string[]; slots: number };

export function ScheduleBoard(props: { initialWeek: AdminWeek; initialQueue: QueueItem[]; initialInstructors: Ins[]; allInstructors: Ins[]; today: string; slotMinutes: number; initialReg: number | null; reportEnabled: boolean; showInstructor: boolean }) {
  const t = useTranslations("admin.sched");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const l = useLocale() as "id" | "en";
  const toast = useToast();
  const [week, setWeek] = useState(props.initialWeek);
  const [queue, setQueue] = useState(props.initialQueue);
  const [load, setLoad] = useState(props.initialInstructors);
  const [sim, setSim] = useState(props.initialWeek.sim);
  const [sel, setSel] = useState<number | null>(props.initialReg);
  const [assign, setAssign] = useState<Slot | null>(null);
  const [detail, setDetail] = useState<Slot | null>(null);
  const [maint, setMaint] = useState(false);
  const [clear, setClear] = useState<Slot | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(
    async (s = sim, monday = week.monday) => {
      const [w, q] = await Promise.all([api<{ week: AdminWeek; instructors: Ins[] }>(`/api/admin/slots/week?sim=${s}&week=${monday}`), api<QueueItem[]>(`/api/admin/slots/queue`)]);
      setWeek(w.week);
      setLoad(w.instructors);
      setQueue(q);
    },
    [sim, week.monday],
  );
  useRealtime<{ type: string; sim?: string; date?: string; start?: string }>(
    "admin",
    (e) => {
      if (e.type !== "slot") return;
      if (e.sim === sim) setFlash(`${e.date}|${e.start}`);
      setTimeout(() => setFlash(null), 1000);
      if (deb.current) clearTimeout(deb.current);
      deb.current = setTimeout(() => reload(), 400);
    },
    () => reload(),
  );

  const selItem = queue.find((q) => q.reg_id === sel) ?? null;
  const slotAt = (date: string, start: string) => week.slots.find((x) => x.date === date && x.start === start);
  const b = sim === "B737" ? "b737" : "";

  const cellFor = (date: string, start: string): CalCell => {
    const x = slotAt(date, start);
    if (!x) return { cls: "slot past", lab: "—" };
    const past = x.past ? "past" : "";
    const mine = sel && x.reg_id === sel ? "selected" : "";
    switch (x.status) {
      case "AVAILABLE":
        return { cls: `slot free ${past}`, lab: x.past ? t("past") : te("slotStatus.AVAILABLE"), clickable: !x.past };
      case "SCHEDULED":
        return { cls: `slot busy ${b} ${past} ${mine}`, lab: x.short ?? "", sub: x.instructor ?? undefined, clickable: true, title: `${x.name} · ${x.reg_no}` };
      case "COMPLETED":
        return { cls: `slot done ${mine}`, lab: x.short ?? "", sub: te("slotStatus.COMPLETED"), clickable: true };
      case "NO_SHOW":
        return { cls: `slot noshow ${mine}`, lab: x.short ?? "", sub: te("slotStatus.NO_SHOW"), clickable: true };
      case "CANCELLED":
        return { cls: `slot busy past`, lab: te("slotStatus.CANCELLED"), sub: x.short ?? undefined, clickable: !!x.reg_id };
      case "MAINTENANCE":
        return x.block_kind === "OTHER"
          ? { cls: `slot maint ${past}`, lab: x.reason ?? t("kindOther"), sub: t("kindOther"), clickable: !x.past }
          : { cls: `slot maint ${past}`, lab: "Maintenance", sub: x.reason ?? undefined, clickable: !x.past };
      default:
        return { cls: "slot", lab: x.status };
    }
  };
  const onCell = (date: string, start: string) => {
    const x = slotAt(date, start);
    if (!x) return;
    if (x.status === "AVAILABLE") setAssign(x);
    else if (x.status === "MAINTENANCE") setClear(x);
    else setDetail(x);
  };

  const pickReg = (q: QueueItem) => {
    setSel(q.reg_id);
    const target = q.pref_from && q.pref_from > props.today ? mondayOf(q.pref_from) : mondayOf(props.today);
    if (q.sim !== sim || target !== week.monday) {
      setSim(q.sim);
      reload(q.sim, target);
    }
    toast(`${shortName(q.name)} → ${l === "id" ? "klik slot kosong di kalender" : "click an empty slot on the calendar"}`);
  };

  const run = async (fn: () => Promise<string | void>, close: () => void) => {
    setBusy(true);
    try {
      const m = await fn();
      if (m) toast(m);
      close();
      await reload();
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };

  const slotLabel = (x: { date: string; start: string; end: string }) => `${fmtDate(x.date, l, { weekday: true, year: false })} · ${fmtTime(x.start, l)}–${fmtTime(x.end, l)}`;
  const nSlots4h = Math.ceil(240 / props.slotMinutes);
  const sortedQueue = useMemo(() => [...queue].filter((q) => q.remaining > 0 || !q.schedule_sent_at).sort((a, b) => Number(b.affected) - Number(a.affected) || (a.paid_at ?? "").localeCompare(b.paid_at ?? "")), [queue]);

  return (
    <>
      <div className="topbar">
        <div>
          <div className="eyebrow">{t("eyebrow")}</div>
          <h2>{t("title")}</h2>
        </div>
        <div className="row wrap">
          <span className="live small" style={{ color: "var(--ok)" }}>{t("liveSync")}</span>
          <button className="btn ghost sm" onClick={() => setMaint(true)}>{t("maint")}</button>
          <button className="btn sm" onClick={() => { const f = week.slots.find((x) => x.status === "AVAILABLE" && !x.past); if (f) setAssign(f); }}>{t("assign")}</button>
        </div>
      </div>
      <div className="grid sched-grid" style={{ gridTemplateColumns: "minmax(0,1fr) 300px", alignItems: "start" }}>
        <div className="card">
          <div className="hd">
            <div className="simtabs">
              {(["A320", "B737"] as const).map((s) => (
                <button key={s} className={sim === s ? "on" : ""} onClick={() => { setSim(s); reload(s, week.monday); }}>{tc(`sim.${s}`)}</button>
              ))}
            </div>
            <div className="row">
              <button className="btn xs ghost" onClick={() => reload(sim, mondayOf(props.today))}>{tc("thisWeek")}</button>
              <WeekNav monday={week.monday} l={l} onChange={(m) => reload(sim, m)} prevLabel={tc("prevWeek")} nextLabel={tc("nextWeek")} />
            </div>
          </div>
          <div className="bd">
            {selItem && (
              <div className="banner warn row between wrap" style={{ marginBottom: 12 }}>
                <span><b>{selItem.name}</b> · {selItem.sim} {selItem.pkg} · {t("slotsProgress", { a: selItem.assigned, n: selItem.needed })}</span>
                <button className="btn xs ghost" onClick={() => setSel(null)}>✕</button>
              </div>
            )}
            <WeekCalendar monday={week.monday} times={week.times} workDays={week.work_days} today={props.today} l={l} cellFor={cellFor} onCell={onCell} flash={flash} />
            <div className="row between wrap" style={{ marginTop: 14 }}>
              <div className="legend">
                <span><i className="f" />{t("legendFree")}</span>
                <span><i className="b" />{t("legendBusy")}</span>
                <span><i className="mt" />{t("legendMaint")}</span>
                <span><i style={{ background: "var(--ok-soft)", borderColor: "#BFE6D3" }} />{t("legendDone")}</span>
              </div>
              <span className="small faint">{t("foot", { h: props.slotMinutes / 60, n: nSlots4h })}</span>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="hd"><h3>{t("queue")}</h3><span className="pill teal">{sortedQueue.length}</span></div>
            <div className="bd stack" style={{ gap: 10, paddingTop: 10, maxHeight: 460, overflow: "auto" }}>
              {sortedQueue.length === 0 && <div className="empty">{t("queueEmpty")}</div>}
              {sortedQueue.map((q) => (
                <div key={q.reg_id} className={`qitem stack ${q.affected ? "warn" : ""}`} style={{ gap: 6, outline: sel === q.reg_id ? "2px solid var(--lime)" : undefined }}>
                  <div className="row between"><b>{shortName(q.name)}</b><span className={`chip ${q.sim.toLowerCase()}`}>{q.sim}</span></div>
                  <div className="small muted">
                    {l === "id" ? q.pkg : q.pkg_en} {tc("hours", { n: q.hours })}
                    {q.paid_at ? ` · ${t("paidOn", { date: fmtDate(new Date(new Date(q.paid_at).getTime() + 7 * 3600_000), l, { year: false }) })}` : ""}
                    {q.pref_from ? ` · ${t("pref", { time: te(`prefTimeShort.${q.pref_time as "MORNING"}`), from: fmtDate(q.pref_from, l, { year: false }), to: q.pref_to ? fmtDate(q.pref_to, l, { year: false }) : "…" })}` : ""}
                  </div>
                  {q.affected && <span className="pill warn xs" style={{ alignSelf: "flex-start" }}>{t("affected")}</span>}
                  <div className="prog"><i style={{ width: `${(q.assigned / q.needed) * 100}%` }} /></div>
                  <div className="row between">
                    <span className="small mono">{t("slotsProgress", { a: q.assigned, n: q.needed })}</span>
                    {q.remaining > 0 ? (
                      <button className={`btn xs ${q.assigned ? "ghost" : ""}`} onClick={() => pickReg(q)}>{q.assigned ? t("btnContinue") : t("btnSchedule")}</button>
                    ) : (
                      <button className="btn xs lime" onClick={() => pickReg(q)}>✉</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card pad stack" style={{ gap: 8 }}>
            <div className="eyebrow">{t("instructors")}</div>
            {load.map((i) => (
              <div key={i.id} className="row between small">
                <span>{i.name} {i.sims.map((s) => <span key={s} className={`chip ${s.toLowerCase()}`} style={{ marginLeft: 4 }}>{s}</span>)}</span>
                <span className="mono muted">{tc("slots", { n: i.slots })}</span>
              </div>
            ))}
          </div>

          <div className="card pad stack" style={{ gap: 8 }}>
            <div className="eyebrow">{t("afterTitle")}</div>
            <p className="small muted">{t("afterDesc")}</p>
            {selItem ? (
              <>
                <button
                  className="btn lime sm"
                  disabled={busy || selItem.assigned === 0}
                  onClick={() => run(async () => { const r = await api<{ email: string }>(`/api/admin/registrations/${selItem.reg_id}/send-schedule`, { body: {} }); return t("toastSent", { email: r.email }); }, () => {})}
                >
                  {selItem.assigned < selItem.needed ? t("sendPartial", { name: shortName(selItem.name) }) : t("sendTo", { name: shortName(selItem.name) })}
                </button>
                {selItem.schedule_sent_at && <span className="small faint">{t("sent", { ts: fmtShortTs(new Date(selItem.schedule_sent_at), l) })}</span>}
              </>
            ) : (
              <span className="small faint">{t("noSend")}</span>
            )}
          </div>
        </div>
      </div>

      {assign && (
        <AssignModal
          slot={assign}
          sim={sim}
          queue={queue.filter((q) => q.sim === sim && q.remaining > 0)}
          instructors={props.allInstructors.filter((i) => i.sims.includes(sim))}
          load={load}
          defaultReg={sel}
          busy={busy}
          onClose={() => setAssign(null)}
          onSave={(body) =>
            run(async () => {
              const r = await api<{ assigned: number; name: string; warnings: string[] }>(`/api/admin/slots/assign`, { body });
              setSel(body.registrationId);
              return t("toastAssigned", { n: r.assigned, name: shortName(r.name) });
            }, () => setAssign(null))
          }
          slotLabel={slotLabel}
        />
      )}

      {detail && (
        <DetailModal
          slot={detail}
          sim={sim}
          busy={busy}
          reportEnabled={props.reportEnabled}
          onClose={() => setDetail(null)}
          slotLabel={slotLabel}
          onRelease={(reason, notify) => run(async () => { await api(`/api/admin/slots/release`, { body: { slotId: detail.id, reason, notify } }); return t("toastReleased"); }, () => setDetail(null))}
          onMove={(targetId, notify) => run(async () => { await api(`/api/admin/slots/move`, { body: { slotId: detail.id, targetId, notify } }); return t("toastMoved"); }, () => setDetail(null))}
          onResult={(status, note, report) => run(async () => { await api(`/api/admin/slots/result`, { body: { slotId: detail.id, status, note, report_upload: report } }); return t("toastResult"); }, () => setDetail(null))}
          instructors={props.allInstructors.filter((i) => i.sims.includes(sim))}
          load={load}
          showInstructor={props.showInstructor}
          onInstructor={(instructorId, notify) => run(async () => { const r = await api<{ name: string | null }>(`/api/admin/slots/instructor`, { body: { slotId: detail.id, instructorId, notify } }); return t("toastInstructor", { name: r.name ?? "—" }); }, () => setDetail(null))}
        />
      )}

      {maint && <MaintModal sim={sim} times={week.times} defaultDate={week.monday < props.today && props.today <= week.slots.at(-1)!.date ? props.today : week.monday} busy={busy} onClose={() => setMaint(false)} onDone={async (msg) => { toast(msg); setMaint(false); await reload(); }} setBusy={setBusy} />}

      <Modal
        open={!!clear}
        onClose={() => setClear(null)}
        title={t("maintClear")}
        footer={<><button className="btn ghost" onClick={() => setClear(null)}>{tc("cancel")}</button><button className="btn" disabled={busy} onClick={() => run(async () => { await api(`/api/admin/slots/maintenance-clear`, { body: { slotId: clear!.id } }); return t("toastMaintClear"); }, () => setClear(null))}>{t("maintClear")}</button></>}
      >
        {clear && <p><span className={`chip ${sim.toLowerCase()}`}>{sim}</span> <b>{slotLabel(clear)}</b> · {clear.reason}</p>}
      </Modal>
    </>
  );
}

function AssignModal({ slot, sim, queue, instructors, load, defaultReg, busy, onClose, onSave, slotLabel }: {
  slot: Slot; sim: string; queue: QueueItem[]; instructors: Ins[]; load: Ins[]; defaultReg: number | null; busy: boolean; onClose: () => void;
  onSave: (b: { slotId: number; registrationId: number; instructorId: number | null; autofill: boolean; notify: boolean }) => void; slotLabel: (x: Slot) => string;
}) {
  const t = useTranslations("admin.sched");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const l = useLocale() as "id" | "en";
  const [reg, setReg] = useState<number | "">(queue.some((q) => q.reg_id === defaultReg) ? defaultReg! : (queue[0]?.reg_id ?? ""));
  const [ins, setIns] = useState<number | "">(instructors[0]?.id ?? "");
  const [autofill, setAutofill] = useState(true);
  const [notify, setNotify] = useState(true);
  const q = queue.find((x) => x.reg_id === reg);
  const medWarn = q && q.medical_until < slot.date;
  return (
    <Modal
      open
      onClose={onClose}
      title={t("mAssignTitle")}
      footer={<><button className="btn ghost" onClick={onClose}>{tc("cancel")}</button><button className="btn" disabled={busy || !reg} onClick={() => onSave({ slotId: slot.id, registrationId: Number(reg), instructorId: ins ? Number(ins) : null, autofill, notify })}>{t("save")}</button></>}
    >
      <div className="row between" style={{ padding: "12px 14px", background: "var(--teal-tint)", borderRadius: 8 }}>
        <div><span className={`chip ${sim.toLowerCase()}`}>{sim}</span> <b>{slotLabel(slot)}</b></div>
        <span className="pill ok">{t("empty")}</span>
      </div>
      {queue.length === 0 ? <div className="empty">{t("noCandidates")}</div> : (
        <label className="field">
          <span className="flabel">{t("who")}</span>
          <select className="in" value={reg} onChange={(e) => setReg(Number(e.target.value))}>
            {queue.map((x) => <option key={x.reg_id} value={x.reg_id}>{shortName(x.name)} — {l === "id" ? x.pkg : x.pkg_en} {x.sim} · {x.assigned}/{x.needed} slot</option>)}
          </select>
          {q && <span className="hint">{q.reg_no}{q.pref_from ? ` · ${te(`prefTimeShort.${q.pref_time as "MORNING"}`)} ${fmtDate(q.pref_from, l, { year: false })}–${q.pref_to ? fmtDate(q.pref_to, l, { year: false }) : "…"}` : ""}</span>}
        </label>
      )}
      <label className="field">
        <span className="flabel">{t("instructor")}</span>
        <select className="in" value={ins} onChange={(e) => setIns(e.target.value ? Number(e.target.value) : "")}>
          <option value="">{t("pickInstructor")}</option>
          {instructors.map((i) => <option key={i.id} value={i.id}>{i.name} · {tc("slots", { n: load.find((x) => x.id === i.id)?.slots ?? 0 })}</option>)}
        </select>
      </label>
      {medWarn && <div className="banner warn">{t("medWarn", { date: fmtDate(q!.medical_until, l) })}</div>}
      <label className="row small"><input type="checkbox" checked={autofill} onChange={(e) => setAutofill(e.target.checked)} />{t("autofill")}</label>
      <label className="row small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t("notify")}</label>
    </Modal>
  );
}

function DetailModal({ slot, sim, busy, reportEnabled, onClose, slotLabel, onRelease, onMove, onResult, instructors, load, showInstructor, onInstructor }: {
  slot: Slot; sim: string; busy: boolean; reportEnabled: boolean; onClose: () => void; slotLabel: (x: Slot) => string;
  onRelease: (reason: string, notify: boolean) => void; onMove: (targetId: number, notify: boolean) => void; onResult: (status: string, note: string, report?: string) => void;
  instructors: Ins[]; load: Ins[]; showInstructor: boolean; onInstructor: (instructorId: number | null, notify: boolean) => void;
}) {
  const t = useTranslations("admin.sched");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const l = useLocale() as "id" | "en";
  const [mode, setMode] = useState<"" | "release" | "move" | "result" | "instructor">(slot.past && slot.status === "SCHEDULED" ? "result" : "");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [free, setFree] = useState<{ id: number; date: string; start: string; end: string }[] | null>(null);
  const [target, setTarget] = useState<number | "">("");
  const [status, setStatus] = useState(slot.status === "SCHEDULED" ? "COMPLETED" : slot.status);
  const [note, setNote] = useState(slot.result_note ?? "");
  const [report, setReport] = useState<string | undefined>();
  const [upl, setUpl] = useState("");
  const [ins, setIns] = useState<number | "">(slot.instructor_id ?? "");
  const [insNotify, setInsNotify] = useState(false);
  const future = !slot.past && slot.status === "SCHEDULED";
  return (
    <Modal open onClose={onClose} title={t("mDetailTitle")} wide footer={<button className="btn ghost" onClick={onClose}>{tc("close")}</button>}>
      <div className="kv">
        <span className="k">{t("slot")}</span><span className="v"><span className={`chip ${sim.toLowerCase()}`}>{sim}</span> {slotLabel(slot)}</span>
        <span className="k">{t("participant")}</span><span className="v">{slot.name} <span className="mono small muted">{slot.reg_no}</span></span>
        <span className="k">{t("package")}</span><span className="v">{slot.pkg}</span>
        <span className="k">{t("instructor")}</span><span className="v">{slot.instructor ?? "—"}</span>
        <span className="k">{t("status")}</span><span className="v"><span className={`pill ${slot.status === "SCHEDULED" ? "info" : slot.status === "COMPLETED" ? "ok" : "bad"}`}>{te(`slotStatus.${slot.status}` as "slotStatus.SCHEDULED")}</span></span>
        {slot.result_note && <><span className="k">{t("resultNote")}</span><span className="v">{slot.result_note}</span></>}
        {slot.report && <><span className="k">{t("report")}</span><span className="v"><a href={`/api/admin/uploads/report:${slot.id}`} target="_blank" rel="noopener noreferrer">PDF</a></span></>}
      </div>
      <div className="row wrap">
        {future && <button className={`btn sm ${mode === "instructor" ? "" : "ghost"}`} onClick={() => setMode("instructor")}>{t("changeInstructor")}</button>}
        {future && <button className={`btn sm ${mode === "release" ? "" : "ghost"}`} onClick={() => setMode("release")}>{t("release")}</button>}
        {future && <button className={`btn sm ${mode === "move" ? "" : "ghost"}`} onClick={async () => { setMode("move"); if (!free) setFree(await api(`/api/admin/slots/free?sim=${sim}`)); }}>{t("move")}</button>}
        {slot.past && <button className={`btn sm ${mode === "result" ? "" : "ghost"}`} onClick={() => setMode("result")}>{t("result")}</button>}
      </div>
      {!slot.past && slot.status === "SCHEDULED" && <span className="small faint">{t("resultOnlyPast")}</span>}
      {mode === "instructor" && (
        <div className="stack">
          <label className="field">
            <span className="flabel">{t("newInstructor")}</span>
            <select className="in" value={ins} onChange={(e) => setIns(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("noInstructor")}</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name} · {tc("slots", { n: load.find((x) => x.id === i.id)?.slots ?? 0 })}{i.id === slot.instructor_id ? ` (${t("current")})` : ""}</option>)}
            </select>
          </label>
          {showInstructor && <label className="row small"><input type="checkbox" checked={insNotify} onChange={(e) => setInsNotify(e.target.checked)} />{t("notifyInstructor")}</label>}
          <button className="btn" disabled={busy || (ins || null) === (slot.instructor_id ?? null)} onClick={() => onInstructor(ins || null, insNotify)}>{t("saveInstructor")}</button>
        </div>
      )}
      {mode === "release" && (
        <div className="stack">
          <label className="field"><span className="flabel">{t("releaseReason")}</span><input className="in" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <label className="row small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t("notify")}</label>
          <button className="btn bad" disabled={busy} onClick={() => onRelease(reason, notify)}>{t("release")}</button>
        </div>
      )}
      {mode === "move" && (
        <div className="stack">
          <label className="field">
            <span className="flabel">{t("moveTo")}</span>
            <select className="in" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              <option value="">{free ? t("movePick") : tc("loading")}</option>
              {free?.map((f) => <option key={f.id} value={f.id}>{fmtDate(f.date, l, { weekday: true, year: false })} · {fmtTime(f.start, l)}–{fmtTime(f.end, l)}</option>)}
            </select>
          </label>
          <label className="row small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />{t("notify")}</label>
          <button className="btn" disabled={busy || !target} onClick={() => onMove(Number(target), notify)}>{t("move")}</button>
        </div>
      )}
      {mode === "result" && (
        <div className="stack">
          <div className="chips">
            {(["COMPLETED", "NO_SHOW", "CANCELLED"] as const).map((s) => (
              <button key={s} type="button" className={`chk ${status === s ? "on" : ""}`} onClick={() => setStatus(s)}>{t(s === "COMPLETED" ? "resultCompleted" : s === "NO_SHOW" ? "resultNoShow" : "resultCancelled")}</button>
            ))}
          </div>
          <label className="field"><span className="flabel">{t("resultNote")}</span><textarea className="in" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          {reportEnabled && (
            <label className="field">
              <span className="flabel">{t("report")}</span>
              <input className="in" type="file" accept={ACCEPT} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUpl("…"); try { const u = await uploadFile(f, "SESSION_REPORT"); setReport(u.id); setUpl("✓"); } catch (err) { setUpl((err as Error).message); } }} />
              {upl && <span className="hint">{upl}</span>}
            </label>
          )}
          <button className="btn ok" disabled={busy} onClick={() => onResult(status, note, report)}>{t("saveResult")}</button>
        </div>
      )}
    </Modal>
  );
}

function MaintModal({ sim, times, defaultDate, busy, onClose, onDone, setBusy }: { sim: string; times: { start: string; end: string }[]; defaultDate: string; busy: boolean; onClose: () => void; onDone: (msg: string) => void; setBusy: (b: boolean) => void }) {
  const t = useTranslations("admin.sched");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const toast = useToast();
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState(times[0]?.start ?? "06:00");
  const [to, setTo] = useState(times[0]?.end ?? "08:00");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"MAINTENANCE" | "OTHER">("MAINTENANCE");
  const [preview, setPreview] = useState<{ count: number; affected: { slot: string; name: string; reg_no: string }[] } | null>(null);
  const body = (confirm: boolean) => ({ sim, date, from, to, reason, kind, confirm });
  const check = async () => {
    setBusy(true);
    try {
      setPreview(await api(`/api/admin/slots/maintenance`, { body: body(false) }));
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  const apply = async () => {
    setBusy(true);
    try {
      const r = await api<{ count: number }>(`/api/admin/slots/maintenance`, { body: body(true) });
      onDone(t("toastMaint", { n: r.count }));
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("mMaintTitle")} · ${sim}`}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>{tc("cancel")}</button>
          {!preview ? (
            <button className="btn" disabled={busy || reason.trim().length < 2 || from >= to} onClick={check}>{tc("next")}</button>
          ) : (
            <button className={`btn ${preview.affected.length ? "bad" : ""}`} disabled={busy} onClick={apply}>{preview.affected.length ? t("maintConfirm") : t("maintSave")}</button>
          )}
        </>
      }
    >
      <div className="field" style={{ marginBottom: 12 }}>
        <span className="flabel">{t("blockKind")}</span>
        <div className="chips" role="radiogroup">
          {(["MAINTENANCE", "OTHER"] as const).map((k) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} className={`chk ${kind === k ? "on" : ""}`} onClick={() => { setKind(k); setPreview(null); }}>
              {k === "MAINTENANCE" ? "Maintenance" : t("kindOther")}
            </button>
          ))}
        </div>
      </div>
      <div className="fgrid three">
        <label className="field"><span className="flabel">{t("maintDate")}</span><input className="in" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPreview(null); }} /></label>
        <label className="field"><span className="flabel">{t("maintFrom")}</span><select className="in" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }}>{times.map((x) => <option key={x.start} value={x.start}>{fmtTime(x.start, l)}</option>)}</select></label>
        <label className="field"><span className="flabel">{t("maintTo")}</span><select className="in" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }}>{times.map((x) => <option key={x.end} value={x.end}>{fmtTime(x.end, l)}</option>)}</select></label>
      </div>
      <label className="field"><span className="flabel">{kind === "OTHER" ? t("otherReason") : t("maintReason")}</span><input className="in" value={reason} maxLength={200} onChange={(e) => { setReason(e.target.value); setPreview(null); }} placeholder={kind === "OTHER" ? t("otherReasonPh") : "Visual system, preventive maint., …"} /></label>
      {preview && (
        preview.affected.length ? (
          <div className="banner bad">
            {t("maintAffected")}
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{preview.affected.map((a) => <li key={a.slot + a.reg_no}><b>{a.name}</b> <span className="mono">{a.reg_no}</span> · {a.slot}</li>)}</ul>
          </div>
        ) : (
          <div className="banner ok">{t("toastMaint", { n: preview.count })} · {fmtDate(date, l, { weekday: true })}</div>
        )
      )}
    </Modal>
  );
}
