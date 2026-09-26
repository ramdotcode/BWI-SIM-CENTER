import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { assignSlots } from "@/lib/services/slots";

export const runtime = "nodejs";
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int(), registrationId: z.number().int(), instructorId: z.number().int().nullable(), autofill: z.boolean().default(false), notify: z.boolean().default(true) }));
  return json(await assignSlots(a, b));
});
