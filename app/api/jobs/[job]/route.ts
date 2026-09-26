import { handler, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { JOBS, runJob, type JobName } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Endpoint cron: header X-JOB-SECRET, atau Authorization: Bearer <CRON_SECRET> (dikirim otomatis oleh Vercel Cron).
 * Jadwal Vercel ada di vercel.json (dalam UTC = WIB − 7 jam).
 */
async function run(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const secrets = [process.env.JOB_SECRET, process.env.CRON_SECRET].filter((x): x is string => !!x);
  const got = req.headers.get("x-job-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!got || !secrets.some((s) => safeEqual(got, s))) throw new HttpError(401, "Unauthorized");
  if (!(job in JOBS)) throw new HttpError(404, "Job tidak dikenal");
  return json({ job, result: await runJob(job as JobName) });
}
export const POST = handler(run);
export const GET = handler(run);
