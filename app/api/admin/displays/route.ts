import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { createDisplayLink } from "@/lib/display";

export const runtime = "nodejs";

/** Buat link Mode Layar baru (Super Admin). */
export const POST = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const b = await body(req, z.object({ label: z.string().trim().min(1, "Nama layar wajib diisi").max(60) }));
  return json(await createDisplayLink(a, b));
});
