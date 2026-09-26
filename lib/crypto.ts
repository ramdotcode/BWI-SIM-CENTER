import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} belum di-set`);
  return v;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
/** Hash token magic link (SHA-256 + pepper server). */
export function hashToken(token: string): string {
  return sha256(`${need("TOKEN_PEPPER")}:${token}`);
}
export function hmac(data: string): string {
  return createHmac("sha256", need("AUTH_SECRET")).update(data).digest("base64url");
}
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function key(): Buffer {
  const k = process.env.STORAGE_ENCRYPTION_KEY ? Buffer.from(process.env.STORAGE_ENCRYPTION_KEY, "base64") : createHash("sha256").update(need("AUTH_SECRET")).digest();
  if (k.length !== 32) throw new Error("STORAGE_ENCRYPTION_KEY harus 32 byte (base64)");
  return k;
}
/** AES-256-GCM: iv(12) | tag(16) | ciphertext */
export function encrypt(buf: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}
export function decrypt(buf: Buffer): Buffer {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}
export const encryptString = (s: string) => encrypt(Buffer.from(s, "utf8")).toString("base64url");
export const decryptString = (s: string) => decrypt(Buffer.from(s, "base64url")).toString("utf8");

/** Token bertanda tangan berumur pendek: payload.exp.sig */
export function signPayload(payload: Record<string, unknown>, ttlSec: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  return `${body}.${hmac(body)}`;
}
export function verifyPayload<T = Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof p.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p as T;
  } catch {
    return null;
  }
}
