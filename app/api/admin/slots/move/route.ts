import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { moveSlot } from "@/lib/services/slots";

export const runtime = "nodejs";
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int(), targetId: z.number().int(), notify: z.boolean().default(true) }));
  await moveSlot(a, b.slotId, b.targetId, { notify: b.notify });
  return json({ ok: true });
});
