import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { FacilityPoint } from '../../types';
import { MapMode } from '../../types/webgis';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  attachBasemapToLeaflet,
  MAP_MODE_OPTIONS
} from '../../config/mapProviderRegistry';
import { calculatePolygonAreaShoelace } from '../../utils/geometryEngine';
import {
  applyDisplayOverlapOffsets,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsLocationUrl,
  escapeHtml,
  geoJsonGeometryToLeafletPolygons,
  isValidCoordinatePair,
  normalizeCoordinatePair,
  resolveMapViewport
} from '../../utils/gisAdapter';
import {
  MapPin,
  Building2,
  Phone,
  Compass,
  Navigation,
  ExternalLink,
  Info,
  Map as MapIcon,
  Grid,
  Layers,
  AlertTriangle,
  Clock,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

const MAP_CATEGORIES = [
  { key: 'all', label: 'Semua Fasilitas', color: '#047857' },
  { key: 'kantor_desa', label: 'Kantor & Balai', color: '#b45309' },
  { key: 'kesehatan', label: 'Kesehatan', color: '#0284c7' },
  { key: 'pendidikan', label: 'Pendidikan', color: '#7c3aed' },
  { key: 'ibadah', label: 'Tempat Ibadah', color: '#059669' },
  { key: 'infrastruktur', label: 'Sarana & Utilitas', color: '#d97706' },
  { key: 'ekonomi', label: 'Ekonomi & Koperasi', color: '#e11d48' },
  { key: 'wisata', label: 'Wisata', color: '#0d9488' },
  { key: 'olahraga', label: 'Olahraga', color: '#4f46e5' },
  { key: 'lainnya', label: 'Lainnya', color: '#475569' }
];

function getVerificationLabel(status?: string): string {
  if (status === 'TERVERIFIKASI') return 'Terverifikasi';
  if (status === 'BELUM_TERVERIFIKASI') return 'Belum Terverifikasi';
  return 'Perlu Verifikasi';
}

function buildFacilityPopupElement(facility: FacilityPoint, lat: number, lng: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.fontFamily = 'inherit';
  wrap.style.fontSize = '12px';
  wrap.style.maxWidth = '240px';
  wrap.style.padding = '4px';

  const title = document.createElement('strong');
  title.style.fontSize = '13px';
  title.style.color = '#0f172a';
  title.style.display = 'block';
  title.style.marginBottom = '4px';
  title.textContent = facility.name;
  wrap.appendChild(title);

  const metaRow = document.createElement('div');
  metaRow.style.display = 'flex';
  metaRow.style.flexWrap = 'wrap';
  metaRow.style.gap = '4px';
  metaRow.style.marginBottom = '6px';

  const cat = document.createElement('span');
  cat.style.fontSize = '10px';
  cat.style.color = '#047857';
  cat.style.textTransform = 'uppercase';
  cat.style.fontWeight = 'bold';
  cat.textContent = facility.category.replace(/_/g, ' ');
  metaRow.appendChild(cat);

  const ver = document.createElement('span');
  ver.style.fontSize = '10px';
  ver.style.padding = '1px 6px';
  ver.style.borderRadius = '4px';
  ver.style.fontWeight = 'bold';
  ver.style.backgroundColor = facility.verificationStatus === 'TERVERIFIKASI' ? '#d1fae5' : '#fef3c7';
  ver.style.color = facility.verificationStatus === 'TERVERIFIKASI' ? '#065f46' : '#92400e';
  ver.textContent = getVerificationLabel(facility.verificationStatus);
  metaRow.appendChild(ver);
  wrap.appendChild(metaRow);

  if (facility.description) {
    const desc = document.createElement('p');
    desc.style.color = '#475569';
    desc.style.margin = '0 0 6px 0';
    desc.style.lineHeight = '1.4';
    desc.textContent = facility.description;
    wrap.appendChild(desc);
  }

  const addr = document.createElement('div');
  addr.style.fontSize = '11px';
  addr.style.color = '#64748b';
  addr.style.marginBottom = '6px';
  addr.textContent = facility.plusCode ? `${facility.address} (${facility.plusCode})` : facility.address;
  wrap.appendChild(addr);

  const link = document.createElement('a');
  link.href = buildGoogleMapsDirectionsUrl(lat, lng);
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.style.display = 'inline-block';
  link.style.backgroundColor = '#047857';
  link.style.color = '#ffffff';
  link.style.padding = '5px 10px';
  link.style.borderRadius = '8px';
  link.style.textDecoration = 'none';
  link.style.fontSize = '11px';
  link.style.fontWeight = 'bold';
  link.textContent = 'Buka Rute Navigasi';
  wrap.appendChild(link);

  return wrap;
}

export const VillageMapView: React.FC = () => {
  const { facilities, villageProfile, webGisData, gisBootstrap, navigateTo, addToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'interactive' | 'grid'>('interactive');
  const [mapMode, setMapMode] = useState<MapMode>(
    gisBootstrap?.config?.defaultMapMode || 'roadmap'
  );
  const [showBoundary, setShowBoundary] = useState<boolean>(
    gisBootstrap?.config?.showVillageBoundary ?? true
  );
  const [showNeighborBounds, setShowNeighborBounds] = useState<boolean>(true);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>('Peta Jalan');

  const safeFacilities = useMemo(
    () => (facilities || []).filter((f) => f.isActive !== false),
    [facilities]
  );

  const [activeFacility, setActiveFacility] = useState<FacilityPoint | undefined>(() =>
    safeFacilities.length > 0 ? safeFacilities[0] : undefined
  );

  const visibleBoundaryList = useMemo(() => {
    if (gisBootstrap?.visibleBoundaries && gisBootstrap.visibleBoundaries.length > 0) {
      return gisBootstrap.visibleBoundaries;
    }
    return gisBootstrap?.activeBoundary ? [gisBootstrap.activeBoundary] : [];
  }, [gisBootstrap?.visibleBoundaries, gisBootstrap?.activeBoundary]);

  const hasMainBoundary = useMemo(
    () => visibleBoundaryList.some((b) => b.boundaryRole !== 'NEIGHBOR_VILLAGE'),
    [visibleBoundaryList]
  );

  const hasNeighborBoundary = useMemo(
    () => visibleBoundaryList.some((b) => b.boundaryRole === 'NEIGHBOR_VILLAGE'),
    [visibleBoundaryList]
  );

  const neighborBoundary = useMemo(
    () => visibleBoundaryList.find((b) => b.boundaryRole === 'NEIGHBOR_VILLAGE'),
    [visibleBoundaryList]
  );

  const neighborAreaFormatted = useMemo(() => {
    if (!neighborBoundary) return '';
    if (typeof neighborBoundary.areaSqM === 'number' && neighborBoundary.areaSqM > 0) {
      return `${(neighborBoundary.areaSqM / 10000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha`;
    }
    if (neighborBoundary.geometryGeoJson) {
      const polys = geoJsonGeometryToLeafletPolygons(neighborBoundary.geometryGeoJson);
      if (polys.length > 0 && polys[0].length > 0 && polys[0][0].length >= 3) {
        const calc = calculatePolygonAreaShoelace(polys[0][0]);
        if (calc.areaHectares > 0) return calc.formattedAreaHectares;
      }
    }
    return '';
  }, [neighborBoundary]);

  const filtered = useMemo(
    () =>
      selectedCategory === 'all'
        ? safeFacilities
        : safeFacilities.filter((f) => f.category === selectedCategory),
    [safeFacilities, selectedCategory]
  );

  const viewport = useMemo(
    () =>
      resolveMapViewport({
        gisBootstrap,
        villageProfile,
        facilities: safeFacilities,
        parcels: webGisData
      }),
    [gisBootstrap, villageProfile, safeFacilities, webGisData]
  );

  useEffect(() => {
    if (safeFacilities.length === 0) {
      if (activeFacility) setActiveFacility(undefined);
      return;
    }
    if (!activeFacility || !safeFacilities.some((f) => f.id === activeFacility.id)) {
      setActiveFacility(safeFacilities[0]);
    }
  }, [activeFacility, safeFacilities]);

  useEffect(() => {
    if (gisBootstrap?.config?.defaultMapMode) {
      setMapMode(gisBootstrap.config.defaultMapMode);
    }
    if (typeof gisBootstrap?.config?.showVillageBoundary === 'boolean') {
      setShowBoundary(gisBootstrap.config.showVillageBoundary);
    }
  }, [gisBootstrap?.config?.defaultMapMode, gisBootstrap?.config?.showVillageBoundary]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const basemapCleanupRef = useRef<(() => void) | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker | L.Polygon }>({});
  const lastViewportKeyRef = useRef<string>('');
  const nativeFullscreenActiveRef = useRef<boolean>(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    const el = wrapperRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    if (!el) return;
    try {
      if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen();
        nativeFullscreenActiveRef.current = true;
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        await el.webkitRequestFullscreen();
        nativeFullscreenActiveRef.current = true;
      }
    } catch {
      nativeFullscreenActiveRef.current = false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    try {
      if (document.fullscreenElement) {
        nativeFullscreenActiveRef.current = false;
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen && nativeFullscreenActiveRef.current) {
        nativeFullscreenActiveRef.current = false;
        await doc.webkitExitFullscreen();
      }
    } catch {
      nativeFullscreenActiveRef.current = false;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      void exitFullscreen();
    } else {
      void enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Sinkronisasi native fullscreenchange, ESC, dan body scroll lock
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const fsEl = document.fullscreenElement || doc.webkitFullscreenElement || null;
      if (!fsEl && nativeFullscreenActiveRef.current) {
        nativeFullscreenActiveRef.current = false;
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        void exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, exitFullscreen]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    });
    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 180);
    return () => {
      if (raf1) window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [isFullscreen]);

  // Inisialisasi peta & ganti basemap dari mapProviderRegistry
  useEffect(() => {
    if (viewMode !== 'interactive' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: viewport.center,
        zoom: viewport.zoom,
        zoomControl: true,
        scrollWheelZoom: true
      });
      leafletMapRef.current = map;
      overlayLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = leafletMapRef.current;

    if (basemapCleanupRef.current) {
      basemapCleanupRef.current();
      basemapCleanupRef.current = null;
    }

    const handle = attachBasemapToLeaflet(map, mapMode, {
      customSatelliteTileUrl: gisBootstrap?.config?.customSatelliteTileUrl,
      activeProviderId: gisBootstrap?.config?.activeProviderId
    });
    basemapCleanupRef.current = handle.cleanup;
    setProviderLabel(handle.provider.shortLabel);
    setProviderNotice(handle.fallbackReason || null);

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
    };
  }, [
    viewMode,
    mapMode,
    gisBootstrap?.config?.customSatelliteTileUrl,
    gisBootstrap?.config?.activeProviderId
  ]);

  // Bersihkan instance Leaflet saat pindah ke grid atau unmount
  useEffect(() => {
    if (viewMode !== 'interactive' && leafletMapRef.current) {
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
      overlayLayerRef.current = null;
      lastViewportKeyRef.current = '';
    }
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        overlayLayerRef.current = null;
      }
    };
  }, []);

  // Sesuaikan viewport ketika data GIS tenant / batas wilayah ter-load
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || viewMode !== 'interactive') return;

    const vpKey = `${viewport.source}:${viewport.center[0].toFixed(4)},${viewport.center[1].toFixed(4)}:${viewport.zoom}`;
    if (lastViewportKeyRef.current === vpKey) return;
    lastViewportKeyRef.current = vpKey;

    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [viewport, viewMode]);

  // Render marker fasilitas, persil SPORADIK, dan garis batas wilayah desa
  useEffect(() => {
    const map = leafletMapRef.current;
    const overlayGroup = overlayLayerRef.current;
    if (viewMode !== 'interactive' || !map || !overlayGroup) return;

    overlayGroup.clearLayers();
    markersRef.current = {};

    // 1. Render batas wilayah desa utama & desa sebelah (jika ada & diaktifkan)
    visibleBoundaryList.forEach((boundary) => {
      if (!boundary.geometryGeoJson) return;
      const isNeighbor = boundary.boundaryRole === 'NEIGHBOR_VILLAGE';
      if (isNeighbor && !showNeighborBounds) return;
      if (!isNeighbor && !showBoundary) return;

      const polygons = geoJsonGeometryToLeafletPolygons(boundary.geometryGeoJson);
      const boundaryColor =
        boundary.fillColor ||
        (isNeighbor ? '#0284c7' : gisBootstrap?.config?.boundaryColor || '#ec4899');
      const displayName =
        boundary.villageName ||
        boundary.sourceName ||
        (isNeighbor ? 'Desa Tetangga' : villageProfile.villageName || 'Desa');

      polygons.forEach((rings, ringIdx) => {
        const boundaryLayer = L.polygon(rings, {
          color: boundaryColor,
          weight: isNeighbor ? 2.2 : 3,
          dashArray: isNeighbor ? '5, 5' : '8, 5',
          fillColor: boundaryColor,
          fillOpacity: isNeighbor ? 0.1 : 0.08
        });

        let ringAreaStr = '';
        if (typeof boundary.areaSqM === 'number' && boundary.areaSqM > 0) {
          ringAreaStr = `${(boundary.areaSqM / 10000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha`;
        } else if (rings.length > 0 && rings[0].length >= 3) {
          const calc = calculatePolygonAreaShoelace(rings[0]);
          if (calc.areaHectares > 0) ringAreaStr = calc.formattedAreaHectares;
        }

        // Tooltip interaktif saat di-hover / di-klik (hanya muncul saat interaksi, tidak menutupi peta secara permanen)
        const hoverTip = document.createElement('div');
        hoverTip.className = 'font-sans text-xs text-slate-800 p-1';
        const tipTitle = document.createElement('strong');
        tipTitle.className = 'block text-xs font-bold text-slate-900';
        tipTitle.textContent = displayName;
        hoverTip.appendChild(tipTitle);

        if (ringAreaStr) {
          const areaDiv = document.createElement('div');
          areaDiv.className = 'text-[11px] font-semibold text-emerald-700 mt-0.5';
          areaDiv.textContent = `Luas Wilayah: ${ringAreaStr}`;
          hoverTip.appendChild(areaDiv);
        }

        const tipStatus = document.createElement('div');
        tipStatus.className = 'text-[10px] text-slate-500 mt-0.5';
        tipStatus.textContent = `Status: ${boundary.status === 'TERVERIFIKASI' ? 'Terverifikasi' : 'Belum Terverifikasi'}`;
        hoverTip.appendChild(tipStatus);

        boundaryLayer.bindTooltip(hoverTip, { sticky: true });

        // Label teks luas di peta: TANPA kontainer kotak (transparan, tidak menghalangi peta atau fasilitas)
        if (ringIdx === 0 && ringAreaStr) {
          const cleanLabelEl = document.createElement('div');
          cleanLabelEl.className = 'gis-boundary-clean-label';
          cleanLabelEl.innerHTML = `<span style="font-weight: 800; font-size: 11px; color: ${boundaryColor}; text-shadow: 0 0 3px #ffffff, 0 0 6px #ffffff, 0 0 9px #ffffff, 1px 1px 0 #ffffff, -1px -1px 0 #ffffff; white-space: nowrap; pointer-events: none;">Luas: ${ringAreaStr}</span>`;

          boundaryLayer.bindTooltip(cleanLabelEl, {
            permanent: true,
            direction: 'top',
            className: 'gis-boundary-clean-label',
            offset: [0, -8]
          });
        }

        overlayGroup.addLayer(boundaryLayer);
      });
    });

    // 2. Render pin fasilitas umum (dengan display-only offset untuk titik bertumpuk)
    const offsetMarkers = applyDisplayOverlapOffsets(filtered);
    offsetMarkers.forEach(({ item: facility, lat, lng, displayLat, displayLng }) => {
      const catConfig = MAP_CATEGORIES.find((c) => c.key === facility.category) || { color: '#047857' };
      const safeTitle = escapeHtml(facility.name);

      const markerIcon = L.divIcon({
        className: 'custom-div-marker',
        html: `
          <div style="
            background-color: ${catConfig.color};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            cursor: pointer;
          " title="${safeTitle}">
            <span style="width:10px;height:10px;border-radius:9999px;background:#ffffff;display:block;"></span>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([displayLat, displayLng], { icon: markerIcon });
      marker.bindPopup(buildFacilityPopupElement(facility, lat, lng));
      marker.on('click', () => {
        setActiveFacility(facility);
      });

      overlayGroup.addLayer(marker);
      markersRef.current[facility.id] = marker;
    });

    // 3. Render persil SPORADIK terbit (hanya saat filter semua)
    if (selectedCategory === 'all' && webGisData && webGisData.length > 0) {
      webGisData.forEach((parcel) => {
        if (parcel.sporadikStatus === 'SPORADIK_TERBIT' && parcel.coordinates && parcel.coordinates.length > 2) {
          const polygon = L.polygon(parcel.coordinates, {
            color: '#10b981',
            weight: 2,
            fillColor: '#34d399',
            fillOpacity: 0.4
          });

          const popupEl = document.createElement('div');
          popupEl.style.fontFamily = 'inherit';
          popupEl.style.fontSize = '12px';
          popupEl.style.minWidth = '180px';

          const badge = document.createElement('div');
          badge.style.backgroundColor = '#047857';
          badge.style.color = '#ffffff';
          badge.style.padding = '4px 8px';
          badge.style.borderRadius = '4px';
          badge.style.fontWeight = 'bold';
          badge.style.fontSize = '10px';
          badge.style.display = 'inline-block';
          badge.style.marginBottom = '6px';
          badge.textContent = 'SPORADIK TERBIT';
          popupEl.appendChild(badge);

          const ownerEl = document.createElement('strong');
          ownerEl.style.display = 'block';
          ownerEl.style.fontSize = '13px';
          ownerEl.style.color = '#0f172a';
          ownerEl.style.marginBottom = '2px';
          ownerEl.textContent = `Bidang Tanah: ${parcel.ownerName}`;
          popupEl.appendChild(ownerEl);

          const areaEl = document.createElement('div');
          areaEl.style.fontSize = '11px';
          areaEl.style.color = '#475569';
          areaEl.style.marginBottom = '8px';
          areaEl.textContent = `Luas: ${parcel.landAreaSqM} m² / ${parcel.landAreaHectares} Ha`;
          popupEl.appendChild(areaEl);

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.style.backgroundColor = '#0f172a';
          btn.style.color = '#ffffff';
          btn.style.border = 'none';
          btn.style.padding = '6px 12px';
          btn.style.borderRadius = '6px';
          btn.style.fontSize = '11px';
          btn.style.cursor = 'pointer';
          btn.style.width = '100%';
          btn.style.fontWeight = 'bold';
          btn.textContent = 'Lihat Berkas Surat';
          btn.addEventListener('click', () => {
            if (parcel.sporadikRequestCode) {
              navigateTo('layanan', { trackingCode: parcel.sporadikRequestCode });
            } else {
              addToast('warning', 'Berkas Tidak Ditemukan', 'Kode resi berkas SPORADIK belum tersedia pada data persil ini.');
            }
          });
          popupEl.appendChild(btn);

          polygon.bindPopup(popupEl);
          overlayGroup.addLayer(polygon);
          markersRef.current[parcel.id] = polygon;
        }
      });
    }
  }, [
    filtered,
    viewMode,
    webGisData,
    selectedCategory,
    navigateTo,
    addToast,
    showBoundary,
    showNeighborBounds,
    visibleBoundaryList,
    gisBootstrap?.config?.boundaryColor,
    villageProfile.villageName
  ]);

  const handleSelectFacility = (facility: FacilityPoint) => {
    setActiveFacility(facility);
    const validPair = normalizeCoordinatePair(facility.coordinates);
    if (viewMode === 'interactive' && leafletMapRef.current && validPair) {
      const marker = markersRef.current[facility.id];
      const targetLatLng =
        marker && 'getLatLng' in marker
          ? marker.getLatLng()
          : L.latLng(validPair[0], validPair[1]);
      leafletMapRef.current.flyTo(targetLatLng, 16, { duration: 1.0 });
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const handleRecenter = () => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  };

  const villageDisplayName = villageProfile.villageName || 'Desa';
  const regionLabel = [villageProfile.district, villageProfile.regency].filter(Boolean).join(', ');
  const externalMapQuery = [villageProfile.villageName, villageProfile.district, villageProfile.regency]
    .filter(Boolean)
    .join(' ');
  const externalGoogleMapsHref = buildGoogleMapsLocationUrl(
    viewport.isConfigured ? viewport.center[0] : null,
    viewport.isConfigured ? viewport.center[1] : null,
    externalMapQuery || villageDisplayName
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Geospasial & Fasilitas Umum
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Peta Digital Fasilitas {villageDisplayName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Informasi lokasi kantor desa, sarana pendidikan, fasilitas kesehatan, prasarana umum, dan tata batas wilayah desa secara interaktif.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200">
            <button
              onClick={() => setViewMode('interactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                viewMode === 'interactive'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Peta Interaktif</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Daftar Titik</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1.5 pb-2">
        {MAP_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedCategory === cat.key
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Map & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {viewMode === 'interactive' && (providerNotice || !gisBootstrap?.hasVerifiedBoundary) && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1.5 shadow-xs">
              {providerNotice && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>{providerNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProviderNotice(null)}
                    className="text-amber-700 dark:text-amber-300 hover:text-amber-900 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {!gisBootstrap?.hasVerifiedBoundary && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Batas polygon resmi desa belum terverifikasi (indikatif).</span>
                  </div>
                  {viewport.isConfigured && (
                    <span className="font-mono text-[10px] text-amber-800 dark:text-amber-300 shrink-0">
                      {viewport.center[0].toFixed(4)}°, {viewport.center[1].toFixed(4)}°
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {viewMode === 'interactive' ? (
            <div
              ref={wrapperRef}
              data-fullscreen={isFullscreen ? 'true' : 'false'}
              className={
                isFullscreen
                  ? 'fixed inset-0 z-[9900] w-screen h-screen rounded-none border-0 bg-slate-900 flex flex-col overflow-hidden'
                  : 'bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative flex flex-col'
              }
            >
              {/* Map Bar Header */}
              <div className="px-4 sm:px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    {providerLabel} • {villageDisplayName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                    {MAP_MODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => setMapMode(opt.mode)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          mapMode === opt.mode
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {hasMainBoundary && (
                    <button
                      type="button"
                      onClick={() => setShowBoundary((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                        showBoundary
                          ? 'bg-pink-600/20 text-pink-200 border-pink-400/50'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>Batas Desa</span>
                    </button>
                  )}
                  {hasNeighborBoundary && (
                    <button
                      type="button"
                      onClick={() => setShowNeighborBounds((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors flex items-center gap-1 ${
                        showNeighborBounds
                          ? 'bg-sky-600/25 text-sky-200 border-sky-400/50'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>{neighborAreaFormatted ? `Batas (${neighborAreaFormatted})` : 'Batas Wilayah'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRecenter}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                    title="Pusatkan Ulang Peta"
                  >
                    <Navigation className="w-3 h-3 text-emerald-400" />
                    <span>Pusatkan</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="px-3 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 flex items-center gap-1 shadow-sm"
                    title={isFullscreen ? 'Kecilkan Peta (ESC)' : 'Perbesar Peta ke Layar Penuh'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>Kecilkan</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Perbesar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Leaflet container wrapper */}
              <div className="relative w-full z-0 flex-1">
                <div
                  ref={mapContainerRef}
                  style={{ height: isFullscreen ? '100%' : '520px' }}
                  className="w-full z-0"
                />

                {/* Floating Fullscreen Button on Bottom-Right of Map Canvas */}
                <div className="absolute bottom-12 right-3 z-[1000]">
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="px-3.5 py-2 bg-slate-900/95 hover:bg-slate-900 text-emerald-300 border border-emerald-500/60 rounded-xl shadow-xl transition-all flex items-center gap-1.5 text-xs font-extrabold backdrop-blur-md"
                    title={isFullscreen ? 'Kecilkan Peta (ESC)' : 'Perbesar Peta ke Layar Penuh'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4 text-emerald-400" />
                        <span>Kecilkan</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4 text-emerald-400" />
                        <span>Perbesar Peta</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Klik pada pin untuk melihat informasi fasilitas dan petunjuk arah.</span>
                </div>
                <a
                  href={externalGoogleMapsHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold hover:underline flex items-center space-x-1 text-xs"
                >
                  <span>Buka di Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((facility) => {
                const isSelected = activeFacility?.id === facility.id;
                const hasCoords = Boolean(normalizeCoordinatePair(facility.coordinates));
                return (
                  <div
                    key={facility.id}
                    onClick={() => handleSelectFacility(facility)}
                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {facility.category.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              facility.verificationStatus === 'TERVERIFIKASI'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {getVerificationLabel(facility.verificationStatus)}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{facility.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{facility.description}</p>
                        <div className="text-[11px] text-slate-400 mt-2">{facility.address}</div>
                        {!hasCoords && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            <span>Koordinat belum terkonfirmasi</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'interactive' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">
                Pilih Cepat Titik Lokasi ({filtered.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {filtered.map((f) => {
                  const hasCoords = Boolean(normalizeCoordinatePair(f.coordinates));
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFacility(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all inline-flex items-center gap-1.5 ${
                        activeFacility?.id === f.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{f.name}</span>
                      {!hasCoords && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            activeFacility?.id === f.id
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Belum GPS
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6 h-fit">
          {activeFacility ? (
            (() => {
              const validPair = normalizeCoordinatePair(activeFacility.coordinates);
              return (
                <div className="space-y-4">
                  {activeFacility.imageUrl && activeFacility.imageUrl.trim() !== '' ? (
                    <div className="h-44 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={activeFacility.imageUrl.trim()}
                        alt={activeFacility.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-28 w-full rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 text-xs font-semibold">
                      <Building2 className="w-5 h-5 opacity-50 mr-2" />
                      <span>Belum ada foto asli fasilitas</span>
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {activeFacility.category.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          activeFacility.verificationStatus === 'TERVERIFIKASI'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {getVerificationLabel(activeFacility.verificationStatus)}
                      </span>
                      {activeFacility.plusCode && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {activeFacility.plusCode}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1.5 leading-snug">{activeFacility.name}</h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{activeFacility.description}</p>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Alamat:</strong> {activeFacility.address}
                      </span>
                    </div>
                    {activeFacility.contact && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Kontak:</strong> {activeFacility.contact}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-mono text-[11px]">
                        <strong>Titik Koordinat:</strong>{' '}
                        {validPair
                          ? `${validPair[0]}, ${validPair[1]}`
                          : 'Koordinat belum terkonfirmasi'}
                      </span>
                    </div>
                  </div>

                  {(activeFacility.locationNotes || !gisBootstrap?.hasVerifiedBoundary) && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1 leading-relaxed">
                      {activeFacility.locationNotes && <p>{activeFacility.locationNotes}</p>}
                      {!gisBootstrap?.hasVerifiedBoundary && (
                        <p className="text-amber-800">
                          {activeFacility.boundaryMembershipNote ||
                            'Status wilayah administratif bersifat indikatif karena batas resmi desa belum terverifikasi.'}
                        </p>
                      )}
                    </div>
                  )}

                  {validPair && isValidCoordinatePair(validPair[0], validPair[1]) && (
                    <a
                      href={buildGoogleMapsDirectionsUrl(validPair[0], validPair[1])}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition-all flex items-center justify-center space-x-2 mt-2"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Petunjuk Arah (Navigasi GPS)</span>
                    </a>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Pilih salah satu titik fasilitas untuk melihat informasi detail.
            </div>
          )}

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 leading-relaxed">
            <strong>Akses Wilayah:</strong> {villageDisplayName} dapat ditempuh melalui{' '}
            {villageProfile.addressStreet || 'jalan poros utama'}
            {regionLabel ? ` (${regionLabel})` : ''}.
          </div>
        </div>
      </div>
    </div>
  );
};
