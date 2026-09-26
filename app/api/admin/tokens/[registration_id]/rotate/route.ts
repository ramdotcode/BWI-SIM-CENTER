import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { rotateLink } from "@/lib/services/accounts";

export const runtime = "nodejs";
export const POST = handler(async (req: Request, { params }: { params: Promise<{ registration_id: string }> }) => {
  const a = await requireAdminApi(req);
  return json(await rotateLink(a, Number((await params).registration_id)));
});
