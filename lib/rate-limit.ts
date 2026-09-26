// Rate limiter in-memory (fixed window). Cukup untuk 1 instance; ganti ke Redis bila multi-instance.
const g = globalThis as unknown as { __rl?: Map<string, { n: number; reset: number }> };
const store = (g.__rl ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const cur = store.get(key);
  if (!cur || cur.reset < now) {
    store.set(key, { n: 1, reset: now + windowMs });
    if (store.size > 50_000) for (const [k, v] of store) if (v.reset < now) store.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  cur.n++;
  return { ok: cur.n <= limit, retryAfter: Math.ceil((cur.reset - now) / 1000) };
}

export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
