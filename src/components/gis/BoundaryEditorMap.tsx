import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useApp } from '../../context/AppContext';
import {
  DusunSpatialBoundary,
  GisVillageBoundary,
  MapMode
} from '../../types/webgis';
import { MapFacility } from '../../types';
import { calculatePolygonAreaShoelace } from '../../utils/geometryEngine';
import {
  attachBasemapToLeaflet,
  MAP_MODE_OPTIONS
} from '../../config/mapProviderRegistry';
import {
  applyDisplayOverlapOffsets,
  computeBoundingBoxFromLeafletCoords,
  bboxToLeafletBounds,
  geoJsonGeometryToLeafletPolygons,
  isValidCoordinatePair,
  resolveMapViewport
} from '../../utils/gisAdapter';
import {
  Compass,
  Edit3,
  Eye,
  Navigation,
  RotateCcw,
  Trash2,
  Undo2,
  Info
} from 'lucide-react';

interface BoundaryEditorMapProps {
  points: [number, number][];
  onChangePoints: (nextPoints: [number, number][]) => void;
  isEditing: boolean;
  onToggleEditing: (next: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  hasUnsavedChanges: boolean;
  onDiscardChanges: () => void;
  boundaryColor?: string;
  savedBoundaries?: GisVillageBoundary[];
  editingBoundaryId?: string | null;
  dusunBoundaries?: DusunSpatialBoundary[];
  facilities?: MapFacility[];
  height?: string;
}

export const BoundaryEditorMap: React.FC<BoundaryEditorMapProps> = ({
  points,
  onChangePoints,
  isEditing,
  onToggleEditing,
  canUndo,
  onUndo,
  hasUnsavedChanges,
  onDiscardChanges,
  boundaryColor = '#ec4899',
  savedBoundaries = [],
  editingBoundaryId = null,
  dusunBoundaries = [],
  facilities = [],
  height = '480px'
}) => {
  const { villageProfile, gisBootstrap } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const basemapCleanupRef = useRef<(() => void) | null>(null);
  const referenceLayerRef = useRef<L.LayerGroup | null>(null);
  const editorLayerRef = useRef<L.LayerGroup | null>(null);
  const hasInitializedViewportRef = useRef(false);

  const [mapMode, setMapMode] = useState<MapMode>(
    gisBootstrap?.config?.defaultMapMode || 'roadmap'
  );
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [showSavedLayer, setShowSavedLayer] = useState(true);
  const [showDusunLayer, setShowDusunLayer] = useState(true);
  const [showFacilityLayer, setShowFacilityLayer] = useState(true);

  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onChangePointsRef = useRef(onChangePoints);
  onChangePointsRef.current = onChangePoints;

  const activeFacilities = useMemo(
    () => facilities.filter((f) => f.isActive !== false),
    [facilities]
  );

  const viewport = useMemo(
    () =>
      resolveMapViewport({
        gisBootstrap,
        villageProfile,
        facilities: activeFacilities
      }),
    [gisBootstrap, villageProfile, activeFacilities]
  );

  // Init Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: viewport.center,
      zoom: viewport.zoom,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const refLayer = L.layerGroup().addTo(map);
    const editLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    referenceLayerRef.current = refLayer;
    editorLayerRef.current = editLayer;

    setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      if (basemapCleanupRef.current) {
        basemapCleanupRef.current();
        basemapCleanupRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
      referenceLayerRef.current = null;
      editorLayerRef.current = null;
    };
  }, []);

  // Attach basemap via mapProviderRegistry
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

  // Initial viewport centering
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || hasInitializedViewportRef.current) return;
    hasInitializedViewportRef.current = true;
    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [28, 28], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [viewport]);

  // Click map to append vertex when editing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isEditing) return;
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      onChangePointsRef.current([...pointsRef.current, [lat, lng]]);
    };

    if (isEditing) {
      map.on('click', handleClick);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = 'crosshair';
      }
    } else {
      map.off('click', handleClick);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = 'grab';
      }
    }

    return () => {
      map.off('click', handleClick);
    };
  }, [isEditing]);

  // Reference layers: saved boundaries (including neighbor villages), dusun boundaries, facilities
  useEffect(() => {
    const group = referenceLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (showSavedLayer && savedBoundaries.length > 0) {
      savedBoundaries.forEach((b) => {
        // Hide the currently-edited boundary duplicate outline while editing
        if (editingBoundaryId && b.id === editingBoundaryId && isEditing) return;
        if (b.boundaryRole === 'NEIGHBOR_VILLAGE' && b.showOnMap === false) return;

        const isNeighbor = b.boundaryRole === 'NEIGHBOR_VILLAGE';
        const strokeColor =
          b.fillColor || (isNeighbor ? '#0284c7' : b.isActive ? boundaryColor : '#64748b');

        const polys = geoJsonGeometryToLeafletPolygons(b.geometryGeoJson);
        polys.forEach((rings, ringIdx) => {
          const poly = L.polygon(rings, {
            color: strokeColor,
            weight: isNeighbor ? 2 : b.isActive ? 2.5 : 1.5,
            dashArray: isNeighbor ? '5, 5' : b.isActive ? '6, 4' : '4, 4',
            fillColor: strokeColor,
            fillOpacity: isNeighbor ? 0.1 : b.isActive ? 0.08 : 0.04,
            interactive: false
          });

          if (ringIdx === 0) {
            const labelEl = document.createElement('div');
            labelEl.className = 'gis-boundary-clean-label';
            labelEl.innerHTML = `<span style="font-weight: 800; font-size: 10px; color: ${strokeColor}; text-shadow: 0 0 3px #ffffff, 0 0 6px #ffffff, 1px 1px 0 #ffffff, -1px -1px 0 #ffffff; white-space: nowrap; pointer-events: none;">${b.villageName || b.sourceName || 'Wilayah Desa'}</span>`;
            poly.bindTooltip(labelEl, {
              permanent: true,
              direction: 'top',
              className: 'gis-boundary-clean-label',
              offset: [0, -8]
            });
          }

          group.addLayer(poly);
        });
      });
    }

    if (showDusunLayer && dusunBoundaries.length > 0) {
      dusunBoundaries.forEach((d) => {
        if (!d.coordinates || d.coordinates.length < 3) return;
        const poly = L.polygon(d.coordinates, {
          color: d.color || '#10b981',
          weight: 1.8,
          dashArray: '6, 6',
          fillColor: d.color || '#10b981',
          fillOpacity: 0.05,
          interactive: false
        });
        group.addLayer(poly);
      });
    }

    if (showFacilityLayer && activeFacilities.length > 0) {
      const offsetItems = applyDisplayOverlapOffsets(activeFacilities);
      offsetItems.forEach(({ item: fac, displayLat, displayLng }) => {
        const marker = L.circleMarker([displayLat, displayLng], {
          radius: 5.5,
          fillColor: fac.verificationStatus === 'TERVERIFIKASI' ? '#10b981' : '#3b82f6',
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 0.85
        });
        const tip = document.createElement('div');
        const title = document.createElement('strong');
        title.className = 'text-xs font-sans text-slate-900 block';
        title.textContent = fac.name;
        const sub = document.createElement('span');
        sub.className = 'text-[10px] font-sans text-slate-500';
        sub.textContent = fac.category.replace(/_/g, ' ');
        tip.appendChild(title);
        tip.appendChild(sub);
        marker.bindTooltip(tip, { permanent: false });
        group.addLayer(marker);
      });
    }
  }, [
    showSavedLayer,
    showDusunLayer,
    showFacilityLayer,
    savedBoundaries,
    editingBoundaryId,
    isEditing,
    boundaryColor,
    dusunBoundaries,
    activeFacilities
  ]);

  // Active editable polygon & draggable vertices
  useEffect(() => {
    const group = editorLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const validPts = points.filter((p) => isValidCoordinatePair(p[0], p[1]));
    if (validPts.length === 0) return;

    if (validPts.length >= 2) {
      const line = L.polyline(validPts, {
        color: boundaryColor,
        weight: 2.5,
        dashArray: validPts.length < 3 ? '6, 6' : undefined,
        interactive: false
      });
      group.addLayer(line);
    }

    if (validPts.length >= 3) {
      const poly = L.polygon(validPts, {
        color: boundaryColor,
        weight: 3,
        fillColor: boundaryColor,
        fillOpacity: 0.2,
        interactive: false
      });
      group.addLayer(poly);
    }

    validPts.forEach((pt, idx) => {
      if (isEditing) {
        const icon = L.divIcon({
          className: 'sadewa-vertex-handle',
          html: `<div style="width:22px;height:22px;border-radius:9999px;background:#0f172a;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:move;">${idx + 1}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        const marker = L.marker(pt, {
          icon,
          draggable: true
        });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          const next = [...pointsRef.current];
          next[idx] = [Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6))];
          onChangePointsRef.current(next);
        });

        // Build safe DOM popup to inspect or delete vertex
        const popupEl = document.createElement('div');
        popupEl.className = 'font-sans text-xs space-y-1.5 min-w-[165px]';

        const titleEl = document.createElement('div');
        titleEl.className = 'font-bold text-slate-900';
        titleEl.textContent = `Titik Sudut P${idx + 1}`;
        popupEl.appendChild(titleEl);

        const coordEl = document.createElement('div');
        coordEl.className = 'font-mono text-[11px] text-slate-600';
        coordEl.textContent = `${pt[0].toFixed(6)}, ${pt[1].toFixed(6)}`;
        popupEl.appendChild(coordEl);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className =
          'w-full px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-colors';
        delBtn.textContent = `Hapus Titik P${idx + 1}`;
        delBtn.addEventListener('click', () => {
          const next = pointsRef.current.filter((_, i) => i !== idx);
          onChangePointsRef.current(next);
        });
        popupEl.appendChild(delBtn);

        marker.bindPopup(popupEl);
        group.addLayer(marker);
      } else {
        const dot = L.circleMarker(pt, {
          radius: 4.5,
          fillColor: boundaryColor,
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 1
        }).bindTooltip(`P${idx + 1}: ${pt[0].toFixed(5)}, ${pt[1].toFixed(5)}`);
        group.addLayer(dot);
      }
    });
  }, [points, isEditing, boundaryColor]);

  const metrics = useMemo(() => {
    if (points.length < 3) return null;
    return calculatePolygonAreaShoelace(points);
  }, [points]);

  const handleFocusPolygonOrVillage = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (points.length >= 2) {
      const bbox = computeBoundingBoxFromLeafletCoords(points);
      const lBounds = bboxToLeafletBounds(bbox);
      if (lBounds) {
        map.fitBounds(lBounds, { padding: [32, 32], maxZoom: 16 });
        return;
      }
    }

    if (viewport.leafletBounds && viewport.source === 'boundary') {
      map.fitBounds(viewport.leafletBounds, { padding: [28, 28], maxZoom: 16 });
    } else {
      map.setView(viewport.center, viewport.zoom);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Toolbar Editor Batas Wilayah */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              isEditing
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isEditing ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Selesai Edit Peta</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Aktifkan Edit / Digitasi</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            title="Kembalikan perubahan titik terakhir"
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-600" />
            <span>Undo</span>
          </button>

          <button
            type="button"
            disabled={!hasUnsavedChanges}
            onClick={onDiscardChanges}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            title="Batalkan semua perubahan yang belum disimpan"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Batal Perubahan</span>
          </button>

          {points.length > 0 && (
            <button
              type="button"
              onClick={() => onChangePoints([])}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-1"
              title="Kosongkan seluruh titik poligon dari kanvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Kosongkan</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleFocusPolygonOrVillage}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-700" />
          <span>Pusatkan</span>
        </button>
      </div>

      {/* Canvas Peta Leaflet */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900">
        <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

        {/* Switch Basemap & Layer Referensi */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[calc(100%-2rem)]">
          <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 flex flex-wrap items-center gap-1">
            {MAP_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setMapMode(opt.mode)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  mapMode === opt.mode
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200/80 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-700">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showSavedLayer}
                onChange={(e) => setShowSavedLayer(e.target.checked)}
                className="rounded border-slate-300 text-pink-600 w-3.5 h-3.5"
              />
              <span>Batas Tersimpan</span>
            </label>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showDusunLayer}
                onChange={(e) => setShowDusunLayer(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 w-3.5 h-3.5"
              />
              <span>Dusun</span>
            </label>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showFacilityLayer}
                onChange={(e) => setShowFacilityLayer(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 w-3.5 h-3.5"
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

        {/* Overlay Status & Kalkulasi Geometri Live */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur-md text-white px-3 py-2.5 rounded-2xl shadow-xl border border-slate-700/80 max-w-xs space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              {isEditing ? 'Mode Edit Aktif (Klik / Geser Titik)' : 'Pratinjau Poligon Batas'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono text-[10px]">
              {points.length} titik
            </span>
          </div>
          {metrics ? (
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px]">Luas (Shoelace)</span>
                <strong className="text-emerald-300 font-bold">
                  {metrics.formattedAreaHectares}
                </strong>
                <span className="text-[10px] text-slate-400 block">
                  {metrics.formattedAreaSqM}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Keliling (Haversine)</span>
                <strong className="text-emerald-300 font-bold">
                  {metrics.perimeterMeters.toLocaleString('id-ID')} m
                </strong>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-amber-300">
              {isEditing
                ? 'Klik minimal 3 titik pada peta atau impor file GeoJSON batas desa.'
                : 'Belum ada poligon aktif di editor. Klik "Aktifkan Edit / Digitasi" atau impor GeoJSON.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
