import "server-only";
import ExcelJS from "exceljs";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { db } from "./db";
import { COLUMNS, regInclude, type ColType } from "./columns";
import { translator } from "./i18n/server";
import { fmtDateTime, monthLong, todayJkt, wibInstant } from "./format";
import { financeData } from "./services/finance";

const E = translator("id", "enums");
const WIB = 7 * 3600_000;
const wib = (d: Date | null | undefined) => (d ? new Date(d.getTime() + WIB) : null);
const HEADER_ROW = 5;
const TEAL = "FF0B3B48";
const TINT = "FFF0F5F6";

type Def = { h: string; type: ColType; w?: number };

function sheet(wb: ExcelJS.Workbook, name: string, defs: Def[], rows: unknown[][], meta: string[] | null, freezeCols = 0) {
  const ws = wb.addWorksheet(name, { properties: { defaultRowHeight: 16 } });
  if (meta) {
    meta.slice(0, 3).forEach((m, i) => {
      const c = ws.getCell(i + 1, 1);
      c.value = m;
      c.font = i === 0 ? { bold: true, size: 12, color: { argb: TEAL } } : { size: 10, color: { argb: "FF5E7177" } };
    });
  }
  const start = meta ? HEADER_ROW : 1;
  const hr = ws.getRow(start);
  defs.forEach((d, i) => {
    const c = hr.getCell(i + 1);
    c.value = d.h;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { vertical: "middle" };
  });
  hr.height = 20;
  rows.forEach((r, ri) => {
    const row = ws.getRow(start + 1 + ri);
    r.forEach((v, ci) => {
      const c = row.getCell(ci + 1);
      c.value = (v ?? null) as ExcelJS.CellValue;
      const t = defs[ci]!.type;
      if (t === "date") c.numFmt = "dd/mm/yyyy";
      else if (t === "money") c.numFmt = "#,##0";
      else if (t === "number") c.numFmt = "#,##0.0";
    });
    if (ri % 2 === 1) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } }));
  });
  // Lebar kolom otomatis
  defs.forEach((d, i) => {
    let w = d.h.length;
    for (const r of rows) {
      const v = r[i];
      const len = v instanceof Date ? 10 : typeof v === "number" ? String(Math.round(v)).length + 3 : String(v ?? "").length;
      if (len > w) w = len;
    }
    ws.getColumn(i + 1).width = d.w ?? Math.min(48, Math.max(8, w + 2));
  });
  ws.views = [{ state: "frozen", ySplit: start, xSplit: freezeCols }];
  if (defs.length) ws.autoFilter = { from: { row: start, column: 1 }, to: { row: start, column: defs.length } };
  return ws;
}

export type ExportFilter = { period: string; sim?: string; status?: string; q?: string };

export function regWhere(f: ExportFilter): Prisma.RegistrationWhereInput {
  const w: Prisma.RegistrationWhereInput = {};
  if (/^\d{4}-\d{2}$/.test(f.period)) {
    const [y, m] = f.period.split("-").map(Number) as [number, number];
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    w.created_at = { gte: wibInstant(`${f.period}-01`), lt: wibInstant(next) };
  } else if (/^\d{4}$/.test(f.period)) {
    w.created_at = { gte: wibInstant(`${f.period}-01-01`), lt: wibInstant(`${Number(f.period) + 1}-01-01`) };
  }
  if (f.sim === "A320" || f.sim === "B737") w.simulator = { code: f.sim };
  if (f.status) w.status = f.status as RegistrationStatus;
  if (f.q) w.OR = [{ reg_no: { contains: f.q, mode: "insensitive" } }, { participant: { full_name: { contains: f.q, mode: "insensitive" } } }, { participant: { email: { contains: f.q, mode: "insensitive" } } }, { participant: { nik: { contains: f.q } } }];
  return w;
}

function periodLabel(p: string) {
  if (/^\d{4}-\d{2}$/.test(p)) return `${monthLong(Number(p.slice(5)) - 1, "id")} ${p.slice(0, 4)}`;
  if (/^\d{4}$/.test(p)) return `Tahun ${p}`;
  return "Semua periode";
}
function metaLines(title: string, f: ExportFilter, adminName: string) {
  return [
    `BWI Sim Center — ${title}`,
    `Filter: periode ${periodLabel(f.period)} · simulator ${f.sim || "semua"} · status ${f.status ? E(`registrationStatus.${f.status}`) : "semua"}${f.q ? ` · cari "${f.q}"` : ""}`,
    `Diekspor ${fmtDateTime(new Date(), "id")} oleh ${adminName} (Super Admin)`,
  ];
}

/** bwi-sim_peserta_{YYYY-MM}.xlsx — sheet Peserta, Pembayaran, Sesi, Ringkasan. */
export async function participantsWorkbook(f: ExportFilter, adminName: string) {
  const regs = await db.registration.findMany({ where: regWhere(f), include: regInclude, orderBy: { created_at: "asc" } });
  const wb = new ExcelJS.Workbook();
  wb.creator = "BWI Sim Center";
  wb.created = new Date();

  sheet(wb, "Peserta", COLUMNS.map((c) => ({ h: c.id, type: c.type })), regs.map((r) => COLUMNS.map((c) => c.get(r))), metaLines("Database Peserta", f, adminName), 3);

  const regIds = regs.map((r) => r.id);
  const invs = await db.invoice.findMany({ where: { registration_id: { in: regIds } }, include: { registration: { include: { participant: true, package: true, simulator: true } } }, orderBy: { issued_at: "asc" } });
  await paymentsSheet(wb, invs, null);

  const slots = await db.slot.findMany({
    where: { registration_id: { in: regIds }, status: { in: ["SCHEDULED", "COMPLETED", "NO_SHOW", "CANCELLED"] } },
    include: { simulator: true, instructor: true, registration: { include: { participant: true, package: true } } },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
  await sessionsSheet(wb, slots);
  await summarySheet(wb, Number(f.period.slice(0, 4)) || Number(todayJkt().slice(0, 4)));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** bwi-sim_keuangan_{YYYY}.xlsx — Ringkasan per bulan + Pembayaran. */
export async function financeWorkbook(year: number, adminName: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BWI Sim Center";
  const fd = await financeData(year);
  const meta = [`BWI Sim Center — Rekap Keuangan ${year}`, `Filter: periode Tahun ${year} · hanya invoice LUNAS dikurangi refund`, `Diekspor ${fmtDateTime(new Date(), "id")} oleh ${adminName} (Super Admin)`];
  await summarySheet(wb, year, meta);
  const from = wibInstant(`${year}-01-01`);
  const to = wibInstant(`${year + 1}-01-01`);
  const invs = await db.invoice.findMany({ where: { OR: [{ issued_at: { gte: from, lt: to } }, { paid_at: { gte: from, lt: to } }] }, include: { registration: { include: { participant: true, package: true, simulator: true } } }, orderBy: { issued_at: "asc" } });
  await paymentsSheet(wb, invs, null);
  const ws = wb.addWorksheet("Komposisi");
  ws.addRow(["Paket", "Porsi pendapatan (%)"]).font = { bold: true };
  fd.mix.forEach((m) => ws.addRow([m.name_id, m.pct]));
  ws.addRow([]);
  ws.addRow(["A320 : B737", `${fd.ratio.A320}% : ${fd.ratio.B737}%`]);
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 22;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function paymentsSheet(wb: ExcelJS.Workbook, invs: Prisma.InvoiceGetPayload<{ include: { registration: { include: { participant: true; package: true; simulator: true } } } }>[], meta: string[] | null) {
  const admins = await db.adminUser.findMany({ select: { id: true, name: true } });
  const defs: Def[] = [
    { h: "No. invoice", type: "mono" }, { h: "No. Reg", type: "mono" }, { h: "Nama", type: "text" }, { h: "Simulator", type: "text" }, { h: "Paket", type: "text" },
    { h: "Terbit", type: "date" }, { h: "Jatuh tempo", type: "date" }, { h: "Subtotal", type: "money" }, { h: "PPN", type: "money" }, { h: "Total", type: "money" },
    { h: "Status", type: "text" }, { h: "Tgl konfirmasi WA", type: "date" }, { h: "Nominal diterima", type: "money" }, { h: "Tgl lunas", type: "date" }, { h: "Verifikator", type: "text" },
    { h: "Refund", type: "money" }, { h: "Catatan", type: "text" },
  ];
  sheet(
    wb,
    "Pembayaran",
    defs,
    invs.map((i) => [
      i.invoice_no, i.registration.reg_no, i.registration.participant.full_name, i.registration.simulator.code, i.registration.package.short_id,
      wib(i.issued_at), wib(i.due_at), Number(i.subtotal), Number(i.vat), Number(i.total),
      E(`invoiceStatus.${i.status}`), wib(i.wa_confirmed_at), i.amount_received != null ? Number(i.amount_received) : null, wib(i.paid_at), admins.find((a) => a.id === i.verified_by)?.name ?? "",
      i.refund_amount ? -Number(i.refund_amount) : null, i.note ?? "",
    ]),
    meta,
    1,
  );
}

async function sessionsSheet(wb: ExcelJS.Workbook, slots: Prisma.SlotGetPayload<{ include: { simulator: true; instructor: true; registration: { include: { participant: true; package: true } } } }>[]) {
  const admins = await db.adminUser.findMany({ select: { id: true, name: true } });
  sheet(
    wb,
    "Sesi",
    [
      { h: "ID slot", type: "number", w: 9 }, { h: "Simulator", type: "text" }, { h: "Tanggal", type: "date" }, { h: "Jam", type: "mono" }, { h: "Status", type: "text" },
      { h: "No. Reg", type: "mono" }, { h: "Nama", type: "text" }, { h: "Paket", type: "text" }, { h: "Instruktur", type: "text" }, { h: "Bay", type: "text" },
      { h: "Hasil", type: "text" }, { h: "Catatan", type: "text" }, { h: "Diubah oleh", type: "text" },
    ],
    slots.map((s) => [
      s.id, s.simulator.code, s.date, `${s.start_time}–${s.end_time}`, E(`slotStatus.${s.status}`),
      s.registration?.reg_no ?? "", s.registration?.participant.full_name ?? "", s.registration?.package.short_id ?? "", s.instructor?.name ?? "", s.simulator.bay,
      ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(s.status) ? E(`slotStatus.${s.status}`) : "", s.result_note ?? "", admins.find((a) => a.id === s.updated_by)?.name ?? "",
    ]),
    null,
    1,
  ).getColumn(1).numFmt = "0";
}

async function summarySheet(wb: ExcelJS.Workbook, year: number, meta: string[] | null = null) {
  const fd = await financeData(year);
  const from = wibInstant(`${year}-01-01`);
  const to = wibInstant(`${year + 1}-01-01`);
  const [open, slots] = await Promise.all([
    db.invoice.findMany({ where: { issued_at: { gte: from, lt: to }, status: { in: ["UNPAID", "AWAITING_VERIFICATION", "OVERDUE"] } }, select: { issued_at: true, total: true } }),
    db.slot.findMany({ where: { date: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${year + 1}-01-01T00:00:00Z`) } }, select: { date: true, status: true, simulator: { select: { code: true } } } }),
  ]);
  const rows = fd.months.map((m, i) => {
    const ms = slots.filter((s) => s.date.getUTCMonth() === i);
    const busy = (x: { status: string }) => ["SCHEDULED", "COMPLETED", "NO_SHOW"].includes(x.status);
    const cap = ms.filter((s) => s.status !== "MAINTENANCE").length;
    const receivable = open.filter((o) => new Date(o.issued_at.getTime() + WIB).getUTCMonth() === i).reduce((a, o) => a + Number(o.total), 0);
    return [
      `${monthLong(i, "id")} ${year}`, m.issued, m.paidCount, m.gross, m.refund ? -m.refund : 0, m.net, receivable,
      ms.filter((s) => busy(s) && s.simulator.code === "A320").length, ms.filter((s) => busy(s) && s.simulator.code === "B737").length,
      cap ? Math.round((ms.filter(busy).length / cap) * 1000) / 10 : 0,
    ];
  });
  const tot = rows.reduce<number[]>((a, r) => r.slice(1).map((v, i) => (a[i] ?? 0) + Number(v)), []);
  rows.push(["TOTAL", ...tot.slice(0, 8), 0]);
  (rows[12] as unknown[])[9] = null;
  const ws = sheet(
    wb,
    "Ringkasan",
    [
      { h: "Bulan", type: "text" }, { h: "Invoice terbit", type: "number" }, { h: "Invoice lunas", type: "number" }, { h: "Nominal lunas", type: "money" }, { h: "Refund", type: "money" },
      { h: "Pendapatan bersih", type: "money" }, { h: "Piutang", type: "money" }, { h: "Sesi A320", type: "number" }, { h: "Sesi B737", type: "number" }, { h: "Utilisasi %", type: "number" },
    ],
    rows,
    meta,
    1,
  );
  [2, 3, 8, 9].forEach((c) => (ws.getColumn(c).numFmt = "0"));
  const last = ws.lastRow;
  if (last) last.font = { bold: true };
}

export function exportFileName(kind: string, period: string) {
  const p = /^\d{4}(-\d{2})?$/.test(period) ? period : todayJkt().slice(0, 7);
  return `bwi-sim_${kind}_${p}.xlsx`;
}
