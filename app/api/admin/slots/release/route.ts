import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { releaseSlot } from "@/lib/services/slots";

export const runtime = "nodejs";
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int(), reason: z.string().max(300).optional(), notify: z.boolean().default(true) }));
  await releaseSlot(a, b.slotId, { reason: b.reason, notify: b.notify });
  return json({ ok: true });
});
