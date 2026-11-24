-- ============================================================================
-- SADEWA PHASE 4: POSTGRESQL ROW-LEVEL SECURITY UNTUK TABEL GIS TENANT
-- ============================================================================
-- Melengkapi `phase3_shared_rls_policies.sql` untuk seluruh tabel spasial milik
-- tenant (`villageId` isolation). `GisRegionCatalog` sengaja dikecualikan karena
-- merupakan katalog referensi wilayah tingkat platform (shared read-only).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_tables TEXT[] := ARRAY[
    'GisTenantConfig',
    'GisVillageBoundary',
    'GisRoad',
    'GisInfrastructure',
    'GisPotentialArea',
    'GisDataSource',
    'GisImportJob',
    'GisChangeLog'
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
