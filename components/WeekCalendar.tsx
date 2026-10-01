"use client";
import { addDays, dateOnly, dayShort, fmtTime } from "@/lib/format";

export type CalCell = { cls: string; lab: string; sub?: string; clickable?: boolean; title?: string };

/** Kalender mingguan (hari kerja saja, default Sen–Min) × sesi. Hari ini disorot, slot lampau dipudarkan (kelas "past" dari cellFor). */
export function WeekCalendar({
  monday,
  times,
  workDays = [1, 2, 3, 4, 5, 6, 7],
  today,
  l,
  cellFor,
  onCell,
  flash,
}: {
  monday: string;
  times: { start: string; end: string }[];
  workDays?: number[]; // ISO 1 = Senin … 7 = Minggu
  today: string;
  l: "id" | "en";
  cellFor: (date: string, start: string) => CalCell;
  onCell?: (date: string, start: string) => void;
  flash?: string | null;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((_, i) => workDays.includes(i + 1));
  return (
    <div className="cal" role="grid" style={{ "--cols": days.length } as React.CSSProperties}>
      <div className="hdr" role="row">
        <div />
        {days.map((d) => {
          const x = dateOnly(d);
          return (
            <div key={d} className={`d ${d === today ? "today" : ""}`} role="columnheader">
              <div className="dn">{dayShort(x.getUTCDay(), l)}</div>
              <div className="dd">{x.getUTCDate()}</div>
            </div>
          );
        })}
      </div>
      {times.map((t) => (
        <div className="rowc" key={t.start} role="row">
          <div className="tm">
            {fmtTime(t.start, l)}
            <br />–{fmtTime(t.end, l)}
          </div>
          {days.map((d) => {
            const c = cellFor(d, t.start);
            const key = `${d}|${t.start}`;
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={`${c.cls} ${c.clickable ? "clickable" : ""} ${flash === key ? "flash" : ""}`}
                tabIndex={c.clickable ? 0 : -1}
                title={c.title}
                onClick={c.clickable && onCell ? () => onCell(d, t.start) : undefined}
                aria-label={`${d} ${t.start} ${c.lab}${c.sub ? ` · ${c.sub}` : ""}`}
              >
                <span className="lab">{c.lab}</span>
                {c.sub ? <span className="who">{c.sub}</span> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function WeekNav({ monday, l, onChange, prevLabel, nextLabel }: { monday: string; l: "id" | "en"; onChange: (m: string) => void; prevLabel: string; nextLabel: string }) {
  const a = dateOnly(monday);
  const b = dateOnly(addDays(monday, 6));
  const M = l === "id" ? ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} – ${b.getUTCDate()} ${M[b.getUTCMonth()]} ${b.getUTCFullYear()}` : `${a.getUTCDate()} ${M[a.getUTCMonth()]} – ${b.getUTCDate()} ${M[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  return (
    <div className="weeknav">
      <button type="button" aria-label={prevLabel} onClick={() => onChange(addDays(monday, -7))}>‹</button>
      <span className="wk">{label}</span>
      <button type="button" aria-label={nextLabel} onClick={() => onChange(addDays(monday, 7))}>›</button>
    </div>
  );
}
