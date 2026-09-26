import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SEC, signSession, verifySession } from "./session";
import type { AdminUser } from "@prisma/client";

export type AdminCtx = Pick<AdminUser, "id" | "name" | "email" | "role">;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
let _dummy: Promise<string> | null = null;
export const dummyHash = () => (_dummy ??= bcrypt.hash("dummy-password", 12));

export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(admin: AdminUser) {
  const token = await signSession({ sub: String(admin.id), role: admin.role, name: admin.name, ver: 1 });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
}
export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Admin aktif dari cookie (cek ulang ke DB: akun dinonaktifkan langsung tidak bisa akses). */
export async function currentAdmin(): Promise<AdminCtx | null> {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const a = await db.adminUser.findUnique({ where: { id: Number(s.sub) }, select: { id: true, name: true, email: true, role: true, active: true } });
  if (!a || !a.active) return null;
  return { id: a.id, name: a.name, email: a.email, role: a.role };
}

/** Untuk halaman server: redirect ke login bila belum masuk / peran kurang. */
export async function requireAdminPage(role?: "SUPER_ADMIN"): Promise<AdminCtx> {
  const a = await currentAdmin();
  if (!a) redirect("/admin/login");
  if (role === "SUPER_ADMIN" && a.role !== "SUPER_ADMIN") redirect("/admin");
  return a;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Untuk API route: lempar HttpError 401/403. Mutasi wajib same-origin (CSRF). */
export async function requireAdminApi(req: Request, role?: "SUPER_ADMIN"): Promise<AdminCtx> {
  if (req.method !== "GET" && req.method !== "HEAD") await assertSameOrigin();
  const a = await currentAdmin();
  if (!a) throw new HttpError(401, "Sesi berakhir, silakan masuk lagi", "unauthorized");
  if (role === "SUPER_ADMIN" && a.role !== "SUPER_ADMIN") throw new HttpError(403, "Khusus Super Admin", "forbidden");
  return a;
}

export async function assertSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Origin tidak valid", "bad_origin");
}
