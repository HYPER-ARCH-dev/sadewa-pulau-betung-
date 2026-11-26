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
  BoundaryRole,
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

interface StoredBoundaryMeta {
  villageName?: string | null;
  boundaryRole?: BoundaryRole;
  showOnMap?: boolean;
  fillColor?: string | null;
  verificationNotes?: string | null;
}

function attachBoundaryMeta(
  geometryGeoJson: GeoJsonPolygonGeometry,
  meta: StoredBoundaryMeta
): GeoJsonPolygonGeometry & { sadewaMeta?: StoredBoundaryMeta } {
  const cleanMeta: StoredBoundaryMeta = {};
  if (meta.villageName !== undefined) cleanMeta.villageName = meta.villageName || null;
  if (meta.boundaryRole !== undefined) cleanMeta.boundaryRole = meta.boundaryRole;
  if (meta.showOnMap !== undefined) cleanMeta.showOnMap = Boolean(meta.showOnMap);
  if (meta.fillColor !== undefined) cleanMeta.fillColor = meta.fillColor || null;
  if (meta.verificationNotes !== undefined) cleanMeta.verificationNotes = meta.verificationNotes || null;

  return {
    type: geometryGeoJson.type,
    coordinates: geometryGeoJson.coordinates,
    ...(Object.keys(cleanMeta).length > 0 ? { sadewaMeta: cleanMeta } : {})
  };
}

function extractBoundaryMeta(rawRow: any): StoredBoundaryMeta {
  const geoMeta =
    rawRow?.geometryGeoJson &&
    typeof rawRow.geometryGeoJson === 'object' &&
    rawRow.geometryGeoJson.sadewaMeta &&
    typeof rawRow.geometryGeoJson.sadewaMeta === 'object'
      ? (rawRow.geometryGeoJson.sadewaMeta as Record<string, any>)
      : {};

  const villageName =
    typeof rawRow?.villageName === 'string' && rawRow.villageName.trim()
      ? rawRow.villageName.trim()
      : typeof geoMeta.villageName === 'string' && geoMeta.villageName.trim()
      ? geoMeta.villageName.trim()
      : null;

  const rawRole = rawRow?.boundaryRole || geoMeta.boundaryRole;
  const boundaryRole: BoundaryRole = rawRole === 'NEIGHBOR_VILLAGE' ? 'NEIGHBOR_VILLAGE' : 'MAIN_VILLAGE';

  const showOnMap =
    typeof rawRow?.showOnMap === 'boolean'
      ? rawRow.showOnMap
      : typeof geoMeta.showOnMap === 'boolean'
      ? geoMeta.showOnMap
      : boundaryRole === 'NEIGHBOR_VILLAGE'
      ? true
      : Boolean(rawRow?.isActive);

  const fillColor =
    typeof rawRow?.fillColor === 'string' && rawRow.fillColor.trim()
      ? rawRow.fillColor.trim()
      : typeof geoMeta.fillColor === 'string' && geoMeta.fillColor.trim()
      ? geoMeta.fillColor.trim()
      : null;

  const verificationNotes =
    typeof rawRow?.verificationNotes === 'string'
      ? rawRow.verificationNotes
      : typeof geoMeta.verificationNotes === 'string'
      ? geoMeta.verificationNotes
      : null;

  return {
    villageName,
    boundaryRole,
    showOnMap,
    fillColor,
    verificationNotes
  };
}

function sanitizeCleanGeometryGeoJson(rawGeo: any): GeoJsonPolygonGeometry {
  return {
    type: rawGeo?.type === 'MultiPolygon' ? 'MultiPolygon' : 'Polygon',
    coordinates: rawGeo?.coordinates || []
  };
}

function mapBoundaryRecord(r: any, fallbackVillageName?: string | null): GisVillageBoundary {
  const meta = extractBoundaryMeta(r);
  const resolvedRole: BoundaryRole = meta.boundaryRole || 'MAIN_VILLAGE';
  return {
    id: String(r.id),
    villageId: r.villageId ?? null,
    villageName:
      meta.villageName ||
      (resolvedRole === 'MAIN_VILLAGE' ? fallbackVillageName || null : null) ||
      r.sourceName ||
      null,
    boundaryRole: resolvedRole,
    showOnMap: typeof meta.showOnMap === 'boolean' ? meta.showOnMap : Boolean(r.isActive),
    fillColor: meta.fillColor ?? null,
    regionCode: r.regionCode ?? null,
    status: (['TERVERIFIKASI', 'PERLU_VERIFIKASI'].includes(r.status)
      ? r.status
      : 'BELUM_TERVERIFIKASI') as BoundaryVerificationStatus,
    sourceType: (r.sourceType || 'UNKNOWN') as BoundarySourceType,
    sourceName: r.sourceName ?? null,
    sourceYear: typeof r.sourceYear === 'number' ? r.sourceYear : null,
    licenseNote: r.licenseNote ?? null,
    geometryGeoJson: sanitizeCleanGeometryGeoJson(r.geometryGeoJson),
    bbox: parseBBox(r.bbox),
    centroidLat: typeof r.centroidLat === 'number' ? r.centroidLat : null,
    centroidLng: typeof r.centroidLng === 'number' ? r.centroidLng : null,
    areaSqM: typeof r.areaSqM === 'number' ? r.areaSqM : null,
    perimeterMeters: typeof r.perimeterMeters === 'number' ? r.perimeterMeters : null,
    isActive: Boolean(r.isActive),
    importJobId: r.importJobId ?? null,
    verifiedBy: r.verifiedBy ?? null,
    verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
    verificationNotes: meta.verificationNotes ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined
  };
}

function selectVisibleBoundaries(all: GisVillageBoundary[]): GisVillageBoundary[] {
  return all.filter(
    (b) => b.isActive || b.showOnMap === true || (b.boundaryRole === 'NEIGHBOR_VILLAGE' && b.showOnMap !== false)
  );
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

      const allBoundaries = (db.gisVillageBoundaries || []).map((b: any) =>
        mapBoundaryRecord(b, villageName)
      );
      const activeBoundary =
        allBoundaries.find((b) => b.isActive && b.boundaryRole !== 'NEIGHBOR_VILLAGE') ||
        allBoundaries.find((b) => b.isActive) ||
        null;
      const visibleBoundaries = selectVisibleBoundaries(allBoundaries);

      if (db.gisTenantConfig) {
        return {
          tenantId,
          villageName,
          regionCode: db.gisTenantConfig.regionCode || '15.04.05.2009',
          config: buildDefaultConfig(db.gisTenantConfig),
          activeBoundary,
          visibleBoundaries,
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
          activeBoundary,
          visibleBoundaries,
          hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
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
          activeBoundary,
          visibleBoundaries,
          hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
          dataSource: 'derived_profile'
        };
      }

      return {
        tenantId,
        villageName,
        regionCode: null,
        config: buildDefaultConfig({ defaultZoom: 5 }),
        activeBoundary,
        visibleBoundaries,
        hasVerifiedBoundary: activeBoundary?.status === 'TERVERIFIKASI',
        dataSource: 'neutral_fallback'
      };
    }

    return {
      tenantId,
      villageName: fallbackVillageName,
      regionCode: null,
      config: buildDefaultConfig({ defaultZoom: 5 }),
      activeBoundary: null,
      visibleBoundaries: [],
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
  let dbBoundaryRows: any[] = [];

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
    dbBoundaryRows = await (prisma as any).gisVillageBoundary.findMany({
      where: isMultiTenantRoutingEnabled() ? { villageId: tenantId } : {},
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }]
    });
  } catch (err) {
    if (!isMissingGisSchemaError(err)) {
      console.warn('⚠️ [GIS-REPO] Gagal membaca GisVillageBoundary:', sanitizeDiagnosticMessage(String(err)));
    }
  }

  const villageName = safeProfile?.villageName || fallbackVillageName;
  const allBoundaries: GisVillageBoundary[] = dbBoundaryRows.map((row) =>
    mapBoundaryRecord(row, villageName)
  );
  const activeBoundary: GisVillageBoundary | null =
    allBoundaries.find((b) => b.isActive && b.boundaryRole !== 'NEIGHBOR_VILLAGE') ||
    allBoundaries.find((b) => b.isActive) ||
    null;
  const visibleBoundaries = selectVisibleBoundaries(allBoundaries);
  const regionCode = dbConfigRow?.regionCode || activeBoundary?.regionCode || profileRegionCode || null;

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
      visibleBoundaries,
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
      visibleBoundaries,
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
      visibleBoundaries,
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
    visibleBoundaries,
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
  const fallbackVillageName = ctx?.tenantName || 'Desa Pulau Betung';

  if (await isDatabaseAvailableCached()) {
    try {
      const prisma = getPrisma();
      const rows = await (prisma as any).gisVillageBoundary.findMany({
        where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }]
      });

      return rows.map((r: any) => mapBoundaryRecord(r, fallbackVillageName));
    } catch (err) {
      if (!isMissingGisSchemaError(err)) {
        console.warn('⚠️ [GIS-REPO] Gagal mengambil batas wilayah dari DB:', sanitizeDiagnosticMessage(String(err)));
      }
    }
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    const villageName = db.villageProfile?.villageName || fallbackVillageName;
    const boundaries = (db.gisVillageBoundaries || []).map((b: any) => mapBoundaryRecord(b, villageName));
    return [...boundaries].sort((a: any, b: any) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0));
  }

  return [];
}

function resolveSafeBoundaryStatus(input: CreateVillageBoundaryInput): BoundaryVerificationStatus {
  if (input.status === 'PERLU_VERIFIKASI') return 'PERLU_VERIFIKASI';
  if (input.status === 'TERVERIFIKASI') {
    if (input.sourceType === 'OFFICIAL_BIG' || input.sourceType === 'PEMDA') {
      return 'TERVERIFIKASI';
    }
    return 'PERLU_VERIFIKASI';
  }
  return 'BELUM_TERVERIFIKASI';
}

export async function createVillageBoundary(
  input: CreateVillageBoundaryInput,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';
  const fallbackVillageName = ctx?.tenantName || 'Desa Pulau Betung';

  const { geometryGeoJson, centroidLat, centroidLng, bbox, areaSqM, perimeterMeters } =
    validateAndParseGeoJsonPolygon(input.geometryGeoJson);

  const safeStatus = resolveSafeBoundaryStatus(input);
  const boundaryRole: BoundaryRole =
    input.boundaryRole === 'NEIGHBOR_VILLAGE' ? 'NEIGHBOR_VILLAGE' : 'MAIN_VILLAGE';
  const villageName =
    typeof input.villageName === 'string' && input.villageName.trim()
      ? input.villageName.trim()
      : boundaryRole === 'MAIN_VILLAGE'
      ? fallbackVillageName
      : input.sourceName?.trim() || 'Desa Sebelah';
  const regionCode = input.regionCode
    ? String(input.regionCode).trim()
    : boundaryRole === 'MAIN_VILLAGE'
    ? '15.04.05.2009'
    : null;
  // Neighbor village NEVER hijacks MAIN_VILLAGE isActive
  const shouldBeActive = boundaryRole === 'MAIN_VILLAGE' && Boolean(input.isActive);
  const showOnMap =
    typeof input.showOnMap === 'boolean'
      ? input.showOnMap
      : boundaryRole === 'NEIGHBOR_VILLAGE'
      ? true
      : shouldBeActive;
  const fillColor =
    typeof input.fillColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.fillColor.trim())
      ? input.fillColor.trim().toLowerCase()
      : boundaryRole === 'NEIGHBOR_VILLAGE'
      ? '#0284c7'
      : null;

  const storedGeoJson = attachBoundaryMeta(geometryGeoJson, {
    villageName,
    boundaryRole,
    showOnMap,
    fillColor,
    verificationNotes: input.verificationNotes || null
  });

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const created = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      if (shouldBeActive) {
        const currentRows = await (tx as any).gisVillageBoundary.findMany({
          where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId, isActive: true } : { isActive: true }
        });
        for (const r of currentRows) {
          const meta = extractBoundaryMeta(r);
          if (meta.boundaryRole !== 'NEIGHBOR_VILLAGE') {
            await (tx as any).gisVillageBoundary.update({
              where: { id: r.id },
              data: { isActive: false }
            });
          }
        }
      }

      const boundary = await (tx as any).gisVillageBoundary.create({
        data: {
          villageId: scopedVillageId,
          regionCode,
          status: safeStatus,
          sourceType: input.sourceType,
          sourceName: input.sourceName ? String(input.sourceName).trim() : villageName,
          sourceYear: typeof input.sourceYear === 'number' ? input.sourceYear : null,
          licenseNote: input.licenseNote ? String(input.licenseNote).trim() : null,
          geometryGeoJson: storedGeoJson,
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
          note: `Membuat batas ${boundaryRole === 'NEIGHBOR_VILLAGE' ? 'desa sebelah' : 'desa utama'} "${villageName}" (sumber=${input.sourceType}, status=${safeStatus})`,
          actorId: actor.userId,
          actorName: actor.userName
        }
      });

      return boundary;
    });

    return mapBoundaryRecord(created, fallbackVillageName);
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];

    if (shouldBeActive) {
      db.gisVillageBoundaries.forEach((b: any) => {
        if (b.boundaryRole !== 'NEIGHBOR_VILLAGE') {
          b.isActive = false;
        }
      });
    }

    const nowIso = new Date().toISOString();
    const newBoundary: GisVillageBoundary = {
      id: `boundary-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      villageId: scopedVillageId,
      villageName,
      boundaryRole,
      showOnMap,
      fillColor,
      regionCode,
      status: safeStatus,
      sourceType: input.sourceType,
      sourceName: input.sourceName ? String(input.sourceName).trim() : villageName,
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
      note: `Batas wilayah "${villageName}" dibuat via JSON storage (${safeStatus})`,
      createdAt: nowIso
    });

    saveDb(db);
    return mapBoundaryRecord(newBoundary, fallbackVillageName);
  }

  throw new Error('Database tidak siap untuk menyimpan batas wilayah desa.');
}

export async function createVillageBoundariesBatch(
  inputs: CreateVillageBoundaryInput[],
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary[]> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('Daftar batas wilayah untuk diimpor tidak boleh kosong.');
  }

  const results: GisVillageBoundary[] = [];
  for (const item of inputs) {
    const saved = await createVillageBoundary(item, actor);
    results.push(saved);
  }
  return results;
}

export async function updateVillageBoundary(
  id: string,
  input: UpdateVillageBoundaryInput,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';
  const fallbackVillageName = ctx?.tenantName || 'Desa Pulau Betung';

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

      const existingMeta = extractBoundaryMeta(existing);
      const nextRole: BoundaryRole =
        input.boundaryRole !== undefined
          ? input.boundaryRole === 'NEIGHBOR_VILLAGE'
            ? 'NEIGHBOR_VILLAGE'
            : 'MAIN_VILLAGE'
          : existingMeta.boundaryRole || 'MAIN_VILLAGE';

      const nextIsActive =
        nextRole === 'NEIGHBOR_VILLAGE'
          ? false
          : input.isActive !== undefined
          ? Boolean(input.isActive)
          : Boolean(existing.isActive);

      if (nextIsActive && nextRole === 'MAIN_VILLAGE') {
        const currentRows = await (tx as any).gisVillageBoundary.findMany({
          where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId, isActive: true } : { isActive: true }
        });
        for (const r of currentRows) {
          if (r.id === id) continue;
          const rMeta = extractBoundaryMeta(r);
          if (rMeta.boundaryRole !== 'NEIGHBOR_VILLAGE') {
            await (tx as any).gisVillageBoundary.update({
              where: { id: r.id },
              data: { isActive: false }
            });
          }
        }
      }

      const nextMeta: StoredBoundaryMeta = {
        villageName:
          input.villageName !== undefined
            ? input.villageName
              ? String(input.villageName).trim()
              : null
            : existingMeta.villageName,
        boundaryRole: nextRole,
        showOnMap:
          input.showOnMap !== undefined
            ? Boolean(input.showOnMap)
            : nextRole === 'MAIN_VILLAGE' && input.isActive !== undefined
            ? Boolean(input.isActive)
            : existingMeta.showOnMap,
        fillColor:
          input.fillColor !== undefined
            ? input.fillColor
              ? String(input.fillColor).trim()
              : null
            : existingMeta.fillColor,
        verificationNotes:
          input.verificationNotes !== undefined
            ? input.verificationNotes
            : existingMeta.verificationNotes
      };

      const baseGeometry = parsedGeom
        ? parsedGeom.geometryGeoJson
        : sanitizeCleanGeometryGeoJson(existing.geometryGeoJson);

      const updateData: Record<string, unknown> = {
        geometryGeoJson: attachBoundaryMeta(baseGeometry, nextMeta),
        isActive: nextIsActive
      };
      if (input.regionCode !== undefined) updateData.regionCode = input.regionCode;
      if (input.sourceType !== undefined) updateData.sourceType = input.sourceType;
      if (input.sourceName !== undefined) updateData.sourceName = input.sourceName;
      if (input.sourceYear !== undefined) updateData.sourceYear = input.sourceYear;
      if (input.licenseNote !== undefined) updateData.licenseNote = input.licenseNote;

      if (parsedGeom) {
        updateData.centroidLat = parsedGeom.centroidLat;
        updateData.centroidLng = parsedGeom.centroidLng;
        updateData.bbox = parsedGeom.bbox;
        updateData.areaSqM = parsedGeom.areaSqM;
        updateData.perimeterMeters = parsedGeom.perimeterMeters;

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
          note: `Memperbarui data batas wilayah "${nextMeta.villageName || row.sourceName || id}" (${row.sourceType})`
        }
      });

      return row;
    });

    return mapBoundaryRecord(updated, fallbackVillageName);
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];
    const idx = db.gisVillageBoundaries.findIndex((b: any) => b.id === id);
    if (idx === -1) {
      throw new Error('Data batas wilayah tidak ditemukan.');
    }

    const current = db.gisVillageBoundaries[idx];
    const nextRole: BoundaryRole =
      input.boundaryRole !== undefined
        ? input.boundaryRole === 'NEIGHBOR_VILLAGE'
          ? 'NEIGHBOR_VILLAGE'
          : 'MAIN_VILLAGE'
        : current.boundaryRole === 'NEIGHBOR_VILLAGE'
        ? 'NEIGHBOR_VILLAGE'
        : 'MAIN_VILLAGE';

    const nextIsActive =
      nextRole === 'NEIGHBOR_VILLAGE'
        ? false
        : input.isActive !== undefined
        ? Boolean(input.isActive)
        : Boolean(current.isActive);

    if (nextIsActive && nextRole === 'MAIN_VILLAGE') {
      db.gisVillageBoundaries.forEach((b: any) => {
        if (b.id !== id && b.boundaryRole !== 'NEIGHBOR_VILLAGE') {
          b.isActive = false;
        }
      });
    }

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
      villageName:
        input.villageName !== undefined
          ? input.villageName
            ? String(input.villageName).trim()
            : null
          : current.villageName,
      boundaryRole: nextRole,
      showOnMap:
        input.showOnMap !== undefined
          ? Boolean(input.showOnMap)
          : nextRole === 'MAIN_VILLAGE' && input.isActive !== undefined
          ? Boolean(input.isActive)
          : current.showOnMap,
      fillColor:
        input.fillColor !== undefined
          ? input.fillColor
            ? String(input.fillColor).trim()
            : null
          : current.fillColor,
      regionCode: input.regionCode !== undefined ? input.regionCode : current.regionCode,
      sourceType: input.sourceType !== undefined ? input.sourceType : current.sourceType,
      sourceName: input.sourceName !== undefined ? input.sourceName : current.sourceName,
      sourceYear: input.sourceYear !== undefined ? input.sourceYear : current.sourceYear,
      licenseNote: input.licenseNote !== undefined ? input.licenseNote : current.licenseNote,
      verificationNotes:
        input.verificationNotes !== undefined ? input.verificationNotes : current.verificationNotes,
      isActive: nextIsActive,
      status: newStatus,
      verifiedBy,
      verifiedAt,
      geometryGeoJson: parsedGeom ? parsedGeom.geometryGeoJson : sanitizeCleanGeometryGeoJson(current.geometryGeoJson),
      centroidLat: parsedGeom ? parsedGeom.centroidLat : current.centroidLat,
      centroidLng: parsedGeom ? parsedGeom.centroidLng : current.centroidLng,
      bbox: parsedGeom ? parsedGeom.bbox : current.bbox,
      areaSqM: parsedGeom ? parsedGeom.areaSqM : current.areaSqM,
      perimeterMeters: parsedGeom ? parsedGeom.perimeterMeters : current.perimeterMeters,
      updatedAt: nowIso
    };

    db.gisVillageBoundaries[idx] = updated;
    saveDb(db);
    return mapBoundaryRecord(updated, fallbackVillageName);
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
  const fallbackVillageName = ctx?.tenantName || 'Desa Pulau Betung';
  const now = new Date();

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const updated = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      const existing = await (tx as any).gisVillageBoundary.findUnique({ where: { id } });
      if (!existing) throw new Error('Data batas wilayah tidak ditemukan.');

      const existingMeta = extractBoundaryMeta(existing);
      const updatedGeo = attachBoundaryMeta(sanitizeCleanGeometryGeoJson(existing.geometryGeoJson), {
        ...existingMeta,
        verificationNotes: notes !== null ? notes : existingMeta.verificationNotes
      });

      const row = await (tx as any).gisVillageBoundary.update({
        where: { id },
        data: {
          status,
          geometryGeoJson: updatedGeo,
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

    return mapBoundaryRecord(updated, fallbackVillageName);
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
    return mapBoundaryRecord(updated, fallbackVillageName);
  }

  throw new Error('Database tidak siap untuk memperbarui status verifikasi.');
}

export async function setActiveVillageBoundary(
  id: string,
  actor: { userId: string; userName: string }
): Promise<GisVillageBoundary> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';
  const fallbackVillageName = ctx?.tenantName || 'Desa Pulau Betung';

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    const updated = await runWithTenantRlsTransaction(async (tx: PrismaClient) => {
      const target = await (tx as any).gisVillageBoundary.findUnique({ where: { id } });
      if (!target) throw new Error('Data batas wilayah tidak ditemukan.');

      const currentRows = await (tx as any).gisVillageBoundary.findMany({
        where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId, isActive: true } : { isActive: true }
      });
      for (const r of currentRows) {
        if (r.id === id) continue;
        const rMeta = extractBoundaryMeta(r);
        if (rMeta.boundaryRole !== 'NEIGHBOR_VILLAGE') {
          await (tx as any).gisVillageBoundary.update({
            where: { id: r.id },
            data: { isActive: false }
          });
        }
      }

      const targetMeta = extractBoundaryMeta(target);
      const updatedGeo = attachBoundaryMeta(sanitizeCleanGeometryGeoJson(target.geometryGeoJson), {
        ...targetMeta,
        boundaryRole: 'MAIN_VILLAGE',
        showOnMap: true
      });

      const row = await (tx as any).gisVillageBoundary.update({
        where: { id },
        data: { isActive: true, geometryGeoJson: updatedGeo }
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

    return mapBoundaryRecord(updated, fallbackVillageName);
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    if (!Array.isArray(db.gisVillageBoundaries)) db.gisVillageBoundaries = [];
    const idx = db.gisVillageBoundaries.findIndex((b: any) => b.id === id);
    if (idx === -1) throw new Error('Data batas wilayah tidak ditemukan.');

    db.gisVillageBoundaries.forEach((b: any) => {
      if (b.id === id) {
        b.isActive = true;
        b.boundaryRole = 'MAIN_VILLAGE';
        b.showOnMap = true;
        b.updatedAt = new Date().toISOString();
      } else if (b.boundaryRole !== 'NEIGHBOR_VILLAGE') {
        b.isActive = false;
        b.updatedAt = new Date().toISOString();
      }
    });

    const activeOne = db.gisVillageBoundaries[idx];
    saveDb(db);
    return mapBoundaryRecord(activeOne, fallbackVillageName);
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

export interface GisChangeLogEntry {
  id: string;
  villageId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  note?: string | null;
  createdAt: string;
}

export async function getGisChangeLogs(limit = 50): Promise<GisChangeLogEntry[]> {
  const ctx = getCurrentTenantContext();
  const scopedVillageId = ctx?.tenantId || 'default';

  const dbAvailable = await isDatabaseAvailableCached();
  const tablesReady = dbAvailable ? await checkGisTablesReady() : false;

  if (dbAvailable && tablesReady) {
    try {
      const prisma = getPrisma();
      const rows = await (prisma as any).gisChangeLog.findMany({
        where: isMultiTenantRoutingEnabled() ? { villageId: scopedVillageId } : {},
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      return rows.map((r: any) => ({
        id: String(r.id),
        villageId: r.villageId ?? null,
        entityType: String(r.entityType || 'GIS'),
        entityId: String(r.entityId || ''),
        action: String(r.action || ''),
        actorId: r.actorId ?? null,
        actorName: r.actorName ?? null,
        note: r.note ?? null,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      if (!isMissingGisSchemaError(err)) {
        console.warn('⚠️ [GIS-REPO] Gagal mengambil log perubahan GIS:', sanitizeDiagnosticMessage(String(err)));
      }
    }
  }

  if (isJsonFallbackAllowed()) {
    const db = getDb();
    const logs = Array.isArray(db.gisChangeLogs) ? db.gisChangeLogs : [];
    return logs.slice(0, limit).map((r: any) => ({
      id: String(r.id),
      villageId: r.villageId ?? null,
      entityType: String(r.entityType || 'GIS'),
      entityId: String(r.entityId || ''),
      action: String(r.action || ''),
      actorId: r.actorId ?? r.changedBy ?? null,
      actorName: r.actorName ?? r.changedByName ?? null,
      note: r.note ?? null,
      createdAt: r.createdAt || new Date().toISOString()
    }));
  }

  return [];
}


