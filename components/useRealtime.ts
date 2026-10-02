"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Pembaruan data otomatis.
 *
 * Default "poll": ambil ulang data (onPoll) tiap NEXT_PUBLIC_REFRESH_MINUTES menit (default 15) selama tab terlihat,
 * dan langsung saat tab kembali dilihat. Tidak ada koneksi yang dibiarkan terbuka, sehingga hemat kuota paket gratis
 * (Vercel Hobby menghitung memori selama ada request berjalan; SSE yang terbuka seharian menghabiskan kuota).
 *
 * NEXT_PUBLIC_REALTIME_MODE="sse": mode lama — SSE /api/realtime (event per perubahan, onEvent) dengan fallback polling.
 * Cocok bila hosting berbayar/server sendiri.
 */
const MODE = process.env.NEXT_PUBLIC_REALTIME_MODE === "sse" ? "sse" : "poll";
export const REFRESH_MS = Math.max(1, Number(process.env.NEXT_PUBLIC_REFRESH_MINUTES) || 15) * 60_000;

export function useRealtime<E = unknown>(scope: string, onEvent: (e: E) => void, onPoll?: () => void | Promise<void>) {
  const [last, setLast] = useState(() => Date.now());
  const [live, setLive] = useState(MODE === "poll");
  const ev = useRef(onEvent);
  const poll = useRef(onPoll);
  const lastRef = useRef(last);
  ev.current = onEvent;
  poll.current = onPoll;

  useEffect(() => {
    if (MODE !== "poll") return;
    const run = async () => {
      try {
        await poll.current?.();
      } catch {}
      lastRef.current = Date.now();
      setLast(lastRef.current);
    };
    const timer = setInterval(() => document.visibilityState === "visible" && run(), REFRESH_MS);
    // Kembali ke tab setelah > 30 dtk → langsung ambil data terbaru.
    const onVis = () => document.visibilityState === "visible" && Date.now() - lastRef.current > 30_000 && run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [scope]);

  useEffect(() => {
    if (MODE !== "sse") return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let fails = 0;
    const startPolling = () => {
      if (timer) return;
      timer = setInterval(async () => {
        await poll.current?.();
        setLast(Date.now());
      }, 15_000);
    };
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const connect = () => {
      es = new EventSource(`/api/realtime?scope=${encodeURIComponent(scope)}`);
      es.onopen = () => {
        fails = 0;
        setLive(true);
        stopPolling();
      };
      es.addEventListener("ping", () => setLast(Date.now()));
      es.onmessage = (m) => {
        try {
          ev.current(JSON.parse(m.data));
          setLast(Date.now());
        } catch {}
      };
      es.onerror = () => {
        setLive(false);
        fails++;
        if (fails >= 2) {
          es?.close();
          startPolling();
          setTimeout(connect, 60_000); // coba SSE lagi sesekali
        }
      };
    };
    connect();
    return () => {
      es?.close();
      stopPolling();
    };
  }, [scope]);

  return { last, live };
}

/** Detik sejak pembaruan terakhir (berdetak tiap detik). */
export function useAgo(last: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round((now - last) / 1000));
}

/** "baru saja" / "12 dtk lalu" / "4 mnt lalu" — t = translator namespace "common". */
export function agoText(sec: number, t: (k: "justNow" | "secAgo" | "minAgo", v?: Record<string, number>) => string) {
  if (sec < 3) return t("justNow");
  if (sec < 60) return t("secAgo", { s: sec });
  return t("minAgo", { m: Math.floor(sec / 60) });
}
