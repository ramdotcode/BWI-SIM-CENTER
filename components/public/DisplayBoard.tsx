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

  // Pas satu layar di TV mana pun: bila isi lebih tinggi dari layar, perkecil (CSS zoom) sampai muat.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      el.style.zoom = "1";
      el.style.width = "";
      el.style.minHeight = "";
      const ratio = window.innerHeight / el.scrollHeight;
      if (ratio >= 1) return;
      const z = Math.max(0.5, ratio - 0.005);
      el.style.zoom = String(z);
      // Lebar & tinggi dikompensasi agar setelah diperkecil tetap memenuhi layar.
      el.style.width = `${window.innerWidth / z}px`;
      el.style.minHeight = `${window.innerHeight / z}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [b, full]);


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

  if (revoked) {
    return (
      <div className="disp disp-off">
        <img src="/brand/bwi-aviation.png" alt="BWI Aviation" />
        <h1>{t("revokedTitle")}</h1>
        <p>{t("revokedText")}</p>
      </div>
    );
  }

  // Tata letak (masukan klien Okt 2026, referensi papan jadwal pelatihan):
  // atas = tabel "Hari ini" (Simulator · Jam · Program · Instruktur · Siswa · Status), tetap;
  // bawah = kotak 3 hari kerja berikutnya (simulator × sesi di kiri, tanggal ke kanan), tidak bergantian.
  const day = today;
  const upcoming = b.days.slice(1);
  const busyCount = (code: string) => b.times.filter((tm) => day.cells[code]?.[tm.start]?.name).length;
  const Box = ({ c }: { c: DisplayCell }) => (
    <div className={`dc ${c.st}`} title={t(`st.${c.st}`)}>
      <span className="st">{t(`st.${c.st}`)}</span>
      {c.name ? (
        <div className="trio">
          <div><span className="lb">{t("secProgram")}</span><span className="vl">{c.pkg ?? "—"}</span></div>
          <div><span className="lb">{t("secInstructor")}</span><span className="vl">{c.instructor ?? "—"}</span></div>
          <div><span className="lb">{t("secStudent")}</span><span className="vl nm">{c.name}</span></div>
        </div>
      ) : null}
      {c.reason && <span className="sub">{c.reason}</span>}
    </div>
  );

  return (
    <div className="disp tvx" ref={rootRef}>
      <header className="tvh">
        <div className="tvh-l">
          <img src="/brand/bwi-aviation.png" alt="BWI Aviation" className="lg" />
          <img src="/brand/ppi-curug.png" alt="PPI Curug" className="lg2" />
        </div>
        <div className="tvh-c">
          <div className="w1">{t("welcome")}</div>
          <div className="w2">{t("scheduleTitle")}</div>
        </div>
        <div className="tvh-r">
          <span className="clk" suppressHydrationWarning>{clock}</span>
          <span className="dt">{dayLabel(b.today, true)}{label ? ` · ${label}` : ""}</span>
          {!full && canFull && <button type="button" className="btn sm fsbtn" onClick={goFull}>⛶ {t("fullscreen")}</button>}
        </div>
      </header>

      <main className="tvm">
        <div className="tvsec">{t("today")} · {dayLabel(b.today)}</div>
        {day.closed ? (
          <div className="closed">{t("closedToday")}</div>
        ) : (
          <table className="tvt">
            <thead>
              <tr>
                <th className="c-sim">{t("colSim")}<small>Device</small></th>
                <th className="c-tm">{t("colTime")}<small>Time</small></th>
                <th>{t("secProgram")}<small>Training programme</small></th>
                <th>{t("secInstructor")}<small>Instructor</small></th>
                <th>{t("secStudent")}<small>Trainee</small></th>
                <th className="c-st">{t("colStatus")}<small>Status</small></th>
              </tr>
            </thead>
            {b.sims.map((sim) => (
              <tbody key={sim.code} className={sim.code.toLowerCase()}>
                <tr className="grp">
                  <td colSpan={6}>
                    <b>{sim.name}</b> <span>{sim.bay}</span>
                    <em>{t("sessionsFilled", { n: busyCount(sim.code), total: b.times.length })}</em>
                  </td>
                </tr>
                {b.times.map((tm, i) => {
                  const c: DisplayCell = day.cells[sim.code]?.[tm.start] ?? { st: "free" };
                  return (
                    <tr key={tm.start} className={`r ${c.st}`}>
                      {i === 0 && <td className="c-sim" rowSpan={b.times.length}><span className={`chip ${sim.code.toLowerCase()}`}>{sim.code}</span></td>}
                      <td className="c-tm">{fmtTime(tm.start, l)}<small>–{fmtTime(tm.end, l)}</small></td>
                      {c.name ? (
                        <>
                          <td className="v">{c.pkg ?? "—"}</td>
                          <td className="v">{c.instructor ?? "—"}</td>
                          <td className="v nm">{c.name}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="empty">{c.reason ? `${t(`st.${c.st}`)} · ${c.reason}` : t(`st.${c.st}`)}</td>
                      )}
                      <td className="c-st"><span className={`stp ${c.st}`}>{t(`st.${c.st}`)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        )}

        {upcoming.length > 0 && (
          <section className="next">
            <div className="tvsec">{t("upcoming")}</div>
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
                      {upcoming.map((d) => <td key={d.date}><Box c={d.cells[sim.code]?.[tm.start] ?? { st: "free" }} /></td>)}
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
