import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApp } from '../../context/AppContext';
import { LandParcel, DusunSpatialBoundary, MapMode } from '../../types/webgis';
import { MapFacility } from '../../types';
import { calculatePolygonAreaShoelace } from '../../utils/geometryEngine';
import {
  attachBasemapToLeaflet,
  MAP_MODE_OPTIONS
} from '../../config/mapProviderRegistry';
import {
  geoJsonGeometryToLeafletPolygons,
  isValidCoordinatePair,
  resolveMapViewport
} from '../../utils/gisAdapter';
import { Navigation, Compass, Trash2, Info } from 'lucide-react';

// Fix Leaflet Default Icon path issues in Vite
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

interface WebGisMapProps {
  parcels: LandParcel[];
  dusunBoundaries: DusunSpatialBoundary[];
  facilities?: MapFacility[];
  selectedParcelId?: string | null;
  onSelectParcel?: (parcel: LandParcel | null) => void;
  isDrawingMode?: boolean;
  drawingPoints?: [number, number][];
  onDrawingPointsChange?: (points: [number, number][]) => void;
  height?: string;
  className?: string;
}

function buildParcelPopupElement(
  parcel: LandParcel,
  onSelectParcel?: (parcel: LandParcel | null) => void
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'p-1 max-w-xs font-sans text-slate-800';

  const topRow = document.createElement('div');
  topRow.className = 'flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 gap-2';

  const nopBadge = document.createElement('span');
  nopBadge.className = 'text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700';
  nopBadge.textContent = `NOP: ${parcel.nop}`;
  topRow.appendChild(nopBadge);

  const pbbBadge = document.createElement('span');
  pbbBadge.className = `text-[10px] font-bold px-1.5 py-0.5 rounded ${
    parcel.pbbStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
  }`;
  pbbBadge.textContent = parcel.pbbStatus;
  topRow.appendChild(pbbBadge);
  root.appendChild(topRow);

  const ownerEl = document.createElement('h4');
  ownerEl.className = 'font-bold text-xs text-slate-900 leading-snug';
  ownerEl.textContent = parcel.ownerName;
  root.appendChild(ownerEl);

  const dusunEl = document.createElement('p');
  dusunEl.className = 'text-[11px] text-slate-500 mt-0.5';
  dusunEl.textContent = parcel.addressDusun;
  root.appendChild(dusunEl);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'grid grid-cols-2 gap-1 my-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100';

  const areaBox = document.createElement('div');
  const areaLbl = document.createElement('span');
  areaLbl.className = 'text-slate-400 block';
  areaLbl.textContent = 'Luas Tanah (Shoelace):';
  const areaVal = document.createElement('strong');
  areaVal.className = 'text-slate-800 font-bold';
  areaVal.textContent = `${parcel.landAreaSqM.toLocaleString('id-ID')} m²`;
  areaBox.appendChild(areaLbl);
  areaBox.appendChild(areaVal);
  statsGrid.appendChild(areaBox);

  const pbbBox = document.createElement('div');
  const pbbLbl = document.createElement('span');
  pbbLbl.className = 'text-slate-400 block';
  pbbLbl.textContent = 'Tagihan PBB-P2:';
  const pbbVal = document.createElement('strong');
  pbbVal.className = 'text-emerald-700 font-bold';
  pbbVal.textContent = `Rp ${parcel.pbbTaxAmount.toLocaleString('id-ID')}`;
  pbbBox.appendChild(pbbLbl);
  pbbBox.appendChild(pbbVal);
  statsGrid.appendChild(pbbBox);
  root.appendChild(statsGrid);

  const sporadikRow = document.createElement('div');
  sporadikRow.className = 'text-[10px] text-slate-600 mb-2';
  const sporadikPrefix = document.createElement('strong');
  sporadikPrefix.textContent = 'SPORADIK: ';
  const sporadikVal = document.createElement('span');
  sporadikVal.className = 'font-semibold text-blue-700';
  sporadikVal.textContent = parcel.sporadikStatus.replace(/_/g, ' ');
  sporadikRow.appendChild(sporadikPrefix);
  sporadikRow.appendChild(sporadikVal);
  root.appendChild(sporadikRow);

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.className =
    'w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors shadow-2xs';
  actionBtn.textContent = 'Lihat Detail & SPORADIK';
  actionBtn.addEventListener('click', () => {
    onSelectParcel?.(parcel);
  });
  root.appendChild(actionBtn);

  return root;
}

export const WebGisMap: React.FC<WebGisMapProps> = ({
  parcels,
  dusunBoundaries,
  facilities = [],
  selectedParcelId = null,
  onSelectParcel,
  isDrawingMode = false,
  drawingPoints = [],
  onDrawingPointsChange,
  height = '500px',
  className = ''
}) => {
  const { villageProfile, gisBootstrap } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const basemapCleanupRef = useRef<(() => void) | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);
  const lastViewportKeyRef = useRef<string>('');

  const [mapMode, setMapMode] = useState<MapMode>(
    gisBootstrap?.config?.defaultMapMode || 'roadmap'
  );
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [showVillageBounds, setShowVillageBounds] = useState<boolean>(
    gisBootstrap?.config?.showVillageBoundary ?? true
  );
  const [showDusunBounds, setShowDusunBounds] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);

  const viewport = useMemo(
    () =>
      resolveMapViewport({
        gisBootstrap,
        villageProfile,
        facilities,
        parcels
      }),
    [gisBootstrap, villageProfile, facilities, parcels]
  );

  useEffect(() => {
    if (gisBootstrap?.config?.defaultMapMode) {
      setMapMode(gisBootstrap.config.defaultMapMode);
    }
    if (typeof gisBootstrap?.config?.showVillageBoundary === 'boolean') {
      setShowVillageBounds(gisBootstrap.config.showVillageBoundary);
    }
  }, [gisBootstrap?.config?.defaultMapMode, gisBootstrap?.config?.showVillageBoundary]);

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: viewport.center,
      zoom: viewport.zoom,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layersGroup = L.layerGroup().addTo(map);
    const drawingLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    layersGroupRef.current = layersGroup;
    drawingLayerRef.current = drawingLayer;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      layersGroupRef.current = null;
      drawingLayerRef.current = null;
    };
  }, []);

  // Switch Base Layer melalui mapProviderRegistry
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (basemapCleanupRef.current) {
      basemapCleanupRef.current();
      basemapCleanupRef.current = null;
    }

    const handle = attachBasemapToLeaflet(map, mapMode, {
      customSatelliteTileUrl: gisBootstrap?.config?.customSatelliteTileUrl,
      activeProviderId: gisBootstrap?.config?.activeProviderId
    });
    basemapCleanupRef.current = handle.cleanup;
    setProviderNotice(handle.fallbackReason || null);

    return () => {
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
    };
  }, [
    mapMode,
    gisBootstrap?.config?.customSatelliteTileUrl,
    gisBootstrap?.config?.activeProviderId
  ]);

  // Sinkronisasi viewport dinamis per tenant
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const vpKey = `${viewport.source}:${viewport.center[0].toFixed(4)},${viewport.center[1].toFixed(4)}:${viewport.zoom}`;
    if (lastViewportKeyRef.current === vpKey) return;
    lastViewportKeyRef.current = vpKey;

    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [viewport]);

  // Handle Event Map Click saat Mode Menggambar Poligon GPS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawingMode || !onDrawingPointsChange) return;
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      onDrawingPointsChange([...drawingPoints, newPoint]);
    };

    if (isDrawingMode) {
      map.on('click', handleMapClick);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = 'crosshair';
      }
    } else {
      map.off('click', handleMapClick);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = 'grab';
      }
    }

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isDrawingMode, drawingPoints, onDrawingPointsChange]);

  // Render Poligon Menggambar Aktif
  useEffect(() => {
    const drawingGroup = drawingLayerRef.current;
    if (!drawingGroup) return;

    drawingGroup.clearLayers();

    if (drawingPoints.length > 0) {
      drawingPoints.forEach((pt, idx) => {
        const circle = L.circleMarker(pt, {
          radius: 6,
          fillColor: '#ef4444',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).bindTooltip(`Titik P${idx + 1}: ${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}`, {
          permanent: false
        });
        drawingGroup.addLayer(circle);
      });

      if (drawingPoints.length >= 2) {
        const polyline = L.polyline(drawingPoints, {
          color: '#ef4444',
          weight: 3,
          dashArray: '6, 6'
        });
        drawingGroup.addLayer(polyline);
      }

      if (drawingPoints.length >= 3) {
        const polygon = L.polygon(drawingPoints, {
          color: '#dc2626',
          fillColor: '#f87171',
          fillOpacity: 0.35,
          weight: 3
        });
        drawingGroup.addLayer(polygon);
      }
    }
  }, [drawingPoints]);

  // Render Overlay Batas Desa, Dusun, Bidang Tanah Warga, & Fasilitas
  useEffect(() => {
    const layersGroup = layersGroupRef.current;
    const map = mapInstanceRef.current;
    if (!layersGroup || !map) return;

    layersGroup.clearLayers();

    // 0. Batas Wilayah Desa Aktif (jika tersedia)
    if (showVillageBounds && gisBootstrap?.activeBoundary?.geometryGeoJson) {
      const polygons = geoJsonGeometryToLeafletPolygons(gisBootstrap.activeBoundary.geometryGeoJson);
      const boundaryColor = gisBootstrap.config?.boundaryColor || '#ec4899';
      polygons.forEach((rings) => {
        const villagePoly = L.polygon(rings, {
          color: boundaryColor,
          weight: 3,
          dashArray: '8, 5',
          fillColor: boundaryColor,
          fillOpacity: 0.06
        });
        const tip = document.createElement('div');
        const tipTitle = document.createElement('strong');
        tipTitle.textContent = `Batas Wilayah ${villageProfile.villageName || 'Desa'}`;
        tip.appendChild(tipTitle);
        villagePoly.bindTooltip(tip, { sticky: true });
        layersGroup.addLayer(villagePoly);
      });
    }

    // 1. Batas Administrasi Dusun
    if (showDusunBounds && dusunBoundaries) {
      dusunBoundaries.forEach((dusun) => {
        if (!dusun.coordinates || dusun.coordinates.length === 0) return;

        const polygon = L.polygon(dusun.coordinates, {
          color: dusun.color || '#10b981',
          weight: 2.5,
          dashArray: '8, 8',
          fillColor: dusun.color || '#10b981',
          fillOpacity: 0.08
        });

        const tipEl = document.createElement('div');
        const titleEl = document.createElement('div');
        titleEl.className = 'font-bold text-xs font-sans text-slate-800';
        titleEl.textContent = dusun.name;
        const leaderEl = document.createElement('div');
        leaderEl.className = 'text-[10px] text-slate-500';
        leaderEl.textContent = `Kadus: ${dusun.leaderName}`;
        tipEl.appendChild(titleEl);
        tipEl.appendChild(leaderEl);

        polygon.bindTooltip(tipEl, {
          permanent: true,
          direction: 'center',
          className: 'dusun-label-tooltip'
        });

        layersGroup.addLayer(polygon);
      });
    }

    // 2. Poligon Bidang Tanah Warga (PBB-P2 & SPORADIK)
    if (parcels) {
      parcels.forEach((parcel) => {
        if (!parcel.coordinates || parcel.coordinates.length === 0) return;

        const isSelected = selectedParcelId === parcel.id;
        let fillColor = '#10b981';
        let strokeColor = '#059669';

        if (parcel.pbbStatus === 'BELUM_LUNAS') {
          fillColor = '#f59e0b';
          strokeColor = '#d97706';
        } else if (parcel.pbbStatus === 'BEBAS_PAJAK') {
          fillColor = '#8b5cf6';
          strokeColor = '#7c3aed';
        }

        if (parcel.sporadikStatus === 'SPORADIK_TERBIT') {
          fillColor = '#2563eb';
          strokeColor = '#1d4ed8';
        }

        if (isSelected) {
          fillColor = '#ec4899';
          strokeColor = '#be185d';
        }

        const polygon = L.polygon(parcel.coordinates, {
          color: strokeColor,
          weight: isSelected ? 4 : 2,
          fillColor,
          fillOpacity: isSelected ? 0.6 : 0.35
        });

        polygon.bindPopup(buildParcelPopupElement(parcel, onSelectParcel));

        polygon.on('click', () => {
          onSelectParcel?.(parcel);
        });

        layersGroup.addLayer(polygon);
      });
    }

    // 3. Titik Fasilitas Umum
    if (showFacilities && facilities) {
      facilities.forEach((fac) => {
        if (!fac.coordinates || !isValidCoordinatePair(fac.coordinates[0], fac.coordinates[1])) return;

        const marker = L.circleMarker(fac.coordinates, {
          radius: 7,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9
        });

        const facTip = document.createElement('div');
        const facName = document.createElement('div');
        facName.className = 'font-bold text-xs text-slate-900';
        facName.textContent = fac.name;
        const facCat = document.createElement('div');
        facCat.className = 'text-[10px] text-slate-500';
        facCat.textContent = fac.category;
        facTip.appendChild(facName);
        facTip.appendChild(facCat);

        marker.bindTooltip(facTip, { permanent: false });
        layersGroup.addLayer(marker);
      });
    }
  }, [
    parcels,
    dusunBoundaries,
    facilities,
    selectedParcelId,
    showVillageBounds,
    showDusunBounds,
    showFacilities,
    onSelectParcel,
    gisBootstrap,
    villageProfile.villageName
  ]);

  const liveDrawCalc =
    isDrawingMode && drawingPoints.length >= 3 ? calculatePolygonAreaShoelace(drawingPoints) : null;

  const handleResetZoom = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs bg-slate-900 ${className}`}>
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

      {/* Control Panel Atas Kiri: Switch Mode Peta & Layer Toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[calc(100%-4rem)]">
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 flex flex-wrap items-center gap-1">
          {MAP_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setMapMode(opt.mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                mapMode === opt.mode
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
          {gisBootstrap?.activeBoundary && (
            <>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVillageBounds}
                  onChange={(e) => setShowVillageBounds(e.target.checked)}
                  className="rounded border-slate-300 text-pink-600 focus:ring-pink-500 w-3.5 h-3.5"
                />
                <span>Batas Desa</span>
              </label>
              <span className="text-slate-300">|</span>
            </>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showDusunBounds}
              onChange={(e) => setShowDusunBounds(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span>Batas Dusun</span>
          </label>
          <span className="text-slate-300">|</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showFacilities}
              onChange={(e) => setShowFacilities(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
            />
            <span>Fasilitas</span>
          </label>
        </div>
      </div>

      {providerNotice && (
        <div className="absolute top-14 left-3 z-[1000] max-w-md bg-amber-50/95 backdrop-blur-sm border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl shadow text-[11px] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>{providerNotice}</span>
        </div>
      )}

      {/* Control Panel Atas Kanan: Reset Position */}
      <div className="absolute top-3 right-3 z-[1000]">
        <button
          type="button"
          onClick={handleResetZoom}
          className="bg-white/95 hover:bg-white text-slate-700 p-2 rounded-xl shadow-md border border-slate-200 transition-colors flex items-center justify-center"
          title={`Fokus Ulang Peta ${villageProfile.villageName || 'Desa'}`}
        >
          <Navigation className="w-4 h-4 text-emerald-700" />
        </button>
      </div>

      {/* Banner Informasi Mode Ukur / Digitisasi Poligon Spasial */}
      {isDrawingMode && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1000] bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/80 max-w-md font-sans">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
            <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-400">
              <Compass className="w-4 h-4 text-emerald-400 animate-pulse" />
              Mode Digitasi Spasial Bidang Tanah
            </span>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
              {drawingPoints.length} Titik GPS
            </span>
          </div>

          <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
            Klik pada area peta untuk menambahkan titik sudut koordinat poligon bidang tanah.
          </p>

          {liveDrawCalc ? (
            <div className="bg-emerald-950/80 border border-emerald-800/80 p-2.5 rounded-xl mb-2.5 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-emerald-300/80 block">Luas Tanah (Shoelace):</span>
                <strong className="text-emerald-300 font-extrabold text-sm">{liveDrawCalc.formattedAreaSqM}</strong>
                <span className="text-[10px] text-emerald-400 block font-mono">({liveDrawCalc.formattedAreaHectares})</span>
              </div>
              <div>
                <span className="text-[10px] text-emerald-300/80 block">Keliling (Haversine):</span>
                <strong className="text-emerald-300 font-extrabold text-sm">{liveDrawCalc.perimeterMeters} meter</strong>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-amber-300 bg-amber-950/60 p-2 rounded-xl mb-2 border border-amber-800/60">
              Minimal 3 titik koordinat GPS diperlukan untuk menghitung luas poligon.
            </div>
          )}

          <div className="flex items-center gap-2">
            {drawingPoints.length > 0 && onDrawingPointsChange && (
              <button
                type="button"
                onClick={() => onDrawingPointsChange([])}
                className="px-2.5 py-1.5 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Titik</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legend Warna Poligon Spasial */}
      <div className="absolute bottom-3 right-3 z-[1000] hidden md:flex items-center gap-2.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-slate-200 text-[11px] font-medium text-slate-700">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
          <span>SPORADIK Terbit</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>PBB Lunas</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
          <span>PBB Belum Lunas</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span>
          <span>Fasilitas Umum</span>
        </div>
      </div>
    </div>
  );
};
