import "server-only";
import ExcelJS from "exceljs";
import { zipSync, type Zippable } from "fflate";
import { db } from "../db";
import { HttpError } from "../auth";
import { storage } from "../storage";
import { translator } from "../i18n/server";
import { fmtDateTime, fmtDmy, prettyPhone, todayJkt } from "../format";
import { authorityLabel } from "../columns";

const E = translator("id", "enums");
const TEAL = "FF0B3B48";
const TINT = "FFF0F5F6";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
const DOC_ORDER = ["KTP", "PASSPORT", "MEDICAL", "LICENCE_FRONT", "LICENCE_RATING", "PHOTO"];

const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "peserta";

/**
 * Data personal per orang (CR-04): ZIP berisi Excel data diri + riwayat pendaftaran (pas foto ditempel)
 * dan semua dokumen terbaru (bukan versi lama/yang diganti) per nomor pendaftaran.
 */
export async function participantZip(participantId: number, exportedBy: string) {
  const p = await db.participant.findUnique({
    where: { id: participantId },
    include: {
      registrations: {
        orderBy: { created_at: "desc" },
        include: {
          package: true,
          simulator: true,
          documents: { where: { superseded: false }, orderBy: { kind: "asc" } },
          invoices: { orderBy: { issued_at: "desc" } },
          slots: { where: { status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW"] } }, orderBy: [{ date: "asc" }, { start_time: "asc" }] },
        },
      },
    },
  });
  if (!p) throw new HttpError(404, "Peserta tidak ditemukan");

  const files: Zippable = {};
  const docRows: [string, string, string, string][] = [];
  let photo: { data: Buffer; ext: "jpeg" | "png" } | null = null;
  for (const r of p.registrations) {
    const docs = [...r.documents].sort((a, b) => DOC_ORDER.indexOf(a.kind) - DOC_ORDER.indexOf(b.kind));
    for (const [i, d] of docs.entries()) {
      const name = `${String(i + 1).padStart(2, "0")}-${slug(E(`docKind.${d.kind}`))}.${EXT[d.mime] ?? "bin"}`;
      const path = `dokumen/${r.reg_no}/${name}`;
      try {
        const data = await storage.get(d.storage_key);
        files[path] = [new Uint8Array(data), { level: d.mime === "application/pdf" ? 6 : 0 }];
        if (!photo && d.kind === "PHOTO" && d.mime !== "application/pdf") photo = { data, ext: d.mime === "image/png" ? "png" : "jpeg" };
        docRows.push([r.reg_no, E(`docKind.${d.kind}`), path, E(`docReview.${d.review}`)]);
      } catch {
        docRows.push([r.reg_no, E(`docKind.${d.kind}`), "(file tidak ditemukan di penyimpanan)", E(`docReview.${d.review}`)]);
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "BWI Sim Center";
  wb.created = new Date();

  // Sheet 1 — data diri (vertikal: label | nilai), pas foto di kanan.
  const ws = wb.addWorksheet("Data diri", { properties: { defaultRowHeight: 18 } });
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 48;
  ws.getCell("A1").value = p.full_name;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: TEAL } };
  ws.getCell("A2").value = `Data personal peserta · diekspor ${fmtDateTime(new Date(), "id", { wib: true })} oleh ${exportedBy}`;
  ws.getCell("A2").font = { size: 10, color: { argb: "FF5E7177" } };
  const d = (x: Date | null | undefined) => (x ? fmtDmy(x) : "");
  const rows: ([string, string | number] | string)[] = [
    "Identitas",
    ["Nama lengkap", p.full_name],
    ["Jenis identitas", p.nik ? "KTP" : "Paspor"],
    ["NIK", p.nik ?? ""],
    ["Nomor paspor", p.passport_no ?? ""],
    ["Tempat, tanggal lahir", `${p.birth_place}, ${d(p.birth_date)}`],
    ["Jenis kelamin", E(`gender.${p.gender}`)],
    ["Kewarganegaraan", p.nationality === "ID" ? "Indonesia" : p.nationality],
    "Kontak & alamat",
    ["WhatsApp", prettyPhone(p.whatsapp)],
    ["Email", p.email],
    ["Alamat", p.address],
    ["Kota / Kabupaten", p.city],
    ["Provinsi", p.province],
    ["Kode pos", p.postal_code ?? ""],
    "Lisensi",
    ["Jenis lisensi", p.licence_type],
    ["Nomor lisensi", p.licence_no],
    ["Otoritas penerbit", authorityLabel(p.licence_authority)],
    ["Tanggal terbit", d(p.licence_issued_at)],
    ["Instrument Rating", p.instrument_rating ? E(`instrumentRating.${p.instrument_rating}`) : ""],
    ["Type rating", p.type_ratings.join(", ")],
    ["Total jam terbang", Number(p.total_hours)],
    ["Jam terbang pada tipe", p.hours_on_type != null ? Number(p.hours_on_type) : ""],
    ["ICAO English Proficiency", p.icao_english ? E(`icao.${p.icao_english}`) : ""],
    ["ICAO English berlaku s/d", d(p.icao_valid_until)],
    ["Instansi", p.organization ?? ""],
    ["Posisi", p.position ? E(`position.${p.position}`) : ""],
    "Medical",
    ["Kelas", E(`medicalClass.${p.medical_class}`)],
    ["Nomor sertifikat", p.medical_no],
    ["Berlaku s/d", d(p.medical_valid_until)],
  ];
  let rn = 4;
  for (const r of rows) {
    const row = ws.getRow(rn++);
    if (typeof r === "string") {
      row.getCell(1).value = r;
      row.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      for (const c of [1, 2]) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      continue;
    }
    row.getCell(1).value = r[0];
    row.getCell(1).font = { color: { argb: "FF5E7177" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };
    row.getCell(2).value = r[1];
    row.getCell(2).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
  }
  if (photo) {
    ws.getColumn(4).width = 22;
    ws.getCell("D3").value = "Pas foto";
    ws.getCell("D3").font = { size: 10, color: { argb: "FF5E7177" } };
    const img = wb.addImage({ buffer: photo.data as unknown as ExcelJS.Buffer, extension: photo.ext });
    ws.addImage(img, { tl: { col: 3, row: 3 }, ext: { width: 150, height: 225 } });
  }

  // Sheet 2 — riwayat pendaftaran.
  const ws2 = wb.addWorksheet("Pendaftaran");
  const head = ["No. Reg", "Tgl daftar", "Simulator", "Paket", "Jam", "Harga", "Status", "No. invoice", "Status bayar", "Sesi terjadwal"];
  ws2.addRow(head).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  });
  for (const r of p.registrations) {
    const inv = r.invoices.find((i) => i.status !== "CANCELLED") ?? r.invoices[0];
    const row = ws2.addRow([
      r.reg_no,
      fmtDmy(r.created_at, true),
      r.simulator.code,
      r.package_name_snapshot,
      r.hours_snapshot,
      Number(r.price_snapshot),
      E(`registrationStatus.${r.status}`),
      inv?.invoice_no ?? "-",
      inv ? E(`invoiceStatus.${inv.status}`) : "-",
      r.slots.map((s) => `${fmtDmy(s.date)} ${s.start_time}`).join(", ") || "-",
    ]);
    row.getCell(6).numFmt = "#,##0";
  }
  [16, 12, 10, 36, 6, 14, 22, 24, 18, 40].forEach((w, i) => (ws2.getColumn(i + 1).width = w));

  // Sheet 3 — daftar file dokumen di dalam ZIP.
  const ws3 = wb.addWorksheet("Dokumen");
  ws3.addRow(["No. Reg", "Dokumen", "File di ZIP", "Status verifikasi"]).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
  });
  for (const r of docRows) ws3.addRow(r);
  [16, 28, 56, 18].forEach((w, i) => (ws3.getColumn(i + 1).width = w));

  const base = `Data-${slug(p.full_name)}`;
  files[`${base}.xlsx`] = [new Uint8Array(await wb.xlsx.writeBuffer()), { level: 0 }];
  const zip = zipSync(files, { level: 6 });
  return { filename: `${base}-${todayJkt()}.zip`, data: zip, regIds: p.registrations.map((r) => r.id), docCount: docRows.length };
}
