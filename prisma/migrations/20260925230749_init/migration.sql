-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "LicenceType" AS ENUM ('SPL', 'PPL', 'CPL', 'ATPL', 'MPL');

-- CreateEnum
CREATE TYPE "InstrumentRating" AS ENUM ('VALID', 'EXPIRED', 'NONE');

-- CreateEnum
CREATE TYPE "IcaoLevel" AS ENUM ('L4', 'L5', 'L6', 'NONE');

-- CreateEnum
CREATE TYPE "MedicalClass" AS ENUM ('C1', 'C2');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('id', 'en');

-- CreateEnum
CREATE TYPE "PrefTime" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING_VERIFICATION', 'REUPLOAD_REQUIRED', 'PENDING_PAYMENT', 'EXPIRED', 'PAID', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('KTP', 'MEDICAL', 'LICENCE_FRONT', 'LICENCE_RATING', 'PHOTO', 'PASSPORT');

-- CreateEnum
CREATE TYPE "DocumentReview" AS ENUM ('PENDING', 'OK', 'REJECTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'AWAITING_VERIFICATION', 'PAID', 'OVERDUE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'SCHEDULED', 'MAINTENANCE', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('DASHBOARD', 'REUPLOAD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WA', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'SYSTEM', 'PARTICIPANT');

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "simulators" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bay" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'FTD',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "simulators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "short_id" TEXT NOT NULL,
    "short_en" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "price_idr" BIGINT NOT NULL,
    "description_id" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "bullets_id" JSONB NOT NULL DEFAULT '[]',
    "bullets_en" JSONB NOT NULL DEFAULT '[]',
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "simulator_codes" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "nik" CHAR(16) NOT NULL,
    "passport_no" TEXT,
    "birth_place" TEXT NOT NULL,
    "birth_date" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "nationality" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT,
    "emergency_name" TEXT NOT NULL,
    "emergency_relation" TEXT NOT NULL,
    "emergency_phone" TEXT NOT NULL,
    "licence_type" "LicenceType" NOT NULL,
    "licence_no" TEXT NOT NULL,
    "licence_authority" TEXT NOT NULL,
    "licence_issued_at" DATE NOT NULL,
    "instrument_rating" "InstrumentRating",
    "type_ratings" TEXT[],
    "total_hours" DECIMAL(7,1) NOT NULL,
    "hours_on_type" DECIMAL(7,1),
    "icao_english" "IcaoLevel",
    "organization" TEXT,
    "position" TEXT,
    "medical_class" "MedicalClass" NOT NULL,
    "medical_no" TEXT NOT NULL,
    "medical_valid_until" DATE NOT NULL,
    "medical_center" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'id',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" SERIAL NOT NULL,
    "reg_no" TEXT NOT NULL,
    "participant_id" INTEGER NOT NULL,
    "simulator_id" INTEGER NOT NULL,
    "package_id" INTEGER NOT NULL,
    "hours_snapshot" INTEGER NOT NULL,
    "price_snapshot" BIGINT NOT NULL,
    "package_name_snapshot" TEXT NOT NULL,
    "pref_date_from" DATE,
    "pref_date_to" DATE,
    "pref_time" "PrefTime" NOT NULL DEFAULT 'FLEXIBLE',
    "purpose" TEXT,
    "notes" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verified_by" INTEGER,
    "verified_at" TIMESTAMP(3),
    "rejection_note" TEXT,
    "reupload_count" INTEGER NOT NULL DEFAULT 0,
    "cancelled_reason" TEXT,
    "affected_by_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "schedule_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review" "DocumentReview" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "superseded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_uploads" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pending_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "vat" BIGINT NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "wa_confirmed_at" TIMESTAMP(3),
    "proof_storage_key" TEXT,
    "amount_received" BIGINT,
    "paid_at" TIMESTAMP(3),
    "verified_by" INTEGER,
    "note" TEXT,
    "overdue_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "refund_amount" BIGINT,
    "refund_at" TIMESTAMP(3),
    "refund_proof_key" TEXT,
    "pdf_storage_key" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" SERIAL NOT NULL,
    "simulator_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "registration_id" INTEGER,
    "instructor_id" INTEGER,
    "maintenance_reason" TEXT,
    "result_note" TEXT,
    "report_storage_key" TEXT,
    "reminder_h1_at" TIMESTAMP(3),
    "reminder_h0_at" TIMESTAMP(3),
    "updated_by" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_history" (
    "id" SERIAL NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "from_status" "SlotStatus" NOT NULL,
    "to_status" "SlotStatus" NOT NULL,
    "from_registration_id" INTEGER,
    "to_registration_id" INTEGER,
    "by" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "slot_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_tokens" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "purpose" "TokenPurpose" NOT NULL DEFAULT 'DASHBOARD',
    "token_hash" TEXT NOT NULL,
    "token_enc" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "registration_id" INTEGER,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'id',
    "recipient" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulators_code_key" ON "simulators"("code");

-- CreateIndex
CREATE UNIQUE INDEX "packages_code_key" ON "packages"("code");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "participants_nik_key" ON "participants"("nik");

-- CreateIndex
CREATE INDEX "participants_email_idx" ON "participants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_reg_no_key" ON "registrations"("reg_no");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_created_at_idx" ON "registrations"("created_at");

-- CreateIndex
CREATE INDEX "documents_registration_id_kind_idx" ON "documents"("registration_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_issued_at_idx" ON "invoices"("issued_at");

-- CreateIndex
CREATE INDEX "slots_date_idx" ON "slots"("date");

-- CreateIndex
CREATE INDEX "slots_registration_id_idx" ON "slots"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "slots_simulator_id_date_start_time_key" ON "slots"("simulator_id", "date", "start_time");

-- CreateIndex
CREATE INDEX "slot_history_at_idx" ON "slot_history"("at");

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_hash_key" ON "access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "access_tokens_registration_id_purpose_idx" ON "access_tokens"("registration_id", "purpose");

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- CreateIndex
CREATE INDEX "notifications_registration_id_idx" ON "notifications"("registration_id");

-- CreateIndex
CREATE INDEX "notifications_channel_status_idx" ON "notifications"("channel", "status");

-- CreateIndex
CREATE INDEX "activity_log_entity_entity_id_idx" ON "activity_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "activity_log_at_idx" ON "activity_log"("at");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_simulator_id_fkey" FOREIGN KEY ("simulator_id") REFERENCES "simulators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_simulator_id_fkey" FOREIGN KEY ("simulator_id") REFERENCES "simulators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_history" ADD CONSTRAINT "slot_history_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
