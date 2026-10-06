-- CR-05 (Okt 2026): blok jadwal selain maintenance ("Lainnya", keterangan teks bebas di maintenance_reason).
ALTER TABLE "slots" ADD COLUMN "block_kind" TEXT;
