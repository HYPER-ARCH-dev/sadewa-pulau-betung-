-- ============================================================================
-- SADEWA PHASE 2: CONSTRAINT CUTOVER SQL (POST-BACKFILL ONLY)
-- ============================================================================
-- PRASYARAT WAJIB SEBELUM MENJALANKAN SCRIPT INI:
-- 1. Backup snapshot Supabase PITR & jalankan JSON backup penuh.
-- 2. Pastikan schema Phase 1+2 telah diterapkan (`prisma db push`).
-- 3. Jalankan `npx tsx scripts/backfill_pulau_betung_tenant.ts`.
-- 4. Pastikan `npx tsx scripts/verify_migration_consistency.ts` LULUS (0 NULL).
-- 5. Pastikan kode pemanggil di Phase 3 sudah memakai composite key `[villageId, ...]`
--    sebelum menghapus constraint `@unique` tunggal di bagian B.
-- ============================================================================

BEGIN;

-- ============================================================================
-- BAGIAN A: GUARD ASSERTION — GAGALKAN JIKA MASIH ADA BARIS TANPA villageId
-- ============================================================================
DO $$
DECLARE
  v_table TEXT;
  v_null_count BIGINT;
  v_tables TEXT[] := ARRAY[
    'User', 'VillageProfile', 'Dusun', 'RW', 'RT',
    'VillageService', 'ServiceRequest', 'DeletedServiceRequest',
    'Complaint', 'Resident', 'BansosRecipient',
    'NewsItem', 'Announcement', 'AgendaItem', 'GalleryItem',
    'BudgetYearData', 'DevelopmentProject', 'VillagePotential', 'UmkmItem',
    'VillageOfficial', 'MapFacility', 'LandParcel',
    'ToddlerRecord', 'ToddlerMeasurement', 'PosyanduSchedule',
    'AuditLog', 'AttendanceLog'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('SELECT COUNT(*) FROM "sadewa".%I WHERE "villageId" IS NULL', v_table) INTO v_null_count;
    IF v_null_count > 0 THEN
      RAISE EXCEPTION 'CUTOVER DIBATALKAN: Tabel "%" masih memiliki % baris dengan villageId IS NULL. Jalankan backfill terlebih dahulu!', v_table, v_null_count;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- BAGIAN B: PENGETATAN KOLOM villageId MENJADI NOT NULL
-- ============================================================================
ALTER TABLE "sadewa"."User" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."VillageProfile" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."Dusun" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."RW" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."RT" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."VillageService" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."ServiceRequest" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."DeletedServiceRequest" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."Complaint" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."Resident" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."BansosRecipient" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."NewsItem" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."Announcement" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."AgendaItem" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."GalleryItem" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."BudgetYearData" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."DevelopmentProject" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."VillagePotential" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."UmkmItem" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."VillageOfficial" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."MapFacility" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."LandParcel" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."ToddlerRecord" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."ToddlerMeasurement" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."PosyanduSchedule" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."AuditLog" ALTER COLUMN "villageId" SET NOT NULL;
ALTER TABLE "sadewa"."AttendanceLog" ALTER COLUMN "villageId" SET NOT NULL;

-- ============================================================================
-- BAGIAN C: SWAP LEGACY GLOBAL @unique KE COMPOSITE UNIQUE PER TENANT
-- (Composite index `*_villageId_*_key` sudah dibuat oleh schema Phase 2)
-- ============================================================================
DROP INDEX IF EXISTS "sadewa"."User_username_key";
DROP INDEX IF EXISTS "sadewa"."User_email_key";
DROP INDEX IF EXISTS "sadewa"."User_officialId_key";
DROP INDEX IF EXISTS "sadewa"."ServiceRequest_trackingCode_key";
DROP INDEX IF EXISTS "sadewa"."ServiceRequest_officialLetterNumber_key";
DROP INDEX IF EXISTS "sadewa"."Complaint_ticketNumber_key";
DROP INDEX IF EXISTS "sadewa"."Resident_nik_key";
DROP INDEX IF EXISTS "sadewa"."NewsItem_slug_key";
DROP INDEX IF EXISTS "sadewa"."BudgetYearData_year_documentType_key";
DROP INDEX IF EXISTS "sadewa"."LandParcel_nop_key";
DROP INDEX IF EXISTS "sadewa"."ToddlerRecord_nik_key";
DROP INDEX IF EXISTS "sadewa"."ToddlerRecord_kmsCardNumber_key";

COMMIT;

-- ============================================================================
-- ROLLBACK SQL DARURAT (HANYA SEBELUM TENANT KEDUA DITAMBAHKAN)
-- ============================================================================
-- BEGIN;
-- CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "sadewa"."User"("username");
-- CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "sadewa"."User"("email");
-- CREATE UNIQUE INDEX IF NOT EXISTS "User_officialId_key" ON "sadewa"."User"("officialId");
-- CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequest_trackingCode_key" ON "sadewa"."ServiceRequest"("trackingCode");
-- CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequest_officialLetterNumber_key" ON "sadewa"."ServiceRequest"("officialLetterNumber");
-- CREATE UNIQUE INDEX IF NOT EXISTS "Complaint_ticketNumber_key" ON "sadewa"."Complaint"("ticketNumber");
-- CREATE UNIQUE INDEX IF NOT EXISTS "Resident_nik_key" ON "sadewa"."Resident"("nik");
-- CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_slug_key" ON "sadewa"."NewsItem"("slug");
-- CREATE UNIQUE INDEX IF NOT EXISTS "BudgetYearData_year_documentType_key" ON "sadewa"."BudgetYearData"("year", "documentType");
-- CREATE UNIQUE INDEX IF NOT EXISTS "LandParcel_nop_key" ON "sadewa"."LandParcel"("nop");
-- CREATE UNIQUE INDEX IF NOT EXISTS "ToddlerRecord_nik_key" ON "sadewa"."ToddlerRecord"("nik");
-- CREATE UNIQUE INDEX IF NOT EXISTS "ToddlerRecord_kmsCardNumber_key" ON "sadewa"."ToddlerRecord"("kmsCardNumber");
-- COMMIT;
