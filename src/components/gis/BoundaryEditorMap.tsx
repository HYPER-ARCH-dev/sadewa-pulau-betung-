import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Check,
  Compass,
  Crosshair,
  Edit3,
  Eye,
  Info,
  Layers,
  LayoutGrid,
  MapPin,
  Maximize2,
  Minimize2,
  Pentagon,
  RotateCcw,
  Tag,
  Trash2,
  Undo2,
  X
} from 'lucide-react';

const ADM_MAP_SESSION_KEYS = {
  mapMode: 'sadewa_adm_map_mode',
  showSaved: 'sadewa_adm_show_saved',
  showDusun: 'sadewa_adm_show_dusun',
  showFacility: 'sadewa_adm_show_facility',
  showLabels: 'sadewa_adm_show_labels'
} as const;

function readSessionBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

function readSessionMapMode(fallback: MapMode): MapMode {
  try {
    const raw = window.sessionStorage.getItem(ADM_MAP_SESSION_KEYS.mapMode);
    if (raw === 'roadmap' || raw === 'satellite' || raw === 'hybrid' || raw === 'terrain') {
      return raw;
    }
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

function writeSessionValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage access errors
  }
}

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const basemapCleanupRef = useRef<(() => void) | null>(null);
  const referenceLayerRef = useRef<L.LayerGroup | null>(null);
  const editorLayerRef = useRef<L.LayerGroup | null>(null);
  const layerMenuContainerRef = useRef<HTMLDivElement>(null);
  const hasInitializedViewportRef = useRef(false);
  const nativeFullscreenActiveRef = useRef(false);

  const [mapMode, setMapMode] = useState<MapMode>(() =>
    readSessionMapMode(gisBootstrap?.config?.defaultMapMode || 'roadmap')
  );
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string>('Peta Jalan');
  const [showSavedLayer, setShowSavedLayer] = useState<boolean>(() =>
    readSessionBool(ADM_MAP_SESSION_KEYS.showSaved, true)
  );
  const [showDusunLayer, setShowDusunLayer] = useState<boolean>(() =>
    readSessionBool(ADM_MAP_SESSION_KEYS.showDusun, true)
  );
  const [showFacilityLayer, setShowFacilityLayer] = useState<boolean>(() =>
    readSessionBool(ADM_MAP_SESSION_KEYS.showFacility, true)
  );
  const [showLabels, setShowLabels] = useState<boolean>(() =>
    readSessionBool(ADM_MAP_SESSION_KEYS.showLabels, false)
  );

  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [showMetricsPopup, setShowMetricsPopup] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    writeSessionValue(ADM_MAP_SESSION_KEYS.mapMode, mapMode);
  }, [mapMode]);

  useEffect(() => {
    writeSessionValue(ADM_MAP_SESSION_KEYS.showSaved, String(showSavedLayer));
  }, [showSavedLayer]);

  useEffect(() => {
    writeSessionValue(ADM_MAP_SESSION_KEYS.showDusun, String(showDusunLayer));
  }, [showDusunLayer]);

  useEffect(() => {
    writeSessionValue(ADM_MAP_SESSION_KEYS.showFacility, String(showFacilityLayer));
  }, [showFacilityLayer]);

  useEffect(() => {
    writeSessionValue(ADM_MAP_SESSION_KEYS.showLabels, String(showLabels));
  }, [showLabels]);

  useEffect(() => {
    if (points.length === 0 && confirmClear) {
      setConfirmClear(false);
    }
  }, [points.length, confirmClear]);

  useEffect(() => {
    if (!isLayerMenuOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        layerMenuContainerRef.current &&
        !layerMenuContainerRef.current.contains(e.target as Node)
      ) {
        setIsLayerMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isLayerMenuOpen]);

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
    const map = mapInstanceRef.current;
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

  // Init Leaflet map once (zoom at topleft so top-right floating stack & bottom-right attribution stay clear)
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: viewport.center,
      zoom: viewport.zoom,
      minZoom: 1,
      maxZoom: 19,
      zoomControl: false
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    const refLayer = L.layerGroup().addTo(map);
    const editLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    referenceLayerRef.current = refLayer;
    editorLayerRef.current = editLayer;

    map.on('click', () => {
      setIsLayerMenuOpen(false);
    });

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
    setProviderLabel(handle.provider.shortLabel);
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

  // Reference layers: saved boundaries (labels hidden by default, shown on hover/touch or Label toggle), dusun boundaries, facilities
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
        const labelText = b.villageName || b.sourceName || 'Wilayah Desa';

        const polys = geoJsonGeometryToLeafletPolygons(b.geometryGeoJson);
        polys.forEach((rings, ringIdx) => {
          const poly = L.polygon(rings, {
            color: strokeColor,
            weight: isNeighbor ? 2 : b.isActive ? 2.5 : 1.5,
            dashArray: isNeighbor ? '5, 5' : b.isActive ? '6, 4' : '4, 4',
            fillColor: strokeColor,
            fillOpacity: isNeighbor ? 0.1 : b.isActive ? 0.08 : 0.04,
            interactive: !isEditing
          });

          let areaLabel = '';
          if (typeof b.areaSqM === 'number' && b.areaSqM > 0) {
            areaLabel = `${(b.areaSqM / 10000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha`;
          } else if (rings.length > 0 && rings[0].length >= 3) {
            const calc = calculatePolygonAreaShoelace(rings[0]);
            if (calc.areaHectares > 0) areaLabel = calc.formattedAreaHectares;
          }

          if (showLabels) {
            if (ringIdx === 0) {
              const labelEl = document.createElement('div');
              labelEl.className = 'gis-boundary-clean-label';
              const spanEl = document.createElement('span');
              spanEl.style.fontWeight = '800';
              spanEl.style.fontSize = '10px';
              spanEl.style.color = strokeColor;
              spanEl.style.textShadow =
                '0 0 3px #ffffff, 0 0 6px #ffffff, 1px 1px 0 #ffffff, -1px -1px 0 #ffffff';
              spanEl.style.whiteSpace = 'nowrap';
              spanEl.style.pointerEvents = 'none';
              spanEl.textContent = labelText;
              labelEl.appendChild(spanEl);
              poly.bindTooltip(labelEl, {
                permanent: true,
                direction: 'top',
                className: 'gis-boundary-clean-label',
                offset: [0, -8]
              });
            }
          } else {
            const hoverTip = document.createElement('div');
            hoverTip.className = 'font-sans text-xs text-slate-800 p-0.5';
            const titleEl = document.createElement('strong');
            titleEl.className = 'block text-xs font-bold text-slate-900';
            titleEl.textContent = labelText;
            hoverTip.appendChild(titleEl);
            if (areaLabel) {
              const areaEl = document.createElement('span');
              areaEl.className = 'block text-[11px] font-semibold text-emerald-700';
              areaEl.textContent = `Luas: ${areaLabel}`;
              hoverTip.appendChild(areaEl);
            }
            poly.bindTooltip(hoverTip, {
              permanent: false,
              sticky: true
            });
          }

          if (!isEditing) {
            const popupEl = document.createElement('div');
            popupEl.className = 'font-sans text-xs text-slate-800 p-0.5';
            const pTitle = document.createElement('strong');
            pTitle.className = 'block text-xs font-bold text-slate-900';
            pTitle.textContent = labelText;
            popupEl.appendChild(pTitle);
            if (areaLabel) {
              const pArea = document.createElement('div');
              pArea.className = 'text-[11px] font-semibold text-emerald-700 mt-0.5';
              pArea.textContent = `Luas: ${areaLabel}`;
              popupEl.appendChild(pArea);
            }
            poly.bindPopup(popupEl);
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
          interactive: !isEditing
        });
        if (!isEditing && d.name) {
          const tip = document.createElement('div');
          tip.className = 'font-sans text-xs font-bold text-slate-800';
          tip.textContent = d.name;
          poly.bindTooltip(tip, { permanent: false, sticky: true });
        }
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
    showLabels,
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
      {/* Compact Icon Toolbar Editor Batas Wilayah */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleEditing(!isEditing)}
            aria-label={isEditing ? 'Selesai edit peta' : 'Aktifkan edit / digitasi peta'}
            title={isEditing ? 'Selesai Edit Peta' : 'Aktifkan Edit / Digitasi'}
            aria-pressed={isEditing}
            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border cursor-pointer ${
              isEditing
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {isEditing ? (
              <Eye className="w-4 h-4" />
            ) : (
              <Edit3 className="w-4 h-4 text-emerald-600" />
            )}
          </button>

          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo perubahan titik"
            title="Undo (Kembalikan perubahan titik terakhir)"
            className="w-10 h-10 rounded-xl bg-white/95 border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all"
          >
            <Undo2 className="w-4 h-4 text-amber-600" />
          </button>

          <button
            type="button"
            disabled={!hasUnsavedChanges}
            onClick={onDiscardChanges}
            aria-label="Batalkan semua perubahan"
            title="Batal Perubahan (Reset ke data tersimpan)"
            className="w-10 h-10 rounded-xl bg-white/95 border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
          </button>

          {points.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClear((v) => !v)}
              aria-label="Kosongkan titik poligon"
              aria-expanded={confirmClear}
              title="Kosongkan seluruh titik poligon dari kanvas"
              className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
                confirmClear
                  ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                  : 'bg-white/95 border-rose-200 text-rose-600 hover:bg-rose-50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleFocusPolygonOrVillage}
            aria-label="Pusatkan peta"
            title="Pusatkan Ulang Peta"
            className="w-10 h-10 rounded-xl bg-white/95 border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all"
          >
            <Crosshair className="w-4 h-4 text-emerald-700" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 pr-1">
          {isEditing && (
            <span className="text-emerald-700 font-bold">Mode Edit Aktif</span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700">
            {points.length} titik
          </span>
        </div>
      </div>

      {/* Inline confirmation bar before destructive "Kosongkan" */}
      {confirmClear && points.length > 0 && (
        <div
          role="alertdialog"
          aria-label="Konfirmasi kosongkan titik poligon"
          className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 text-rose-900 px-3 py-2 rounded-xl text-xs"
        >
          <span className="font-semibold">
            Kosongkan semua {points.length} titik poligon dari kanvas?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onChangePoints([]);
                setConfirmClear(false);
              }}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Ya, Kosongkan
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {providerNotice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{providerNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setProviderNotice(null)}
            aria-label="Tutup pemberitahuan peta"
            title="Tutup"
            className="text-amber-700 hover:text-amber-900 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Canvas Peta Leaflet */}
      <div
        ref={wrapperRef}
        data-fullscreen={isFullscreen ? 'true' : 'false'}
        className={
          isFullscreen
            ? 'fixed inset-0 z-[9900] w-screen h-screen rounded-none border-0 bg-slate-900 overflow-hidden'
            : 'relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-900'
        }
      >
        <div
          ref={mapContainerRef}
          style={{ height: isFullscreen ? '100%' : height }}
          className="w-full z-0"
        />

        {/* Vertical Floating Icon Controls (Top-Right, 40x40px semi-transparent, matching Public Map) */}
        <div
          ref={layerMenuContainerRef}
          className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5"
        >
          {/* 1. Layer Peta + Auto-closing Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLayerMenuOpen((v) => !v)}
              aria-label="Pilih layer peta"
              aria-expanded={isLayerMenuOpen}
              title={`Layer Peta (${providerLabel})`}
              className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
                isLayerMenuOpen
                  ? 'bg-emerald-600/95 text-white border-emerald-500'
                  : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200/80'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            {isLayerMenuOpen && (
              <div
                role="menu"
                aria-label="Pilihan layer peta"
                className="absolute top-0 right-12 w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 p-1.5 flex flex-col gap-0.5 z-[1010]"
              >
                {MAP_MODE_OPTIONS.map((opt) => {
                  const isSelected = mapMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      onClick={() => {
                        setMapMode(opt.mode);
                        setIsLayerMenuOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Batas Tersimpan Toggle */}
          <button
            type="button"
            onClick={() => setShowSavedLayer((v) => !v)}
            aria-label="Toggle batas tersimpan"
            aria-pressed={showSavedLayer}
            title={showSavedLayer ? 'Sembunyikan Batas Tersimpan' : 'Tampilkan Batas Tersimpan'}
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              showSavedLayer
                ? 'bg-pink-600/90 hover:bg-pink-600 text-white border-pink-500'
                : 'bg-white/85 hover:bg-white text-slate-400 hover:text-slate-700 border-slate-200/80'
            }`}
          >
            <Pentagon className="w-4 h-4" />
          </button>

          {/* 3. Dusun Toggle */}
          <button
            type="button"
            onClick={() => setShowDusunLayer((v) => !v)}
            aria-label="Toggle batas dusun"
            aria-pressed={showDusunLayer}
            title={showDusunLayer ? 'Sembunyikan Batas Dusun' : 'Tampilkan Batas Dusun'}
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              showDusunLayer
                ? 'bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-500'
                : 'bg-white/85 hover:bg-white text-slate-400 hover:text-slate-700 border-slate-200/80'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* 4. Fasilitas Toggle */}
          <button
            type="button"
            onClick={() => setShowFacilityLayer((v) => !v)}
            aria-label="Toggle pin fasilitas"
            aria-pressed={showFacilityLayer}
            title={showFacilityLayer ? 'Sembunyikan Pin Fasilitas' : 'Tampilkan Pin Fasilitas'}
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              showFacilityLayer
                ? 'bg-sky-600/90 hover:bg-sky-600 text-white border-sky-500'
                : 'bg-white/85 hover:bg-white text-slate-400 hover:text-slate-700 border-slate-200/80'
            }`}
          >
            <MapPin className="w-4 h-4" />
          </button>

          {/* 5. Label Wilayah Toggle (hidden by default) */}
          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            aria-label="Toggle label nama wilayah"
            aria-pressed={showLabels}
            title={showLabels ? 'Sembunyikan Label Wilayah' : 'Tampilkan Label Wilayah'}
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              showLabels
                ? 'bg-amber-600/90 hover:bg-amber-600 text-white border-amber-500'
                : 'bg-white/85 hover:bg-white text-slate-400 hover:text-slate-700 border-slate-200/80'
            }`}
          >
            <Tag className="w-4 h-4" />
          </button>

          {/* 6. Perbesar / Kecilkan Layar */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Kecilkan peta' : 'Perbesar peta'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'Kecilkan Peta (ESC)' : 'Perbesar Peta ke Layar Penuh'}
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              isFullscreen
                ? 'bg-emerald-600/95 hover:bg-emerald-600 text-white border-emerald-500'
                : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200/80'
            }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4 text-emerald-700" />
            )}
          </button>
        </div>

        {/* Bottom-Left Info Icon Button + Closable Geometry Popup (never blocks map permanently) */}
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-col items-start gap-2">
          {showMetricsPopup && (
            <div
              role="dialog"
              aria-label="Informasi pratinjau poligon batas"
              className="bg-slate-900/95 backdrop-blur-md text-white px-3 py-2.5 rounded-2xl shadow-xl border border-slate-700/80 w-64 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  {isEditing ? 'Mode Edit Aktif' : 'Pratinjau Poligon Batas'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono text-[10px]">
                    {points.length} titik
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMetricsPopup(false)}
                    aria-label="Tutup info poligon"
                    title="Tutup"
                    className="p-0.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {metrics ? (
                <div className="grid grid-cols-2 gap-2 pt-1.5 text-[11px] border-t border-slate-800">
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
                <p className="text-[10px] text-amber-300 leading-relaxed pt-1 border-t border-slate-800">
                  {isEditing
                    ? 'Klik minimal 3 titik pada peta atau impor file GeoJSON batas desa.'
                    : 'Belum ada poligon aktif di editor. Klik ikon edit di atas atau impor GeoJSON.'}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowMetricsPopup((v) => !v)}
            aria-label="Info pratinjau poligon batas"
            aria-expanded={showMetricsPopup}
            title={
              showMetricsPopup
                ? 'Tutup Info Poligon Batas'
                : 'Lihat Info Poligon (Titik, Luas, Keliling)'
            }
            className={`w-10 h-10 rounded-xl backdrop-blur-md shadow-md border transition-all flex items-center justify-center cursor-pointer ${
              showMetricsPopup
                ? 'bg-slate-900/95 text-emerald-400 border-slate-700'
                : 'bg-white/90 hover:bg-white text-slate-700 border-slate-200/80'
            }`}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

