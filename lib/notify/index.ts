import "server-only";
import { after } from "next/server";
import { db } from "../db";
import { getSettings } from "../settings";
import { dashboardUrl, ensureDashboardToken, appUrl } from "../tokens";
import { signPayload } from "../crypto";
import { buildIcs } from "../ics";
import { fmtTime } from "../format";
import { publish } from "../realtime";
import { sendMail, type MailAttachment } from "./email";
import { waLink, waSender } from "./wa";
import { loadRegCtx } from "./context";
import { render, renderOtp, type TemplateExtra, type TemplateName } from "./templates";

type Channel = "EMAIL" | "WA" | "DASHBOARD";

const DEFAULT_CHANNELS: Record<TemplateName, Channel[]> = {
  registration_received: ["EMAIL", "WA"],
  admin_new_registration: ["EMAIL"],
  documents_rejected: ["EMAIL", "WA"],
  invoice_issued: ["EMAIL", "WA"],
  invoice_reminder: ["EMAIL", "WA"],
  invoice_overdue_admin: ["DASHBOARD"],
  payment_verified: ["EMAIL", "WA", "DASHBOARD"],
  schedule_assigned: ["EMAIL", "WA", "DASHBOARD"],
  session_reminder: ["WA", "DASHBOARD"],
  schedule_changed: ["EMAIL", "WA", "DASHBOARD"],
  session_completed: ["EMAIL", "DASHBOARD"],
  link_resent: ["EMAIL", "WA"],
};

const SCHEDULE_SENDER: TemplateName[] = ["schedule_assigned", "schedule_changed", "session_reminder", "session_completed", "link_resent"];
const NEEDS_LINK: TemplateName[] = ["schedule_assigned", "schedule_changed", "session_completed", "link_resent"];

/**
 * Kirim notifikasi sesuai matriks (email + WA + dashboard), dwibahasa mengikuti participants.locale.
 * Tidak pernah melempar error ke pemanggil: setiap kiriman dicatat di tabel notifications (SENT/FAILED/MANUAL).
 */
export async function notify(template: TemplateName, registrationId: number, opts: { channels?: Channel[]; extra?: TemplateExtra } = {}) {
  // Dalam request: kirim setelah respons terkirim (UI admin tidak menunggu render PDF/SMTP).
  // Di luar request (job/cron): jalankan langsung.
  try {
    after(() => deliver(template, registrationId, opts));
    return;
  } catch {
    return deliver(template, registrationId, opts);
  }
}

async function deliver(template: TemplateName, registrationId: number, opts: { channels?: Channel[]; extra?: TemplateExtra }) {
  try {
    const [ctx, s] = await Promise.all([loadRegCtx(registrationId), getSettings()]);
    const l = ctx.participant.locale;
    const channels = opts.channels ?? DEFAULT_CHANNELS[template];
    const extra: TemplateExtra = { ...opts.extra };

    if (NEEDS_LINK.includes(template) || (template === "payment_verified" && s.send_link_on_paid)) {
      extra.dashboardLink ??= dashboardUrl(await ensureDashboardToken(db, ctx.id, ctx.reg_no), l);
    }
    const inv = ctx.invoices.find((i) => i.status !== "CANCELLED") ?? ctx.invoices[0];
    if ((template === "invoice_issued" || template === "invoice_reminder") && inv) {
      extra.invoicePdfLink ??= appUrl(`/api/public/invoice-pdf?t=${encodeURIComponent(signPayload({ inv: inv.id }, 60 * 60 * 24 * 30))}`, l);
    }

    const r = render(template, ctx, s, l, extra);

    // --- EMAIL ---
    if (channels.includes("EMAIL")) {
      const isAdmin = template === "admin_new_registration";
      const to = isAdmin ? s.admin_notify_emails : ctx.participant.email;
      const from = `${s.sender_name} <${SCHEDULE_SENDER.includes(template) ? s.sender_email_schedule : s.sender_email_billing}>`;
      const attachments: MailAttachment[] = [];
      try {
        if ((template === "invoice_issued" || template === "invoice_reminder" || template === "payment_verified") && inv) {
          const { renderInvoicePdf } = await import("../pdf/invoice");
          const pdf = await renderInvoicePdf(inv.id, l);
          const kind = template === "payment_verified" ? (l === "id" ? "kuitansi" : "receipt") : "invoice";
          attachments.push({ filename: `${kind}-${inv.invoice_no.replaceAll("/", "-")}.pdf`, content: pdf, contentType: "application/pdf" });
        }
        if ((template === "schedule_assigned" || template === "schedule_changed") && ctx.slots.length) {
          const ics = buildIcs(
            ctx.slots.map((sl) => ({
              uid: `slot-${sl.id}@${s.domain}`,
              date: sl.date.toISOString().slice(0, 10),
              start: sl.start_time,
              end: sl.end_time,
              title: `BWI Sim Center · ${ctx.simulator.code} FTD (${fmtTime(sl.start_time, l)})`,
              location: s.location_name,
              description: `${ctx.reg_no} · ${l === "id" ? ctx.package.name_id : ctx.package.name_en}${extra.dashboardLink ? `\n${extra.dashboardLink}` : ""}`,
            })),
          );
          attachments.push({ filename: "jadwal-bwi-sim.ics", content: ics, contentType: "text/calendar; charset=utf-8; method=PUBLISH" });
        }
        await sendMail({ from, to, subject: r.subject, html: r.html, text: r.text, attachments });
        await record(registrationId, "EMAIL", template, l, Array.isArray(to) ? to.join(",") : to, { subject: r.subject }, "SENT");
      } catch (e) {
        await record(registrationId, "EMAIL", template, l, Array.isArray(to) ? to.join(",") : to, { subject: r.subject }, "FAILED", String((e as Error).message ?? e));
      }
    }

    // --- WHATSAPP ---
    if (channels.includes("WA") && r.wa) {
      const to = ctx.participant.whatsapp;
      const sender = waSender(s.wa_mode);
      if (sender.mode === "MANUAL") {
        await record(registrationId, "WA", template, l, to, { text: r.wa, link: waLink(to, r.wa) }, "MANUAL");
        await publish({ type: "admin", kind: "notification" });
      } else {
        const res = await sender.send(to, r.wa);
        await record(registrationId, "WA", template, l, to, { text: r.wa, link: waLink(to, r.wa) }, res.ok ? "SENT" : "FAILED", res.error);
      }
    }

    // --- DASHBOARD (feed peserta / tanda admin) ---
    if (channels.includes("DASHBOARD") && r.dashboard) {
      // Simpan dua bahasa agar feed dashboard ikut toggle ID/EN.
      const other = render(template, ctx, s, l === "id" ? "en" : "id", extra).dashboard;
      await record(registrationId, "DASHBOARD", template, l, null, { text: r.dashboard, [`text_${l}`]: r.dashboard, [`text_${l === "id" ? "en" : "id"}`]: other }, "SENT");
    }
  } catch (e) {
    console.error(`[notify] ${template} #${registrationId} gagal`, e);
  }
}

async function record(registrationId: number, channel: Channel, template: string, locale: "id" | "en", recipient: string | null, payload: Record<string, unknown>, status: "SENT" | "FAILED" | "MANUAL", error?: string) {
  await db.notification.create({
    data: { registration_id: registrationId, channel, template, locale, recipient, payload: payload as never, status, sent_at: status === "SENT" ? new Date() : null, error: error ?? null },
  });
}

/** Kode OTP untuk peserta lama (E-08). */
export async function sendOtpEmail(email: string, code: string, l: "id" | "en") {
  const s = await getSettings();
  const r = renderOtp(s, l, code);
  await sendMail({ from: `${s.sender_name} <${s.sender_email_billing}>`, to: email, subject: r.subject, html: r.html, text: r.text });
}
