// Edge-safe: dipakai middleware & server. JWT HS256 di cookie httpOnly.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bwi_admin";
export const SESSION_TTL_SEC = 60 * 60 * 12;

export type SessionPayload = { sub: string; role: "ADMIN" | "SUPER_ADMIN"; name: string; ver: number };

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name, ver: p.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SEC}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return { sub: String(payload.sub), role: payload.role as SessionPayload["role"], name: String(payload.name), ver: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}

/** Rute admin yang hanya untuk SUPER_ADMIN */
export const SA_ONLY_SEGMENTS = ["keuangan", "database", "pengaturan"];
