import "server-only";
import type { Settings } from "../settings";
import { fmtDate, fmtDateLong, fmtDateTime, fmtTime, fmtTsDate, prettyPhone, rupiah } from "../format";
import { waLink } from "./wa";
import type { RegCtx } from "./context";

export type Loc = "id" | "en";
export type TemplateName =
  | "registration_received"
  | "admin_new_registration"
  | "documents_rejected"
  | "invoice_issued"
  | "invoice_reminder"
  | "invoice_overdue_admin"
  | "payment_verified"
  | "schedule_assigned"
  | "session_reminder"
  | "schedule_changed"
  | "session_completed"
  | "link_resent";

export type TemplateExtra = {
  dashboardLink?: string;
  reuploadLink?: string;
  invoicePdfLink?: string;
  note?: string;
  rejectedKinds?: string[];
  slotLabel?: string; // session_reminder / session_completed / schedule_changed
  when?: "H-1" | "H-0";
  reportLink?: string;
  resultStatus?: string;
  partial?: boolean;
  changes?: string[];
};

export type Rendered = { subject: string; html: string; text: string; wa?: string; dashboard?: string };

// ---------- helpers ----------
const C = { teal: "#0B3B48", deep: "#072A34", mid: "#16586A", tint: "#F0F5F6", lime: "#D9F21F", line: "#D7E0E3", muted: "#5E7177", faint: "#8A9BA0", ok: "#1E9E68", bad: "#D4443C", ink: "#112429" };
const FONT = `font-family:Barlow,'Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = `font-family:'IBM Plex Mono',Menlo,Consolas,monospace`;
const e = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(s: Settings, l: Loc, body: string) {
  const footer =
    l === "id"
      ? `Email ini dikirim otomatis oleh sistem BWI Sim Center. Nomor WhatsApp admin: ${e(prettyPhone(s.wa_admin_number))}. Jika Anda tidak merasa mendaftar, abaikan email ini.`
      : `This email was sent automatically by the BWI Sim Center system. Admin WhatsApp: ${e(prettyPhone(s.wa_admin_number))}. If you did not register, please ignore this email.`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#F3F6F7;${FONT};color:${C.ink};font-size:15px;line-height:1.5">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border:1px solid ${C.line};border-radius:12px">
<tr><td style="padding:24px 28px 0">
  <table role="presentation" width="100%" style="border-bottom:2px solid ${C.lime}"><tr>
    <td style="padding-bottom:14px"><img src="cid:bwi-logo" alt="BWI Aviation" height="34" style="height:34px;vertical-align:middle"> <img src="cid:ppi-logo" alt="PPI Curug" height="30" style="height:30px;vertical-align:middle;margin-left:10px"></td>
    <td align="right" style="padding-bottom:14px;font-size:12.5px;color:${C.muted}">Sim Center · PPI Curug</td>
  </tr></table>
</td></tr>
<tr><td style="padding:20px 28px 8px">${body}</td></tr>
<tr><td style="padding:8px 28px 24px"><div style="font-size:12.5px;color:${C.faint};border-top:1px solid #E8EEF0;padding-top:14px">${footer}<br>${e(s.company_name)} · Kawasan PPI Curug, Tangerang, Banten.</div></td></tr>
</table></td></tr></table></body></html>`;
}
const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const btn = (href: string, label: string, kind: "wa" | "lime" | "ghost" | "teal" = "teal") => {
  const st = {
    wa: `background:#25D366;color:#063`,
    lime: `background:${C.lime};color:${C.deep}`,
    ghost: `background:#fff;color:${C.teal};border:1px solid ${C.line}`,
    teal: `background:${C.teal};color:#fff`,
  }[kind];
  return `<a href="${e(href)}" style="display:inline-block;${st};padding:11px 18px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;margin:0 8px 8px 0">${label}</a>`;
};
const box = (cells: [string, string][], full?: [string, string]) => {
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const td = (c?: [string, string]) =>
      c ? `<td width="50%" style="padding:6px 8px;vertical-align:top"><div style="color:${C.muted};font-size:11.5px;text-transform:uppercase;letter-spacing:.06em">${c[0]}</div><div style="font-weight:600">${c[1]}</div></td>` : "<td></td>";
    rows.push(`<tr>${td(cells[i])}${td(cells[i + 1])}</tr>`);
  }
  if (full) rows.push(`<tr><td colspan="2" style="padding:8px;border-top:1px solid ${C.line}"><div style="color:${C.muted};font-size:11.5px;text-transform:uppercase;letter-spacing:.06em">${full[0]}</div>${full[1]}</td></tr>`);
  return `<table role="presentation" width="100%" style="border:1px solid ${C.line};border-radius:8px;background:${C.tint};margin:0 0 16px;border-collapse:separate">${rows.join("")}</table>`;
};
const mono = (s: string) => `<span style="${MONO}">${e(s)}</span>`;
const ok = (s: string) => `<b style="color:${C.ok}">${s}</b>`;

function pkgName(ctx: RegCtx, l: Loc) {
  return l === "id" ? ctx.package.name_id : ctx.package.name_en;
}
function simName(ctx: RegCtx) {
  return ctx.simulator.code === "A320" ? "Airbus A320" : "Boeing 737NG";
}
function firstName(n: string) {
  return n.split(/\s+/)[0] ?? n;
}
function invoiceOf(ctx: RegCtx) {
  return ctx.invoices.find((i) => i.status !== "CANCELLED") ?? ctx.invoices[0];
}
export function slotLabel(slot: { date: Date; start_time: string; end_time: string }, l: Loc) {
  return `${fmtDate(slot.date, l, { weekday: true })} · ${fmtTime(slot.start_time, l)}–${fmtTime(slot.end_time, l)} WIB`;
}
function sessionCards(ctx: RegCtx, s: Settings, l: Loc) {
  const total = ctx.slots.length;
  return ctx.slots
    .map((sl, i) => {
      const ins = sl.instructor && s.show_instructor_to_participant ? ` · Instr. ${e(sl.instructor.name)}` : "";
      const d = sl.date;
      return `<table role="presentation" width="100%" style="background:${C.teal};border-radius:12px;margin:0 0 10px;color:#fff"><tr>
<td width="80" style="padding:14px 0 14px 16px;vertical-align:middle"><div style="font-size:34px;font-weight:700;line-height:1;color:${C.lime}">${String(d.getUTCDate()).padStart(2, "0")}</div><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#B9D3D9">${fmtDate(d, l, { weekday: true }).split(",")[0]} · ${fmtDate(d, l, { year: false }).split(" ")[1]}</div></td>
<td style="padding:14px 16px 14px 8px"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#B9D3D9">${l === "id" ? `Sesi ${i + 1} dari ${total}` : `Session ${i + 1} of ${total}`}</div><div style="font-weight:700;font-size:16px">${fmtTime(sl.start_time, l)} – ${fmtTime(sl.end_time, l)} WIB</div><div style="font-size:13px;color:#C6DBE0">${ctx.simulator.code} FTD · ${e(ctx.simulator.bay)}${ins}</div></td></tr></table>`;
    })
    .join("");
}
function sessionsText(ctx: RegCtx, s: Settings, l: Loc) {
  return ctx.slots.map((sl, i) => `${i + 1}. ${slotLabel(sl, l)}${sl.instructor && s.show_instructor_to_participant ? ` · ${sl.instructor.name}` : ""}`).join("\n");
}
export function participantWaConfirmText(ctx: RegCtx, l: Loc) {
  const inv = invoiceOf(ctx);
  return l === "id"
    ? `Halo Admin BWI, saya ${ctx.participant.full_name} ingin konfirmasi pembayaran invoice ${inv?.invoice_no} sebesar ${rupiah(inv?.total)}. Bukti transfer terlampir.`
    : `Hello BWI Admin, I am ${ctx.participant.full_name} and would like to confirm payment for invoice ${inv?.invoice_no} amounting to ${rupiah(inv?.total)}. Transfer receipt attached.`;
}

// ---------- templates ----------
export function render(name: TemplateName, ctx: RegCtx, s: Settings, l: Loc, x: TemplateExtra = {}): Rendered {
  const P = ctx.participant;
  const inv = invoiceOf(ctx);
  const id = l === "id";
  const tag = "[BWI Aviation]";
  const adminWa = prettyPhone(s.wa_admin_number);
  const bank = `${s.bank_name} ${s.bank_account}`;
  const pkg = `${pkgName(ctx, l)} – ${simName(ctx)} · ${ctx.hours_snapshot} ${id ? "jam" : "h"}`;

  switch (name) {
    case "registration_received": {
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(
          id
            ? `Pendaftaran sesi simulator Anda sudah kami terima dengan nomor ${mono(ctx.reg_no)}. Admin akan memeriksa foto lisensi, medical, dan KTP Anda dalam <b>1 hari kerja</b>. Setelah lolos, invoice dikirim ke email ini.`
            : `We have received your simulator session registration, number ${mono(ctx.reg_no)}. Admin will check your licence, medical, and ID photos within <b>1 working day</b>. Once approved, the invoice is sent to this email.`,
        ) +
        box([
          [id ? "No. registrasi" : "Registration no.", mono(ctx.reg_no)],
          [id ? "Paket" : "Package", e(pkg)],
          [id ? "Total" : "Total", e(rupiah(ctx.price_snapshot))],
          [id ? "Status" : "Status", id ? "Menunggu verifikasi" : "Awaiting verification"],
        ]);
      return {
        subject: `${tag} ${id ? "Pendaftaran diterima" : "Registration received"} – ${ctx.reg_no}`,
        html: layout(s, l, body),
        text: `${ctx.reg_no}`,
        wa: id
          ? `Halo ${P.full_name}, pendaftaran simulator BWI Sim Center Anda sudah diterima (No. ${ctx.reg_no}, ${pkg}). Admin memverifikasi dokumen dalam 1 hari kerja; invoice akan dikirim ke ${P.email}.`
          : `Hello ${P.full_name}, your BWI Sim Center simulator registration has been received (No. ${ctx.reg_no}, ${pkg}). Admin verifies documents within 1 working day; the invoice will be sent to ${P.email}.`,
      };
    }
    case "admin_new_registration": {
      const body =
        p(`Pendaftar baru menunggu verifikasi:`) +
        box([
          ["No. registrasi", mono(ctx.reg_no)],
          ["Nama", e(P.full_name)],
          ["Paket", e(`${ctx.package.name_id} – ${ctx.simulator.code}`)],
          ["Lisensi", e(`${P.licence_type} · ${P.licence_no}`)],
        ]) +
        btn(`${(process.env.APP_URL ?? "").replace(/\/$/, "")}/admin/verifikasi?reg=${ctx.id}`, "Buka panel verifikasi →");
      return { subject: `${tag} Pendaftar baru ${ctx.reg_no} – ${P.full_name}`, html: layout(s, "id", body), text: ctx.reg_no };
    }
    case "documents_rejected": {
      const kinds = (x.rejectedKinds ?? []).join(", ");
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(
          id
            ? `Dokumen pendaftaran ${mono(ctx.reg_no)} <b style="color:${C.bad}">perlu diunggah ulang</b>: <b>${e(kinds)}</b>.`
            : `The documents for registration ${mono(ctx.reg_no)} <b style="color:${C.bad}">need to be re-uploaded</b>: <b>${e(kinds)}</b>.`,
        ) +
        `<div style="border-left:3px solid ${C.lime};background:#F4FBBF;padding:12px 14px;border-radius:0 8px 8px 0;color:#4B5800;margin:0 0 16px"><b>${id ? "Catatan admin" : "Admin note"}:</b> ${e(x.note)}</div>` +
        p(id ? `Nomor registrasi Anda tetap sama. Link unggah ulang berlaku ${s.reupload_token_days} hari.` : `Your registration number stays the same. The re-upload link is valid for ${s.reupload_token_days} days.`) +
        btn(x.reuploadLink ?? "#", id ? "Unggah ulang dokumen →" : "Re-upload documents →", "lime");
      return {
        subject: `${tag} ${id ? "Dokumen perlu diunggah ulang" : "Documents need re-upload"} – ${ctx.reg_no}`,
        html: layout(s, l, body),
        text: x.reuploadLink ?? "",
        wa: id
          ? `Halo ${P.full_name}, dokumen pendaftaran ${ctx.reg_no} perlu diunggah ulang: ${kinds}. Catatan: ${x.note}. Unggah di: ${x.reuploadLink} (berlaku ${s.reupload_token_days} hari).`
          : `Hello ${P.full_name}, documents for registration ${ctx.reg_no} need to be re-uploaded: ${kinds}. Note: ${x.note}. Upload here: ${x.reuploadLink} (valid ${s.reupload_token_days} days).`,
      };
    }
    case "invoice_issued":
    case "invoice_reminder": {
      const reminder = name === "invoice_reminder";
      const due = inv ? fmtTsDate(inv.due_at, l) : "";
      const dueLong = inv ? fmtDateLong(new Date(inv.due_at.getTime() + 7 * 3600_000), l) : "";
      const confirm = waLink(s.wa_admin_number, participantWaConfirmText(ctx, l));
      const intro = reminder
        ? id
          ? `Pengingat: invoice ${mono(inv!.invoice_no)} <b>jatuh tempo besok (${e(dueLong)})</b> dan belum kami terima pembayarannya.`
          : `Reminder: invoice ${mono(inv!.invoice_no)} is <b>due tomorrow (${e(dueLong)})</b> and we have not received payment yet.`
        : id
          ? `Dokumen Anda telah ${ok("lolos verifikasi")}. Berikut invoice untuk sesi simulator yang Anda pilih. Silakan lakukan pembayaran <b>lunas</b> paling lambat <b>${e(dueLong)}</b>.`
          : `Your documents have ${ok("passed verification")}. Here is the invoice for your chosen simulator session. Please pay <b>in full</b> no later than <b>${e(dueLong)}</b>.`;
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(intro) +
        box(
          [
            [id ? "No. invoice" : "Invoice no.", mono(inv?.invoice_no ?? "")],
            ["Total", `<span style="font-size:22px;color:${C.deep}">${e(rupiah(inv?.total))}</span>`],
            [id ? "Paket" : "Package", e(pkg)],
            [id ? "Jatuh tempo" : "Due date", e(due)],
          ],
          [id ? "Transfer ke" : "Transfer to", `<div style="${MONO};font-size:16px;font-weight:600">${e(bank)}</div><div style="font-size:13px;color:${C.muted}">a.n. ${e(s.bank_holder)}</div>`],
        ) +
        `<div style="margin:0 0 16px"><b>${id ? "Cara konfirmasi pembayaran" : "How to confirm payment"}</b><ol style="margin:6px 0 0;padding-left:20px;color:${C.muted}">` +
        (id
          ? `<li>Transfer sesuai nominal di atas.</li><li>Kirim <b>foto bukti transfer</b> dan <b>nomor invoice</b> ke WhatsApp admin.</li><li>Admin memverifikasi dalam jam kerja (${e(s.office_hours)}), lalu Anda menerima email jadwal.</li>`
          : `<li>Transfer the exact amount above.</li><li>Send a <b>photo of the transfer receipt</b> and the <b>invoice number</b> to admin WhatsApp.</li><li>Admin verifies during office hours (${e(s.office_hours)}), then you receive the schedule email.</li>`) +
        `</ol></div>` +
        btn(confirm, `💬 ${id ? "Konfirmasi via WhatsApp" : "Confirm via WhatsApp"} · ${e(adminWa)}`, "wa") +
        (x.invoicePdfLink ? btn(x.invoicePdfLink, id ? "Lihat invoice (PDF)" : "View invoice (PDF)", "ghost") : "");
      return {
        subject: `${tag} ${reminder ? (id ? "Pengingat jatuh tempo" : "Due date reminder") + " – " : ""}Invoice ${inv?.invoice_no} – ${pkgName(ctx, l)} ${simName(ctx)} (${ctx.hours_snapshot} ${id ? "jam" : "h"})`,
        html: layout(s, l, body),
        text: inv?.invoice_no ?? "",
        wa: id
          ? `Halo ${P.full_name}, ${reminder ? "pengingat: " : ""}invoice ${inv?.invoice_no} sebesar ${rupiah(inv?.total)} ${reminder ? "jatuh tempo besok" : "jatuh tempo"} ${due}. Transfer ke ${bank} a.n. ${s.bank_holder}, lalu kirim bukti transfer + nomor invoice ke nomor ini.`
          : `Hello ${P.full_name}, ${reminder ? "reminder: " : ""}invoice ${inv?.invoice_no} of ${rupiah(inv?.total)} is due ${reminder ? "tomorrow, " : ""}${due}. Transfer to ${bank} (${s.bank_holder}), then send the receipt + invoice number to this number.`,
      };
    }
    case "invoice_overdue_admin": {
      const body = p(`Invoice ${mono(inv?.invoice_no ?? "")} (${e(P.full_name)}, ${e(rupiah(inv?.total))}) lewat jatuh tempo ${e(inv ? fmtTsDate(inv.due_at, "id") : "")}. Silakan follow up via WhatsApp.`);
      return { subject: `${tag} Invoice lewat tempo ${inv?.invoice_no}`, html: layout(s, "id", body), text: "", dashboard: `Invoice ${inv?.invoice_no} lewat tempo` };
    }
    case "payment_verified": {
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(
          id
            ? `Pembayaran invoice ${mono(inv?.invoice_no ?? "")} sebesar <b>${e(rupiah(inv?.amount_received ?? inv?.total))}</b> sudah ${ok("lunas terverifikasi")}. Kuitansi terlampir. Admin akan menjadwalkan sesi Anda dan mengirim email jadwal beserta link dashboard.`
            : `Payment for invoice ${mono(inv?.invoice_no ?? "")} of <b>${e(rupiah(inv?.amount_received ?? inv?.total))}</b> has been ${ok("verified as paid")}. The receipt is attached. Admin will schedule your sessions and send a schedule email with your dashboard link.`,
        ) +
        (x.dashboardLink ? btn(x.dashboardLink, id ? "Buka dashboard →" : "Open dashboard →", "lime") : "");
      return {
        subject: `${tag} ${id ? "Pembayaran lunas" : "Payment received"} – ${inv?.invoice_no}`,
        html: layout(s, l, body),
        text: "",
        wa: id
          ? `✅ Pembayaran ${inv?.invoice_no} sudah terverifikasi. Email jadwal sesi & link dashboard akan dikirim ke ${P.email}. Sampai bertemu di Curug!`
          : `✅ Payment for ${inv?.invoice_no} is verified. The session schedule email & dashboard link will be sent to ${P.email}. See you at Curug!`,
        dashboard: id ? `Pembayaran ${inv?.invoice_no} lunas terverifikasi` : `Payment ${inv?.invoice_no} verified`,
      };
    }
    case "schedule_assigned":
    case "schedule_changed": {
      const changed = name === "schedule_changed";
      const dates = ctx.slots.map((sl) => fmtDate(sl.date, l, { weekday: true, year: false }).replace(",", "")).filter((v, i, a) => a.indexOf(v) === i);
      const needed = Math.ceil((ctx.hours_snapshot * 60) / s.slot_minutes);
      const partial = ctx.slots.length < needed;
      const intro = changed
        ? id
          ? `Jadwal sesi simulator Anda <b>berubah</b>${x.note ? ` (${e(x.note)})` : ""}. Berikut jadwal terbaru:`
          : `Your simulator session schedule has <b>changed</b>${x.note ? ` (${e(x.note)})` : ""}. Here is the latest schedule:`
        : id
          ? `Halo <b>${e(firstName(P.full_name))}</b>, pembayaran Anda sudah ${ok("lunas terverifikasi")}. Berikut jadwal sesi simulator Anda:`
          : `Hello <b>${e(firstName(P.full_name))}</b>, your payment has been ${ok("verified")}. Here is your simulator session schedule:`;
      const partialNote = partial
        ? `<div style="border-left:3px solid ${C.lime};background:#F4FBBF;padding:10px 14px;border-radius:0 8px 8px 0;color:#4B5800;margin:0 0 14px">${id ? `Jadwal parsial: ${ctx.slots.length} dari ${needed} sesi. Sisa sesi akan dikabarkan menyusul.` : `Partial schedule: ${ctx.slots.length} of ${needed} sessions. Remaining sessions will follow.`}</div>`
        : "";
      const body =
        (changed ? p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) : "") +
        p(intro) +
        partialNote +
        (ctx.slots.length ? sessionCards(ctx, s, l) : p(id ? "<i>Belum ada sesi terjadwal.</i>" : "<i>No sessions scheduled.</i>")) +
        box(
          [
            [id ? "Lokasi" : "Location", e(s.location_name)],
            [id ? "Hadir" : "Arrive", id ? "30 menit sebelum sesi (briefing)" : "30 minutes before the session (briefing)"],
            [id ? "Bawa" : "Bring", id ? "Lisensi asli, medical, KTP" : "Original licence, medical, ID"],
            [id ? "Link dashboard pribadi" : "Private dashboard link", `<span style="${MONO};font-size:12px">${e(shortDisplay(x.dashboardLink, s))}</span><div style="font-size:12px;color:${C.muted};font-weight:400">${id ? "Tanpa login. Jangan bagikan link ini." : "No login. Do not share this link."}</div>`],
          ],
        ) +
        p(`<span style="font-size:13px;color:${C.muted}">${id ? "Ingin melihat slot secara real-time atau memantau perubahan jadwal? Buka dashboard peserta Anda:" : "Want to see slots in real time or track schedule changes? Open your participant dashboard:"}</span>`) +
        btn(x.dashboardLink ?? "#", id ? "Buka dashboard jadwal →" : "Open schedule dashboard →", "lime") +
        p(`<span style="font-size:12.5px;color:${C.faint}">${id ? `File kalender (.ics) terlampir. Perubahan jadwal hanya dilakukan admin dan diberitahukan via email & WhatsApp. Hubungi ${e(adminWa)} untuk reschedule maks. ${s.reschedule_free_hours} jam sebelum sesi.` : `A calendar file (.ics) is attached. Schedule changes are made by admin only and announced via email & WhatsApp. Contact ${e(adminWa)} to reschedule at least ${s.reschedule_free_hours} hours before the session.`}</span>`);
      const subj = changed
        ? `${tag} ${id ? "Perubahan jadwal sesi" : "Session schedule changed"} ${id ? ctx.package.short_id : ctx.package.short_en} ${ctx.simulator.code}`
        : `${tag} ${id ? "Jadwal sesi" : "Session schedule"} ${id ? ctx.package.short_id : ctx.package.short_en} ${ctx.simulator.code}${id ? " Anda" : ""} – ${dates.join(" & ")} ${ctx.slots[0] ? ctx.slots[0].date.getUTCFullYear() : ""}`.trim();
      return {
        subject: subj,
        html: layout(s, l, body),
        text: sessionsText(ctx, s, l),
        wa: id
          ? `Halo ${P.full_name}, ${changed ? "jadwal sesi Anda berubah" : "jadwal sesi simulator Anda"} (${ctx.simulator.code}):\n${sessionsText(ctx, s, l)}\nHadir 30 menit sebelumnya, bawa lisensi asli, medical, KTP.\nDashboard: ${x.dashboardLink}`
          : `Hello ${P.full_name}, ${changed ? "your session schedule has changed" : "your simulator session schedule"} (${ctx.simulator.code}):\n${sessionsText(ctx, s, l)}\nArrive 30 minutes early, bring your original licence, medical, ID.\nDashboard: ${x.dashboardLink}`,
        dashboard: changed ? (id ? `Jadwal Anda berubah${x.note ? `: ${x.note}` : ""}` : `Your schedule changed${x.note ? `: ${x.note}` : ""}`) : id ? `Jadwal Anda ditetapkan: ${dates.join(" & ")}` : `Your schedule is set: ${dates.join(" & ")}`,
      };
    }
    case "session_reminder": {
      const when = x.when === "H-0" ? (id ? "hari ini" : "today") : id ? "besok" : "tomorrow";
      const wa = id
        ? `Pengingat BWI Sim Center: sesi ${ctx.simulator.code} Anda ${when}, ${x.slotLabel}. Hadir 30 menit sebelumnya untuk briefing; bawa lisensi asli, medical, dan KTP. Lokasi: ${s.location_name}.`
        : `BWI Sim Center reminder: your ${ctx.simulator.code} session is ${when}, ${x.slotLabel}. Arrive 30 minutes early for briefing; bring your original licence, medical, and ID. Location: ${s.location_name}.`;
      return { subject: "", html: "", text: wa, wa, dashboard: id ? `Pengingat: sesi ${when} ${x.slotLabel}` : `Reminder: session ${when} ${x.slotLabel}` };
    }
    case "session_completed": {
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(id ? `Sesi simulator Anda <b>${e(x.slotLabel)}</b> telah tercatat: <b>${e(x.resultStatus)}</b>.` : `Your simulator session <b>${e(x.slotLabel)}</b> has been recorded: <b>${e(x.resultStatus)}</b>.`) +
        (x.note ? `<div style="border-left:3px solid ${C.lime};background:#F4FBBF;padding:12px 14px;border-radius:0 8px 8px 0;color:#4B5800;margin:0 0 16px">${e(x.note)}</div>` : "") +
        (x.dashboardLink ? btn(x.dashboardLink, id ? "Lihat progres & laporan di dashboard →" : "View progress & report on the dashboard →", "lime") : "");
      return {
        subject: `${tag} ${id ? "Hasil sesi" : "Session result"} – ${x.slotLabel}`,
        html: layout(s, l, body),
        text: "",
        dashboard: id ? `Hasil sesi ${x.slotLabel}: ${x.resultStatus}` : `Session result ${x.slotLabel}: ${x.resultStatus}`,
      };
    }
    case "link_resent": {
      const body =
        p(`${id ? "Halo" : "Hello"} <b>${e(P.full_name)}</b>,`) +
        p(id ? `Berikut link dashboard pribadi Anda untuk pendaftaran ${mono(ctx.reg_no)}. Link lama (jika ada) mungkin sudah tidak berlaku.` : `Here is your private dashboard link for registration ${mono(ctx.reg_no)}. Any previous link may no longer work.`) +
        btn(x.dashboardLink ?? "#", id ? "Buka dashboard →" : "Open dashboard →", "lime") +
        p(`<span style="font-size:12.5px;color:${C.faint}">${id ? "Tanpa login. Jangan bagikan link ini." : "No login required. Do not share this link."}</span>`);
      return {
        subject: `${tag} ${id ? "Link dashboard Anda" : "Your dashboard link"} – ${ctx.reg_no}`,
        html: layout(s, l, body),
        text: x.dashboardLink ?? "",
        wa: id ? `Halo ${P.full_name}, berikut link dashboard pribadi Anda (${ctx.reg_no}): ${x.dashboardLink}\nJangan bagikan link ini.` : `Hello ${P.full_name}, here is your private dashboard link (${ctx.reg_no}): ${x.dashboardLink}\nDo not share this link.`,
      };
    }
  }
}

function shortDisplay(link: string | undefined, s: Settings) {
  if (!link) return "—";
  const m = link.match(/\/d\/(REG-\d{4}-\d{4})-(.{4})/);
  return m ? `${s.domain}/d/${m[1]}-${m[2]}…` : link;
}

/** Email OTP (E-08 peserta lama). */
export function renderOtp(s: Settings, l: Loc, code: string): Rendered {
  const id = l === "id";
  const body =
    p(id ? "Kode verifikasi untuk mengisi otomatis data pendaftaran Anda:" : "Your verification code to auto-fill your registration data:") +
    `<div style="${MONO};font-size:30px;font-weight:600;letter-spacing:.3em;background:${C.tint};border-radius:8px;padding:14px 18px;display:inline-block;margin:0 0 14px">${e(code)}</div>` +
    p(`<span style="font-size:13px;color:${C.muted}">${id ? "Berlaku 10 menit. Abaikan email ini jika Anda tidak memintanya." : "Valid for 10 minutes. Ignore this email if you did not request it."}</span>`);
  return { subject: `[BWI Aviation] ${id ? "Kode verifikasi" : "Verification code"}: ${code}`, html: layout(s, l, body), text: code };
}

export { fmtDateTime };
