import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ToddlerRecord } from '../../types/posyandu';
import { useApp } from '../../context/AppContext';
import { MapPin, Navigation, AlertTriangle, ShieldCheck, Phone, CheckCircle2, HeartHandshake, Eye } from 'lucide-react';

interface PosyanduSpatialMapProps {
  toddlers: ToddlerRecord[];
  onSelectToddler?: (toddler: ToddlerRecord) => void;
  onSendWhatsAppIntervention?: (toddler: ToddlerRecord) => void;
}

export const PosyanduSpatialMap: React.FC<PosyanduSpatialMapProps> = ({
  toddlers,
  onSelectToddler,
  onSendWhatsAppIntervention
}) => {
  const { villageProfile } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [selectedDusun, setSelectedDusun] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Center on village coords (-1.6050, 103.3500)
  const CENTER_LAT = -1.6050;
  const CENTER_LNG = 103.3500;

  // Filtered Toddlers
  const filteredToddlers = toddlers.filter((t) => {
    const matchesDusun = selectedDusun === 'all' || t.dusunName === selectedDusun;
    const latest = t.measurements[t.measurements.length - 1];
    const isStunted = latest && (latest.stuntingCategory === 'Severely Stunted' || latest.stuntingCategory === 'Stunted');

    let matchesStatus = true;
    if (selectedStatus === 'stunted') {
      matchesStatus = isStunted;
    } else if (selectedStatus === 'normal') {
      matchesStatus = !isStunted;
    } else if (selectedStatus === 'intervention') {
      matchesStatus = t.isInterventionTarget;
    }

    return matchesDusun && matchesStatus;
  });

  // Calculate Stunting Stats
  const total = toddlers.length;
  const stuntedCount = toddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && (m.stuntingCategory === 'Severely Stunted' || m.stuntingCategory === 'Stunted');
  }).length;
  const normalCount = total - stuntedCount;
  const stuntingRatePct = total > 0 ? ((stuntedCount / total) * 100).toFixed(1) : '0';

  const [isMapReady, setIsMapReady] = useState(false);

  // Leaflet Map Initialization
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [CENTER_LAT, CENTER_LNG],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap kontributor &copy; CARTO | Posyandu SADEWA'
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          setIsMapReady(true);
        }
      }, 200);

      return () => {
        clearTimeout(timer);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  // Update Markers when filteredToddlers changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersGroupRef.current) return;

    markersGroupRef.current.clearLayers();

    // Add Markers for Filtered Toddlers
    filteredToddlers.forEach((toddler) => {
      const latest = toddler.measurements[toddler.measurements.length - 1];
      const isStunted = latest && (latest.stuntingCategory === 'Severely Stunted' || latest.stuntingCategory === 'Stunted');
      const isSeverelyStunted = latest && latest.stuntingCategory === 'Severely Stunted';

      const colorClass = isSeverelyStunted ? 'bg-rose-600' : isStunted ? 'bg-amber-500' : 'bg-emerald-600';
      const borderClass = isSeverelyStunted ? 'ring-4 ring-rose-300 animate-pulse' : isStunted ? 'ring-2 ring-amber-200' : 'ring-2 ring-emerald-200';

      const customHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full ${colorClass} ${borderClass} text-white flex items-center justify-center shadow-lg transform transition-transform hover:scale-125">
            <span class="font-bold text-xs">${toddler.name.charAt(0)}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: customHtml,
        className: 'custom-toddler-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([toddler.coordinates[0], toddler.coordinates[1]], { icon: customIcon });

      // Popup Content
      const popupHtml = `
        <div class="p-3 min-w-[240px] font-sans">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white ${colorClass}">
              ${latest ? latest.overallStatus : 'Belum Ditimbang'}
            </span>
            <span class="text-[10px] text-slate-500 font-mono">${toddler.kmsCardNumber}</span>
          </div>
          <h4 class="font-bold text-sm text-slate-900">${toddler.name}</h4>
          <p class="text-xs text-slate-600 mt-0.5">
            Usia: <strong>${latest ? latest.ageInMonths : 0} bln</strong> • Ortu: <strong>${toddler.parentName}</strong>
          </p>
          <p class="text-[11px] text-slate-500 mt-0.5">
            Dusun: ${toddler.dusunName} (${toddler.rtRw})
          </p>
          <div class="mt-2 pt-2 border-t border-slate-200 text-xs flex justify-between items-center">
            <span class="font-semibold text-slate-700">TB: ${latest ? latest.heightCm : '-'} cm</span>
            <span class="font-mono text-slate-500">Z-Score: ${latest ? latest.zScoreHeightForAge : '-'}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      markersGroupRef.current?.addLayer(marker);
    });
  }, [filteredToddlers, isMapReady]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
            Sistem Informasi Geospasial Stunting (e-Posyandu)
          </span>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Peta Sebaran Balita & Pemetaan Resiko Stunting
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Sistem pemetaan presisi untuk mempermudah Bidan Desa dan Tim Pendamping Keluarga (TPK) {villageProfile.villageName || 'Desa'} mendeteksi balita berisiko stunting dan melakukan intervensi gizi tepat sasaran.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white shadow-sm text-center">
            <div className="text-[10px] font-medium text-slate-300">Total Balita</div>
            <div className="text-base font-black">{total} Anak</div>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm text-center">
            <div className="text-[10px] font-bold uppercase text-rose-700">Stunting (Prevalensi)</div>
            <div className="text-base font-black text-rose-700">{stuntedCount} ({stuntingRatePct}%)</div>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-700">Gizi Normal</div>
            <div className="text-base font-black text-emerald-800">{normalCount} Anak</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700">Filter Dusun:</span>
          <select
            value={selectedDusun}
            onChange={(e) => setSelectedDusun(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Dusun</option>
            <option value="Dusun Betung Indah">Dusun Betung Indah</option>
            <option value="Dusun Teluk Melintang">Dusun Teluk Melintang</option>
            <option value="Dusun Seberang Jaya">Dusun Seberang Jaya</option>
          </select>

          <span className="text-xs font-bold text-slate-700 ml-2">Status Gizi:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Semua Status Gizi</option>
            <option value="stunted">Stunting / Berisiko (Merah & Jingga)</option>
            <option value="normal">Normal (Hijau)</option>
            <option value="intervention">Target Intervensi Khusus TPK</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-rose-600 ring-2 ring-rose-300 inline-block" /> Sangat Pendek
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Pendek / Riset
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Normal
          </span>
        </div>
      </div>

      {/* Map Element */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-[460px]">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Re-center Map Floating Button */}
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.setView([CENTER_LAT, CENTER_LNG], 15)}
          className="absolute top-3 right-3 z-[1000] bg-white/95 text-slate-800 p-2.5 rounded-xl shadow-md border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
          title="Fokus Ulang Peta Spasial"
        >
          <Navigation className="w-4 h-4 text-emerald-700" />
        </button>
      </div>

      {/* Cards Grid Balita Terfilter */}
      <div className="space-y-3 pt-2">
        <h4 className="text-sm font-bold text-slate-800 flex items-center justify-between">
          <span>Daftar Balita pada Wilayah Terpilih ({filteredToddlers.length})</span>
          <span className="text-xs text-slate-500 font-normal">Klik balita untuk lihat detail KMS / Kirim Pesan Intervensi</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredToddlers.map((t) => {
            const latest = t.measurements[t.measurements.length - 1];
            const isStunted = latest && (latest.stuntingCategory === 'Severely Stunted' || latest.stuntingCategory === 'Stunted');

            return (
              <div
                key={t.id}
                className={`p-4 rounded-2xl border transition-all hover:shadow-md ${
                  isStunted
                    ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
                    : 'bg-white border-slate-200 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                      isStunted ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {latest ? latest.overallStatus : 'Belum Ditimbang'}
                    </span>
                    <h5 className="font-extrabold text-sm text-slate-900 mt-1.5">{t.name}</h5>
                    <p className="text-xs text-slate-600">
                      Ortu: <span className="font-semibold">{t.parentName}</span> ({t.parentPhone})
                    </p>
                  </div>
                  {isStunted && (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-1" />
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dusun / RT</span>
                    <span className="font-bold text-slate-800">{t.dusunName} ({t.rtRw})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">TB / Z-Score</span>
                    <span className={`font-bold font-mono ${isStunted ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {latest ? `${latest.heightCm}cm (${latest.zScoreHeightForAge}SD)` : '-'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
                  {onSelectToddler && (
                    <button
                      onClick={() => onSelectToddler(t)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-800 hover:text-emerald-900 text-xs font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>KMS Digital</span>
                    </button>
                  )}

                  {onSendWhatsAppIntervention && (
                    <button
                      onClick={() => onSendWhatsAppIntervention(t)}
                      className="py-1.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                      title="Kirim Pesan WhatsApp Intervensi TPK"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Intervensi WA</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
