// Jalankan job terjadwal secara manual lewat endpoint bersecret: npm run jobs:run -- expire-invoices
import "dotenv/config";
const name = process.argv[2];
if (!name) { console.error("Pakai: npm run jobs:run -- <generate-slots|invoice-reminders|expire-invoices|session-reminders|deactivate-tokens|cleanup>"); process.exit(1); }
const r = await fetch(`${process.env.APP_URL ?? "http://localhost:3100"}/api/jobs/${name}`, { method: "POST", headers: { "x-job-secret": process.env.JOB_SECRET ?? "" } });
console.log(r.status, await r.text());
