"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { agoText, REFRESH_MS, useAgo } from "../useRealtime";
import { dateOnly, dayShort, fmtTime, monthShort, workDaysLabel } from "@/lib/format";
import type { DisplayBoardData, DisplayCell } from "@/lib/services/display-board";

type WakeLock = { release: () => Promise<void> };

/**
 * Mode Layar (CR-01): papan jadwal untuk TV/monitor. Tanpa login, hanya-baca.
 * Ambil ulang data tiap REFRESH_MS (default 15 menit, hemat kuota paket gratis) + tepat di jam mulai/selesai
 * sesi & pergantian hari, agar status "berlangsung/lewat" dan tanggal tetap tepat waktu.
 */
export function DisplayBoard({ token, initial, label }: { token: string; initial: DisplayBoardData; label: string }) {
  const t = useTranslations("display");
  const tc = useTranslations("common");
  const l = useLocale() as "id" | "en";
  const [b, setB] = useState(initial);
  const [revoked, setRevoked] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false); // iPhone Safari tidak mendukung Fullscreen API
  const wake = useRef<WakeLock | null>(null);

  const [last, setLast] = useState(() => Date.now());
  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/layar/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (r.status === 404) return setRevoked(true);
      if (r.ok) {
        setB(await r.json());
        setLast(Date.now());
      }
    } catch {}
  }, [token]);
  const ago = useAgo(last);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    const periodic = setInterval(refetch, REFRESH_MS);
    return () => { clearInterval(clock); clearInterval(periodic); };
  }, [refetch]);

  // Ambil ulang tepat setelah jam mulai/selesai sesi berikutnya atau tengah malam (WIB).
  useEffect(() => {
    const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`).getTime();
    const tomorrow = new Date(at(b.today, "00:00") + 86_400_000).toISOString().slice(0, 10);
    const marks = [...b.times.flatMap((x) => [at(b.today, x.start), at(b.today, x.end)]), at(tomorrow, "00:00")];
    const next = marks.filter((m) => m > Date.now()).sort((a, z) => a - z)[0];
    if (!next) return;
    const h = setTimeout(refetch, Math.min(next - Date.now() + 5_000, 2_147_000_000));
    return () => clearTimeout(h);
  }, [b.today, b.times, last, refetch]);

  // Layar tetap menyala (Wake Lock) & status layar penuh.
  const lockScreen = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (k: "screen") => Promise<WakeLock> } };
      if (nav.wakeLock && document.visibilityState === "visible") wake.current = await nav.wakeLock.request("screen");
    } catch {}
  }, []);
  useEffect(() => {
    setCanFull(!!document.fullscreenEnabled);
    lockScreen();
    const onVis = () => document.visibilityState === "visible" && lockScreen();
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      wake.current?.release().catch(() => {});
    };
  }, [lockScreen]);
  const goFull = async () => {
    try { await document.documentElement.requestFullscreen(); } catch {}
    lockScreen();
  };

  const clock = new Intl.DateTimeFormat(l === "id" ? "id-ID" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(now).replace(/\./g, ":");
  const dayLabel = (iso: string, long = false) => {
    const d = dateOnly(iso);
    return `${dayShort(d.getUTCDay(), l)}, ${d.getUTCDate()} ${monthShort(d.getUTCMonth(), l)}${long ? ` ${d.getUTCFullYear()}` : ""}`;
  };
  const today = b.days[0]!;
  const upcoming = b.days.slice(1);

  if (revoked) {
    return (
      <div className="disp disp-off">
        <img src="/brand/bwi-aviation.png" alt="BWI Aviation" />
        <h1>{t("revokedTitle")}</h1>
        <p>{t("revokedText")}</p>
      </div>
    );
  }

  // Sel besar (hari ini): status + nama. Sel ringkas (hari berikutnya): nama ATAU status — warna sel sudah menandai status.
  const Cell = ({ c, big }: { c: DisplayCell; big?: boolean }) => (
    <div className={`dc ${c.st} ${big ? "big" : ""}`} title={t(`st.${c.st}`)}>
      {(big || !c.name) && <span className="st">{t(`st.${c.st}`)}</span>}
      {c.name && <span className="nm">{c.name}</span>}
      {(c.instructor || c.pkg) && <span className="sub">{[c.pkg, c.instructor].filter(Boolean).join(" · ")}</span>}
      {c.reason && <span className="sub">{c.reason}</span>}
    </div>
  );

  return (
    <div className="disp">
      <header className="dh">
        <div className="row" style={{ gap: 18 }}>
          <img src="/brand/bwi-aviation.png" alt="BWI Aviation" className="lg" />
          <img src="/brand/ppi-curug.png" alt="PPI Curug" className="lg2" />
          <div>
            <div className="ttl">{t("title")}</div>
            <div className="dt">{dayLabel(b.today, true)}{label ? ` · ${label}` : ""}</div>
          </div>
        </div>
        <div className="row dh-r" style={{ gap: 22 }}>
          <span className="live">{t("live")}</span>
          <span className="clk" suppressHydrationWarning>{clock}</span>
          {!full && canFull && <button type="button" className="btn sm fsbtn" onClick={goFull}>⛶ {t("fullscreen")}</button>}
        </div>
      </header>

      <main className="dm">
        <section className="today">
          <div className="sect-h">{t("today")}</div>
          {today.closed ? (
            <div className="closed">{t("closedToday")}</div>
          ) : (
            <div className="sims" style={{ gridTemplateColumns: `repeat(${b.sims.length}, minmax(0,1fr))` }}>
              {b.sims.map((sim) => (
                <div key={sim.code} className={`simcol ${sim.code.toLowerCase()}`}>
                  <div className="simh">
                    <b>{sim.name}</b>
                    <span>{sim.bay}</span>
                  </div>
                  {b.times.map((tm) => (
                    <div key={tm.start} className="srow">
                      <div className="tm">{fmtTime(tm.start, l)}<small>–{fmtTime(tm.end, l)}</small></div>
                      <Cell c={today.cells[sim.code]?.[tm.start] ?? { st: "free" }} big />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="next">
            <div className="sect-h">{t("upcoming")}</div>
            {/* CR-05: simulator × sesi di kiri (baris), tanggal ke kanan (kolom). */}
            <table>
              <thead>
                <tr>
                  <th className="simc" />
                  <th className="tmc" />
                  {upcoming.map((d) => <th key={d.date}>{dayLabel(d.date)}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.sims.map((sim) =>
                  b.times.map((tm, i) => (
                    <tr key={`${sim.code}${tm.start}`} className={i === 0 ? "first" : ""}>
                      {i === 0 && <td className={`simc ${sim.code.toLowerCase()}`} rowSpan={b.times.length}>{sim.code}</td>}
                      <td className="tmc">{fmtTime(tm.start, l)}<small>–{fmtTime(tm.end, l)}</small></td>
                      {upcoming.map((d) => <td key={d.date}><Cell c={d.cells[sim.code]?.[tm.start] ?? { st: "free" }} /></td>)}
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>

      <footer className="df">
        <span>{t("foot", { h: b.slotHours, days: workDaysLabel(b.workDays, l), start: fmtTime(b.opsStart, l), end: fmtTime(b.opsEnd, l) })}</span>
        <span>{t("updated", { ago: agoText(ago, tc) })}</span>
      </footer>
    </div>
  );
}
