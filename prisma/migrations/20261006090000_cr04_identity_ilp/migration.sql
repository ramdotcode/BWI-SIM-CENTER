-- CR-04 (Okt 2026): identitas boleh KTP atau paspor, kontak darurat dihapus dari form,
-- masa berlaku ICAO English Proficiency (ILP) dicatat seperti medical.
ALTER TABLE "participants" ALTER COLUMN "nik" DROP NOT NULL;
ALTER TABLE "participants" ALTER COLUMN "emergency_name" DROP NOT NULL;
ALTER TABLE "participants" ALTER COLUMN "emergency_relation" DROP NOT NULL;
ALTER TABLE "participants" ALTER COLUMN "emergency_phone" DROP NOT NULL;
ALTER TABLE "participants" ADD COLUMN "icao_valid_until" DATE;
