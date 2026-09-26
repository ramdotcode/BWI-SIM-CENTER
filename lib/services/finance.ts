import "server-only";
import { db } from "../db";
import { getSettings, slotsNeeded } from "../settings";
import { todayJkt, wibInstant } from "../format";
import { RECEIVABLE } from "../state-machine";

const WIB = 7 * 3600_000;
const monthOf = (d: Date) => new Date(d.getTime() + WIB).getUTCMonth();
const yearOf = (d: Date) => new Date(d.getTime() + WIB).getUTCFullYear();

/**
 * Rekap keuangan — hanya invoice yang pernah LUNAS (paid_at), dikurangi refund (bulan refund_at).
 * Invoice dibatalkan setelah lunas tetap dihitung pemasukannya lalu refund tampil negatif.
 */
export async function financeData(year: number) {
  const s = await getSettings();
  const from = wibInstant(`${year}-01-01`);
  const to = wibInstant(`${year + 1}-01-01`);
  const [paid, refunds, receivable, issuedAll] = await Promise.all([
    db.invoice.findMany({ where: { paid_at: { gte: from, lt: to } }, include: { registration: { include: { participant: true, package: true, simulator: true } } }, orderBy: { paid_at: "desc" } }),
    db.invoice.findMany({ where: { refund_at: { gte: from, lt: to }, refund_amount: { gt: 0 } }, include: { registration: { include: { package: true, simulator: true } } } }),
    db.invoice.findMany({ where: { status: { in: RECEIVABLE } }, select: { total: true } }),
    db.invoice.findMany({ where: { issued_at: { gte: from, lt: to } }, select: { issued_at: true, status: true } }),
  ]);
  const amount = (i: { amount_received: bigint | null; total: bigint }) => Number(i.amount_received ?? i.total);
  const months = Array.from({ length: 12 }, () => ({ gross: 0, refund: 0, net: 0, paidCount: 0, issued: 0 }));
  for (const i of paid) {
    const m = months[monthOf(i.paid_at!)]!;
    m.gross += amount(i);
    m.paidCount++;
  }
  for (const r of refunds) months[monthOf(r.refund_at!)]!.refund += Number(r.refund_amount);
  for (const i of issuedAll) months[monthOf(i.issued_at)]!.issued++;
  for (const m of months) m.net = m.gross - m.refund;

  const ytd = months.reduce((a, m) => a + m.net, 0);
  const today = todayJkt();
  const curMonth = Number(today.slice(0, 4)) === year ? Number(today.slice(5, 7)) - 1 : 11;
  const sessions = paid.reduce((a, i) => a + slotsNeeded(i.registration.hours_snapshot, s.slot_minutes), 0);

  const mix = new Map<string, number>();
  const bySim = { A320: 0, B737: 0 } as Record<string, number>;
  for (const i of paid) {
    mix.set(i.registration.package.code, (mix.get(i.registration.package.code) ?? 0) + amount(i));
    bySim[i.registration.simulator.code] = (bySim[i.registration.simulator.code] ?? 0) + amount(i);
  }
  for (const r of refunds) {
    mix.set(r.registration.package.code, (mix.get(r.registration.package.code) ?? 0) - Number(r.refund_amount));
    bySim[r.registration.simulator.code] = (bySim[r.registration.simulator.code] ?? 0) - Number(r.refund_amount);
  }
  const pkgs = await db.package.findMany({ orderBy: { sort: "asc" } });
  const mixTotal = [...mix.values()].reduce((a, b) => a + b, 0) || 1;
  const simTotal = (bySim.A320 ?? 0) + (bySim.B737 ?? 0) || 1;

  const verifiers = await db.adminUser.findMany({ select: { id: true, name: true } });
  return {
    year,
    curMonth,
    months,
    kpi: {
      ytd,
      ytdCount: paid.length,
      month: months[curMonth]!,
      receivable: receivable.reduce((a, i) => a + Number(i.total), 0),
      receivableCount: receivable.length,
      avgPerSession: sessions ? Math.round(ytd / sessions) : 0,
      slotHours: s.slot_minutes / 60,
    },
    mix: pkgs.map((p) => ({ code: p.code, name_id: `${p.short_id} (${p.hours} jam)`, name_en: `${p.short_en} (${p.hours} h)`, pct: Math.round(((mix.get(p.code) ?? 0) / mixTotal) * 100) })),
    ratio: { A320: Math.round(((bySim.A320 ?? 0) / simTotal) * 100), B737: Math.round(((bySim.B737 ?? 0) / simTotal) * 100) },
    recent: paid.slice(0, 10).map((i) => ({
      id: i.id,
      paid_at: i.paid_at!,
      no: i.invoice_no,
      name: i.registration.participant.full_name,
      sim: i.registration.simulator.code,
      pkg: `${i.registration.package.short_id} ${i.registration.hours_snapshot}j`,
      amount: amount(i),
      refund: Number(i.refund_amount ?? 0),
      verifier: verifiers.find((v) => v.id === i.verified_by)?.name ?? "—",
      proof: !!i.proof_storage_key,
    })),
    years: await availableYears(),
  };
}

async function availableYears() {
  const first = await db.invoice.findFirst({ orderBy: { issued_at: "asc" }, select: { issued_at: true } });
  const cur = Number(todayJkt().slice(0, 4));
  const start = first ? yearOf(first.issued_at) : cur;
  return Array.from({ length: cur - start + 1 }, (_, i) => cur - i);
}
