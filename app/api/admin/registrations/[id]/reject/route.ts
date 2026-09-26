import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { rejectRegistration } from "@/lib/services/registrations";
import { DOC_KINDS } from "@/lib/schemas";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ note: z.string().trim().min(3).max(1000), kinds: z.array(z.enum(DOC_KINDS)).min(1) }));
  await rejectRegistration(Number((await params).id), a, b.note, b.kinds);
  return json({ ok: true });
});
