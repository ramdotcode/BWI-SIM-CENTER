import "server-only";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { Client, type ClientConfig } from "pg";
import { db } from "./db";

/**
 * Real-time lintas instance via Postgres LISTEN/NOTIFY → EventEmitter → SSE (/api/realtime).
 * Setiap mutasi slot memanggil publish(); SSE memfilter & menyamarkan data sesuai scope (public/admin/peserta).
 */
export type SlotEvent = {
  type: "slot";
  sim: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  status: "AVAILABLE" | "SCHEDULED" | "MAINTENANCE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  action: "assigned" | "released" | "maintenance" | "maintenance_cleared" | "result" | "moved";
  registration_id: number | null;
  prev_registration_id?: number | null;
  participant?: string | null; // admin only
  instructor?: string | null;
  reason?: string | null;
  at: string;
};
export type AdminEvent = { type: "admin"; kind: "registration" | "invoice" | "notification"; id?: number; at: string };
export type RtEvent = SlotEvent | AdminEvent;

const CHANNEL = "bwi_rt";
const g = globalThis as unknown as { __rt?: { em: EventEmitter; client?: Client; connecting?: Promise<void> } };
const rt = (g.__rt ??= { em: new EventEmitter().setMaxListeners(10_000) });

export async function publish(ev: Omit<SlotEvent, "at"> | Omit<AdminEvent, "at">) {
  const payload = JSON.stringify({ ...ev, at: new Date().toISOString() });
  try {
    await db.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`;
  } catch (e) {
    console.error("[realtime] notify gagal, fallback lokal", e);
    rt.em.emit("event", JSON.parse(payload));
  }
}

async function ensureListener() {
  if (rt.client) return;
  if (rt.connecting) return rt.connecting;
  rt.connecting = (async () => {
    const c = new Client(listenerConfig());
    c.on("notification", (m) => {
      if (m.channel !== CHANNEL || !m.payload) return;
      try {
        rt.em.emit("event", JSON.parse(m.payload));
      } catch {}
    });
    c.on("error", (e) => {
      console.error("[realtime] listener error", e.message);
      rt.client = undefined;
      rt.connecting = undefined;
      c.end().catch(() => {});
    });
    await c.connect();
    await c.query(`LISTEN ${CHANNEL}`);
    rt.client = c;
  })();
  try {
    await rt.connecting;
  } finally {
    rt.connecting = undefined;
  }
}

/**
 * Koneksi khusus LISTEN. Memakai DIRECT_URL (koneksi langsung / Supabase *Session pooler*) karena
 * LISTEN/NOTIFY tidak jalan lewat *Transaction pooler* (pgbouncer, port 6543).
 * SSL: aktif bila URL memuat sslmode (≠ disable) atau host Supabase. Verifikasi sertifikat memakai
 * DB_SSL_CA_PATH (CA Supabase, unduh dari Project Settings → Database) bila di-set.
 */
function listenerConfig(): ClientConfig {
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
  const u = new URL(raw);
  const sslmode = u.searchParams.get("sslmode");
  const wantSsl = (sslmode && sslmode !== "disable") || /supabase\.(co|com)$/.test(u.hostname);
  const ca = process.env.DB_SSL_CA_PATH;
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)) || "postgres",
    ssl: wantSsl ? (ca ? { ca: readFileSync(ca, "utf8"), rejectUnauthorized: true } : { rejectUnauthorized: false }) : undefined,
    keepAlive: true,
  };
}

export async function subscribe(fn: (e: RtEvent) => void): Promise<() => void> {
  await ensureListener();
  rt.em.on("event", fn);
  return () => rt.em.off("event", fn);
}
