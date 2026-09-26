import { handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { exportFileName, financeWorkbook } from "@/lib/xlsx";
import { logActivity } from "@/lib/activity";
import { todayJkt } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Export Excel rekap keuangan (SA). */
export const GET = handler(async (req: Request) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const y = Number(new URL(req.url).searchParams.get("year")) || Number(todayJkt().slice(0, 4));
  const buf = await financeWorkbook(y, a.name);
  await logActivity({ type: "ADMIN", id: a.id }, "export.finance", "export", null, { year: y });
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${exportFileName("keuangan", String(y))}"`, "cache-control": "no-store" },
  });
});
