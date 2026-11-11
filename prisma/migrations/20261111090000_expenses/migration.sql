-- Revisi klien Nov 2026 (poin 10): pencatatan pengeluaran untuk menu Keuangan (pemasukan, pengeluaran, laba rugi).
-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "spent_on" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payee" TEXT,
    "amount" BIGINT NOT NULL,
    "receipt_key" TEXT,
    "receipt_name" TEXT,
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_spent_on_idx" ON "expenses"("spent_on");

-- Aplikasi mengakses DB lewat Prisma (pemilik tabel), bukan Data API Supabase.
-- RLS tanpa policy menutup tabel ini dari akses anon/authenticated bila Data API terbuka.
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
