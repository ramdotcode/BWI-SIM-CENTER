import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { getSettings } from "../settings";
import { todayJkt } from "../format";
import { financeData } from "./finance";

/**
 * Pengeluaran & laba rugi (revisi klien Nov 2026, poin 10). Hanya Super Admin.
 * Pengeluaran dicatat manual per tanggal (kolom DATE, WIB) → bulan = bulan tanggal itu.
 * Pemasukan = rekap yang sudah ada (invoice lunas dikurangi refund, `financeData`).
 */

export type ExpenseFilter = { month?: number; category?: string };

export function expenseWhere(year: number, f: ExpenseFilter = {}): Prisma.ExpenseWhereInput {
  const from = f.month != null ? new Date(Date.UTC(year, f.month, 1)) : new Date(Date.UTC(year, 0, 1));
  const to = f.month != null ? new Date(Date.UTC(year, f.month + 1, 1)) : new Date(Date.UTC(year + 1, 0, 1));
  return { spent_on: { gte: from, lt: to }, ...(f.category ? { category: f.category } : {}) };
}

export async function expenseData(year: number, f: ExpenseFilter = {}) {
  const [all, admins] = await Promise.all([
    db.expense.findMany({ where: expenseWhere(year), orderBy: [{ spent_on: "desc" }, { id: "desc" }] }),
    db.adminUser.findMany({ select: { id: true, name: true } }),
  ]);
  const months = Array.from({ length: 12 }, () => 0);
  const byCat = new Map<string, number>();
  for (const e of all) {
    months[e.spent_on.getUTCMonth()]! += Number(e.amount);
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount));
  }
  const total = months.reduce((a, b) => a + b, 0);
  const categories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount, pct: total ? Math.round((amount / total) * 100) : 0 }));
  const rows = all
    .filter((e) => (f.month == null || e.spent_on.getUTCMonth() === f.month) && (!f.category || e.category === f.category))
    .map((e) => ({
      id: e.id,
      spent_on: e.spent_on.toISOString().slice(0, 10),
      category: e.category,
      description: e.description,
      payee: e.payee ?? "",
      amount: Number(e.amount),
      receipt: e.receipt_key ? (e.receipt_name ?? "nota") : null,
      by: admins.find((a) => a.id === (e.updated_by ?? e.created_by))?.name ?? "—",
    }));
  return { year, months, total, count: all.length, categories, rows, rowsTotal: rows.reduce((a, r) => a + r.amount, 0) };
}

/**
 * Laba rugi per bulan: pemasukan bersih − pengeluaran = laba sebelum pajak; pajak dari setting.
 * - income_tax_base = PROFIT: pajak bulanan = % × laba bulan itu (bulan rugi = 0); total setahun = % × laba setahun
 *   (rugi di satu bulan mengurangi laba bulan lain), jadi jumlah pajak bulanan bisa berbeda dari total tahunan.
 * - income_tax_base = REVENUE: pajak = % × pemasukan bersih (mis. PPh final 0,5% dari omzet).
 */
export async function profitLossData(year: number) {
  const [fin, exp, s] = await Promise.all([financeData(year), expenseData(year), getSettings()]);
  const pct = Math.max(0, Number(s.income_tax_percent) || 0);
  const base = s.income_tax_base === "REVENUE" ? "REVENUE" : "PROFIT";
  const taxOf = (revenue: number, profit: number) => Math.round((pct / 100) * Math.max(0, base === "REVENUE" ? revenue : profit));
  const months = fin.months.map((m, i) => {
    const revenue = m.net;
    const expense = exp.months[i]!;
    const profit = revenue - expense;
    const tax = taxOf(revenue, profit);
    return { revenue, expense, profit, tax, after: profit - tax, margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null };
  });
  const sum = (k: "revenue" | "expense" | "profit") => months.reduce((a, m) => a + m[k], 0);
  const revenue = sum("revenue"), expense = sum("expense"), profit = sum("profit");
  const tax = taxOf(revenue, profit);
  const monthlyTaxSum = months.reduce((a, m) => a + m.tax, 0);
  const cy = Number(todayJkt().slice(0, 4));
  return {
    year,
    curMonth: fin.curMonth,
    shownMonths: year === cy ? fin.curMonth + 1 : year > cy ? 0 : 12,
    months,
    total: { revenue, expense, profit, tax, after: profit - tax, margin: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null },
    tax: { pct, base, differs: tax !== monthlyTaxSum },
    years: fin.years,
  };
}
