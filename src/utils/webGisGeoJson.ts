import {
  DusunSpatialBoundary,
  GisVillageBoundary,
  LandParcel
} from '../types/webgis';
import { VillageProfile } from '../types';

export type GeoJsonDatasetType = 'administrative_boundary' | 'land_parcel';

export interface GeoJsonPolygonGeometryRaw {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface GeoJsonFeature<P extends Record<string, unknown> = Record<string, unknown>> {
  type: 'Feature';
  properties: P;
  geometry: GeoJsonPolygonGeometryRaw;
}

export interface GeoJsonFeatureCollection<P extends Record<string, unknown> = Record<string, unknown>> {
  type: 'FeatureCollection';
  name: string;
  metadata: {
    dataset: GeoJsonDatasetType;
    exported_at: string;
    total_features: number;
    disclaimer?: string;
  };
  features: GeoJsonFeature<P>[];
}

export interface BoundaryExportProperties {
  [key: string]: unknown;
  nama_wilayah: string;
  kode_wilayah: string | null;
  tingkat_wilayah: 'Desa Utama' | 'Desa Sebelah' | 'Dusun';
  status_batas: 'Definitif' | 'Indikatif';
  sumber_data: string;
  tanggal_data: string;
  keterangan: string;
}

export interface ParcelExportProperties {
  [key: string]: unknown;
  id_bidang: string;
  nop: string;
  pemilik: string;
  dusun: string;
  rt: string | null;
  rw: string | null;
  luas_m2: number;
  kategori_lahan: string;
  status_pbb: string;
  status_sporadik: string;
}

export interface LayerMetadata {
  datasetType: GeoJsonDatasetType;
  sourceLabel: string;
  lastUpdatedAt: string | null;
  totalCount: number;
  validCount: number;
  invalidCount: number;
}

export interface BoundaryLayerState {
  boundaryFeatures: GisVillageBoundary[];
  dusunBoundaries: DusunSpatialBoundary[];
  boundaryGeoJson: GeoJsonFeatureCollection<BoundaryExportProperties>;
  boundaryLoading: boolean;
  boundaryError: string | null;
  boundaryMetadata: LayerMetadata;
}

export interface ParcelLayerState {
  parcelFeatures: LandParcel[];
  parcelGeoJson: GeoJsonFeatureCollection<ParcelExportProperties>;
  parcelLoading: boolean;
  parcelError: string | null;
  parcelMetadata: LayerMetadata;
}

export interface RejectedGeoJsonFeature {
  index: number;
  id?: string;
  label?: string;
  reason: string;
}

export interface GeoJsonBuildResult<P extends Record<string, unknown>> {
  featureCollection: GeoJsonFeatureCollection<P>;
  validCount: number;
  rejectedCount: number;
  rejectedFeatures: RejectedGeoJsonFeature[];
}

export interface GeoJsonValidationReport {
  isValidCollection: boolean;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  validFeatures: GeoJsonFeature[];
  rejectedFeatures: RejectedGeoJsonFeature[];
  collectionError?: string;
}

const DEFAULT_INDICATIVE_DISCLAIMER =
  'Batas indikatif merupakan acuan delineasi wilayah dan bukan penetapan batas hukum definitif.';

/**
 * Validasi posisi GeoJSON strict: wajib [longitude, latitude], angka finite,
 * bukan null/NaN/Infinity, longitude [-180, 180], latitude [-90, 90], dan bukan titik [0,0].
 * TIDAK melakukan auto-swap atau perbaikan diam-diam.
 */
export function validateLngLatPositionStrict(
  pos: unknown
): { valid: boolean; reason?: string } {
  if (!Array.isArray(pos) || pos.length < 2) {
    return { valid: false, reason: 'Posisi koordinat harus berupa array [longitude, latitude].' };
  }

  const lng = pos[0];
  const lat = pos[1];

  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return { valid: false, reason: 'Nilai longitude dan latitude wajib bertipe number.' };
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { valid: false, reason: 'Koordinat mengandung NaN atau Infinity.' };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, reason: `Longitude ${lng} berada di luar rentang valid [-180, 180].` };
  }

  if (lat < -90 || lat > 90) {
    return {
      valid: false,
      reason: `Latitude ${lat} berada di luar rentang valid [-90, 90] (indikasi koordinat terbalik [lat, lng]).`
    };
  }

  if (lng === 0 && lat === 0) {
    return { valid: false, reason: 'Koordinat dummy [0, 0] tidak diperbolehkan.' };
  }

  return { valid: true };
}

/**
 * Validasi LinearRing RFC 7946 tanpa mutasi:
 * - Minimal 4 posisi
 * - Semua posisi valid [lng, lat]
 * - Titik awal dan titik akhir harus identik (tertutup)
 */
export function validateLinearRingStrict(
  ring: unknown,
  ringLabel = 'ring'
): { valid: boolean; reason?: string } {
  if (!Array.isArray(ring) || ring.length === 0) {
    return { valid: false, reason: `${ringLabel}: ring koordinat kosong.` };
  }

  if (ring.length < 4) {
    return {
      valid: false,
      reason: `${ringLabel}: ring poligon wajib memiliki minimal 4 titik (ditemukan ${ring.length}).`
    };
  }

  for (let i = 0; i < ring.length; i += 1) {
    const check = validateLngLatPositionStrict(ring[i]);
    if (!check.valid) {
      return { valid: false, reason: `${ringLabel} titik #${i + 1}: ${check.reason}` };
    }
  }

  const first = ring[0] as number[];
  const last = ring[ring.length - 1] as number[];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return {
      valid: false,
      reason: `${ringLabel}: poligon tidak tertutup (titik awal [${first[0]}, ${first[1]}] != titik akhir [${last[0]}, ${last[1]}]).`
    };
  }

  return { valid: true };
}

/**
 * Validasi Geometri GeoJSON strict: hanya mendukung Polygon & MultiPolygon.
 */
export function validateGeoJsonGeometryStrict(
  geometry: unknown
): { valid: boolean; reason?: string } {
  if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) {
    return { valid: false, reason: 'Geometri bernilai null atau bukan objek JSON.' };
  }

  const geom = geometry as Record<string, unknown>;
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') {
    return {
      valid: false,
      reason: `Tipe geometri "${String(geom.type)}" tidak didukung (wajib Polygon atau MultiPolygon).`
    };
  }

  if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
    return { valid: false, reason: 'Array koordinat geometri kosong.' };
  }

  if (geom.type === 'Polygon') {
    for (let rIdx = 0; rIdx < geom.coordinates.length; rIdx += 1) {
      const check = validateLinearRingStrict(geom.coordinates[rIdx], `Ring #${rIdx + 1}`);
      if (!check.valid) return check;
    }
    return { valid: true };
  }

  // MultiPolygon
  for (let pIdx = 0; pIdx < geom.coordinates.length; pIdx += 1) {
    const poly = geom.coordinates[pIdx];
    if (!Array.isArray(poly) || poly.length === 0) {
      return { valid: false, reason: `MultiPolygon bagian #${pIdx + 1} kosong atau tidak valid.` };
    }
    for (let rIdx = 0; rIdx < poly.length; rIdx += 1) {
      const check = validateLinearRingStrict(
        poly[rIdx],
        `Poligon #${pIdx + 1} Ring #${rIdx + 1}`
      );
      if (!check.valid) return check;
    }
  }

  return { valid: true };
}

/**
 * Validasi FeatureCollection GeoJSON menyeluruh tanpa mutasi.
 */
export function validateFeatureCollectionStrict(input: unknown): GeoJsonValidationReport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValidCollection: false,
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      validFeatures: [],
      rejectedFeatures: [],
      collectionError: 'Root GeoJSON harus berupa objek JSON.'
    };
  }

  const obj = input as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' || !Array.isArray(obj.features)) {
    return {
      isValidCollection: false,
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      validFeatures: [],
      rejectedFeatures: [],
      collectionError: 'Root GeoJSON wajib bertipe FeatureCollection dan memiliki array features.'
    };
  }

  const validFeatures: GeoJsonFeature[] = [];
  const rejectedFeatures: RejectedGeoJsonFeature[] = [];

  obj.features.forEach((rawFeat, idx) => {
    if (!rawFeat || typeof rawFeat !== 'object' || Array.isArray(rawFeat)) {
      rejectedFeatures.push({ index: idx, reason: 'Elemen feature bukan objek JSON.' });
      return;
    }

    const feat = rawFeat as Record<string, unknown>;
    if (feat.type !== 'Feature') {
      rejectedFeatures.push({
        index: idx,
        reason: `Tipe feature "${String(feat.type)}" tidak valid (wajib "Feature").`
      });
      return;
    }

    if (!feat.properties || typeof feat.properties !== 'object' || Array.isArray(feat.properties)) {
      rejectedFeatures.push({
        index: idx,
        reason: 'Feature tidak memiliki objek properties yang valid.'
      });
      return;
    }

    const geomCheck = validateGeoJsonGeometryStrict(feat.geometry);
    if (!geomCheck.valid) {
      rejectedFeatures.push({
        index: idx,
        reason: geomCheck.reason || 'Geometri feature tidak valid.'
      });
      return;
    }

    validFeatures.push({
      type: 'Feature',
      properties: feat.properties as Record<string, unknown>,
      geometry: feat.geometry as GeoJsonPolygonGeometryRaw
    });
  });

  return {
    isValidCollection: true,
    totalCount: obj.features.length,
    validCount: validFeatures.length,
    invalidCount: rejectedFeatures.length,
    validFeatures,
    rejectedFeatures
  };
}

/**
 * Mengonversi array titik Leaflet internal [lat, lng] ke Polygon GeoJSON [lng, lat] tertutup
 * secara ketat TANPA memperbaiki/membalik koordinat yang rusak.
 */
export function buildStrictPolygonGeometryFromLatLngPoints(
  points: unknown
): { geometry: GeoJsonPolygonGeometryRaw | null; reason?: string } {
  if (!Array.isArray(points) || points.length < 3) {
    return {
      geometry: null,
      reason: `Poligon minimal membutuhkan 3 titik koordinat (ditemukan ${Array.isArray(points) ? points.length : 0}).`
    };
  }

  const ring: number[][] = [];
  for (let i = 0; i < points.length; i += 1) {
    const pt = points[i];
    if (!Array.isArray(pt) || pt.length < 2) {
      return { geometry: null, reason: `Titik #${i + 1} bukan pasangan [lat, lng].` };
    }
    const lat = pt[0];
    const lng = pt[1];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { geometry: null, reason: `Titik #${i + 1} mengandung nilai non-angka/NaN/Infinity.` };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        geometry: null,
        reason: `Titik #${i + 1} ([${lat}, ${lng}]) berada di luar rentang koordinat bumi atau terbalik.`
      };
    }
    if (lat === 0 && lng === 0) {
      return { geometry: null, reason: `Titik #${i + 1} bernilai [0, 0] tidak valid.` };
    }
    ring.push([lng, lat]);
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  const candidate: GeoJsonPolygonGeometryRaw = {
    type: 'Polygon',
    coordinates: [ring]
  };

  const geomCheck = validateGeoJsonGeometryStrict(candidate);
  if (!geomCheck.valid) {
    return { geometry: null, reason: geomCheck.reason };
  }

  return { geometry: candidate };
}

function parseRtFromAddress(addressDusun: string): string | null {
  const match = String(addressDusun || '').match(/\bRT\s*0*(\d+)\b/i);
  return match ? match[1].padStart(2, '0') : null;
}

function parseRwFromAddress(addressDusun: string): string | null {
  const match = String(addressDusun || '').match(/\bRW\s*0*(\d+)\b/i);
  return match ? match[1].padStart(2, '0') : null;
}

function extractDusunOnly(addressDusun: string): string {
  const raw = String(addressDusun || '').trim();
  if (!raw) return '-';
  return raw
    .replace(/\bRT\s*\d+\b/gi, '')
    .replace(/\bRW\s*\d+\b/gi, '')
    .replace(/[-,/]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || raw;
}

/**
 * Builder GeoJSON KHUSUS Batas Wilayah Administratif Desa & Dusun.
 * Sumber data terisolasi sepenuhnya dari data persil/bidang tanah (tidak memuat NOP/pemilik/PBB/SPORADIK).
 */
export function buildBoundaryGeoJsonExport(
  villageBoundaries: GisVillageBoundary[],
  dusunBoundaries: DusunSpatialBoundary[],
  villageProfile?: Partial<VillageProfile> | null
): GeoJsonBuildResult<BoundaryExportProperties> {
  const features: GeoJsonFeature<BoundaryExportProperties>[] = [];
  const rejectedFeatures: RejectedGeoJsonFeature[] = [];
  let inspectIndex = 0;

  // 1. Batas Wilayah Desa Utama & Desa Sebelah
  (villageBoundaries || []).forEach((boundary) => {
    const idx = inspectIndex++;
    const label =
      boundary.villageName ||
      boundary.sourceName ||
      villageProfile?.villageName ||
      'Wilayah Desa';

    const geomCheck = validateGeoJsonGeometryStrict(boundary.geometryGeoJson);
    if (!geomCheck.valid) {
      rejectedFeatures.push({
        index: idx,
        id: boundary.id,
        label,
        reason: geomCheck.reason || 'Geometri batas desa tidak valid.'
      });
      return;
    }

    const isDefinitive = boundary.status === 'TERVERIFIKASI';
    const isNeighbor = boundary.boundaryRole === 'NEIGHBOR_VILLAGE';
    const baseNote = (boundary.verificationNotes || boundary.licenseNote || '').trim();
    const keterangan = isDefinitive
      ? baseNote || 'Batas administratif wilayah terverifikasi.'
      : baseNote
      ? `${baseNote} — ${DEFAULT_INDICATIVE_DISCLAIMER}`
      : DEFAULT_INDICATIVE_DISCLAIMER;

    features.push({
      type: 'Feature',
      properties: {
        nama_wilayah: label,
        kode_wilayah: boundary.regionCode ? String(boundary.regionCode) : null,
        tingkat_wilayah: isNeighbor ? 'Desa Sebelah' : 'Desa Utama',
        status_batas: isDefinitive ? 'Definitif' : 'Indikatif',
        sumber_data: String(boundary.sourceName || boundary.sourceType || 'SADEWA GIS'),
        tanggal_data: String(boundary.updatedAt || boundary.createdAt || new Date().toISOString().split('T')[0]),
        keterangan
      },
      geometry: {
        type: boundary.geometryGeoJson.type,
        coordinates: boundary.geometryGeoJson.coordinates
      }
    });
  });

  // 2. Batas Administrasi Dusun
  (dusunBoundaries || []).forEach((dusun) => {
    const idx = inspectIndex++;
    const built = buildStrictPolygonGeometryFromLatLngPoints(dusun.coordinates);
    if (!built.geometry) {
      rejectedFeatures.push({
        index: idx,
        id: dusun.dusunId,
        label: dusun.name,
        reason: built.reason || 'Geometri batas dusun tidak valid.'
      });
      return;
    }

    features.push({
      type: 'Feature',
      properties: {
        nama_wilayah: dusun.name,
        kode_wilayah: dusun.dusunId || null,
        tingkat_wilayah: 'Dusun',
        status_batas: 'Indikatif',
        sumber_data: `Pemetaan Dusun ${villageProfile?.villageName || 'Desa Pulau Betung'}`,
        tanggal_data: new Date().toISOString().split('T')[0],
        keterangan: `${DEFAULT_INDICATIVE_DISCLAIMER} Kepala Dusun: ${dusun.leaderName || '-'}.`
      },
      geometry: built.geometry
    });
  });

  return {
    featureCollection: {
      type: 'FeatureCollection',
      name: 'Batas_Wilayah',
      metadata: {
        dataset: 'administrative_boundary',
        exported_at: new Date().toISOString(),
        total_features: features.length,
        disclaimer: DEFAULT_INDICATIVE_DISCLAIMER
      },
      features
    },
    validCount: features.length,
    rejectedCount: rejectedFeatures.length,
    rejectedFeatures
  };
}

/**
 * Builder GeoJSON KHUSUS Bidang Tanah / Persil Warga.
 * Sumber data terisolasi sepenuhnya dari batas administratif wilayah dan bebas atribut sensitif/internal.
 */
export function buildParcelGeoJsonExport(
  parcels: LandParcel[]
): GeoJsonBuildResult<ParcelExportProperties> {
  const features: GeoJsonFeature<ParcelExportProperties>[] = [];
  const rejectedFeatures: RejectedGeoJsonFeature[] = [];

  (parcels || []).forEach((parcel, idx) => {
    const built = buildStrictPolygonGeometryFromLatLngPoints(parcel.coordinates);
    if (!built.geometry) {
      rejectedFeatures.push({
        index: idx,
        id: parcel.id,
        label: `${parcel.ownerName} (${parcel.nop})`,
        reason: built.reason || 'Geometri bidang tanah tidak valid.'
      });
      return;
    }

    const numericArea = Number.isFinite(parcel.landAreaSqM) ? Math.round(parcel.landAreaSqM) : 0;

    features.push({
      type: 'Feature',
      properties: {
        id_bidang: String(parcel.id || ''),
        nop: String(parcel.nop || '-'),
        pemilik: String(parcel.ownerName || '-'),
        dusun: extractDusunOnly(parcel.addressDusun),
        rt: parseRtFromAddress(parcel.addressDusun),
        rw: parseRwFromAddress(parcel.addressDusun),
        luas_m2: numericArea,
        kategori_lahan: String(parcel.landUseCategory || 'LAINNYA'),
        status_pbb: String(parcel.pbbStatus || 'BELUM_LUNAS'),
        status_sporadik: String(parcel.sporadikStatus || 'BELUM_TERDAFTAR')
      },
      geometry: built.geometry
    });
  });

  return {
    featureCollection: {
      type: 'FeatureCollection',
      name: 'Bidang_Tanah_Persil',
      metadata: {
        dataset: 'land_parcel',
        exported_at: new Date().toISOString(),
        total_features: features.length
      },
      features
    },
    validCount: features.length,
    rejectedCount: rejectedFeatures.length,
    rejectedFeatures
  };
}

/**
 * Helper download aman dengan pembersihan ObjectURL.
 */
export function downloadGeoJsonBlob<P extends Record<string, unknown>>(
  featureCollection: GeoJsonFeatureCollection<P>,
  filename: string
): boolean {
  if (!featureCollection || featureCollection.features.length === 0) {
    return false;
  }
  const serialized = JSON.stringify(featureCollection, null, 2);
  const blob = new Blob([serialized], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
