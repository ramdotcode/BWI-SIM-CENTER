import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { adminQueue } from "@/lib/services/admin-schedule";

export const dynamic = "force-dynamic";
export const GET = handler(async (req: Request) => {
  await requireAdminApi(req);
  return json(await adminQueue());
});
