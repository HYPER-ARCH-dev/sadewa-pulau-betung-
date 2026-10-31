import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../context/AppContext';
import { LandParcel, DusunSpatialBoundary } from '../../types/webgis';
import { MapFacility } from '../../types';
import { calculatePolygonAreaShoelace } from '../../utils/geometryEngine';
import { Layers, MapPin, Navigation, Maximize2, Compass, Plus, Trash2, Check, RefreshCw } from 'lucide-react';

// Fix Leaflet Default Icon path issues in Vite
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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
  const { villageProfile } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeTile, setActiveTile] = useState<'osm' | 'satellite'>('osm');
  const [showDusunBounds, setShowDusunBounds] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);

  // Pusat Peta Desa Pulau Betung (-1.6050, 103.3500)
  const CENTER_LAT = -1.6050;
  const CENTER_LNG = 103.3500;
  const DEFAULT_ZOOM = 15;

  // Inisialisasi Peta Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Mencegah re-initialization

    const map = L.map(mapContainerRef.current, {
      center: [CENTER_LAT, CENTER_LNG],
      zoom: DEFAULT_ZOOM,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer Ubin Vektor CartoDB Voyager vs Esri World Imagery (Satelit)
    const vectorLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO | SADEWA WebGIS'
    });

    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      }
    );

    vectorLayer.addTo(map);

    const layersGroup = L.layerGroup().addTo(map);
    const drawingLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    layersGroupRef.current = layersGroup;
    drawingLayerRef.current = drawingLayer;

    // Fix map layout recalculation on container resize
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Base Layer (OSM vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (activeTile === 'satellite') {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { 
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        }
      ).addTo(map);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO | SADEWA WebGIS'
      }).addTo(map);
    }
  }, [activeTile]);

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
      // 1. Gambar Marker titik-titik sudut
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

      // 2. Gambar garis penghubung
      if (drawingPoints.length >= 2) {
        const polyline = L.polyline(drawingPoints, {
          color: '#ef4444',
          weight: 3,
          dashArray: '6, 6'
        });
        drawingGroup.addLayer(polyline);
      }

      // 3. Gambar poligon tertutup jika >= 3 titik
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

  // Render Overlay Poligon Dusun, Bidang Tanah Warga, & Fasilitas
  useEffect(() => {
    const layersGroup = layersGroupRef.current;
    const map = mapInstanceRef.current;
    if (!layersGroup || !map) return;

    layersGroup.clearLayers();

    // 1. Render Batas Administrasi Dusun
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

        polygon.bindTooltip(
          `<div class="font-bold text-xs font-sans text-slate-800">${dusun.name}</div><div class="text-[10px] text-slate-500">Kadus: ${dusun.leaderName}</div>`,
          { permanent: true, direction: 'center', className: 'dusun-label-tooltip' }
        );

        layersGroup.addLayer(polygon);
      });
    }

    // 2. Render Poligon Bidang Tanah Warga (PBB-P2 & SPORADIK)
    if (parcels) {
      parcels.forEach((parcel) => {
        if (!parcel.coordinates || parcel.coordinates.length === 0) return;

        const isSelected = selectedParcelId === parcel.id;

        // Penentuan Warna Poligon
        let fillColor = '#10b981'; // Emerald Default
        let strokeColor = '#059669';

        if (parcel.pbbStatus === 'BELUM_LUNAS') {
          fillColor = '#f59e0b'; // Amber
          strokeColor = '#d97706';
        } else if (parcel.pbbStatus === 'BEBAS_PAJAK') {
          fillColor = '#8b5cf6'; // Purple
          strokeColor = '#7c3aed';
        }

        if (parcel.sporadikStatus === 'SPORADIK_TERBIT') {
          fillColor = '#2563eb'; // Blue
          strokeColor = '#1d4ed8';
        }

        if (isSelected) {
          fillColor = '#ec4899'; // Pink Highlight
          strokeColor = '#be185d';
        }

        const polygon = L.polygon(parcel.coordinates, {
          color: strokeColor,
          weight: isSelected ? 4 : 2,
          fillColor,
          fillOpacity: isSelected ? 0.6 : 0.35
        });

        // Popup Interaktif
        const popupContent = `
          <div class="p-1 max-w-xs font-sans text-slate-800">
            <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200">
              <span class="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">NOP: ${parcel.nop}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${parcel.pbbStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${parcel.pbbStatus}</span>
            </div>
            <h4 class="font-bold text-xs text-slate-900 leading-snug">${parcel.ownerName}</h4>
            <p class="text-[11px] text-slate-500 mt-0.5">${parcel.addressDusun}</p>
            <div class="grid grid-cols-2 gap-1 my-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
              <div>
                <span class="text-slate-400 block">Luas Tanah (Shoelace):</span>
                <strong class="text-slate-800 font-bold">${parcel.landAreaSqM.toLocaleString('id-ID')} m²</strong>
              </div>
              <div>
                <span class="text-slate-400 block">PBB-P2 (Batang Hari):</span>
                <strong class="text-emerald-700 font-bold">Rp ${parcel.pbbTaxAmount.toLocaleString('id-ID')}</strong>
              </div>
            </div>
            <div class="text-[10px] text-slate-600 mb-2">
              <strong>SPORADIK:</strong> <span class="font-semibold text-blue-700">${parcel.sporadikStatus.replace('_', ' ')}</span>
            </div>
            <button id="btn-select-parcel-${parcel.id}" class="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors shadow-2xs">
              Lihat Detail & SPORADIK
            </button>
          </div>
        `;

        polygon.bindPopup(popupContent);

        polygon.on('click', () => {
          if (onSelectParcel) {
            onSelectParcel(parcel);
          }
        });

        layersGroup.addLayer(polygon);
      });
    }

    // 3. Render Titik Fasilitas Umum
    if (showFacilities && facilities) {
      facilities.forEach((fac) => {
        if (!fac.coordinates) return;

        const marker = L.circleMarker(fac.coordinates, {
          radius: 7,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 0.9
        });

        marker.bindTooltip(
          `<div class="font-bold text-xs text-slate-900">${fac.name}</div><div class="text-[10px] text-slate-500">${fac.category}</div>`,
          { permanent: false }
        );

        layersGroup.addLayer(marker);
      });
    }
  }, [parcels, dusunBoundaries, facilities, selectedParcelId, showDusunBounds, showFacilities, onSelectParcel]);

  // Calculated Live Area untuk Poligon Menggambar
  const liveDrawCalc = isDrawingMode && drawingPoints.length >= 3
    ? calculatePolygonAreaShoelace(drawingPoints)
    : null;

  const handleResetZoom = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([CENTER_LAT, CENTER_LNG], DEFAULT_ZOOM);
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs bg-slate-900 ${className}`}>
      {/* Container Element Peta Leaflet */}
      <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

      {/* Control Panel Atas Kiri: Switch Tile & Layer Toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2">
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTile('osm')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeTile === 'osm' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Vektor Peta
          </button>
          <button
            type="button"
            onClick={() => setActiveTile('satellite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeTile === 'satellite' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Citra Satelit
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl shadow-md border border-slate-200/80 flex items-center gap-2 text-xs font-semibold text-slate-700">
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

          {/* Realtime Live Shoelace Area Preview */}
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
