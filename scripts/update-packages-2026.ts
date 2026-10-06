// CR-04: terapkan paket flyer 2026 ke database yang SUDAH berjalan (seed tidak menimpa paket yang ada).
// Paket baru di-upsert (harga & isi sesuai flyer, JAM masih dummy), paket dummy lama dinonaktifkan (tidak dihapus).
// Jalankan: npx tsx scripts/update-packages-2026.ts            (DATABASE_URL dari .env — PASTIKAN database tujuan benar)
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { OLD_PACKAGE_CODES, PACKAGES } from "../prisma/packages";

const db = new PrismaClient();

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");
  console.log(`Database: ${host}`);
  for (const p of PACKAGES) {
    const { price, ...rest } = p;
    const data = { ...rest, price_idr: price, active: true };
    await db.package.upsert({ where: { code: p.code }, create: data, update: data });
    console.log(`  ✓ ${p.code.padEnd(12)} ${p.name_id} · Rp ${Number(price).toLocaleString("id-ID")} · ${p.hours} jam (DUMMY)`);
  }
  const off = await db.package.updateMany({ where: { code: { in: OLD_PACKAGE_CODES } }, data: { active: false, highlight: false } });
  console.log(`  − ${off.count} paket lama dinonaktifkan (${OLD_PACKAGE_CODES.join(", ")})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
