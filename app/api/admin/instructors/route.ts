import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

const schema = z.object({ id: z.number().int().optional(), name: z.string().trim().min(2).max(100), simulator_codes: z.array(z.enum(["A320", "B737"])).min(1), active: z.boolean().default(true) });

export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const { id, ...data } = await body(req, schema);
  const i = id ? await db.instructor.update({ where: { id }, data }) : await db.instructor.create({ data });
  await logActivity({ type: "ADMIN", id: a.id }, id ? "instructor.updated" : "instructor.created", "instructor", i.id, data);
  return json({ id: i.id });
});
