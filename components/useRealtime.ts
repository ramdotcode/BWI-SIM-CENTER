"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Langganan SSE /api/realtime. Jika koneksi gagal → fallback polling tiap 15 detik (onPoll).
 * Mengembalikan waktu pembaruan terakhir untuk indikator "LIVE · diperbarui X dtk lalu".
 */
export function useRealtime<E = unknown>(scope: string, onEvent: (e: E) => void, onPoll?: () => void | Promise<void>) {
  const [last, setLast] = useState(() => Date.now());
  const [live, setLive] = useState(false);
  const ev = useRef(onEvent);
  const poll = useRef(onPoll);
  ev.current = onEvent;
  poll.current = onPoll;

  useEffect(() => {
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

export function useAgo(last: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.round((now - last) / 1000));
}
