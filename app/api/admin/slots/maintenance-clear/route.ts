import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { clearMaintenance } from "@/lib/services/slots";

export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int() }));
  await clearMaintenance(a, b.slotId);
  return json({ ok: true });
});
