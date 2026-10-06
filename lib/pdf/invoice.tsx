import "server-only";
import path from "node:path";
import React from "react";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { db } from "../db";
import { getSettings, type Settings } from "../settings";
import { fmtTsDate, num, prettyPhone, rupiah } from "../format";
import { storage } from "../storage";

const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const BRAND_DIR = path.join(process.cwd(), "public/brand");
let fontsReady = false;
export function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Barlow",
    fonts: [
      { src: path.join(FONT_DIR, "Barlow-Regular.ttf") },
      { src: path.join(FONT_DIR, "Barlow-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Barlow-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "BarlowCondensed",
    fonts: [
      { src: path.join(FONT_DIR, "BarlowCondensed-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "BarlowCondensed-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "PlexMono",
    fonts: [
      { src: path.join(FONT_DIR, "IBMPlexMono-Regular.ttf") },
      { src: path.join(FONT_DIR, "IBMPlexMono-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

const C = { teal: "#0B3B48", deep: "#072A34", tint: "#F0F5F6", line: "#D7E0E3", soft: "#E8EEF0", muted: "#5E7177", faint: "#8A9BA0", ok: "#1E9E68", bad: "#D4443C", lime: "#D9F21F", ink: "#112429" };
const st = StyleSheet.create({
  page: { fontFamily: "Barlow", fontSize: 10, color: C.ink, padding: 40, paddingBottom: 50 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { height: 38, width: 62 },
  small: { fontSize: 9, color: C.muted, lineHeight: 1.4 },
  h: { fontFamily: "BarlowCondensed", fontWeight: 700, fontSize: 30, color: C.deep, textAlign: "right", letterSpacing: 1 },
  mono: { fontFamily: "PlexMono" },
  meta: { flexDirection: "row", marginTop: 22, marginBottom: 18, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line },
  k: { fontSize: 7.5, color: C.faint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  v: { fontWeight: 600 },
  th: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 600, paddingVertical: 7, paddingHorizontal: 6, backgroundColor: C.tint, borderBottomWidth: 1, borderColor: C.line },
  td: { paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: C.soft },
  box: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 12, backgroundColor: C.tint },
  stamp: { position: "absolute", top: 330, left: 64, borderWidth: 2.5, borderRadius: 5, paddingVertical: 4, paddingHorizontal: 12, fontFamily: "BarlowCondensed", fontWeight: 700, fontSize: 22, letterSpacing: 2.5, textTransform: "uppercase", transform: "rotate(-8deg)", opacity: 0.85 },
});

type Inv = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;
async function loadInvoice(id: number) {
  return db.invoice.findUnique({ where: { id }, include: { registration: { include: { participant: true, package: true, simulator: true } } } });
}

function T(l: "id" | "en") {
  const id = l === "id";
  return {
    title: "INVOICE",
    ref: (r: string) => (id ? `Ref. registrasi ${r}` : `Registration ref. ${r}`),
    billed: id ? "Ditagihkan kepada" : "Billed to",
    issued: id ? "Tanggal invoice" : "Invoice date",
    due: id ? "Jatuh tempo" : "Due date",
    licence: id ? "Lisensi" : "Licence",
    method: id ? "Metode" : "Method",
    methodV: id ? "Transfer bank, lunas" : "Bank transfer, paid in full",
    desc: id ? "Deskripsi" : "Description",
    hours: id ? "Jam" : "Hours",
    price: id ? "Harga/paket" : "Price/package",
    amount: id ? "Jumlah" : "Amount",
    itemSub: (sim: string) => (id ? `${sim} · termasuk briefing 30 mnt & debriefing · instruktur` : `${sim} · incl. 30-min briefing & debriefing · instructor`),
    subtotal: "Subtotal",
    vat: (p: number) => (id ? `PPN ${p}%` : `VAT ${p}%`),
    total: "Total",
    bank: id ? "Rekening tujuan" : "Destination account",
    confirm: id ? "Konfirmasi pembayaran" : "Payment confirmation",
    confirmD: id ? "Kirim bukti transfer + nomor invoice. Verifikasi manual oleh admin pada jam kerja." : "Send the transfer receipt + invoice number. Verified manually by admin during office hours.",
    terms: (h: number) =>
      id
        ? `Sesi dijadwalkan setelah pembayaran terverifikasi. Pembatalan ≤ ${h} jam sebelum sesi tidak dapat dikembalikan.`
        : `Sessions are scheduled after payment is verified. Cancellations ≤ ${h} hours before a session are non-refundable.`,
    paid: (d: string, by: string) => (id ? `Dibayar ${d}${by}` : `Paid ${d}${by}`),
    refund: (a: string, d: string) => (id ? `Refund ${a} · ${d}` : `Refund ${a} · ${d}`),
    stamp: { PAID: id ? "Lunas" : "Paid", CANCELLED: id ? "Dibatalkan" : "Cancelled", EXPIRED: id ? "Kedaluwarsa" : "Expired", other: id ? "Belum dibayar" : "Unpaid" },
  };
}

function InvoiceDoc({ inv, s, l }: { inv: Inv; s: Settings; l: "id" | "en" }) {
  const t = T(l);
  const r = inv.registration;
  const p = r.participant;
  const paid = inv.status === "PAID";
  const stampText = (t.stamp as Record<string, string>)[inv.status] ?? t.stamp.other;
  const stampColor = paid ? C.ok : C.bad;
  const pkgName = l === "id" ? r.package.name_id : r.package.name_en;
  const sim = r.simulator.code === "A320" ? "Airbus A320" : "Boeing 737NG";
  return (
    <Document title={`Invoice ${inv.invoice_no}`} author={s.company_name} creator="BWI Sim Center">
      <Page size="A4" style={st.page}>
        <Text style={[st.stamp, { color: stampColor, borderColor: stampColor }]}>{stampText}</Text>
        <View style={st.top}>
          <View style={{ flex: 1, maxWidth: 300, paddingRight: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image tidak memiliki prop alt */}
              <Image src={path.join(BRAND_DIR, "bwi-aviation.png")} style={st.logo} />
            </View>
            <Text style={[st.small, { marginTop: 8 }]}>{s.company_name}</Text>
            <Text style={st.small}>{s.company_address}</Text>
            <Text style={st.small}>
              {s.contact_email} · {prettyPhone(s.wa_admin_number)}
            </Text>
          </View>
          <View>
            <Text style={st.h}>{t.title}</Text>
            <Text style={[st.mono, { fontSize: 10.5, color: C.muted, textAlign: "right" }]}>{inv.invoice_no}</Text>
            <Text style={[st.small, { textAlign: "right", marginTop: 4 }]}>{t.ref(r.reg_no)}</Text>
          </View>
        </View>

        <View style={st.meta}>
          <View style={{ flex: 1.3, paddingRight: 12 }}>
            <Text style={st.k}>{t.billed}</Text>
            <Text style={st.v}>{p.full_name}</Text>
            <Text style={st.small}>{p.nik ? `NIK ${p.nik}` : `${l === "id" ? "Paspor" : "Passport"} ${p.passport_no ?? ""}`}</Text>
            <Text style={st.small}>
              {p.address}, {p.city} {p.postal_code ?? ""}
            </Text>
            <Text style={st.small}>
              {p.email} · {prettyPhone(p.whatsapp)}
            </Text>
          </View>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={st.k}>{t.issued}</Text>
            <Text style={st.v}>{fmtTsDate(inv.issued_at, l)}</Text>
            <Text style={[st.k, { marginTop: 10 }]}>{t.due}</Text>
            <Text style={st.v}>{fmtTsDate(inv.due_at, l)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.k}>{t.licence}</Text>
            <Text style={st.v}>
              {p.licence_type} · {p.licence_no}
            </Text>
            <Text style={[st.k, { marginTop: 10 }]}>{t.method}</Text>
            <Text style={st.v}>{t.methodV}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row" }}>
          <Text style={[st.th, { flex: 3 }]}>{t.desc}</Text>
          <Text style={[st.th, { flex: 0.6, textAlign: "right" }]}>{t.hours}</Text>
          <Text style={[st.th, { flex: 1.2, textAlign: "right" }]}>{t.price}</Text>
          <Text style={[st.th, { flex: 1.2, textAlign: "right" }]}>{t.amount}</Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <View style={[st.td, { flex: 3 }]}>
            <Text style={{ fontWeight: 600 }}>{pkgName}</Text>
            <Text style={st.small}>{t.itemSub(sim)}</Text>
          </View>
          <Text style={[st.td, st.mono, { flex: 0.6, textAlign: "right" }]}>{r.hours_snapshot}</Text>
          <Text style={[st.td, st.mono, { flex: 1.2, textAlign: "right" }]}>{num(inv.subtotal)}</Text>
          <Text style={[st.td, st.mono, { flex: 1.2, textAlign: "right" }]}>{num(inv.subtotal)}</Text>
        </View>

        <View style={{ alignItems: "flex-end", marginTop: 12 }}>
          <View style={{ width: 240 }}>
            <Row k={t.subtotal} v={rupiah(inv.subtotal)} />
            <Row k={t.vat(s.vat_percent)} v={rupiah(inv.vat)} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 2, borderColor: C.teal, paddingTop: 7, marginTop: 4 }}>
              <Text style={{ fontFamily: "BarlowCondensed", fontWeight: 600, fontSize: 18, color: C.deep }}>{t.total}</Text>
              <Text style={{ fontFamily: "BarlowCondensed", fontWeight: 600, fontSize: 18, color: C.deep }}>{rupiah(inv.total)}</Text>
            </View>
            {paid && inv.paid_at ? <Text style={[st.small, { textAlign: "right", marginTop: 6, color: C.ok }]}>{t.paid(fmtTsDate(inv.paid_at, l), inv.amount_received != null ? ` · ${rupiah(inv.amount_received)}` : "")}</Text> : null}
            {inv.refund_amount ? <Text style={[st.small, { textAlign: "right", marginTop: 3 }]}>{t.refund(rupiah(inv.refund_amount), inv.refund_at ? fmtTsDate(inv.refund_at, l) : "")}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", marginTop: 22 }}>
          <View style={[st.box, { marginRight: 12 }]}>
            <Text style={st.k}>{t.bank}</Text>
            <Text style={[st.mono, { fontSize: 14, fontWeight: 600, color: C.deep }]}>
              {s.bank_name} {s.bank_account}
            </Text>
            <Text style={st.small}>a.n. {s.bank_holder}</Text>
          </View>
          <View style={st.box}>
            <Text style={st.k}>{t.confirm}</Text>
            <Text style={{ fontWeight: 600 }}>WhatsApp {prettyPhone(s.wa_admin_number)}</Text>
            <Text style={st.small}>{t.confirmD}</Text>
          </View>
        </View>

        <Text style={[st.small, { color: C.faint, marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderColor: C.soft }]}>{t.terms(s.reschedule_free_hours)}</Text>
      </Page>
    </Document>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: C.muted }}>{k}</Text>
      <Text style={st.mono}>{v}</Text>
    </View>
  );
}

/**
 * PDF invoice A4. Hasil disimpan di storage (pdf_storage_key) dan dibuat ulang otomatis
 * setiap kali status/isi invoice berubah (kunci memuat status + updated_at).
 */
export async function renderInvoicePdf(invoiceId: number, locale: "id" | "en" = "id"): Promise<Buffer> {
  const inv = await loadInvoice(invoiceId);
  if (!inv) throw new Error("Invoice tidak ditemukan");
  const key = `invoices/${inv.id}/${inv.status}-${locale}-${inv.updated_at.getTime()}.pdf`;
  if (inv.pdf_storage_key === key) {
    try {
      return await storage.get(key);
    } catch {}
  }
  ensureFonts();
  const s = await getSettings();
  const buf = await renderToBuffer(<InvoiceDoc inv={inv} s={s} l={locale} />);
  await storage.put(key, buf, "application/pdf");
  await db.$executeRaw`UPDATE invoices SET pdf_storage_key = ${key} WHERE id = ${inv.id}`;
  return buf;
}
