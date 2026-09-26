import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { sendSchedule } from "@/lib/services/slots";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req);
  return json(await sendSchedule(a, Number((await params).id)));
});
