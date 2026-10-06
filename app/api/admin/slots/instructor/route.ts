import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { changeInstructor } from "@/lib/services/slots";

export const runtime = "nodejs";
/** Ganti instruktur pada sesi terjadwal (slot tidak dilepas). */
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int(), instructorId: z.number().int().nullable(), notify: z.boolean().default(false) }));
  return json(await changeInstructor(a, b.slotId, b.instructorId, { notify: b.notify }));
});
