import { handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { displayLinkUrl, revokeDisplayLink } from "@/lib/display";

export const runtime = "nodejs";

/** Ambil URL link layar untuk disalin (Super Admin). */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdminApi(req, "SUPER_ADMIN");
  return json({ url: await displayLinkUrl((await params).id) });
});

/** Cabut link layar — layar yang memakainya berhenti menampilkan jadwal. */
export const DELETE = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  await revokeDisplayLink(a, (await params).id);
  return json({ ok: true });
});
