// Dipanggil dari instrumentation.ts hanya pada runtime Node.
import cron from "node-cron";
import { runJob } from "./jobs";

export function startCron() {
  const g = globalThis as unknown as { __cron?: boolean };
  if (g.__cron) return;
  g.__cron = true;
  const tz = { timezone: "Asia/Jakarta" };
  const safe = (name: Parameters<typeof runJob>[0]) => () => void runJob(name).catch((e) => console.error(`[cron] ${name}`, e));
  cron.schedule("10 0 * * *", safe("generate-slots"), tz);
  cron.schedule("20 0 * * *", safe("expire-invoices"), tz);
  cron.schedule("0 9 * * *", safe("invoice-reminders"), tz);
  cron.schedule("0 8 * * *", safe("session-reminders-h0"), tz);
  cron.schedule("0 17 * * *", safe("session-reminders-h1"), tz);
  cron.schedule("30 1 * * *", safe("cleanup"), tz);
  cron.schedule("0 2 * * 1", safe("deactivate-tokens"), tz);
  console.log("[cron] jadwal internal aktif (Asia/Jakarta)");
}
