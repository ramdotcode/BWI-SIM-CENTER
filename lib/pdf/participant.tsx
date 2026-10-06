import "server-only";
import path from "node:path";
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ensureFonts } from "./invoice";
import { collectDocs, exportBase, exportedLine, loadParticipant, personalSections, REG_HEAD, registrationRows, type DocFile, type FullParticipant } from "../services/participant-export";
import { todayJkt } from "../format";

const BRAND_DIR = path.join(process.cwd(), "public/brand");
const C = { teal: "#0B3B48", deep: "#072A34", tint: "#F0F5F6", line: "#D7E0E3", muted: "#5E7177", faint: "#8A9BA0", ink: "#112429", bad: "#D4443C" };
const st = StyleSheet.create({
  page: { fontFamily: "Barlow", fontSize: 8.8, color: C.ink, padding: 32, paddingBottom: 40 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  h: { fontFamily: "BarlowCondensed", fontWeight: 700, fontSize: 22, color: C.deep },
  small: { fontSize: 8.5, color: C.muted },
  sect: { fontFamily: "BarlowCondensed", fontWeight: 600, fontSize: 11, color: "#fff", backgroundColor: C.teal, paddingVertical: 2, paddingHorizontal: 6, marginTop: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: C.line },
  k: { width: 150, paddingVertical: 1.2, paddingHorizontal: 6, color: C.muted, backgroundColor: C.tint },
  v: { flex: 1, paddingVertical: 1.2, paddingHorizontal: 6 },
  th: { fontSize: 7.5, fontWeight: 600, color: C.muted, paddingVertical: 2.5, paddingHorizontal: 3, backgroundColor: C.tint },
  td: { fontSize: 7.8, paddingVertical: 2.5, paddingHorizontal: 3 },
});
const REG_W = [62, 44, 42, 0, 22, 0, 0, 0, 0, 0]; // 0 = flex
const REG_COLS = [0, 1, 2, 3, 6, 8, 9]; // kolom yang ditampilkan di PDF (tanpa jam, harga, no. invoice)

function Cover({ p, docs, by }: { p: FullParticipant; docs: DocFile[]; by: string }) {
  const photo = docs.find((d) => d.kind === "PHOTO" && d.data && d.mime !== "application/pdf");
  const regs = registrationRows(p);
  return (
    <Document title={`Data personal ${p.full_name}`} author="BWI Sim Center" creator="BWI Sim Center">
      <Page size="A4" style={st.page}>
        <View style={st.top}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image tidak memiliki prop alt */}
            <Image src={path.join(BRAND_DIR, "bwi-aviation.png")} style={{ height: 32, width: 52, marginBottom: 8 }} />
            <Text style={st.small}>DATA PERSONAL PESERTA</Text>
            <Text style={st.h}>{p.full_name}</Text>
            <Text style={st.small}>{exportedLine(by)}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {photo && <Image src={{ data: photo.data!, format: photo.mime === "image/png" ? "png" : "jpg" }} style={{ width: 70, height: 105, objectFit: "cover", borderWidth: 1, borderColor: C.line }} />}
        </View>
        {personalSections(p).map((s) => (
          <View key={s.title} wrap={false}>
            <Text style={st.sect}>{s.title}</Text>
            {s.rows.map(([k, v]) => (
              <View key={k} style={st.row}>
                <Text style={st.k}>{k}</Text>
                <Text style={st.v}>{v === "" ? "—" : String(v)}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={st.sect}>Riwayat pendaftaran</Text>
        <View style={[st.row, { borderBottomWidth: 0 }]}>
          {REG_COLS.map((i) => <Text key={i} style={[st.th, REG_W[i] ? { width: REG_W[i] } : { flex: 1 }]}>{REG_HEAD[i]}</Text>)}
        </View>
        {regs.map((r) => (
          <View key={String(r[0])} style={st.row} wrap={false}>
            {REG_COLS.map((i) => <Text key={i} style={[st.td, REG_W[i] ? { width: REG_W[i] } : { flex: 1 }]}>{String(r[i])}</Text>)}
          </View>
        ))}
        <Text style={st.sect}>Lampiran dokumen</Text>
        {docs.length === 0 && <Text style={[st.td, { color: C.muted }]}>Tidak ada dokumen.</Text>}
        {docs.map((d, i) => (
          <View key={`${d.reg_no}${d.kind}`} style={st.row}>
            <Text style={[st.td, { width: 70 }]}>Lampiran {i + 1}</Text>
            <Text style={[st.td, { width: 70 }]}>{d.reg_no}</Text>
            <Text style={[st.td, { flex: 1 }]}>{d.label}</Text>
            <Text style={[st.td, { width: 90, color: d.data ? C.ink : C.bad }]}>{d.data ? d.review : "file tidak ditemukan"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// ---------- penggabungan (pdf-lib) ----------
const A4 = { w: 595.28, h: 841.89 };
const M = 36;
const HEAD_H = 34;
/** Font standar PDF hanya WinAnsi: karakter lain diganti agar teks judul tidak gagal. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ–—•]/g, "?");

function header(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, sub: string) {
  page.drawRectangle({ x: 0, y: A4.h - HEAD_H, width: A4.w, height: HEAD_H, color: rgb(0.043, 0.231, 0.282) });
  page.drawText(safe(title), { x: M, y: A4.h - 22, size: 11, font: bold, color: rgb(1, 1, 1) });
  const w = font.widthOfTextAtSize(safe(sub), 9);
  page.drawText(safe(sub), { x: A4.w - M - w, y: A4.h - 21, size: 9, font, color: rgb(0.85, 0.95, 0.12) });
}
/** Gambar/halaman disesuaikan ke area isi A4 (di bawah judul), proporsional, di tengah. */
function fit(w: number, h: number) {
  const bw = A4.w - 2 * M;
  const bh = A4.h - HEAD_H - 2 * M;
  const s = Math.min(bw / w, bh / h, 1.6);
  const dw = w * s;
  const dh = h * s;
  return { x: (A4.w - dw) / 2, y: M + (bh - dh) / 2, width: dw, height: dh };
}

/**
 * Satu PDF per peserta (CR-06): lembar data diri + semua dokumen terbaru digabung sebagai lampiran.
 * Dibuat saat diminta, tidak disimpan (tidak menambah data/penyimpanan).
 */
export async function participantPdf(participantId: number, exportedBy: string) {
  const p = await loadParticipant(participantId);
  const docs = await collectDocs(p);
  ensureFonts();
  const cover = await renderToBuffer(<Cover p={p} docs={docs} by={exportedBy} />);

  const out = await PDFDocument.create();
  out.setTitle(`Data personal ${p.full_name}`);
  out.setCreator("BWI Sim Center");
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const coverDoc = await PDFDocument.load(cover);
  for (const pg of await out.copyPages(coverDoc, coverDoc.getPageIndices())) out.addPage(pg);

  const fail = (title: string, sub: string, msg: string) => {
    const page = out.addPage([A4.w, A4.h]);
    header(page, font, bold, title, sub);
    page.drawText(safe(msg), { x: M, y: A4.h - HEAD_H - 60, size: 11, font, color: rgb(0.83, 0.27, 0.24), maxWidth: A4.w - 2 * M, lineHeight: 15 });
  };

  for (const [i, d] of docs.entries()) {
    const title = `Lampiran ${i + 1} · ${d.label}`;
    if (!d.data) {
      fail(title, d.reg_no, "File tidak ditemukan di penyimpanan.");
      continue;
    }
    try {
      if (d.mime === "application/pdf") {
        const src = await PDFDocument.load(d.data, { ignoreEncryption: true });
        const n = src.getPageCount();
        const embedded = await out.embedPdf(src, src.getPageIndices());
        embedded.forEach((ep, j) => {
          const page = out.addPage([A4.w, A4.h]);
          header(page, font, bold, title, `${d.reg_no} · hal. ${j + 1}/${n}`);
          page.drawPage(ep, fit(ep.width, ep.height));
        });
      } else {
        const img = d.mime === "image/png" ? await out.embedPng(d.data) : await out.embedJpg(d.data);
        const page = out.addPage([A4.w, A4.h]);
        header(page, font, bold, title, d.reg_no);
        page.drawImage(img, fit(img.width, img.height));
      }
    } catch {
      fail(title, d.reg_no, "Dokumen ini tidak dapat digabung (mis. PDF terkunci/rusak). Unduh terpisah lewat ZIP atau drawer verifikasi.");
    }
  }

  const pages = out.getPages();
  pages.forEach((pg, i) => {
    const t = safe(`${p.full_name} · Halaman ${i + 1}/${pages.length}`);
    pg.drawText(t, { x: A4.w - M - font.widthOfTextAtSize(t, 7.5), y: 18, size: 7.5, font, color: rgb(0.54, 0.61, 0.63) });
  });
  const data = await out.save();
  return { filename: `${exportBase(p)}-${todayJkt()}.pdf`, data, regIds: p.registrations.map((r) => r.id), docCount: docs.length, pages: pages.length };
}
