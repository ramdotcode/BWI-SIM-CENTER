import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { upsertAdmin } from "@/lib/services/accounts";

const schema = z.object({ id: z.number().int().optional(), name: z.string().trim().min(2).max(100), email: z.string().trim().email(), role: z.enum(["ADMIN", "SUPER_ADMIN"]), active: z.boolean(), password: z.string().max(200).optional() });

export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const b = await body(req, schema);
  const r = await upsertAdmin(a, { ...b, password: b.password || undefined });
  return json({ id: r.id });
});
