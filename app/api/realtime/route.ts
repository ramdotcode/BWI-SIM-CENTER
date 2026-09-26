import { subscribe, type RtEvent } from "@/lib/realtime";
import { currentAdmin } from "@/lib/auth";
import { resolveToken } from "@/lib/tokens";
import { viewStatus } from "@/lib/slot-view";
import { getSettings } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel memutus fungsi setelah maxDuration: stream ditutup rapi lebih awal, EventSource tersambung ulang otomatis.
export const maxDuration = 300;
const STREAM_MS = process.env.VERCEL ? 280_000 : 0;

/**
 * SSE: scope=public | admin | d:{token}.
 * Publik & peserta hanya menerima status tersamar (tanpa nama peserta lain).
 */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") ?? "public";
  if (!rateLimit(`sse:${clientIp(req.headers)}`, 60, 60_000).ok) return new Response("rate limited", { status: 429 });

  let mine: number | null = null;
  let isAdmin = false;
  if (scope === "admin") {
    isAdmin = !!(await currentAdmin());
    if (!isAdmin) return new Response("unauthorized", { status: 401 });
  } else if (scope.startsWith("d:")) {
    const t = await resolveToken(scope.slice(2), "DASHBOARD", false);
    if (!t) return new Response("not found", { status: 404 });
    mine = t.registration_id;
  }
  const s = await getSettings();

  const map = (e: RtEvent): unknown | null => {
    if (e.type === "admin") return isAdmin ? e : null;
    if (isAdmin) return e;
    const v = viewStatus(e.status, e.registration_id, mine);
    const out: Record<string, unknown> = { type: "slot", sim: e.sim, date: e.date, start: e.start, end: e.end, v, action: e.action, at: e.at };
    if (mine && (e.registration_id === mine || e.prev_registration_id === mine)) {
      out.mine = true;
      out.prevMine = e.prev_registration_id === mine && e.registration_id !== mine;
      out.status = e.status;
      if (s.show_instructor_to_participant && e.registration_id === mine) out.instructor = e.instructor;
    }
    if (v === "maint") out.reason = null;
    return out;
  };

  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (s: string) => {
        try {
          ctrl.enqueue(enc.encode(s));
        } catch {}
      };
      send(`retry: 5000\n\n`);
      send(`event: ping\ndata: ${Date.now()}\n\n`);
      unsub = await subscribe((e) => {
        const m = map(e);
        if (m) send(`data: ${JSON.stringify(m)}\n\n`);
      });
      ping = setInterval(() => send(`event: ping\ndata: ${Date.now()}\n\n`), 20_000);
      if (STREAM_MS)
        setTimeout(() => {
          unsub?.();
          if (ping) clearInterval(ping);
          try {
            ctrl.close();
          } catch {}
        }, STREAM_MS);
      req.signal.addEventListener("abort", () => {
        unsub?.();
        if (ping) clearInterval(ping);
        try {
          ctrl.close();
        } catch {}
      });
    },
    cancel() {
      unsub?.();
      if (ping) clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
