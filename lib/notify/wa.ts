import "server-only";
import { waDigits } from "../format";

/**
 * Pengirim WhatsApp. Fase 1 (default, Q7): MANUAL_PREFILL → tidak mengirim apa pun,
 * notifikasi dicatat status MANUAL + tautan wa.me berisi pesan, admin mengirim dari panel.
 * Fase 2: provider API (Fonnte/Wablas/Twilio) — implementasikan WaSender dan pilih lewat env WA_PROVIDER.
 */
export interface WaSender {
  readonly mode: "MANUAL" | "API";
  send(to: string, text: string): Promise<{ ok: boolean; error?: string }>;
}

export function waLink(to: string, text: string) {
  return `https://wa.me/${waDigits(to)}?text=${encodeURIComponent(text)}`;
}

class ManualSender implements WaSender {
  readonly mode = "MANUAL" as const;
  async send() {
    return { ok: true };
  }
}

class FonnteSender implements WaSender {
  readonly mode = "API" as const;
  async send(to: string, text: string) {
    const token = process.env.FONNTE_TOKEN;
    if (!token) return { ok: false, error: "FONNTE_TOKEN belum di-set" };
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: new URLSearchParams({ target: waDigits(to), message: text, countryCode: "62" }),
    }).catch((e) => ({ ok: false, statusText: String(e) }) as Response);
    return r.ok ? { ok: true } : { ok: false, error: r.statusText || "Gagal kirim WA" };
  }
}

export function waSender(mode: "MANUAL_PREFILL" | "API"): WaSender {
  if (mode === "API" && process.env.WA_PROVIDER === "fonnte") return new FonnteSender();
  return new ManualSender();
}
