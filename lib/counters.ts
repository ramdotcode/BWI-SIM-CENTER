import "server-only";
import type { DbOrTx } from "./db";

/** Penomoran atomik: INSERT … ON CONFLICT DO UPDATE … RETURNING. Nomor tidak pernah dipakai ulang. */
export async function nextCounter(tx: DbOrTx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO counters (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = counters.value + 1
    RETURNING value`;
  return Number(rows[0]!.value);
}

/** REG-YYYY-NNNN */
export async function nextRegNo(tx: DbOrTx, year: number): Promise<string> {
  const n = await nextCounter(tx, `REG-${year}`);
  return `REG-${year}-${String(n).padStart(4, "0")}`;
}
/** BWI/INV/YYYY/MM/NNNN (counter per bulan) */
export async function nextInvoiceNo(tx: DbOrTx, year: number, month: number): Promise<string> {
  const mm = String(month).padStart(2, "0");
  const n = await nextCounter(tx, `INV-${year}-${mm}`);
  return `BWI/INV/${year}/${mm}/${String(n).padStart(4, "0")}`;
}
