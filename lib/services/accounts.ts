import "server-only";
import { db } from "../db";
import { HttpError, hashPassword, type AdminCtx } from "../auth";
import { logActivity } from "../activity";
import { notify } from "../notify";
import { dashboardUrl, ensureDashboardToken, rotateDashboardToken } from "../tokens";

/** E-07: kirim ulang link (token sama). */
export async function resendLink(admin: AdminCtx, regId: number) {
  const reg = await db.registration.findUnique({ where: { id: regId }, include: { participant: true } });
  if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
  const raw = await ensureDashboardToken(db, reg.id, reg.reg_no);
  await notify("link_resent", reg.id, { extra: { dashboardLink: dashboardUrl(raw, reg.participant.locale) } });
  await logActivity({ type: "ADMIN", id: admin.id }, "token.resent", "registration", reg.id);
  return { email: reg.participant.email };
}
/** E-07: cabut & buat baru (link bocor). */
export async function rotateLink(admin: AdminCtx, regId: number) {
  const reg = await db.registration.findUnique({ where: { id: regId }, include: { participant: true } });
  if (!reg) throw new HttpError(404, "Pendaftaran tidak ditemukan");
  const raw = await db.$transaction((tx) => rotateDashboardToken(tx, reg.id, reg.reg_no));
  await notify("link_resent", reg.id, { extra: { dashboardLink: dashboardUrl(raw, reg.participant.locale) } });
  await logActivity({ type: "ADMIN", id: admin.id }, "token.rotated", "registration", reg.id);
  return { email: reg.participant.email };
}

export async function upsertAdmin(actor: AdminCtx, input: { id?: number; name: string; email: string; role: "ADMIN" | "SUPER_ADMIN"; active: boolean; password?: string }) {
  if (actor.role !== "SUPER_ADMIN") throw new HttpError(403, "Khusus Super Admin");
  if (input.id === actor.id && (!input.active || input.role !== "SUPER_ADMIN")) throw new HttpError(422, "Tidak bisa menonaktifkan / menurunkan akun sendiri");
  if (input.password && input.password.length < 10) throw new HttpError(422, "Kata sandi minimal 10 karakter");
  if (!input.id && !input.password) throw new HttpError(422, "Kata sandi wajib untuk akun baru");
  const data = { name: input.name, email: input.email.toLowerCase(), role: input.role, active: input.active, ...(input.password ? { password_hash: await hashPassword(input.password) } : {}) };
  const dup = await db.adminUser.findFirst({ where: { email: data.email, NOT: input.id ? { id: input.id } : undefined } });
  if (dup) throw new HttpError(409, "Email sudah dipakai");
  const a = input.id ? await db.adminUser.update({ where: { id: input.id }, data }) : await db.adminUser.create({ data: { ...data, password_hash: data.password_hash! } });
  if (a.role !== "SUPER_ADMIN" || !a.active) {
    const sa = await db.adminUser.count({ where: { role: "SUPER_ADMIN", active: true } });
    if (sa === 0) throw new HttpError(422, "Minimal harus ada satu Super Admin aktif");
  }
  await logActivity({ type: "ADMIN", id: actor.id }, input.id ? "admin.updated" : "admin.created", "admin_user", a.id, { role: a.role, active: a.active, password_changed: !!input.password });
  return a;
}
