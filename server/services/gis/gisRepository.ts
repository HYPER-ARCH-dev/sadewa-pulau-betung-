import { PrismaClient } from '@prisma/client';
import {
  getPrisma,
  isDatabaseAvailableCached,
  isJsonFallbackAllowed,
  runWithTenantRlsTransaction
} from '../../db/prisma-helpers';
import { getCurrentTenantContext, isMultiTenantRoutingEnabled } from '../../db/tenantContext';
import { getDb, saveDb } from '../../db/database';
import { sanitizeDiagnosticMessage } from '../../db/connection-diagnostic';
import {
  GisBootstrapPayload,
  GisBoundingBox,
  GisTenantConfig,
  GisVillageBoundary,
  MapMode,
  GeoJsonPolygonGeometry,
  BoundaryVerificationStatus,
  BoundarySourceType,
  CreateVillageBoundaryInput,
  UpdateVillageBoundaryInput
} from '../../../src/types/webgis';
import { calculatePolygonAreaShoelace } from '../../../src/utils/geometryEngine';

const VALID_MAP_MODES: Set<MapMode> = new Set(['roadmap', 'satellite', 'hybrid', 'terrain']);

export function isMissingGisSchemaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  const code = String(e.code || e.meta?.code || '');
  if (code === 'P2021' || code === 'P2022' || code === '42P01' || code === '42703') {
    return true;
  }
  const msg = String(e.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    (msg.includes('relation') && msg.includes('not found')) ||
    (msg.includes('column') && msg.includes('not exist'))
  );
}

function isValidCoordPair(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function parseBBox(raw: unknown): GisBoundingBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = nums;
  if (!isValidCoordPair(minLat, minLng) || !isValidCoordPair(maxLat, maxLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  if (!lower || lower === 'localhost' || lower === '::1' || lower === '[::1]') return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true;
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^169\.254\./.test(lower) || /^192\.168\./.test(lower)) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(lower);
  if (match172) {
    const second = Number.parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function validateCustomSatelliteTileUrl(raw: unknown): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const trimmed = String(raw).trim();
  if (trimmed.length > 500) {
    throw new Error('URL sumber citra satelit terlalu panjang (maksimal 500 karakter).');
  }
  // Ganti sementara placeholder tile agar lolos parser URL standar
  const probeUrl = trimmed
    .replace(/\{s\}/gi, 'a')
    .replace(/\{z\}/gi, '1')
    .replace(/\{x\}/gi, '1')
    .replace(/\{y\}/gi, '1')
    .replace(/\{-y\}/gi, '1');

  let parsed: URL;
  try {
    parsed = new URL(probeUrl);
  } catch {
    throw new Error('Format URL sumber citra satelit tidak valid.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('URL sumber citra satelit wajib menggunakan protokol https://.');
  }

  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error('Hostname sumber citra satelit tidak diizinkan (alamat lokal/internal ditolak).');
  }

  if (!trimmed.includes('{z}') || !trimmed.includes('{x}') || !trimmed.includes('{y}')) {
    throw new Error('Template URL tile wajib memuat placeholder {z}, {x}, dan {y}.');
  }

  return trimmed;
}

function computeCentroidFromPoints(points: [number, number][]): [number, number] | null {
  const valid = points.filter(([lat, lng]) => isValidCoordPair(lat, lng));
  if (valid.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of valid) {
    sumLat += lat;
    sumLng += lng;
  }
  return [sumLat / valid.length, sumLng / valid.length];
}

function computeBBoxFromPoints(points: [number, number][]): GisBoundingBox | null {
  const valid = points.filter(([lat, lng]) => isValidCoordPair(lat, lng));
  if (valid.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of valid) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function buildDefaultConfig(overrides?: Partial<GisTenantConfig>): GisTenantConfig {
  return {
    regionCode: overrides?.regionCode ?? null,
    centerLat: overrides?.centerLat ?? null,
    centerLng: overrides?.centerLng ?? null,
    defaultZoom: overrides?.defaultZoom ?? 14,
    bbox: overrides?.bbox ?? null,
    defaultMapMode: overrides?.defaultMapMode ?? 'roadmap',
    activeProviderId: overrides?.activeProviderId ?? null,
    showVillageBoundary: overrides?.showVillageBoundary ?? true,
    boundaryColor: overrides?.boundaryColor ?? '#ec4899',
    customSatelliteTileUrl: overrides?.customSatelliteTileUrl ?? null
  };
}

function extractDerivablePointsFromJsonFallback(db: ReturnType<typeof getDb>): [number, number][] {
  const points: [number, number][] = [];
  if (Array.isArray(db.facilities)) {
    for (const fac of db.facilities) {
      if (Array.isArray(fac?.coordinates) && fac.coordinates.length >= 2) {
        const lat = Number(fac.coordinates[0]);
        const lng = Number(fac.coordinates[1]);
        if (isValidCoordPair(lat, lng)) points.push([lat, lng]);
      }
    }
  }
  if (Array.isArray(db.landParcels)) {
    for (const parcel of db.landParcels) {
      if (Array.isArray(parcel?.coordinates)) {
        for (const pt of parcel.coordinates) {
          if (Array.isArray(pt) && pt.length >= 2) {
            const lat = Number(pt[0]);
            const lng = Number(pt[1]);
            if (isValidCoordPair(lat, lng)) points.push([lat, lng]);
          }
        }
      }
    }
  }
  return points;
}

export async function checkGisTablesReady(): Promise<boolean> {
  if (!(await isDatabaseAvailableCached())) {
    return false;
  }
  try {
    const prisma = getPrisma() as unknown as {
      gisTenantConfig: { count: () => Promise<number> };
      gisVillageBoundary: { count: () => Promise<number> };
    };
    await Promise.all([prisma.gisTenantConfig.count(), prisma.gisVillageBoundary.count()]);
    return true;
  } catch (err) {
    if (isMissingGisSchemaError(err)) {
      return false;
    }
    return false;
  }
}

export async function getPublicGisBootstrap(): Promise<GisBootstrapPayload> {
  const ctx = getCurrentTenantContext();
  const tenantId = ctx?.tenantId || 'default';
  const fallbackVillageName = ctx?.tenantName || 'Desa';

  if (!(await isDatabaseAvailableCached())) {
    if (isJsonFallbackAllowed()) {
      const db = getDb();
      const profile = db.villageProfile;
      const villageName = profile?.villageName || fallbackVillageName;
      const officeLat = profile?.officeLocation?.lat;
      const officeLng = profile?.officeLocation?.lng;

      if (db.gisTenantConfig) {
        const activeBoundary = (db.gisVillageBoundaries || []).find((b: any) => b.isActive) || null;
        return {
          tenantId,
          villageName,
          regionCode: db.gisTenantConfig.regionCode || '15.04.05.2009',
          config: buildDefaultConfig(db.gisTenantConfig),
          activeBoundary,
          hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
          dataSource: 'database'
        };
      }

      if (isValidCoordPair(officeLat, officeLng)) {
        return {
          tenantId,
          villageName,
          regionCode: '15.04.05.2009',
          config: buildDefaultConfig({
            regionCode: '15.04.05.2009',
            centerLat: Number(officeLat),
            centerLng: Number(officeLng),
            defaultZoom: 15
          }),
          activeBoundary: null,
          hasVerifiedBoundary: false,
          dataSource: 'derived_profile'
        };
      }

      const fallbackPoints = extractDerivablePointsFromJsonFallback(db);
      const centroid = computeCentroidFromPoints(fallbackPoints);
      if (centroid) {
        return {
          tenantId,
          villageName,
          regionCode: null,
          config: buildDefaultConfig({
            centerLat: centroid[0],
            centerLng: centroid[1],
            defaultZoom: 14,
            bbox: computeBBoxFromPoints(fallbackPoints)
          }),
          activeBoundary: null,
          hasVerifiedBoundary: false,
          dataSource: 'derived_profile'
        };
      }

      return {
        tenantId,
        villageName,
        regionCode: null,
        config: buildDefaultConfig({ defaultZoom: 5 }),
        activeBoundary: null,
        hasVerifiedBoundary: false,
        dataSource: 'neutral_fallback'
      };
    }

    return {
      tenantId,
      villageName: fallbackVillageName,
      regionCode: null,
      config: buildDefaultConfig({ defaultZoom: 5 }),
      activeBoundary: null,
      hasVerifiedBoundary: false,
      dataSource: 'neutral_fallback'
    };
  }

  const prisma = getPrisma();

  // Hanya select kolom pra-migrasi yang pasti ada sebelum SQL Phase 4 dijalankan
  const safeProfile = await prisma.villageProfile
    .findFirst({
      select: {
        villageName: true,
        officeLocation: true
      },
      orderBy: { lastUpdated: 'desc' }
    })
    .catch(() => null);

  let profileRegionCode: string | null = null;
  try {
    const extProfile = await (prisma.villageProfile as any).findFirst({
      select: { regionCode: true },
      orderBy: { lastUpdated: 'desc' }
    });
    if (extProfile?.regionCode) {
      profileRegionCode = String(extProfile.regionCode);
    }
  } catch (err) {
    if (!isMissingGisSchemaError(err)) {
      console.warn('⚠️ [GIS-REPO] Gagal membaca regionCode profil:', sanitizeDiagnosticMessage(String(err)));
    }
  }

  let dbConfigRow: any = null;
  let dbBoundaryRow: any = null;

  try {
    dbConfigRow = await (prisma as any).gisTenantConfig.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
  } catch (err) {
    if (!isMissingGisSchemaError(err)) {
      console.warn('⚠️ [GIS-REPO] Gagal membaca GisTenantConfig:', sanitizeDiagnosticMessage(String(err)));
    }
  }

  try {
    dbBoundaryRow = await (prisma as any).gisVillageBoundary.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
  } catch (err) {
    if (!isMissingGisSchemaError(err)) {
      console.warn('⚠️ [GIS-REPO] Gagal membaca GisVillageBoundary:', sanitizeDiagnosticMessage(String(err)));
    }
  }

  const villageName = safeProfile?.villageName || fallbackVillageName;
  const regionCode = dbConfigRow?.regionCode || dbBoundaryRow?.regionCode || profileRegionCode || null;

  const activeBoundary: GisVillageBoundary | null = dbBoundaryRow
    ? {
        id: String(dbBoundaryRow.id),
        regionCode: dbBoundaryRow.regionCode ?? null,
        status: (dbBoundaryRow.status === 'TERVERIFIKASI' ? 'TERVERIFIKASI' : 'BELUM_TERVERIFIKASI') as BoundaryVerificationStatus,
        sourceType: (dbBoundaryRow.sourceType || 'UNKNOWN') as BoundarySourceType,
        sourceName: dbBoundaryRow.sourceName ?? null,
        sourceYear: typeof dbBoundaryRow.sourceYear === 'number' ? dbBoundaryRow.sourceYear : null,
        licenseNote: dbBoundaryRow.licenseNote ?? null,
        geometryGeoJson: dbBoundaryRow.geometryGeoJson as GeoJsonPolygonGeometry,
        bbox: parseBBox(dbBoundaryRow.bbox),
        centroidLat: typeof dbBoundaryRow.centroidLat === 'number' ? dbBoundaryRow.centroidLat : null,
        centroidLng: typeof dbBoundaryRow.centroidLng === 'number' ? dbBoundaryRow.centroidLng : null,
        areaSqM: typeof dbBoundaryRow.areaSqM === 'number' ? dbBoundaryRow.areaSqM : null,
        perimeterMeters: typeof dbBoundaryRow.perimeterMeters === 'number' ? dbBoundaryRow.perimeterMeters : null,
        isActive: Boolean(dbBoundaryRow.isActive),
        verifiedBy: dbBoundaryRow.verifiedBy ?? null,
        verifiedAt: dbBoundaryRow.verifiedAt ? new Date(dbBoundaryRow.verifiedAt).toISOString() : null,
        updatedAt: dbBoundaryRow.updatedAt ? new Date(dbBoundaryRow.updatedAt).toISOString() : undefined
      }
    : null;

  if (dbConfigRow) {
    const modeCandidate = String(dbConfigRow.defaultMapMode || 'roadmap') as MapMode;
    return {
      tenantId,
      villageName,
      regionCode,
      config: buildDefaultConfig({
        id: String(dbConfigRow.id),
        regionCode,
        centerLat: typeof dbConfigRow.centerLat === 'number' ? dbConfigRow.centerLat : activeBoundary?.centroidLat ?? null,
        centerLng: typeof dbConfigRow.centerLng === 'number' ? dbConfigRow.centerLng : activeBoundary?.centroidLng ?? null,
        defaultZoom: typeof dbConfigRow.defaultZoom === 'number' ? dbConfigRow.defaultZoom : 14,
        bbox: parseBBox(dbConfigRow.bbox) ?? activeBoundary?.bbox ?? null,
        defaultMapMode: VALID_MAP_MODES.has(modeCandidate) ? modeCandidate : 'roadmap',
        activeProviderId: dbConfigRow.activeProviderId ?? null,
        showVillageBoundary: dbConfigRow.showVillageBoundary !== false,
        boundaryColor: dbConfigRow.boundaryColor || '#ec4899',
        customSatelliteTileUrl: dbConfigRow.customSatelliteTileUrl ?? null
      }),
      activeBoundary,
      hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
      dataSource: 'database'
    };
  }

  // Derivasi aman dari profil kantor desa (tanpa mengarang batas desa)
  const officeLoc = safeProfile?.officeLocation as { lat?: number; lng?: number } | null | undefined;
  if (officeLoc && isValidCoordPair(officeLoc.lat, officeLoc.lng)) {
    return {
      tenantId,
      villageName,
      regionCode,
      config: buildDefaultConfig({
        regionCode,
        centerLat: Number(officeLoc.lat),
        centerLng: Number(officeLoc.lng),
        defaultZoom: 15
      }),
      activeBoundary,
      hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
      dataSource: 'derived_profile'
    };
  }

  // Derivasi dari titik fasilitas / persil tanah yang sudah ada di DB tenant aktif
  const [facRows, parcelRows] = await Promise.all([
    prisma.mapFacility.findMany({ select: { coordinates: true }, take: 50 }).catch(() => []),
    prisma.landParcel.findMany({ select: { coordinates: true }, take: 50 }).catch(() => [])
  ]);

  const points: [number, number][] = [];
  for (const row of facRows) {
    if (Array.isArray(row.coordinates) && row.coordinates.length >= 2) {
      const lat = Number(row.coordinates[0]);
      const lng = Number(row.coordinates[1]);
      if (isValidCoordPair(lat, lng)) points.push([lat, lng]);
    }
  }
  for (const row of parcelRows) {
    if (Array.isArray(row.coordinates)) {
      for (const pt of row.coordinates as unknown[]) {
        if (Array.isArray(pt) && pt.length >= 2) {
          const lat = Number(pt[0]);
          const lng = Number(pt[1]);
          if (isValidCoordPair(lat, lng)) points.push([lat, lng]);
        }
      }
    }
  }

  const centroid = computeCentroidFromPoints(points);
  if (centroid) {
    return {
      tenantId,
      villageName,
      regionCode,
      config: buildDefaultConfig({
        regionCode,
        centerLat: centroid[0],
        centerLng: centroid[1],
        defaultZoom: 14,
        bbox: computeBBoxFromPoints(points)
      }),
      activeBoundary,
      hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
      dataSource: 'derived_profile'
    };
  }

  return {
    tenantId,
    villageName,
    regionCode,
    config: buildDefaultConfig({
      regionCode,
      defaultZoom: 5
    }),
    activeBoundary,
    hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
    dataSource: 'neutral_fallback'
  };
}

export interface UpdateTenantGisConfigInput {
  regionCode?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  defaultZoom?: number;
  bbox?: GisBoundingBox | null;
  defaultMapMode?: MapMode;
  activeProviderId?: string | null;
  showVillageBoundary?: boolean;
  boundaryColor?: string;
  customSatelliteTileUrl?: string | null;
}

export async function upsertTenantGisConfig(
  input: UpdateTenantGisConfigInput,
  actor: { userId: string; userName: string }
): Promise<GisTenantConfig> {
  const ctx = getCurrentTenantContext();
  if (isMultiTenantRoutingEnabled() && !ctx?.tenantId) {
    const err = new Error('Konteks desa aktif tidak ditemukan untuk menyimpan konfigurasi GIS.') as Error & {
      statusCode?: number;
    };
    err.statusCode = 403;
    throw err;
  }

  const validatedSatelliteUrl =
    input.customSatelliteTileUrl !== undefined
      ? validateCustomSatelliteTileUrl(input.customSatelliteTileUrl)
      : undefined;

  if (input.centerLat !== undefined && input.centerLat !== null) {
    if (typeof input.centerLat !== 'number' || !Number.isFinite(input.centerLat) || input.centerLat < -90 || input.centerLat > 90) {
      throw new Error('Nilai centerLat tidak valid (-90 sampai 90).');
    }
  }
  if (input.centerLng !== undefined && input.centerLng !== null) {
    if (typeof input.centerLng !== 'number' || !Number.isFinite(input.centerLng) || input.centerLng > 180 || input.centerLng < -180) {
      throw new Error('Nilai centerLng tidak valid (-180 sampai 180).');
    }
  }

  let validatedZoom: number | undefined;
  if (input.defaultZoom !== undefined) {
    const z = Math.round(Number(input.defaultZoom));
    if (!Number.isFinite(z) || z < 1 || z > 19) {
      throw new Error('Nilai defaultZoom harus antara 1 hingga 19.');
    }
    validatedZoom = z;
  }

  let validatedMode: MapMode | undefined;
  if (input.defaultMapMode !== undefined) {
    if (!VALID_MAP_MODES.has(input.defaultMapMode)) {
      throw new Error('Mode peta default harus salah satu dari: roadmap, satellite, hybrid, terrain.');
    }
    validatedMode = input.defaultMapMode;
  }

  let validatedColor: string | undefined;
  if (input.boundaryColor !== undefined) {
    const cleanColor = String(input.boundaryColor).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(cleanColor)) {
      throw new Error('Warna garis batas wilayah wajib format heksadesimal #RRGGBB.');
    }
    validatedColor = cleanColor.toLowerCase();
  }

  const validatedBBox = input.bbox !== undefined ? (input.bbox === null ? null : parseBBox(input.bbox)) : undefined;
  if (input.bbox !== undefined && input.bbox !== null && !validatedBBox) {
    throw new Error('Format bbox tidak valid (harus [minLng, minLat, maxLng, maxLat]).');
  }

  const scopedVillageId = ctx?.tenantId || 'default';
  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  // Jalur Database PostgreSQL / Supabase
  if (dbAvailable && tablesReady) {
    const saved = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      const existing = await (tx as any).gisTenantConfig.findFirst({
        orderBy: { updatedAt: 'desc' }
      });

      const dataPayload: Record<string, unknown> = {
        villageId: scopedVillageId
      };
      if (input.regionCode !== undefined) {
        dataPayload.regionCode = input.regionCode ? String(input.regionCode).trim() : null;
      }
      if (input.centerLat !== undefined) dataPayload.centerLat = input.centerLat;
      if (input.centerLng !== undefined) dataPayload.centerLng = input.centerLng;
      if (validatedZoom !== undefined) dataPayload.defaultZoom = validatedZoom;
      if (validatedBBox !== undefined) dataPayload.bbox = validatedBBox;
      if (validatedMode !== undefined) dataPayload.defaultMapMode = validatedMode;
      if (input.activeProviderId !== undefined) {
        dataPayload.activeProviderId = input.activeProviderId ? String(input.activeProviderId).trim() : null;
      }
      if (input.showVillageBoundary !== undefined) {
        dataPayload.showVillageBoundary = Boolean(input.showVillageBoundary);
      }
      if (validatedColor !== undefined) dataPayload.boundaryColor = validatedColor;
      if (validatedSatelliteUrl !== undefined) {
        dataPayload.customSatelliteTileUrl = validatedSatelliteUrl;
      }

      const row = existing
        ? await (tx as any).gisTenantConfig.update({
            where: { id: existing.id },
            data: dataPayload
          })
        : await (tx as any).gisTenantConfig.create({
            data: dataPayload
          });

      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'GIS_CONFIG',
          entityId: String(row.id),
          action: existing ? 'UPDATE' : 'CREATE',
          afterData: {
            regionCode: row.regionCode,
            centerLat: row.centerLat,
            centerLng: row.centerLng,
            defaultZoom: row.defaultZoom,
            defaultMapMode: row.defaultMapMode,
            showVillageBoundary: row.showVillageBoundary,
            boundaryColor: row.boundaryColor
          },
          changedBy: actor.userId,
          changedByName: actor.userName
        }
      });

      return row;
    });

    return buildDefaultConfig({
      id: String(saved.id),
      regionCode: saved.regionCode ?? null,
      centerLat: typeof saved.centerLat === 'number' ? saved.centerLat : null,
      centerLng: typeof saved.centerLng === 'number' ? saved.centerLng : null,
      defaultZoom: typeof saved.defaultZoom === 'number' ? saved.defaultZoom : 14,
      bbox: parseBBox(saved.bbox),
      defaultMapMode: (VALID_MAP_MODES.has(saved.defaultMapMode) ? saved.defaultMapMode : 'roadmap') as MapMode,
      activeProviderId: saved.activeProviderId ?? null,
      showVillageBoundary: saved.showVillageBoundary !== false,
      boundaryColor: saved.boundaryColor || '#ec4899',
      customSatelliteTileUrl: saved.customSatelliteTileUrl ?? null
    });
  }

  // Jalur Fallback JSON Storage (Dev / Preview resilience)
  if (isJsonFallbackAllowed()) {
    const db = getDb();
    const current = db.gisTenantConfig || {
      id: 'gis-cfg-pulau-betung',
      regionCode: '15.04.05.2009',
      centerLat: -1.5562,
      centerLng: 103.4475,
      defaultZoom: 14,
      defaultMapMode: 'roadmap',
      activeProviderId: 'openfreemap',
      showVillageBoundary: true,
      boundaryColor: '#ec4899'
    };

    const updated: GisTenantConfig = {
      ...current,
      regionCode: input.regionCode !== undefined ? (input.regionCode ? String(input.regionCode).trim() : null) : current.regionCode,
      centerLat: input.centerLat !== undefined ? input.centerLat : current.centerLat,
      centerLng: input.centerLng !== undefined ? input.centerLng : current.centerLng,
      defaultZoom: validatedZoom !== undefined ? validatedZoom : current.defaultZoom,
      bbox: validatedBBox !== undefined ? validatedBBox : current.bbox,
      defaultMapMode: validatedMode !== undefined ? validatedMode : current.defaultMapMode,
      activeProviderId: input.activeProviderId !== undefined ? (input.activeProviderId ? String(input.activeProviderId).trim() : null) : current.activeProviderId,
      showVillageBoundary: input.showVillageBoundary !== undefined ? Boolean(input.showVillageBoundary) : current.showVillageBoundary,
      boundaryColor: validatedColor !== undefined ? validatedColor : current.boundaryColor,
      customSatelliteTileUrl: validatedSatelliteUrl !== undefined ? validatedSatelliteUrl : current.customSatelliteTileUrl
    };

    db.gisTenantConfig = updated;
    if (!Array.isArray(db.gisChangeLogs)) db.gisChangeLogs = [];
    db.gisChangeLogs.unshift({
      id: `gis-log-${Date.now()}`,
      villageId: scopedVillageId,
      entityType: 'GIS_CONFIG',
      entityId: updated.id || 'gis-cfg-pulau-betung',
      action: 'UPDATE',
      changedBy: actor.userId,
      changedByName: actor.userName,
      createdAt: new Date().toISOString()
    });
    saveDb(db);
    return buildDefaultConfig(updated);
  }

  throw new Error('Database belum terhubung dan mode JSON fallback tidak diizinkan.');
}

// ============================================================================
// BOUNDARY MANAGEMENT SERVICES (TAHAP 2)
// ============================================================================

export function validateAndParseGeoJsonPolygon(geometry: unknown): {
  geometryGeoJson: GeoJsonPolygonGeometry;
  centroidLat: number;
  centroidLng: number;
  bbox: GisBoundingBox;
  areaSqM: number;
  perimeterMeters: number;
} {
  if (!geometry || typeof geometry !== 'object') {
    throw new Error('Geometri GeoJSON tidak valid (wajib berupa objek JSON).');
  }
  const geo = geometry as GeoJsonPolygonGeometry;
  if (geo.type !== 'Polygon' && geo.type !== 'MultiPolygon') {
    throw new Error('Tipe geometri GeoJSON batas wilayah harus berupa Polygon atau MultiPolygon.');
  }
  if (!Array.isArray(geo.coordinates) || geo.coordinates.length === 0) {
    throw new Error('Koordinat geometri GeoJSON tidak boleh kosong.');
  }

  // Ambil ring luar poligon
  let rawRing: unknown[] = [];
  if (geo.type === 'Polygon') {
    rawRing = Array.isArray(geo.coordinates[0]) ? (geo.coordinates[0] as unknown[]) : [];
  } else if (geo.type === 'MultiPolygon') {
    rawRing =
      Array.isArray(geo.coordinates[0]) && Array.isArray((geo.coordinates[0] as unknown[])[0])
        ? ((geo.coordinates[0] as unknown[])[0] as unknown[])
        : [];
  }

  if (rawRing.length < 3) {
    throw new Error('Poligon batas wilayah wajib memiliki minimal 3 titik koordinat.');
  }

  const convertedPoints: [number, number][] = [];
  for (const pt of rawRing) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const num0 = Number(pt[0]);
    const num1 = Number(pt[1]);
    if (!Number.isFinite(num0) || !Number.isFinite(num1)) continue;

    // Deteksi dan konversi standar GeoJSON [lng, lat] ke SADEWA [lat, lng]
    let lat: number;
    let lng: number;
    if (Math.abs(num0) > Math.abs(num1)) {
      lng = num0;
      lat = num1;
    } else {
      lat = num0;
      lng = num1;
    }

    if (isValidCoordPair(lat, lng)) {
      convertedPoints.push([lat, lng]);
    }
  }

  // Hilangkan titik penutup duplikat di akhir jika ada
  if (convertedPoints.length > 3) {
    const first = convertedPoints[0];
    const last = convertedPoints[convertedPoints.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
      convertedPoints.pop();
    }
  }

  if (convertedPoints.length < 3) {
    throw new Error('Titik koordinat valid pada poligon batas wilayah kurang dari 3 titik.');
  }

  const centroid = computeCentroidFromPoints(convertedPoints);
  const bbox = computeBBoxFromPoints(convertedPoints);
  if (!centroid || !bbox) {
    throw new Error('Gagal mengkalkulasi centroid atau bounding box poligon batas wilayah.');
  }

  const areaCalc = calculatePolygonAreaShoelace(convertedPoints);

  return {
    geometryGeoJson: geo,
    centroidLat: centroid[0],
    centroidLng: centroid[1],
    bbox,
    areaSqM: areaCalc.areaSqM,
    perimeterMeters: areaCalc.perimeterMeters
  };
}

export async function getVillageBoundaries(): Promise<GisVillageBoundary[]> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  if (await isDatabaseAvailableCached()) {
    try {
      const prisma = getPrisma();
      const rows = await (prisma as any).gisVillageBoundary.findMany({
        where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }]
      });

      return rows.map((r: any) => ({
        id: String(r.id),
        villageId: r.villageId ?? null,
        regionCode: r.regionCode ?? null,
        status: (r.status || 'BELUM_TERVERIFIKASI') as BoundaryVerificationStatus,
        sourceType: (r.sourceType || 'UNKNOWN') as BoundarySourceType,
        sourceName: r.sourceName ?? null,
        sourceYear: typeof r.sourceYear === 'number' ? r.sourceYear : null,
        licenseNote: r.licenseNote ?? null,
        geometryGeoJson: r.geometryGeoJson as GeoJsonPolygonGeometry,
        bbox: parseBBox(r.bbox),
        centroidLat: typeof r.centroidLat === 'number' ? r.centroidLat : null,
        centroidLng: typeof r.centroidLng === 'number' ? r.centroidLng : null,
        areaSqM: typeof r.areaSqM === 'number' ? r.areaSqM : null,
        perimeterMeters: typeof r.perimeterMeters === 'number' ? r.perimeterMeters : null,
        isActive: Boolean(r.isActive),
        importJobId: r.importJobId ?? null,
        verifiedBy: r.verifiedBy ?? null,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined
      }));
    } catch (err) {
      if (!isMissingGisSchemaError(err)) {
        console.warn('⚠️ [GIS-REPO] Gagal mengambil batas wilayah dari DB:', sanitizeDiagnosticMessage(String(err)));
      }
    }
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    const boundaries = db.gisVillageBoundaries || [];
    return [...boundaries].sort((a: any, b: any) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  }

  return [];
}

export async function createVillageBoundary(
  input: CreateVillageBoundaryInput,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  const { geometryGeoJson, centroidLat, centroidLng, bbox, areaSqM, perimeterMeters } =
    validateAndParseGeoJsonPolygon(input.geometryGeoJson);

  // Aturan Resmi: Digitasi manual atau import biasa TIDAK boleh otomatis berstatus TERVERIFIKASI
  let safeStatus: BoundaryVerificationStatus = 'BELUM_TERVERIFIKASI';
  if (input.status === 'PERLU_VERIFIKASI') {
    safeStatus = 'PERLU_VERIFIKASI';
  } else if (input.status === 'TERVERIFIKASI') {
    if (input.sourceType === 'OFFICIAL_BIG' || input.sourceType === 'PEMDA') {
      safeStatus = 'TERVERIFIKASI';
    } else {
      safeStatus = 'PERLU_VERIFIKASI';
    }
  }

  const regionCode = input.regionCode ? String(input.regionCode).trim() : '15.04.05.2009';
  const shouldBeActive = Boolean(input.isActive);

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const created = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      if (shouldBeActive) {
        await (tx as any).gisVillageBoundary.updateMany({
          where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
          data: { isActive: false }
        });
      }

      const boundary = await (tx as any).gisVillageBoundary.create({
        data: {
          villageId: scopedVillageId,
          regionCode,
          status: safeStatus,
          sourceType: input.sourceType,
          sourceName: input.sourceName ? String(input.sourceName).trim() : null,
          sourceYear: typeof input.sourceYear === 'number' ? input.sourceYear : null,
          licenseNote: input.licenseNote ? String(input.licenseNote).trim() : null,
          geometryGeoJson,
          bbox,
          centroidLat,
          centroidLng,
          areaSqM,
          perimeterMeters,
          isActive: shouldBeActive,
          verifiedBy: safeStatus === 'TERVERIFIKASI' ? actor.userName : null,
          verifiedAt: safeStatus === 'TERVERIFIKASI' ? new Date() : null
        }
      });

      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'VILLAGE_BOUNDARY',
          entityId: String(boundary.id),
          action: 'CREATE',
          note: `Membuat batas wilayah baru (sumber=${input.sourceType}, status=${safeStatus})`,
          actorId: actor.userId,
          actorName: actor.userName
        }
      });

      return boundary;
    });

    return {
      id: String(created.id),
      villageId: created.villageId ?? null,
      regionCode: created.regionCode ?? null,
      status: created.status as BoundaryVerificationStatus,
      sourceType: created.sourceType as BoundarySourceType,
      sourceName: created.sourceName ?? null,
      sourceYear: created.sourceYear ?? null,
      licenseNote: created.licenseNote ?? null,
      geometryGeoJson: created.geometryGeoJson as GeoJsonPolygonGeometry,
      bbox: parseBBox(created.bbox),
      centroidLat: created.centroidLat,
      centroidLng: created.centroidLng,
      areaSqM: created.areaSqM,
      perimeterMeters: created.perimeterMeters,
      isActive: Boolean(created.isActive),
      verifiedBy: created.verifiedBy ?? null,
      verifiedAt: created.verifiedAt ? new Date(created.verifiedAt).toISOString() : null,
      createdAt: created.createdAt ? new Date(created.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: created.updatedAt ? new Date(created.updatedAt).toISOString() : new Date().toISOString()
    };
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];

    if (shouldBeActive) {
      db.gisVillageBoundaries.forEach((b: any) => {
        b.isActive = false;
      });
    }

    const nowIso = new Date().toISOString();
    const newBoundary: GisVillageBoundary = {
      id: `boundary-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      villageId: scopedVillageId,
      regionCode,
      status: safeStatus,
      sourceType: input.sourceType,
      sourceName: input.sourceName ? String(input.sourceName).trim() : null,
      sourceYear: typeof input.sourceYear === 'number' ? input.sourceYear : null,
      licenseNote: input.licenseNote ? String(input.licenseNote).trim() : null,
      geometryGeoJson,
      bbox,
      centroidLat,
      centroidLng,
      areaSqM,
      perimeterMeters,
      isActive: shouldBeActive,
      verifiedBy: safeStatus === 'TERVERIFIKASI' ? actor.userName : null,
      verifiedAt: safeStatus === 'TERVERIFIKASI' ? nowIso : null,
      verificationNotes: input.verificationNotes || null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    db.gisVillageBoundaries.unshift(newBoundary);
    if (!Array.isArray(db.gisChangeLogs)) db.gisChangeLogs = [];
    db.gisChangeLogs.unshift({
      id: `gis-log-${Date.now()}`,
      villageId: scopedVillageId,
      entityType: 'VILLAGE_BOUNDARY',
      entityId: newBoundary.id,
      action: 'CREATE',
      actorId: actor.userId,
      actorName: actor.userName,
      note: `Batas wilayah dibuat via JSON storage (${safeStatus})`,
      createdAt: nowIso
    });

    saveDb(db);
    return newBoundary;
  }

  throw new Error('Database tidak siap untuk menyimpan batas wilayah desa.');
}

export async function updateVillageBoundary(
  id: string,
  input: UpdateVillageBoundaryInput,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  let parsedGeom: ReturnType<typeof validateAndParseGeoJsonPolygon> | null = null;
  if (input.geometryGeoJson) {
    parsedGeom = validateAndParseGeoJsonPolygon(input.geometryGeoJson);
  }

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const updated = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      const existing = await (tx as any).gisVillageBoundary.findUnique({ where: { id } });
      if (!existing) {
        throw new Error('Data batas wilayah tidak ditemukan.');
      }

      if (input.isActive) {
        await (tx as any).gisVillageBoundary.updateMany({
          where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
          data: { isActive: false }
        });
      }

      const updateData: Record<string, unknown> = {};
      if (input.regionCode !== undefined) updateData.regionCode = input.regionCode;
      if (input.sourceType !== undefined) updateData.sourceType = input.sourceType;
      if (input.sourceName !== undefined) updateData.sourceName = input.sourceName;
      if (input.sourceYear !== undefined) updateData.sourceYear = input.sourceYear;
      if (input.licenseNote !== undefined) updateData.licenseNote = input.licenseNote;
      if (input.isActive !== undefined) updateData.isActive = Boolean(input.isActive);

      if (parsedGeom) {
        updateData.geometryGeoJson = parsedGeom.geometryGeoJson;
        updateData.centroidLat = parsedGeom.centroidLat;
        updateData.centroidLng = parsedGeom.centroidLng;
        updateData.bbox = parsedGeom.bbox;
        updateData.areaSqM = parsedGeom.areaSqM;
        updateData.perimeterMeters = parsedGeom.perimeterMeters;

        // Jika geometri diubah, status verifikasi direset ke PERLU_VERIFIKASI
        if (existing.status === 'TERVERIFIKASI') {
          updateData.status = 'PERLU_VERIFIKASI';
          updateData.verifiedBy = null;
          updateData.verifiedAt = null;
        }
      }

      const row = await (tx as any).gisVillageBoundary.update({
        where: { id },
        data: updateData
      });

      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'VILLAGE_BOUNDARY',
          entityId: id,
          action: 'UPDATE',
          actorId: actor.userId,
          actorName: actor.userName,
          note: `Memperbarui data batas wilayah (${row.sourceType})`
        }
      });

      return row;
    });

    return {
      id: String(updated.id),
      villageId: updated.villageId ?? null,
      regionCode: updated.regionCode ?? null,
      status: updated.status as BoundaryVerificationStatus,
      sourceType: updated.sourceType as BoundarySourceType,
      sourceName: updated.sourceName ?? null,
      sourceYear: updated.sourceYear ?? null,
      licenseNote: updated.licenseNote ?? null,
      geometryGeoJson: updated.geometryGeoJson as GeoJsonPolygonGeometry,
      bbox: parseBBox(updated.bbox),
      centroidLat: updated.centroidLat,
      centroidLng: updated.centroidLng,
      areaSqM: updated.areaSqM,
      perimeterMeters: updated.perimeterMeters,
      isActive: Boolean(updated.isActive),
      verifiedBy: updated.verifiedBy ?? null,
      verifiedAt: updated.verifiedAt ? new Date(updated.verifiedAt).toISOString() : null,
      updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString()
    };
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];
    const idx = db.gisVillageBoundaries.findIndex((b: any) => b.id === id);
    if (idx === -1) {
      throw new Error('Data batas wilayah tidak ditemukan.');
    }

    if (input.isActive) {
      db.gisVillageBoundaries.forEach((b: any) => {
        b.isActive = false;
      });
    }

    const current = db.gisVillageBoundaries[idx];
    const nowIso = new Date().toISOString();

    let newStatus = current.status;
    let verifiedBy = current.verifiedBy;
    let verifiedAt = current.verifiedAt;

    if (parsedGeom && current.status === 'TERVERIFIKASI') {
      newStatus = 'PERLU_VERIFIKASI';
      verifiedBy = null;
      verifiedAt = null;
    }

    const updated: GisVillageBoundary = {
      ...current,
      regionCode: input.regionCode !== undefined ? input.regionCode : current.regionCode,
      sourceType: input.sourceType !== undefined ? input.sourceType : current.sourceType,
      sourceName: input.sourceName !== undefined ? input.sourceName : current.sourceName,
      sourceYear: input.sourceYear !== undefined ? input.sourceYear : current.sourceYear,
      licenseNote: input.licenseNote !== undefined ? input.licenseNote : current.licenseNote,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : current.isActive,
      status: newStatus,
      verifiedBy,
      verifiedAt,
      geometryGeoJson: parsedGeom ? parsedGeom.geometryGeoJson : current.geometryGeoJson,
      centroidLat: parsedGeom ? parsedGeom.centroidLat : current.centroidLat,
      centroidLng: parsedGeom ? parsedGeom.centroidLng : current.centroidLng,
      bbox: parsedGeom ? parsedGeom.bbox : current.bbox,
      areaSqM: parsedGeom ? parsedGeom.areaSqM : current.areaSqM,
      perimeterMeters: parsedGeom ? parsedGeom.perimeterMeters : current.perimeterMeters,
      updatedAt: nowIso
    };

    db.gisVillageBoundaries[idx] = updated;
    saveDb(db);
    return updated;
  }

  throw new Error('Database tidak siap untuk memperbarui batas wilayah.');
}

export async function verifyVillageBoundary(
  id: string,
  status: BoundaryVerificationStatus,
  notes: string | null,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const validStatuses: Set<BoundaryVerificationStatus> = new Set(['BELUM_TERVERIFIKASI', 'PERLU_VERIFIKASI', 'TERVERIFIKASI']);
  if (!validStatuses.has(status)) {
    throw new Error('Status verifikasi harus salah satu dari: BELUM_TERVERIFIKASI, PERLU_VERIFIKASI, TERVERIFIKASI.');
  }

  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';
  const now = new Date();

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const updated = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      const existing = await (tx as any).gisVillageBoundary.findUnique({ where: { id } });
      if (!existing) throw new Error('Data batas wilayah tidak ditemukan.');

      const row = await (tx as any).gisVillageBoundary.update({
        where: { id },
        data: {
          status,
          verifiedBy: status === 'TERVERIFIKASI' ? actor.userName : null,
          verifiedAt: status === 'TERVERIFIKASI' ? now : null
        }
      });

      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'VILLAGE_BOUNDARY',
          entityId: id,
          action: 'VERIFY',
          actorId: actor.userId,
          actorName: actor.userName,
          note: `Verifikasi batas wilayah diubah menjadi ${status}. Catatan: ${notes || '-'}`
        }
      });

      return row;
    });

    return {
      id: String(updated.id),
      villageId: updated.villageId ?? null,
      regionCode: updated.regionCode ?? null,
      status: updated.status as BoundaryVerificationStatus,
      sourceType: updated.sourceType as BoundarySourceType,
      sourceName: updated.sourceName ?? null,
      sourceYear: updated.sourceYear ?? null,
      licenseNote: updated.licenseNote ?? null,
      geometryGeoJson: updated.geometryGeoJson as GeoJsonPolygonGeometry,
      bbox: parseBBox(updated.bbox),
      centroidLat: updated.centroidLat,
      centroidLng: updated.centroidLng,
      areaSqM: updated.areaSqM,
      perimeterMeters: updated.perimeterMeters,
      isActive: Boolean(updated.isActive),
      verifiedBy: updated.verifiedBy ?? null,
      verifiedAt: updated.verifiedAt ? new Date(updated.verifiedAt).toISOString() : null,
      updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString()
    };
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];
    const idx = db.gisVillageBoundaries.findIndex((b: any) => b.id === id);
    if (idx === -1) throw new Error('Data batas wilayah tidak ditemukan.');

    const current = db.gisVillageBoundaries[idx];
    const nowIso = now.toISOString();

    const updated: GisVillageBoundary = {
      ...current,
      status,
      verifiedBy: status === 'TERVERIFIKASI' ? actor.userName : null,
      verifiedAt: status === 'TERVERIFIKASI' ? nowIso : null,
      verificationNotes: notes || null,
      updatedAt: nowIso
    };

    db.gisVillageBoundaries[idx] = updated;
    if (!Array.isArray(db.gisChangeLogs)) db.gisChangeLogs = [];
    db.gisChangeLogs.unshift({
      id: `gis-log-${Date.now()}`,
      villageId: scopedVillageId,
      entityType: 'VILLAGE_BOUNDARY',
      entityId: id,
      action: 'VERIFY',
      actorId: actor.userId,
      actorName: actor.userName,
      note: `Verifikasi batas wilayah diubah menjadi ${status}. Catatan: ${notes || '-'}`
    });

    saveDb(db);
    return updated;
  }

  throw new Error('Database tidak siap untuk memperbarui status verifikasi.');
}

export async function setActiveVillageBoundary(
  id: string,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const updated = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      await (tx as any).gisVillageBoundary.updateMany({
        where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
        data: { isActive: false }
      });

      const row = await (tx as any).gisVillageBoundary.update({
        where: { id },
        data: { isActive: true }
      });

      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'VILLAGE_BOUNDARY',
          entityId: id,
          action: 'SET_ACTIVE',
          actorId: actor.userId,
          actorName: actor.userName,
          note: `Mengaktifkan batas wilayah id=${id} untuk tampilan peta desa.`
        }
      });

      return row;
    });

    return {
      id: String(updated.id),
      villageId: updated.villageId ?? null,
      regionCode: updated.regionCode ?? null,
      status: updated.status as BoundaryVerificationStatus,
      sourceType: updated.sourceType as BoundarySourceType,
      sourceName: updated.sourceName ?? null,
      sourceYear: updated.sourceYear ?? null,
      licenseNote: updated.licenseNote ?? null,
      geometryGeoJson: updated.geometryGeoJson as GeoJsonPolygonGeometry,
      bbox: parseBBox(updated.bbox),
      centroidLat: updated.centroidLat,
      centroidLng: updated.centroidLng,
      areaSqM: updated.areaSqM,
      perimeterMeters: updated.perimeterMeters,
      isActive: true,
      verifiedBy: updated.verifiedBy ?? null,
      verifiedAt: updated.verifiedAt ? new Date(updated.verifiedAt).toISOString() : null,
      updatedAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : new Date().toISOString()
    };
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];
    const idx = db.gisVillageBoundaries.findIndex((b: any) => b.id === id);
    if (idx === -1) throw new Error('Data batas wilayah tidak ditemukan.');

    db.gisVillageBoundaries.forEach((b: any) => {
      b.isActive = b.id === id;
      b.updatedAt = new Date().toISOString();
    });

    const activeOne = db.gisVillageBoundaries[idx];
    saveDb(db);
    return activeOne;
  }

  throw new Error('Database tidak siap untuk mengatur batas wilayah aktif.');
}

export async function deleteVillageBoundary(
  id: string,
  actor: { userId: string; userName: string }
): Promise<boolean> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      await (tx as any).gisVillageBoundary.delete({ where: { id } });
      await (tx as any).gisChangeLog.create({
        data: {
          villageId: scopedVillageId,
          entityType: 'VILLAGE_BOUNDARY',
          entityId: id,
          action: 'DELETE',
          actorId: actor.userId,
          actorName: actor.userName,
          note: `Menghapus batas wilayah id=${id}`
        }
      });
    });
    return true;
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) return false;
    const initialLen = db.gisVillageBoundaries.length;
    db.gisVillageBoundaries = db.gisVillageBoundaries.filter((b: any) => b.id !== id);
    if (db.gisVillageBoundaries.length < initialLen) {
      if (!Array.isArray(db.gisChangeLogs)) db.gisChangeLogs = [];
      db.gisChangeLogs.unshift({
        id: `gis-log-${Date.now()}`,
        villageId: scopedVillageId,
        entityType: 'VILLAGE_BOUNDARY',
        entityId: id,
        action: 'DELETE',
        actorId: actor.userId,
        actorName: actor.userName,
        note: `Menghapus batas wilayah id=${id} dari JSON storage`
      });
      saveDb(db);
      return true;
    }
    return false;
  }

  return false;
}

