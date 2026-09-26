import { handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { exportFileName, participantsWorkbook } from "@/lib/xlsx";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export Excel database peserta (SA). */
export const GET = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const u = new URL(req.url).searchParams;
  const f = { period: u.get("period") ?? "all", sim: u.get("sim") ?? undefined, status: u.get("status") ?? undefined, q: u.get("q") ?? undefined };
  const buf = await participantsWorkbook(f, a.name);
  await logActivity({ type: "ADMIN", id: a.id }, "export.participants", "export", null, f);
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${exportFileName("peserta", f.period)}"`, "cache-control": "no-store" },
  });
});
