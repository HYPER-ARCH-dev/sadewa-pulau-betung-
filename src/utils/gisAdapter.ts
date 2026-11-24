import {
  GeoJsonPolygonGeometry,
  GisBoundingBox,
  GisBootstrapPayload,
  LandParcel
} from '../types/webgis';
import { MapFacility, VillageProfile } from '../types';
import { ToddlerRecord } from '../types/posyandu';

/**
 * Viewport netral nasional Indonesia — HANYA digunakan ketika tenant baru
 * belum memiliki konfigurasi GIS, belum mengisi koordinat kantor desa,
 * dan belum memiliki titik fasilitas/persil sama sekali.
 */
export const NEUTRAL_INDONESIA_CENTER: [number, number] = [-2.5489, 118.0149];
export const NEUTRAL_INDONESIA_ZOOM = 5;

export interface ResolvedMapViewport {
  center: [number, number];
  zoom: number;
  bbox: GisBoundingBox | null;
  leafletBounds: [[number, number], [number, number]] | null;
  source: 'boundary' | 'gis_config' | 'office_location' | 'data_centroid' | 'neutral_fallback';
  isConfigured: boolean;
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
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

export function geoJsonRingToLeafletLatLngs(ring: number[][]): [number, number][] {
  if (!Array.isArray(ring)) return [];
  const points: [number, number][] = [];
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (isValidCoordinatePair(lat, lng)) {
        points.push([lat, lng]);
      }
    }
  }
  return points;
}

export function geoJsonGeometryToLeafletPolygons(
  geom: GeoJsonPolygonGeometry | null | undefined
): [number, number][][][] {
  if (!geom || !Array.isArray(geom.coordinates)) return [];

  if (geom.type === 'Polygon') {
    const rings = (geom.coordinates as number[][][])
      .map((ring) => geoJsonRingToLeafletLatLngs(ring))
      .filter((ring) => ring.length >= 3);
    return rings.length > 0 ? [rings] : [];
  }

  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][])
      .map((poly) =>
        (Array.isArray(poly) ? poly : [])
          .map((ring) => geoJsonRingToLeafletLatLngs(ring))
          .filter((ring) => ring.length >= 3)
      )
      .filter((poly) => poly.length > 0);
  }

  return [];
}

export function leafletCoordsToGeoJsonPolygon(coords: [number, number][]): GeoJsonPolygonGeometry {
  const validRing = (coords || [])
    .filter((pt) => Array.isArray(pt) && pt.length >= 2 && isValidCoordinatePair(pt[0], pt[1]))
    .map(([lat, lng]) => [lng, lat]);

  if (validRing.length >= 3) {
    const first = validRing[0];
    const last = validRing[validRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      validRing.push([first[0], first[1]]);
    }
  }

  return {
    type: 'Polygon',
    coordinates: validRing.length >= 4 ? [validRing] : []
  };
}

export function computeBoundingBoxFromLeafletCoords(
  points: [number, number][]
): GisBoundingBox | null {
  const valid = points.filter((p) => Array.isArray(p) && p.length >= 2 && isValidCoordinatePair(p[0], p[1]));
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

export function computeCentroidFromLeafletCoords(
  points: [number, number][]
): [number, number] | null {
  const valid = points.filter((p) => Array.isArray(p) && p.length >= 2 && isValidCoordinatePair(p[0], p[1]));
  if (valid.length === 0) return null;

  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of valid) {
    sumLat += lat;
    sumLng += lng;
  }

  return [sumLat / valid.length, sumLng / valid.length];
}

export function bboxToLeafletBounds(
  bbox: GisBoundingBox | null | undefined
): [[number, number], [number, number]] | null {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  const [minLng, minLat, maxLng, maxLat] = bbox.map(Number);
  if (!isValidCoordinatePair(minLat, minLng) || !isValidCoordinatePair(maxLat, maxLng)) {
    return null;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng]
  ];
}

export function calculateZoomFromBBox(bbox: GisBoundingBox | null | undefined): number {
  if (!Array.isArray(bbox) || bbox.length !== 4) return 14;
  const [minLng, minLat, maxLng, maxLat] = bbox.map(Number);
  const span = Math.max(Math.abs(maxLng - minLng), Math.abs(maxLat - minLat));
  if (!Number.isFinite(span) || span <= 0) return 15;
  if (span > 10) return 6;
  if (span > 3) return 8;
  if (span > 1) return 10;
  if (span > 0.4) return 11;
  if (span > 0.15) return 12;
  if (span > 0.06) return 13;
  if (span > 0.02) return 14;
  if (span > 0.008) return 15;
  return 16;
}

export function resolveMapViewport(params: {
  gisBootstrap?: GisBootstrapPayload | null;
  villageProfile?: Partial<VillageProfile> | null;
  facilities?: MapFacility[];
  parcels?: LandParcel[];
  toddlers?: ToddlerRecord[];
}): ResolvedMapViewport {
  const { gisBootstrap, villageProfile, facilities = [], parcels = [], toddlers = [] } = params;

  const boundary = gisBootstrap?.activeBoundary;
  if (boundary) {
    const boundaryBounds = bboxToLeafletBounds(boundary.bbox);
    if (
      isValidCoordinatePair(boundary.centroidLat, boundary.centroidLng) &&
      boundary.centroidLat != null &&
      boundary.centroidLng != null
    ) {
      return {
        center: [boundary.centroidLat, boundary.centroidLng],
        zoom: calculateZoomFromBBox(boundary.bbox),
        bbox: boundary.bbox || null,
        leafletBounds: boundaryBounds,
        source: 'boundary',
        isConfigured: true
      };
    }

    const polygons = geoJsonGeometryToLeafletPolygons(boundary.geometryGeoJson);
    const flatPoints = polygons.flatMap((poly) => poly[0] || []);
    const centroid = computeCentroidFromLeafletCoords(flatPoints);
    const computedBBox = boundary.bbox || computeBoundingBoxFromLeafletCoords(flatPoints);
    if (centroid) {
      return {
        center: centroid,
        zoom: calculateZoomFromBBox(computedBBox),
        bbox: computedBBox,
        leafletBounds: bboxToLeafletBounds(computedBBox),
        source: 'boundary',
        isConfigured: true
      };
    }
  }

  const cfg = gisBootstrap?.config;
  if (cfg && isValidCoordinatePair(cfg.centerLat, cfg.centerLng)) {
    const cfgBounds = bboxToLeafletBounds(cfg.bbox);
    return {
      center: [Number(cfg.centerLat), Number(cfg.centerLng)],
      zoom: cfg.defaultZoom || calculateZoomFromBBox(cfg.bbox) || 14,
      bbox: cfg.bbox || null,
      leafletBounds: cfgBounds,
      source: 'gis_config',
      isConfigured: true
    };
  }

  const officeLat = villageProfile?.officeLocation?.lat;
  const officeLng = villageProfile?.officeLocation?.lng;
  if (isValidCoordinatePair(officeLat, officeLng)) {
    return {
      center: [Number(officeLat), Number(officeLng)],
      zoom: 15,
      bbox: null,
      leafletBounds: null,
      source: 'office_location',
      isConfigured: true
    };
  }

  const allPoints: [number, number][] = [];
  for (const fac of facilities) {
    if (fac.coordinates && isValidCoordinatePair(fac.coordinates[0], fac.coordinates[1])) {
      allPoints.push([fac.coordinates[0], fac.coordinates[1]]);
    }
  }
  for (const parcel of parcels) {
    if (Array.isArray(parcel.coordinates)) {
      for (const pt of parcel.coordinates) {
        if (Array.isArray(pt) && isValidCoordinatePair(pt[0], pt[1])) {
          allPoints.push([pt[0], pt[1]]);
        }
      }
    }
  }
  for (const toddler of toddlers) {
    if (toddler.coordinates && isValidCoordinatePair(toddler.coordinates[0], toddler.coordinates[1])) {
      allPoints.push([toddler.coordinates[0], toddler.coordinates[1]]);
    }
  }

  const dataCentroid = computeCentroidFromLeafletCoords(allPoints);
  if (dataCentroid) {
    const bbox = computeBoundingBoxFromLeafletCoords(allPoints);
    return {
      center: dataCentroid,
      zoom: Math.min(16, Math.max(13, calculateZoomFromBBox(bbox))),
      bbox,
      leafletBounds: bboxToLeafletBounds(bbox),
      source: 'data_centroid',
      isConfigured: true
    };
  }

  return {
    center: NEUTRAL_INDONESIA_CENTER,
    zoom: NEUTRAL_INDONESIA_ZOOM,
    bbox: null,
    leafletBounds: null,
    source: 'neutral_fallback',
    isConfigured: false
  };
}

export function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function buildGoogleMapsLocationUrl(
  lat?: number | null,
  lng?: number | null,
  labelQuery?: string
): string {
  if (isValidCoordinatePair(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const cleanLabel = (labelQuery || '').trim();
  return cleanLabel
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanLabel)}`
    : 'https://www.google.com/maps';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
