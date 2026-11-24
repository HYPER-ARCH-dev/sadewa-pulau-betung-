-- ============================================================================
-- SADEWA PHASE 4: UNIVERSAL MULTI-TENANT GIS FOUNDATION (ADDITIVE ONLY)
-- ============================================================================
-- PENTING: File migrasi ini bersifat ADDITIVE dan idempoten.
-- Jangan dijalankan ke database produksi sebelum ditinjau & disetujui DBA/Admin.
-- ============================================================================

BEGIN;

ALTER TABLE "sadewa"."VillageProfile"
  ADD COLUMN IF NOT EXISTS "regionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "spatialMetadata" JSONB;

ALTER TABLE "sadewa"."MapFacility"
  ADD COLUMN IF NOT EXISTS "importJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "geometryGeoJson" JSONB;

ALTER TABLE "sadewa"."LandParcel"
  ADD COLUMN IF NOT EXISTS "importJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "geometryGeoJson" JSONB;

CREATE TABLE IF NOT EXISTS "sadewa"."GisRegionCatalog" (
  "id" TEXT NOT NULL,
  "regionCode" TEXT NOT NULL,
  "provinceCode" TEXT NOT NULL,
  "provinceName" TEXT NOT NULL,
  "regencyCode" TEXT NOT NULL,
  "regencyName" TEXT NOT NULL,
  "districtCode" TEXT NOT NULL,
  "districtName" TEXT NOT NULL,
  "villageName" TEXT NOT NULL,
  "sourceName" TEXT,
  "sourceYear" INTEGER,
  "centroidLat" DOUBLE PRECISION,
  "centroidLng" DOUBLE PRECISION,
  "bbox" JSONB,
  "defaultGeometryGeoJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisRegionCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GisRegionCatalog_regionCode_key"
  ON "sadewa"."GisRegionCatalog"("regionCode");
CREATE INDEX IF NOT EXISTS "GisRegionCatalog_provinceCode_regencyCode_districtCode_idx"
  ON "sadewa"."GisRegionCatalog"("provinceCode", "regencyCode", "districtCode");

CREATE TABLE IF NOT EXISTS "sadewa"."GisTenantConfig" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "regionCode" TEXT,
  "centerLat" DOUBLE PRECISION,
  "centerLng" DOUBLE PRECISION,
  "defaultZoom" INTEGER NOT NULL DEFAULT 14,
  "bbox" JSONB,
  "defaultMapMode" TEXT NOT NULL DEFAULT 'roadmap',
  "activeProviderId" TEXT,
  "showVillageBoundary" BOOLEAN NOT NULL DEFAULT true,
  "boundaryColor" TEXT NOT NULL DEFAULT '#ec4899',
  "customSatelliteTileUrl" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisTenantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GisTenantConfig_villageId_key"
  ON "sadewa"."GisTenantConfig"("villageId");
CREATE INDEX IF NOT EXISTS "GisTenantConfig_villageId_idx"
  ON "sadewa"."GisTenantConfig"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisVillageBoundary" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "regionCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'BELUM_TERVERIFIKASI',
  "sourceType" TEXT NOT NULL DEFAULT 'ADMIN_DIGITIZED',
  "sourceName" TEXT,
  "sourceYear" INTEGER,
  "licenseNote" TEXT,
  "geometryGeoJson" JSONB NOT NULL,
  "bbox" JSONB,
  "centroidLat" DOUBLE PRECISION,
  "centroidLng" DOUBLE PRECISION,
  "areaSqM" DOUBLE PRECISION,
  "perimeterMeters" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "importJobId" TEXT,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisVillageBoundary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisVillageBoundary_villageId_idx"
  ON "sadewa"."GisVillageBoundary"("villageId");
CREATE INDEX IF NOT EXISTS "GisVillageBoundary_villageId_isActive_idx"
  ON "sadewa"."GisVillageBoundary"("villageId", "isActive");

CREATE TABLE IF NOT EXISTS "sadewa"."GisRoad" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "name" TEXT NOT NULL,
  "roadClass" TEXT,
  "surfaceType" TEXT,
  "lengthMeters" DOUBLE PRECISION,
  "geometryGeoJson" JSONB NOT NULL,
  "importJobId" TEXT,
  "sourceType" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisRoad_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisRoad_villageId_idx"
  ON "sadewa"."GisRoad"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisInfrastructure" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "conditionStatus" TEXT,
  "geometryGeoJson" JSONB NOT NULL,
  "importJobId" TEXT,
  "sourceType" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisInfrastructure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisInfrastructure_villageId_idx"
  ON "sadewa"."GisInfrastructure"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisPotentialArea" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "name" TEXT NOT NULL,
  "sector" TEXT NOT NULL,
  "areaSqM" DOUBLE PRECISION,
  "geometryGeoJson" JSONB NOT NULL,
  "importJobId" TEXT,
  "sourceType" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisPotentialArea_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisPotentialArea_villageId_idx"
  ON "sadewa"."GisPotentialArea"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisDataSource" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "name" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "licenseName" TEXT,
  "licenseUrl" TEXT,
  "sourceYear" INTEGER,
  "attributionText" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisDataSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisDataSource_villageId_idx"
  ON "sadewa"."GisDataSource"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisImportJob" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "targetLayer" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileFormat" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "totalFeatures" INTEGER NOT NULL DEFAULT 0,
  "importedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisImportJob_villageId_idx"
  ON "sadewa"."GisImportJob"("villageId");

CREATE TABLE IF NOT EXISTS "sadewa"."GisChangeLog" (
  "id" TEXT NOT NULL,
  "villageId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "previousSnapshot" JSONB,
  "newSnapshot" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GisChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GisChangeLog_villageId_entityType_idx"
  ON "sadewa"."GisChangeLog"("villageId", "entityType");

COMMIT;
