-- ============================================================================
-- SADEWA PHASE 3: POSTGRESQL ROW-LEVEL SECURITY (DEFENSE-IN-DEPTH)
-- ============================================================================
-- Kebijakan RLS ini melengkapi Prisma `$extends` di level database pada cluster
-- Shared Database. Saat `runWithTenantRlsTransaction` mengeksekusi:
--   SELECT set_config('app.current_tenant_id', '<tenantId>', true)
-- PostgreSQL otomatis memastikan query hanya dapat membaca/memodifikasi baris
-- dengan `"villageId" = current_setting('app.current_tenant_id', true)`.
--
-- Catatan transisi aman:
-- - Ketika `app.current_tenant_id` tidak disetel / kosong (misal query CLI/seed
--   atau fase single-tenant sebelum cutover), kebijakan fallback mengizinkan akses
--   reguler agar operasional eksisting tidak putus; sedangkan ketika `app.current_tenant_id`
--   terisi selama eksekusi request tenant, isolasi baris diberlakukan secara ketat.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_table TEXT;
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
    EXECUTE format('ALTER TABLE "sadewa".%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS sadewa_tenant_isolation_policy ON "sadewa".%I', v_table);
    EXECUTE format(
      'CREATE POLICY sadewa_tenant_isolation_policy ON "sadewa".%I
       USING (
         COALESCE(NULLIF(current_setting(''app.current_tenant_id'', true), ''''), "villageId") = "villageId"
       )
       WITH CHECK (
         COALESCE(NULLIF(current_setting(''app.current_tenant_id'', true), ''''), "villageId") = "villageId"
       )',
      v_table
    );
  END LOOP;
END $$;

COMMIT;
