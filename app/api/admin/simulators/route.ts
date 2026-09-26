import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";

const schema = z.object({ id: z.number().int(), name: z.string().trim().min(2), bay: z.string().trim().min(1), level: z.string().trim().min(1), active: z.boolean() });

export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const { id, ...data } = await body(req, schema);
  await db.simulator.update({ where: { id }, data });
  await logActivity({ type: "ADMIN", id: a.id }, "simulator.updated", "simulator", id, data);
  return json({ ok: true });
});
