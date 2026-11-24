import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import '@maplibre/maplibre-gl-leaflet';
import { MapMode } from '../types/webgis';

let maplibreWorkerConfigured = false;

function ensureMaplibreWorkerUrl(): void {
  if (maplibreWorkerConfigured || typeof window === 'undefined') return;
  try {
    const resolvedUrl =
      maplibreWorkerUrl.startsWith('http://') ||
      maplibreWorkerUrl.startsWith('https://') ||
      maplibreWorkerUrl.startsWith('blob:')
        ? maplibreWorkerUrl
        : new URL(maplibreWorkerUrl, window.location.origin).href;
    setWorkerUrl(resolvedUrl);
    maplibreWorkerConfigured = true;
  } catch {
    // Biarkan fallback raster mengambil alih bila konfigurasi worker gagal
  }
}

export interface MapProviderDefinition {
  id: string;
  mode: MapMode;
  label: string;
  shortLabel: string;
  renderEngine: 'vector-maplibre' | 'raster-tile';
  urlOrStyle: string | Record<string, unknown>;
  subdomains?: string[];
  minZoom: number;
  maxNativeZoom: number;
  maxZoom: number;
  attribution: string;
  requiresApiKey: boolean;
  commercialAllowedWithoutKey: boolean;
  licenseName: string;
  usagePolicyNote: string;
  isCoarseResolution?: boolean;
}

export interface TenantProviderOverrides {
  customSatelliteTileUrl?: string | null;
  activeProviderId?: string | null;
}

export interface AttachedBasemapHandle {
  provider: MapProviderDefinition;
  usedFallback: boolean;
  fallbackReason?: string;
  cleanup: () => void;
}

const ENV_CUSTOM_SATELLITE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SATELLITE_TILE_URL) || '';

const ENV_CUSTOM_SATELLITE_ATTRIBUTION =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SATELLITE_ATTRIBUTION) ||
  'Citra Satelit Berlisensi';

const ENV_ARCGIS_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ARCGIS_API_KEY) || '';

const NASA_GIBS_COMPOSITE_DATE = '2024-08-15';

function buildTerrainHillshadeStyle(): Record<string, unknown> {
  return {
    version: 8,
    name: 'SADEWA Terrain OpenFreeMap + AWS Terrarium',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      },
      terrain_dem: {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution:
          'Elevation tiles courtesy of AWS Terrain Tiles / Mapzen (Tilezen Joerd attribution)'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f4f6f1' }
      },
      {
        id: 'landcover-park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: {
          'fill-color': '#e2ecd9',
          'fill-opacity': 0.7
        }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#aadaff' }
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': '#8ec5f0', 'line-width': 1.2 }
      },
      {
        id: 'hillshade-relief',
        type: 'hillshade',
        source: 'terrain_dem',
        paint: {
          'hillshade-exaggeration': 0.55,
          'hillshade-shadow-color': '#475569',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#64748b'
        }
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track', 'path'],
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2.5],
          'line-opacity': 0.85
        }
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk', 'motorway'],
        paint: {
          'line-color': '#f59e0b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3.8],
          'line-opacity': 0.9
        }
      },
      {
        id: 'boundary-admin',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        paint: {
          'line-color': '#94a3b8',
          'line-width': 1,
          'line-dasharray': [3, 2]
        }
      }
    ]
  };
}

function buildHybridVectorOverlayStyle(): Record<string, unknown> {
  return {
    version: 8,
    name: 'SADEWA Hybrid Transparent Vector Overlay',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      {
        id: 'hybrid-waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': '#38bdf8', 'line-width': 1.5, 'line-opacity': 0.85 }
      },
      {
        id: 'hybrid-roads-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        paint: {
          'line-color': '#f8fafc',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 2.4],
          'line-opacity': 0.85
        }
      },
      {
        id: 'hybrid-roads-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk', 'motorway'],
        paint: {
          'line-color': '#fbbf24',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 15, 4],
          'line-opacity': 0.95
        }
      },
      {
        id: 'hybrid-boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        paint: {
          'line-color': '#f472b6',
          'line-width': 1.2,
          'line-dasharray': [4, 2]
        }
      }
    ]
  };
}

export const MAP_PROVIDER_REGISTRY: Record<string, MapProviderDefinition> = {
  openfreemap_liberty: {
    id: 'openfreemap_liberty',
    mode: 'roadmap',
    label: 'Peta Jalan Vektor (OpenFreeMap)',
    shortLabel: 'Peta Jalan',
    renderEngine: 'vector-maplibre',
    urlOrStyle: 'https://tiles.openfreemap.org/styles/liberty',
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; OpenMapTiles &copy; OpenStreetMap contributors',
    requiresApiKey: false,
    commercialAllowedWithoutKey: true,
    licenseName: 'OpenFreeMap + ODbL (Commercial SaaS Allowed)',
    usagePolicyNote: 'Gratis tanpa API key & diizinkan untuk aplikasi SaaS komersial.'
  },
  openfreemap_bright: {
    id: 'openfreemap_bright',
    mode: 'roadmap',
    label: 'Peta Jalan Kontras (OpenFreeMap Bright)',
    shortLabel: 'Peta Cerah',
    renderEngine: 'vector-maplibre',
    urlOrStyle: 'https://tiles.openfreemap.org/styles/bright',
    minZoom: 1,
    maxNativeZoom: 18,
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; OpenMapTiles &copy; OpenStreetMap contributors',
    requiresApiKey: false,
    commercialAllowedWithoutKey: true,
    licenseName: 'OpenFreeMap + ODbL (Commercial SaaS Allowed)',
    usagePolicyNote: 'Gratis tanpa API key & diizinkan untuk aplikasi SaaS komersial.'
  },
  openfreemap_terrain: {
    id: 'openfreemap_terrain',
    mode: 'terrain',
    label: 'Kontur & Relief Medan (OpenFreeMap + AWS Terrarium)',
    shortLabel: 'Medan',
    renderEngine: 'vector-maplibre',
    urlOrStyle: buildTerrainHillshadeStyle(),
    minZoom: 1,
    maxNativeZoom: 15,
    maxZoom: 19,
    attribution:
      '&copy; OpenFreeMap &copy; OpenStreetMap contributors | Elevation: AWS Terrain Tiles (Tilezen Joerd)',
    requiresApiKey: false,
    commercialAllowedWithoutKey: true,
    licenseName: 'OpenFreeMap + AWS Open Data Sponsorship',
    usagePolicyNote: 'Gratis tanpa API key & diizinkan untuk komersial dengan atribusi sumber elevasi.'
  },
  nasa_gibs_truecolor: {
    id: 'nasa_gibs_truecolor',
    mode: 'satellite',
    label: 'Citra Satelit Publik (NASA GIBS MODIS)',
    shortLabel: 'Satelit',
    renderEngine: 'raster-tile',
    urlOrStyle: `https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${NASA_GIBS_COMPOSITE_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    subdomains: ['a', 'b', 'c'],
    minZoom: 1,
    maxNativeZoom: 9,
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://earthdata.nasa.gov" target="_blank" rel="noreferrer">NASA EOSDIS GIBS</a> (Public Domain)',
    requiresApiKey: false,
    commercialAllowedWithoutKey: true,
    licenseName: 'US Government Public Domain / NASA Open Data',
    usagePolicyNote:
      'Legal untuk komersial tanpa API key (resolusi regional ~250m; untuk citra desa resolusi <1m dapat ditambahkan URL satelit berlisensi).',
    isCoarseResolution: true
  },
  osm_standard_emergency: {
    id: 'osm_standard_emergency',
    mode: 'roadmap',
    label: 'OpenStreetMap Raster (Fallback Non-WebGL)',
    shortLabel: 'Peta Cadangan',
    renderEngine: 'raster-tile',
    urlOrStyle: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 1,
    maxNativeZoom: 19,
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors (Fallback Non-WebGL)',
    requiresApiKey: false,
    commercialAllowedWithoutKey: false,
    licenseName: 'OSM Tile Usage Policy (Limited Fallback Only)',
    usagePolicyNote:
      'Hanya dipakai otomatis sebagai cadangan jika perangkat tidak mendukung WebGL atau OpenFreeMap tidak dapat dijangkau.'
  }
};

export const MAP_MODE_OPTIONS: { mode: MapMode; label: string }[] = [
  { mode: 'roadmap', label: 'Peta Jalan' },
  { mode: 'satellite', label: 'Satelit' },
  { mode: 'hybrid', label: 'Hybrid' },
  { mode: 'terrain', label: 'Medan' }
];

export function hasWebGLSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function getLicensedSatelliteProvider(
  overrides?: TenantProviderOverrides
): MapProviderDefinition | null {
  const customUrl = (overrides?.customSatelliteTileUrl || ENV_CUSTOM_SATELLITE_URL || '').trim();
  if (customUrl) {
    return {
      id: 'tenant_licensed_satellite',
      mode: 'satellite',
      label: 'Citra Satelit Berlisensi',
      shortLabel: 'Satelit',
      renderEngine: 'raster-tile',
      urlOrStyle: customUrl,
      minZoom: 1,
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: ENV_CUSTOM_SATELLITE_ATTRIBUTION,
      requiresApiKey: true,
      commercialAllowedWithoutKey: false,
      licenseName: 'Custom Licensed Satellite Source',
      usagePolicyNote: 'Menggunakan sumber citra satelit terkonfigurasi.'
    };
  }

  if (ENV_ARCGIS_API_KEY.trim()) {
    return {
      id: 'esri_world_imagery_licensed',
      mode: 'satellite',
      label: 'Esri World Imagery (Berlisensi)',
      shortLabel: 'Satelit',
      renderEngine: 'raster-tile',
      urlOrStyle: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(
        ENV_ARCGIS_API_KEY.trim()
      )}`,
      minZoom: 1,
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
      requiresApiKey: true,
      commercialAllowedWithoutKey: false,
      licenseName: 'ArcGIS Location Platform (API Key)',
      usagePolicyNote: 'Aktif menggunakan kunci lisensi ArcGIS yang dikonfigurasi.'
    };
  }

  return null;
}

export function resolveProviderForMode(
  mode: MapMode,
  overrides?: TenantProviderOverrides
): {
  primary: MapProviderDefinition;
  overlayStyle?: Record<string, unknown>;
  fallback: MapProviderDefinition;
  hasHighResSatellite: boolean;
} {
  const licensedSat = getLicensedSatelliteProvider(overrides);

  if (mode === 'satellite') {
    const sat = licensedSat || MAP_PROVIDER_REGISTRY.nasa_gibs_truecolor;
    return {
      primary: sat,
      fallback: MAP_PROVIDER_REGISTRY.nasa_gibs_truecolor,
      hasHighResSatellite: Boolean(licensedSat)
    };
  }

  if (mode === 'hybrid') {
    const sat = licensedSat || MAP_PROVIDER_REGISTRY.nasa_gibs_truecolor;
    return {
      primary: sat,
      overlayStyle: buildHybridVectorOverlayStyle(),
      fallback: MAP_PROVIDER_REGISTRY.openfreemap_liberty,
      hasHighResSatellite: Boolean(licensedSat)
    };
  }

  if (mode === 'terrain') {
    return {
      primary: MAP_PROVIDER_REGISTRY.openfreemap_terrain,
      fallback: MAP_PROVIDER_REGISTRY.osm_standard_emergency,
      hasHighResSatellite: Boolean(licensedSat)
    };
  }

  const preferredId = overrides?.activeProviderId;
  const primaryRoadmap =
    preferredId && MAP_PROVIDER_REGISTRY[preferredId]?.mode === 'roadmap'
      ? MAP_PROVIDER_REGISTRY[preferredId]
      : MAP_PROVIDER_REGISTRY.openfreemap_liberty;

  return {
    primary: primaryRoadmap,
    fallback: MAP_PROVIDER_REGISTRY.osm_standard_emergency,
    hasHighResSatellite: Boolean(licensedSat)
  };
}

function createRasterLayer(provider: MapProviderDefinition): L.TileLayer {
  const opts: L.TileLayerOptions = {
    minZoom: provider.minZoom,
    maxNativeZoom: provider.maxNativeZoom,
    maxZoom: provider.maxZoom,
    attribution: provider.attribution,
    crossOrigin: 'anonymous'
  };
  if (provider.subdomains && provider.subdomains.length > 0) {
    opts.subdomains = provider.subdomains;
  }
  return L.tileLayer(String(provider.urlOrStyle), opts);
}

export function attachBasemapToLeaflet(
  map: L.Map,
  mode: MapMode,
  overrides?: TenantProviderOverrides
): AttachedBasemapHandle {
  const { primary, overlayStyle, fallback, hasHighResSatellite } = resolveProviderForMode(
    mode,
    overrides
  );

  const attachedLayers: L.Layer[] = [];
  let disposed = false;
  let usedFallback = false;
  let fallbackReason: string | undefined;

  const clearAttached = () => {
    while (attachedLayers.length > 0) {
      const layer = attachedLayers.pop();
      if (layer && map.hasLayer(layer)) {
        try {
          map.removeLayer(layer);
        } catch {
          // Abaikan error pelepasan layer jika kontainer peta sudah dibersihkan
        }
      }
    }
  };

  const attachFallbackLayer = (reason: string) => {
    if (disposed || usedFallback) return;
    usedFallback = true;
    fallbackReason = reason;
    clearAttached();
    const fallbackRaster = createRasterLayer(fallback);
    fallbackRaster.addTo(map);
    attachedLayers.push(fallbackRaster);
  };

  const webglReady = hasWebGLSupport();

  if (primary.renderEngine === 'vector-maplibre') {
    if (!webglReady) {
      attachFallbackLayer('Perangkat/browser tidak mengaktifkan akselerasi WebGL.');
      return {
        provider: fallback,
        usedFallback: true,
        fallbackReason,
        cleanup: () => {
          disposed = true;
          clearAttached();
        }
      };
    }

    try {
      ensureMaplibreWorkerUrl();
      const glLayer = L.maplibreGL({
        style: primary.urlOrStyle,
        attribution: primary.attribution,
        interactive: false
      });
      glLayer.addTo(map);
      attachedLayers.push(glLayer);

      const glMap = glLayer.getMaplibreMap() as {
        once?: (event: string, cb: () => void) => void;
        on?: (event: string, cb: () => void) => void;
      } | null;
      if (glMap && typeof glMap.on === 'function') {
        let styleLoaded = false;
        glMap.once?.('styledata', () => {
          styleLoaded = true;
        });
        glMap.on('error', () => {
          if (!styleLoaded) {
            attachFallbackLayer('Gaya peta vektor OpenFreeMap tidak dapat dimuat; beralih ke fallback.');
          }
        });
      }
    } catch {
      attachFallbackLayer('Gagal menginisialisasi renderer vektor OpenFreeMap.');
    }
  } else {
    const raster = createRasterLayer(primary);
    let tileErrors = 0;
    raster.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 6 && primary.id !== fallback.id) {
        attachFallbackLayer('Sumber citra utama mengalami gangguan jaringan.');
      }
    });
    raster.addTo(map);
    attachedLayers.push(raster);

    if (overlayStyle && webglReady) {
      try {
        ensureMaplibreWorkerUrl();
        const hybridOverlay = L.maplibreGL({
          style: overlayStyle,
          attribution: '&copy; OpenFreeMap &copy; OpenStreetMap contributors',
          interactive: false
        });
        hybridOverlay.addTo(map);
        attachedLayers.push(hybridOverlay);

        const hybridGlMap = hybridOverlay.getMaplibreMap() as {
          on?: (event: string, cb: () => void) => void;
        } | null;
        hybridGlMap?.on?.('error', () => {
          // Hybrid tetap tampil dengan citra satelit walaupun overlay vektor gagal
        });
      } catch {
        // Hybrid tetap tampil dengan citra satelit walaupun overlay vektor gagal
      }
    }
  }

  if (!hasHighResSatellite && (mode === 'satellite' || mode === 'hybrid')) {
    fallbackReason =
      'Menampilkan citra satelit publik NASA GIBS (resolusi regional, legal komersial tanpa API key). Untuk citra desa resolusi tinggi dapat dikonfigurasi sumber satelit berlisensi.';
  }

  return {
    provider: usedFallback ? fallback : primary,
    usedFallback,
    fallbackReason,
    cleanup: () => {
      disposed = true;
      clearAttached();
    }
  };
}
