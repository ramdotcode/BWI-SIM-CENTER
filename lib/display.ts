import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import type { AdminCtx } from "./auth";
import { HttpError } from "./auth";
import { decryptString, encryptString, hashToken, randomToken, safeEqual } from "./crypto";
import { logActivity } from "./activity";
import { appUrl } from "./tokens";

/**
 * Link "Mode Layar" (CR-01): papan jadwal real-time untuk TV/monitor, tanpa login.
 * Disimpan di tabel settings (key display_links) agar tidak menambah tabel/migrasi.
 * Token mentah hanya ada di URL; yang dicocokkan hash-nya. Salinan terenkripsi dipakai untuk "Salin link".
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

export async function createDisplayLink(admin: AdminCtx, input: { label: string; show_names: boolean }) {
  const raw = randomToken(24);
  const link: DisplayLink = { id: randomUUID().slice(0, 8), label: input.label.trim().slice(0, 60), show_names: input.show_names, hash: hashToken(raw), enc: encryptString(raw), created_at: new Date().toISOString(), created_by: admin.id };
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

export async function displayLinkUrl(id: string, locale: "id" | "en" = "id") {
  const link = (await listDisplayLinks()).find((x) => x.id === id);
  if (!link) throw new HttpError(404, "Link layar tidak ditemukan");
  return displayUrl(decryptString(link.enc), locale);
}

/** Validasi token layar. touch = catat terakhir aktif (paling sering tiap 5 menit per link). */
export async function resolveDisplay(raw: string, touch = false): Promise<DisplayLink | null> {
  const h = hashToken(decodeURIComponent(raw));
  const link = (await listDisplayLinks()).find((x) => safeEqual(x.hash, h)) ?? null;
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
