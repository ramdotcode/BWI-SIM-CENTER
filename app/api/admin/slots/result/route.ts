import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { recordResult } from "@/lib/services/slots";
import { claimUpload } from "@/lib/claim";

export const runtime = "nodejs";
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req);
  const b = await body(req, z.object({ slotId: z.number().int(), status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED"]), note: z.string().max(1000).optional(), report_upload: z.string().optional() }));
  const key = await claimUpload(b.report_upload, ["SESSION_REPORT"]);
  await recordResult(a, b.slotId, { status: b.status, note: b.note || undefined, report_key: key });
  return json({ ok: true });
});
