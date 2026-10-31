import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { FacilityPoint } from '../../types';
import L from 'leaflet';
import {
  MapPin,
  Building2,
  Phone,
  Compass,
  Navigation,
  ExternalLink,
  Layers,
  Info,
  Map as MapIcon,
  Grid
} from 'lucide-react';

const MAP_CATEGORIES = [
  { key: 'all', label: 'Semua Fasilitas', color: '#047857' },
  { key: 'kantor_desa', label: 'Kantor & Balai', color: '#b45309' },
  { key: 'kesehatan', label: 'Kesehatan', color: '#0284c7' },
  { key: 'pendidikan', label: 'Pendidikan', color: '#7c3aed' },
  { key: 'ibadah', label: 'Tempat Ibadah', color: '#059669' },
  { key: 'infrastruktur', label: 'Dermaga & Sarana', color: '#d97706' },
  { key: 'ekonomi', label: 'Pasar & BUMDes', color: '#e11d48' },
  { key: 'wisata', label: 'Wisata', color: '#0d9488' },
  { key: 'olahraga', label: 'Olahraga', color: '#4f46e5' }
];

export const VillageMapView: React.FC = () => {
  const { facilities, villageProfile, webGisData, navigateTo } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'interactive' | 'grid'>('interactive');
  const [activeFacility, setActiveFacility] = useState<FacilityPoint | undefined>(() =>
    facilities && facilities.length > 0 ? facilities[0] : undefined
  );

  const safeFacilities = facilities || [];
  const filtered =
    selectedCategory === 'all'
      ? safeFacilities
      : safeFacilities.filter((f) => f.category === selectedCategory);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker | L.Polygon }>({});

  // Initialize and update Leaflet map
  useEffect(() => {
    if (viewMode !== 'interactive' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [-1.6050, 103.3500],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap kontributor &copy; CARTO'
      }).addTo(map);

      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;

    // Clear old markers
    (Object.values(markersRef.current) as L.Layer[]).forEach((layer) => layer.remove());
    markersRef.current = {};

    // Add markers for filtered facilities
    filtered.forEach((facility) => {
      if (!facility.coordinates || facility.coordinates.length < 2) return;
      const [lat, lng] = facility.coordinates;
      const catConfig = MAP_CATEGORIES.find((c) => c.key === facility.category) || { color: '#047857' };

      const markerIcon = L.divIcon({
        className: 'custom-div-marker',
        html: `
          <div style="
            background-color: ${catConfig.color};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.2s;
          " title="${facility.name}">
            📍
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);

      const popupContent = `
        <div style="font-family: inherit; font-size: 12px; max-width: 220px; padding: 4px;">
          <strong style="font-size: 13px; color: #0f172a; display: block; margin-bottom: 4px;">${facility.name}</strong>
          <div style="font-size: 10px; color: #047857; text-transform: uppercase; font-weight: bold; margin-bottom: 6px;">${facility.category.replace('_', ' ')}</div>
          <p style="color: #475569; margin: 0 0 8px 0; line-height: 1.4;">${facility.description}</p>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">📍 ${facility.address}</div>
          <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" rel="noreferrer" style="
            display: inline-block;
            background-color: #047857;
            color: white;
            padding: 4px 10px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 11px;
            font-weight: bold;
          ">Buka Rute Navigasi</a>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('click', () => {
        setActiveFacility(facility);
      });

      markersRef.current[facility.id] = marker;
    });

    // Render SPORADIK WebGIS Parcels (Only if not filtering by non-all)
    if (selectedCategory === 'all' && webGisData && webGisData.length > 0) {
      webGisData.forEach(parcel => {
        if (parcel.sporadikStatus === 'SPORADIK_TERBIT' && parcel.coordinates && parcel.coordinates.length > 2) {
          const polygon = L.polygon(parcel.coordinates, {
            color: '#10b981',
            weight: 2,
            fillColor: '#34d399',
            fillOpacity: 0.4
          }).addTo(map);

          const popupContent = document.createElement('div');
          popupContent.innerHTML = `
            <div style="font-family: inherit; font-size: 12px; min-width: 180px;">
              <div style="background-color: #047857; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; display: inline-block; margin-bottom: 6px;">
                ✓ SPORADIK TERBIT
              </div>
              <strong style="display: block; font-size: 13px; color: #0f172a; margin-bottom: 2px;">Bidang Tanah: ${parcel.ownerName}</strong>
              <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">Luas: ${parcel.landAreaSqM} m² / ${parcel.landAreaHectares} Ha</div>
              <button class="view-sporadik-btn" style="
                background-color: #0f172a;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 11px;
                cursor: pointer;
                width: 100%;
                font-weight: bold;
              ">Lihat Berkas Surat</button>
            </div>
          `;

          const btn = popupContent.querySelector('.view-sporadik-btn');
          if (btn) {
            btn.addEventListener('click', () => {
              // Open modal or navigate
              if (parcel.sporadikRequestCode) {
                 navigateTo('layanan', { trackingCode: parcel.sporadikRequestCode });
              } else {
                 alert('Berkas SPORADIK tidak ditemukan (ID/Resi hilang).');
              }
            });
          }

          polygon.bindPopup(popupContent);
          markersRef.current[parcel.id] = polygon;
        }
      });
    }

    // Invalidate size in case of tab or view resize
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [filtered, viewMode, webGisData, selectedCategory, navigateTo]);

  // Handle click on a facility from list
  const handleSelectFacility = (facility: FacilityPoint) => {
    setActiveFacility(facility);
    if (viewMode === 'interactive' && leafletMapRef.current && facility.coordinates && facility.coordinates.length >= 2) {
      const [lat, lng] = facility.coordinates;
      leafletMapRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
      const marker = markersRef.current[facility.id];
      if (marker) {
        marker.openPopup();
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
            Geospasial & Fasilitas Umum
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Peta Digital Fasilitas {villageProfile.villageName || 'Desa'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Informasi lokasi kantor desa, sarana pendidikan, fasilitas kesehatan, dermaga penyeberangan perahu Batang Hari, dan batas dusun.
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
              <span>Peta Interaktif (OSM)</span>
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
        {/* Visual Map Representation */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === 'interactive' ? (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm relative">
              {/* Map Bar Header */}
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Peta OpenStreetMap {villageProfile.villageName || 'Desa'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Batang Hari: -1.5284°, 103.3142°
                </span>
              </div>

              {/* Leaflet container */}
              <div
                ref={mapContainerRef}
                className="w-full h-[520px] z-10"
                style={{ background: '#f8fafc' }}
              />

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Klik pada pin untuk melihat informasi fasilitas dan petunjuk arah.</span>
                </div>
                <a
                  href="https://maps.google.com/?q=Pulau+Betung+Pemayung+Batang+Hari"
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
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((facility) => {
                const isSelected = activeFacility?.id === facility.id;
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
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {facility.category.replace('_', ' ')}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">{facility.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{facility.description}</p>
                        <div className="text-[11px] text-slate-400 mt-2">📍 {facility.address}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick POI list under interactive map */}
          {viewMode === 'interactive' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <span className="text-xs font-bold text-slate-700 block">Pilih Cepat Titik Lokasi ({filtered.length}):</span>
              <div className="flex flex-wrap gap-2">
                {filtered.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => handleSelectFacility(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      activeFacility?.id === f.id
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6 h-fit">
          {activeFacility ? (
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
                <div className="h-32 w-full rounded-2xl bg-emerald-900/10 border border-emerald-200 flex items-center justify-center text-emerald-800 text-xs font-semibold">
                  <Building2 className="w-6 h-6 opacity-50 mr-2" />
                  <span>Fasilitas Resmi Desa</span>
                </div>
              )}

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {activeFacility.category.replace('_', ' ')}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1.5 leading-snug">{activeFacility.name}</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {activeFacility.description}
                </p>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Alamat:</strong> {activeFacility.address}</span>
                </div>
                {activeFacility.contact && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Kontak:</strong> {activeFacility.contact}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-mono text-[11px]">
                    <strong>Titik Koordinat:</strong>{' '}
                    {activeFacility.coordinates && activeFacility.coordinates.length >= 2
                      ? `${activeFacility.coordinates[0]}, ${activeFacility.coordinates[1]}`
                      : activeFacility.coordinatesLabel || '-1.5284°, 103.3142°'}
                  </span>
                </div>
              </div>

              {activeFacility.coordinates && activeFacility.coordinates.length >= 2 && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeFacility.coordinates[0]},${activeFacility.coordinates[1]}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition-all flex items-center justify-center space-x-2 mt-2"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Petunjuk Arah (Navigasi GPS)</span>
                </a>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Pilih salah satu titik fasilitas untuk melihat informasi detail.
            </div>
          )}

          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 leading-relaxed">
            <strong>Akses Wilayah:</strong> {villageProfile.villageName || 'Desa'} dapat ditempuh melalui {villageProfile.addressStreet || 'jalan poros utama'} ({villageProfile.district || 'Kecamatan Pemayung'}, {villageProfile.regency || 'Kabupaten Batang Hari'}).
          </div>
        </div>
      </div>
    </div>
  );
};
