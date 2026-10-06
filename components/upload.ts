"use client";
// Unggah: minta URL bertanda tangan → PUT file (ke server, atau langsung ke R2 lalu /complete).
// Server selalu melakukan mime sniffing & strip EXIF sebelum file dipakai.
export type Uploaded = { id: string; name: string; size: number; mime: string };
export const ACCEPT = "image/jpeg,image/png,application/pdf";

export async function uploadFile(file: File, kind: string): Promise<Uploaded> {
  // Batas ukuran (setting upload_max_mb) dicek server di /sign sebelum file dikirim.
  const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  const s = await fetch("/api/public/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, name: file.name, size: file.size, mime }) });
  const sj = await s.json();
  if (!s.ok) throw new Error(sj.error ?? "upload");
  let pj: { id: string; size: number; mime: string; error?: string };
  if (sj.mode === "direct") {
    // R2: kirim langsung ke bucket, lalu minta server memvalidasi & membersihkan file.
    const put = await fetch(sj.url, { method: "PUT", body: file, headers: { "content-type": mime } });
    if (!put.ok) throw new Error(`upload ${put.status}`);
    const c = await fetch(sj.complete, { method: "POST" });
    pj = await c.json();
    if (!c.ok) throw new Error(pj.error ?? "upload");
  } else {
    const p = await fetch(sj.url, { method: "PUT", body: file });
    pj = await p.json();
    if (!p.ok) throw new Error(pj.error ?? "upload");
  }
  return { id: pj.id, name: file.name, size: pj.size, mime: pj.mime };
}

export function fmtSize(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, { method: init?.method ?? (init?.body ? "POST" : "GET"), headers: init?.body ? { "content-type": "application/json" } : undefined, body: init?.body ? JSON.stringify(init.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j as T;
}
