import { handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { participantZip } from "@/lib/services/participant-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Unduh data personal 1 peserta (SA): ZIP berisi Excel data diri + semua dokumen. Dicatat di activity_log. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const id = Number((await params).id);
  const z = await participantZip(id, a.name);
  await logActivity({ type: "ADMIN", id: a.id }, "export.participant_zip", "participant", id, { docs: z.docCount, registrations: z.regIds });
  return new Response(z.data, {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${z.filename}"`, "cache-control": "no-store" },
  });
});
