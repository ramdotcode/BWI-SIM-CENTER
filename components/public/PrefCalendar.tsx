"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { addDays, dayShort, fmtDate, monthLong } from "@/lib/format";

type Avail = { from: string; to: string; perDay: number; days: Record<string, number> };

/**
 * Kalender preferensi jadwal (CR-04): rentang tanggal dipilih di atas ketersediaan simulator.
 * Tanggal yang semua sesinya sudah terisi/maintenance ditandai "Penuh" dan tidak bisa dipilih;
 * hari libur & di luar horizon slot tidak bisa dipilih. Klik 1 = tanggal awal, klik 2 = tanggal akhir.
 */
export function PrefCalendar({ sim, from, to, onChange, l, invalid }: { sim: string; from: string; to: string; onChange: (from: string, to: string) => void; l: "id" | "en"; invalid?: boolean }) {
  const t = useTranslations("form");
  const [av, setAv] = useState<Avail | null>(null);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState<string | null>(null); // "YYYY-MM" bulan pertama yang tampil

  useEffect(() => {
    let alive = true;
    setFailed(false);
    fetch(`/api/public/availability/days?sim=${sim}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Avail) => {
        if (!alive) return;
        setAv(j);
        setMonth((m) => m ?? (from || j.from).slice(0, 7));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [sim]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pilihan lama yang ternyata penuh untuk simulator ini → kosongkan.
  useEffect(() => {
    if (!av) return;
    const bad = (d: string) => !!d && (av.days[d] ?? -1) <= 0;
    if (bad(from) || bad(to)) onChange(bad(from) ? "" : from, bad(to) || bad(from) ? "" : to);
  }, [av]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className="callout">{t("calFailed")}</div>;
  if (!av || !month) return <div className="small muted">{t("calLoading")}</div>;

  const firstMonth = av.from.slice(0, 7);
  const lastMonth = av.to.slice(0, 7);
  const months = [month, nextMonth(month)].filter((m) => m <= lastMonth);
  const pick = (d: string) => {
    if (!from || to || d < from) return onChange(d, "");
    onChange(from, d);
  };

  return (
    <div style={{ gridColumn: "1/-1", border: invalid ? "1.5px solid var(--bad)" : undefined, borderRadius: 10, padding: invalid ? 8 : 0 }}>
      <div className="pcal">
        {months.map((m, i) => (
          <div key={m}>
            <div className="mh">
              <button type="button" className="btn xs ghost" aria-label="‹" style={{ visibility: i === 0 && m > firstMonth ? "visible" : "hidden" }} onClick={() => setMonth(prevMonth(month))}>‹</button>
              <span>{monthLong(Number(m.slice(5)) - 1, l)} {m.slice(0, 4)}</span>
              <button type="button" className="btn xs ghost" aria-label="›" style={{ visibility: i === months.length - 1 && nextMonth(m) <= lastMonth ? "visible" : "hidden" }} onClick={() => setMonth(nextMonth(month))}>›</button>
            </div>
            <div className="grid7">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="dow">{dayShort(d, l)}</div>)}
              {cells(m).map((d, j) => {
                if (!d) return <span key={j} />;
                const free = av.days[d];
                const open = free !== undefined;
                const full = open && free <= 0;
                const edge = d === from || d === to;
                const inRange = open && from && to && d > from && d < to;
                const cls = `d ${!open ? "off" : full ? "isfull" : "free"} ${edge ? "edge" : inRange ? "in" : ""}`;
                return (
                  <button type="button" key={d} className={cls} disabled={!open || full} aria-pressed={edge} title={open ? (full ? t("calFull") : t("calFree", { n: free })) : undefined} onClick={() => pick(d)}>
                    {Number(d.slice(8))}
                    {open && <small>{full ? t("calFullShort") : `${free}/${av.perDay}`}</small>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="pcal-legend">
        <span><i style={{ borderColor: "var(--line)" }} />{t("calLegendFree")}</span>
        <span><i style={{ background: "var(--bad-soft)", borderColor: "var(--bad-soft)" }} />{t("calLegendFull")}</span>
        <span><i style={{ background: "var(--teal)", borderColor: "var(--teal)" }} />{t("calLegendPicked")}</span>
      </div>
      <div className="row between wrap" style={{ marginTop: 10, fontSize: 14 }}>
        <span>
          <b>{t("pref_date_from")}:</b> {from ? fmtDate(from, l) : "—"} · <b>{t("pref_date_to")}:</b> {to ? fmtDate(to, l) : from ? <span className="muted">{t("calPickEnd")}</span> : "—"}
        </span>
        {(from || to) && <button type="button" className="btn xs ghost" onClick={() => onChange("", "")}>{t("calClear")}</button>}
      </div>
    </div>
  );
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}
/** Sel kalender Senin-pertama: null untuk kotak kosong sebelum tanggal 1. */
function cells(m: string): (string | null)[] {
  const first = `${m}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const out: (string | null)[] = Array(lead).fill(null);
  for (let d = first; d.startsWith(m); d = addDays(d, 1)) out.push(d);
  return out;
}
