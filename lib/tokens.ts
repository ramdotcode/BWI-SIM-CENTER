import "server-only";
import { db, type DbOrTx } from "./db";
import { decryptString, encryptString, hashToken, randomToken } from "./crypto";

/**
 * Magic link peserta. Token = "{reg_no}-{random ≥24 byte}" (reg_no hanya untuk tampilan pendek di email);
 * yang divalidasi selalu hash SHA-256 (+pepper) dari token penuh.
 */
export async function createToken(tx: DbOrTx, registrationId: number, regNo: string, purpose: "DASHBOARD" | "REUPLOAD" = "DASHBOARD", expiresAt?: Date) {
  const raw = `${regNo}-${randomToken(24)}`;
  await tx.accessToken.create({
    data: { registration_id: registrationId, purpose, token_hash: hashToken(raw), token_enc: encryptString(raw), expires_at: expiresAt ?? null },
  });
  return raw;
}

export type ResolvedToken = NonNullable<Awaited<ReturnType<typeof resolveToken>>>;

export async function resolveToken(raw: string, purpose: "DASHBOARD" | "REUPLOAD" = "DASHBOARD", touch = true) {
  if (!raw || raw.length < 30 || raw.length > 120) return null;
  const t = await db.accessToken.findUnique({ where: { token_hash: hashToken(raw) } });
  if (!t || t.purpose !== purpose || t.revoked_at) return null;
  if (t.expires_at && t.expires_at < new Date()) return null;
  if (touch) {
    const now = new Date();
    await db.accessToken.update({ where: { id: t.id }, data: { last_seen_at: now, opened_at: t.opened_at ?? now } });
  }
  return t;
}

/** Token dashboard aktif (untuk kirim ulang = token yang sama). */
export async function activeDashboardToken(tx: DbOrTx, registrationId: number) {
  const t = await tx.accessToken.findFirst({
    where: { registration_id: registrationId, purpose: "DASHBOARD", revoked_at: null },
    orderBy: { created_at: "desc" },
  });
  return t ? { ...t, raw: decryptString(t.token_enc) } : null;
}

export async function ensureDashboardToken(tx: DbOrTx, registrationId: number, regNo: string) {
  const t = await activeDashboardToken(tx, registrationId);
  return t ? t.raw : createToken(tx, registrationId, regNo, "DASHBOARD");
}

/** Cabut semua token dashboard lalu buat baru (E-07 link bocor). */
export async function rotateDashboardToken(tx: DbOrTx, registrationId: number, regNo: string) {
  await tx.accessToken.updateMany({ where: { registration_id: registrationId, purpose: "DASHBOARD", revoked_at: null }, data: { revoked_at: new Date() } });
  return createToken(tx, registrationId, regNo, "DASHBOARD");
}

export function appUrl(path: string, locale: "id" | "en" = "id") {
  const base = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  return `${base}${locale === "en" ? "/en" : ""}${path}`;
}
export const dashboardUrl = (raw: string, locale: "id" | "en" = "id") => appUrl(`/d/${raw}`, locale);
export const reuploadUrl = (raw: string, locale: "id" | "en" = "id") => appUrl(`/unggah-ulang/${raw}`, locale);
/** Tampilan pendek: bwi-sim.id/d/REG-2026-0912-k7x2… */
export function shortLink(raw: string, domain: string) {
  const m = raw.match(/^(REG-\d{4}-\d{4})-(.{4})/);
  return `${domain}/d/${m ? `${m[1]}-${m[2]}…` : raw.slice(0, 16) + "…"}`;
}
