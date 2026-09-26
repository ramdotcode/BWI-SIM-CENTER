import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { blockMaintenance } from "@/lib/services/slots";

export const runtime = "nodejs";
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ sim: z.enum(["A320", "B737"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), from: z.string().regex(/^\d{2}:\d{2}$/), to: z.string().regex(/^\d{2}:\d{2}$/), reason: z.string().trim().min(2).max(200), confirm: z.boolean().default(false) }));
  return json(await blockMaintenance(a, { simCode: b.sim, date: b.date, from: b.from, to: b.to, reason: b.reason, confirm: b.confirm }));
});
