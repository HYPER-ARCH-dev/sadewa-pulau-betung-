import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { MAP_MODE_OPTIONS, MAP_PROVIDER_REGISTRY } from '../../config/mapProviderRegistry';
import {
  computeCentroidFromLeafletCoords,
  geoJsonGeometryToLeafletPolygons,
  isValidCoordinatePair
} from '../../utils/gisAdapter';
import { GisVillageBoundary, MapMode } from '../../types/webgis';
import {
  CheckCircle2,
  Compass,
  ExternalLink,
  Globe,
  MapPin,
  Palette,
  Save,
  Settings,
  ShieldCheck
} from 'lucide-react';

const REFERENCE_MAPS_PIN_URL = 'https://maps.app.goo.gl/JWwhvNZPj22Z9g4r5?g_st=ac';

const ROADMAP_PROVIDERS = Object.values(MAP_PROVIDER_REGISTRY).filter(
  (p) => p.mode === 'roadmap' && p.id !== 'osm_standard_emergency'
);

export const GisConfigPanel: React.FC = () => {
  const { addToast, villageProfile, gisBootstrap, refreshGisBootstrap } = useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [villageName, setVillageName] = useState(villageProfile?.villageName || 'Desa Pulau Betung');
  const [regionCode, setRegionCode] = useState('15.04.05.2009');
  const [centerLat, setCenterLat] = useState<string>('-1.5562');
  const [centerLng, setCenterLng] = useState<string>('103.4475');
  const [defaultZoom, setDefaultZoom] = useState<number>(14);
  const [defaultMapMode, setDefaultMapMode] = useState<MapMode>('roadmap');
  const [activeProviderId, setActiveProviderId] = useState<string>('openfreemap_liberty');
  const [showVillageBoundary, setShowVillageBoundary] = useState<boolean>(true);
  const [boundaryColor, setBoundaryColor] = useState<string>('#ec4899');
  const [customSatelliteTileUrl, setCustomSatelliteTileUrl] = useState<string>('');
  const [activeBoundary, setActiveBoundary] = useState<GisVillageBoundary | null>(null);
  const [dataSource, setDataSource] = useState<string>('database');
  const [gisTablesReady, setGisTablesReady] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const loadConfig = async () => {
      setLoading(true);
      const res = await api.getAdminGisConfig();
      if (!mounted) return;
      setLoading(false);

      if (!res.success || !res.data) {
        addToast('error', 'Gagal Memuat Konfigurasi GIS', res.error || 'Terjadi kesalahan server.');
        return;
      }

      const payload = res.data;
      const cfg = payload.config;
      setVillageName(payload.villageName || villageProfile?.villageName || 'Desa Pulau Betung');
      setRegionCode(cfg.regionCode || payload.regionCode || '15.04.05.2009');
      setCenterLat(
        cfg.centerLat != null
          ? String(cfg.centerLat)
          : String(villageProfile?.officeLocation?.lat ?? -1.5562)
      );
      setCenterLng(
        cfg.centerLng != null
          ? String(cfg.centerLng)
          : String(villageProfile?.officeLocation?.lng ?? 103.4475)
      );
      setDefaultZoom(cfg.defaultZoom || 14);
      setDefaultMapMode(cfg.defaultMapMode || 'roadmap');
      setActiveProviderId(
        cfg.activeProviderId && MAP_PROVIDER_REGISTRY[cfg.activeProviderId]
          ? cfg.activeProviderId
          : 'openfreemap_liberty'
      );
      setShowVillageBoundary(
        typeof cfg.showVillageBoundary === 'boolean' ? cfg.showVillageBoundary : true
      );
      setBoundaryColor(cfg.boundaryColor || '#ec4899');
      setCustomSatelliteTileUrl(cfg.customSatelliteTileUrl || '');
      setActiveBoundary(payload.activeBoundary || null);
      setDataSource(payload.dataSource || 'database');
      setGisTablesReady(Boolean(payload.gisTablesReady));
    };

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [addToast, villageProfile]);

  const handleUseOfficeCoords = () => {
    const lat = villageProfile?.officeLocation?.lat;
    const lng = villageProfile?.officeLocation?.lng;
    if (!isValidCoordinatePair(lat, lng)) {
      addToast('warning', 'Koordinat Kantor Belum Diisi', 'Silakan lengkapi titik kantor desa di Pengaturan Profil Desa.');
      return;
    }
    setCenterLat(String(lat));
    setCenterLng(String(lng));
    addToast('info', 'Koordinat Kantor Diterapkan', `Pusat peta disetel ke ${lat}, ${lng}.`);
  };

  const handleUseBoundaryCentroid = () => {
    if (!activeBoundary) {
      addToast('info', 'Belum Ada Batas Aktif', 'Buat atau aktifkan poligon batas desa terlebih dahulu.');
      return;
    }

    if (isValidCoordinatePair(activeBoundary.centroidLat, activeBoundary.centroidLng)) {
      setCenterLat(String(activeBoundary.centroidLat));
      setCenterLng(String(activeBoundary.centroidLng));
      addToast('info', 'Centroid Batas Diterapkan', 'Koordinat pusat peta diselaraskan dengan batas aktif.');
      return;
    }

    const polys = geoJsonGeometryToLeafletPolygons(activeBoundary.geometryGeoJson);
    const flat = polys.flatMap((poly) => poly[0] || []);
    const centroid = computeCentroidFromLeafletCoords(flat);
    if (centroid) {
      setCenterLat(centroid[0].toFixed(6));
      setCenterLng(centroid[1].toFixed(6));
      addToast('info', 'Centroid Batas Diterapkan', 'Koordinat pusat peta diselaraskan dengan centroid poligon.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = centerLat.trim() ? Number(centerLat) : null;
    const parsedLng = centerLng.trim() ? Number(centerLng) : null;

    if (
      (parsedLat !== null || parsedLng !== null) &&
      !isValidCoordinatePair(parsedLat, parsedLng)
    ) {
      addToast('warning', 'Koordinat Pusat Tidak Valid', 'Masukkan Latitude dan Longitude desimal yang valid.');
      return;
    }

    if (customSatelliteTileUrl.trim() && !customSatelliteTileUrl.trim().startsWith('https://')) {
      addToast('warning', 'URL Tile Satelit Tidak Valid', 'Template URL tile satelit kustom wajib menggunakan protokol https://');
      return;
    }

    setSaving(true);
    const res = await api.updateAdminGisConfig({
      regionCode: regionCode.trim() || null,
      centerLat: parsedLat,
      centerLng: parsedLng,
      defaultZoom: Math.min(19, Math.max(1, Number(defaultZoom) || 14)),
      defaultMapMode,
      activeProviderId,
      showVillageBoundary,
      boundaryColor: boundaryColor.trim() || '#ec4899',
      customSatelliteTileUrl: customSatelliteTileUrl.trim() || null
    });
    setSaving(false);

    if (!res.success) {
      addToast('error', 'Gagal Menyimpan Konfigurasi', res.error || 'Terjadi kesalahan saat memperbarui konfigurasi.');
      return;
    }

    await refreshGisBootstrap();
    addToast('success', 'Konfigurasi GIS Disimpan', 'Pengaturan wilayah, viewport, dan provider peta desa telah diperbarui.');
  };

  const selectedProvider =
    MAP_PROVIDER_REGISTRY[activeProviderId] || MAP_PROVIDER_REGISTRY.openfreemap_liberty;

  return (
    <div className="space-y-6">
      {/* Kartu Identitas Resmi Desa */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              IDENTITAS WILAYAH ADMINISTRATIF DESA
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-600" />
              <span>{villageName}</span>
            </h3>
            <p className="text-xs text-slate-600">
              {villageProfile?.district || 'Kecamatan Pemayung'} •{' '}
              {villageProfile?.regency || 'Kabupaten Batang Hari'} •{' '}
              {villageProfile?.province || 'Provinsi Jambi'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-xs font-bold">
              Kode Kemendagri: {regionCode || '15.04.05.2009'}
            </span>
            <a
              href={REFERENCE_MAPS_PIN_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
              <span>Referensi Google Maps</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">Status Mesin GIS</span>
            <strong className="text-slate-900 font-extrabold inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {gisTablesReady ? 'Universal Modular GIS Aktif' : 'Fallback Profil Desa'} ({dataSource})
              </span>
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">Status Batas Wilayah Aktif</span>
            <strong className="text-slate-900 font-extrabold block">
              {activeBoundary
                ? `${activeBoundary.status.replace(/_/g, ' ')} (${activeBoundary.sourceType})`
                : 'Belum Ada Poligon Batas Resmi'}
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 block">Catatan Referensi Lokasi</span>
            <span className="text-[11px] text-slate-600 leading-relaxed block">
              Pin Google Maps hanya dipakai sebagai acuan lokasi umum dan bukan batas administratif resmi.
            </span>
          </div>
        </div>
      </div>

      {/* Form Konfigurasi Viewport, Provider & Layer Batas */}
      <form
        onSubmit={handleSaveConfig}
        className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>Konfigurasi Viewport & Provider Peta Tenant</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Berlaku pada peta publik maupun panel admin untuk tenant {gisBootstrap?.tenantId || 'desa aktif'}.
            </p>
          </div>
          {loading && <span className="text-xs text-slate-400">Memuat konfigurasi...</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          {/* Kolom Kiri: Kode Wilayah & Viewport */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Kode Wilayah Kemendagri</label>
              <input
                type="text"
                value={regionCode}
                onChange={(e) => setRegionCode(e.target.value)}
                placeholder="15.04.05.2009"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Center Latitude</label>
                <input
                  type="text"
                  value={centerLat}
                  onChange={(e) => setCenterLat(e.target.value)}
                  placeholder="-1.5562"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Center Longitude</label>
                <input
                  type="text"
                  value={centerLng}
                  onChange={(e) => setCenterLng(e.target.value)}
                  placeholder="103.4475"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Default Zoom (1–19)</label>
                <input
                  type="number"
                  min={1}
                  max={19}
                  value={defaultZoom}
                  onChange={(e) => setDefaultZoom(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseOfficeCoords}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Gunakan Koordinat Kantor Desa</span>
              </button>
              <button
                type="button"
                onClick={handleUseBoundaryCentroid}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-pink-600" />
                <span>Gunakan Centroid Batas Aktif</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-pink-600" />
                  <span>Tampilan Overlay Batas Desa</span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showVillageBoundary}
                    onChange={(e) => setShowVillageBoundary(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 w-4 h-4"
                  />
                  <span>Tampilkan di Peta</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={boundaryColor}
                  onChange={(e) => setBoundaryColor(e.target.value)}
                  className="w-10 h-9 rounded-lg border border-slate-200 cursor-pointer bg-white p-0.5"
                />
                <input
                  type="text"
                  value={boundaryColor}
                  onChange={(e) => setBoundaryColor(e.target.value)}
                  placeholder="#ec4899"
                  className="w-32 p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs"
                />
                <span className="text-[11px] text-slate-500">
                  Warna garis & arsiran batas wilayah desa
                </span>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Mode Peta, Provider & Satelit Kustom */}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">Mode Basemap Default</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MAP_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => setDefaultMapMode(opt.mode)}
                    className={`py-2 px-3 rounded-xl font-bold border text-xs transition-all ${
                      defaultMapMode === opt.mode
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>Provider Peta Jalan Utama (Vector Engine)</span>
              </label>
              <select
                value={activeProviderId}
                onChange={(e) => setActiveProviderId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              >
                {ROADMAP_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.id})
                  </option>
                ))}
              </select>

              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <strong className="text-emerald-950">{selectedProvider.licenseName}</strong>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {selectedProvider.requiresApiKey ? 'Butuh API Key' : 'Tanpa API Key'}
                  </span>
                </div>
                <p className="text-emerald-900">{selectedProvider.usagePolicyNote}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">
                URL Tile Satelit Kustom Berlisensi (Opsional)
              </label>
              <input
                type="text"
                value={customSatelliteTileUrl}
                onChange={(e) => setCustomSatelliteTileUrl(e.target.value)}
                placeholder="https://tiles.example.com/sat/{z}/{x}/{y}.jpg"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Kosongkan untuk memakai citra satelit publik NASA GIBS (legal tanpa API key). Gunakan placeholder <code>{'{z}/{x}/{y}'}</code> bila memakai tile berlisensi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs inline-flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan Konfigurasi...' : 'Simpan Konfigurasi GIS Desa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
