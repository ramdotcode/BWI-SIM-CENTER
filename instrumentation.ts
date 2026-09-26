// Cron internal (node-cron) — aktif bila ENABLE_INTERNAL_CRON=true dan runtime Node.
// Untuk Vercel Cron / pg_cron: set ENABLE_INTERNAL_CRON=false dan panggil /api/jobs/{nama} dengan header X-JOB-SECRET.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ENABLE_INTERNAL_CRON === "true") {
    const { startCron } = await import("./lib/cron");
    startCron();
  }
}
