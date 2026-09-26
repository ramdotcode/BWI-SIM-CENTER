import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  id: z.number().int().optional(),
  code: z.string().trim().regex(/^[a-z0-9-]{2,20}$/),
  name_id: z.string().trim().min(2), name_en: z.string().trim().min(2), short_id: z.string().trim().min(1), short_en: z.string().trim().min(1),
  hours: z.number().int().min(1).max(200), price_idr: z.number().int().min(0),
  description_id: z.string().default(""), description_en: z.string().default(""),
  bullets_id: z.array(z.string()).default([]), bullets_en: z.array(z.string()).default([]),
  highlight: z.boolean().default(false), active: z.boolean().default(true), sort: z.number().int().default(0),
});

/** Harga & jam paket (SA). Invoice terbit tidak berubah (snapshot saat daftar). */
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const { id, price_idr, ...b } = await body(req, schema);
  const data = { ...b, price_idr: BigInt(price_idr) };
  const p = id ? await db.package.update({ where: { id }, data }) : await db.package.create({ data });
  if (p.highlight) await db.package.updateMany({ where: { NOT: { id: p.id } }, data: { highlight: false } });
  await logActivity({ type: "ADMIN", id: a.id }, id ? "package.updated" : "package.created", "package", p.id, { code: p.code, price: price_idr, hours: p.hours });
  return json({ id: p.id });
});
