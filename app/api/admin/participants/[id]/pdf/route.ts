import { handler } from "@/lib/api";
import { requireAdminApi } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { participantPdf } from "@/lib/pdf/participant";
import { deliverFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Unduh data personal 1 peserta (SA) sebagai SATU PDF: lembar data diri + semua dokumen digabung. Tidak disimpan. */
export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const a = await requireAdminApi(req, "SUPER_ADMIN");
  const id = Number((await params).id);
  const r = await participantPdf(id, a.name);
  await logActivity({ type: "ADMIN", id: a.id }, "export.participant_pdf", "participant", id, { docs: r.docCount, pages: r.pages, registrations: r.regIds });
  return deliverFile(req, r.data, r.filename, "application/pdf");
});
