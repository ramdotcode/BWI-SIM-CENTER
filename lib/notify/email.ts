import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import path from "node:path";

const g = globalThis as unknown as { __mailer?: Transporter };

function transport(): Transporter {
  if (g.__mailer) return g.__mailer;
  const url = process.env.SMTP_URL;
  g.__mailer = url ? nodemailer.createTransport(url) : nodemailer.createTransport({ jsonTransport: true });
  return g.__mailer;
}

export type MailAttachment = { filename: string; content: Buffer | string; contentType?: string; cid?: string };

export const BRAND_ATTACHMENTS: MailAttachment[] = [
  { filename: "bwi-aviation.png", content: path.join(process.cwd(), "public/brand/bwi-aviation.png") as unknown as string, cid: "bwi-logo" },
  { filename: "ppi-curug.png", content: path.join(process.cwd(), "public/brand/ppi-curug.png") as unknown as string, cid: "ppi-logo" },
];

export async function sendMail(opts: { from: string; to: string | string[]; subject: string; html: string; text?: string; attachments?: MailAttachment[] }) {
  const brand = BRAND_ATTACHMENTS.map((a) => ({ filename: a.filename, path: a.content as string, cid: a.cid }));
  const extra = (opts.attachments ?? []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType }));
  return transport().sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: [...brand, ...extra],
  });
}
