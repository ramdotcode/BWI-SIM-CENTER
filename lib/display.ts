import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { db } from "./db";
import type { AdminCtx } from "./auth";
import { HttpError } from "./auth";
import { decryptString, encryptString, hashToken, safeEqual } from "./crypto";
import { logActivity } from "./activity";
import { appUrl } from "./tokens";

/**
 * Link "Mode Layar" (CR-01): papan jadwal real-time untuk TV/monitor, tanpa login.
 * Disimpan di tabel settings (key display_links) agar tidak menambah tabel/migrasi.
 * Token mentah hanya ada di URL; yang dicocokkan hash-nya. Salinan terenkripsi dipakai untuk "Salin link".
 * Semua link memakai kode pendek yang mudah diketik di TV ("lobi-7k2m"). Sejak Okt 2026 semua layar menampilkan
 * nama siswa, instruktur & paket (keputusan klien) — cabut link bila layar dipindah/tidak dipakai.
 * Waktu terakhir aktif disimpan terpisah (display_seen) supaya polling layar tidak menimpa daftar link.
 */
export type DisplayLink = { id: string; label: string; show_names: boolean; hash: string; enc: string; created_at: string; created_by: number };
const KEY = "display_links";
const SEEN = "display_seen";

export async function listDisplayLinks(): Promise<DisplayLink[]> {
  const r = await db.setting.findUnique({ where: { key: KEY } });
  return Array.isArray(r?.value) ? (r!.value as unknown as DisplayLink[]) : [];
}

export async function displaySeen(): Promise<Record<string, string>> {
  const r = await db.setting.findUnique({ where: { key: SEEN } });
  return (r?.value as Record<string, string> | null) ?? {};
}

async function save(list: DisplayLink[]) {
  await db.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: list as never }, update: { value: list as never } });
}

export const displayUrl = (raw: string, locale: "id" | "en" = "id") => appUrl(`/layar/${raw}`, locale);

const SHORT_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"; // tanpa 0/o, 1/l/i agar tidak salah ketik
function shortCode(label: string): string {
  const slug = label.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20).replace(/-+$/, "") || "layar";
  return `${slug}-${Array.from({ length: 4 }, () => SHORT_ALPHABET[randomInt(SHORT_ALPHABET.length)]).join("")}`;
}

export async function createDisplayLink(admin: AdminCtx, input: { label: string }) {
  const existing = new Set((await listDisplayLinks()).map((x) => x.hash));
  let raw = shortCode(input.label);
  while (existing.has(hashToken(raw))) raw = shortCode(input.label);
  const link: DisplayLink = { id: randomUUID().slice(0, 8), label: input.label.trim().slice(0, 60), show_names: true, hash: hashToken(raw), enc: encryptString(raw), created_at: new Date().toISOString(), created_by: admin.id };
  await save([...(await listDisplayLinks()), link]);
  await logActivity({ type: "ADMIN", id: admin.id }, "display.created", "display_link", link.id, { label: link.label, show_names: link.show_names });
  return { id: link.id, url: displayUrl(raw) };
}

export async function revokeDisplayLink(admin: AdminCtx, id: string) {
  const list = await listDisplayLinks();
  const link = list.find((x) => x.id === id);
  if (!link) throw new HttpError(404, "Link layar tidak ditemukan");
  await save(list.filter((x) => x.id !== id));
  await logActivity({ type: "ADMIN", id: admin.id }, "display.revoked", "display_link", id, { label: link.label });
}

/** Path yang ditampilkan di daftar admin (kode pendek); link lama bertoken panjang disamarkan. */
export function displayPath(link: DisplayLink): string | null {
  const raw = decryptString(link.enc);
  return raw.length <= 30 ? `/layar/${raw}` : null;
}

export async function displayLinkUrl(id: string, locale: "id" | "en" = "id") {
  const link = (await listDisplayLinks()).find((x) => x.id === id);
  if (!link) throw new HttpError(404, "Link layar tidak ditemukan");
  return displayUrl(decryptString(link.enc), locale);
}

/** Validasi token layar (kode pendek tidak peka huruf besar/kecil). touch = catat terakhir aktif (paling sering tiap 5 menit per link). */
export async function resolveDisplay(raw: string, touch = false): Promise<DisplayLink | null> {
  const r = decodeURIComponent(raw).trim();
  const hashes = [hashToken(r), hashToken(r.toLowerCase())];
  const link = (await listDisplayLinks()).find((x) => hashes.some((h) => safeEqual(x.hash, h))) ?? null;
  if (link && touch) {
    const seen = (await displaySeen())[link.id];
    if (!seen || Date.now() - new Date(seen).getTime() > 5 * 60_000) {
      // Gabung atomik (jsonb ||) agar beberapa layar yang menulis bersamaan tidak saling menimpa.
      await db.$executeRaw`
        INSERT INTO settings (key, value, updated_at) VALUES (${SEEN}, jsonb_build_object(${link.id}::text, ${new Date().toISOString()}::text), now())
        ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now()`;
    }
  }
  return link;
}
