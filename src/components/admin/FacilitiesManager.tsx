import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FacilityCoordinateSource,
  FacilityVerificationStatus,
  MapFacility
} from '../../types';
import {
  isValidCoordinatePair,
  normalizeCoordinatePair,
  resolveMapViewport
} from '../../utils/gisAdapter';
import { decodePlusCodeToLatLng } from '../../utils/plusCode';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  Compass,
  X,
  Building2,
  AlertTriangle,
  Sparkles,
  Clock,
  Power,
  Eye,
  EyeOff
} from 'lucide-react';

const CATEGORY_OPTIONS: { value: MapFacility['category']; label: string; badgeColor: string }[] = [
  { value: 'kantor_desa', label: 'Kantor & Balai Desa', badgeColor: 'bg-emerald-100 text-emerald-800' },
  { value: 'kesehatan', label: 'Layanan Kesehatan / Poskesdes', badgeColor: 'bg-rose-100 text-rose-800' },
  { value: 'pendidikan', label: 'Pendidikan & Sekolah', badgeColor: 'bg-amber-100 text-amber-800' },
  { value: 'ibadah', label: 'Tempat Ibadah (Masjid/Musholla)', badgeColor: 'bg-teal-100 text-teal-800' },
  { value: 'infrastruktur', label: 'Infrastruktur & Utilitas', badgeColor: 'bg-blue-100 text-blue-800' },
  { value: 'ekonomi', label: 'Ekonomi / Koperasi & Pasar', badgeColor: 'bg-purple-100 text-purple-800' },
  { value: 'wisata', label: 'Wisata & Taman Desa', badgeColor: 'bg-indigo-100 text-indigo-800' },
  { value: 'olahraga', label: 'Fasilitas Olahraga / Lapangan', badgeColor: 'bg-orange-100 text-orange-800' },
  { value: 'lainnya', label: 'Tempat & Situs Lainnya', badgeColor: 'bg-slate-100 text-slate-800' }
];

const VERIFICATION_OPTIONS: {
  value: FacilityVerificationStatus;
  label: string;
  badgeClass: string;
}[] = [
  {
    value: 'PERLU_VERIFIKASI',
    label: 'Perlu Verifikasi',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    value: 'TERVERIFIKASI',
    label: 'Terverifikasi',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    value: 'BELUM_TERVERIFIKASI',
    label: 'Belum Terverifikasi',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
  }
];

const SOURCE_OPTIONS: { value: FacilityCoordinateSource; label: string }[] = [
  { value: 'KOORDINAT_EKSPLISIT', label: 'Koordinat Eksplisit (Lat/Lng)' },
  { value: 'PLUS_CODE_OLC', label: 'Konversi Plus Code (OLC)' },
  { value: 'SURVEY_LAPANGAN', label: 'Survei Lapangan GPS' },
  { value: 'REFERENSI_LAMA', label: 'Referensi Lama (Perlu Cek Ulang)' },
  { value: 'BELUM_TERKONFIRMASI', label: 'Belum Terkonfirmasi' }
];

const DEFAULT_BOUNDARY_NOTE =
  'Keanggotaan wilayah administratif belum dapat dipastikan karena polygon batas resmi desa belum terverifikasi.';

function getVerificationBadge(status?: FacilityVerificationStatus) {
  return (
    VERIFICATION_OPTIONS.find((opt) => opt.value === status) || VERIFICATION_OPTIONS[0]
  );
}

export const FacilitiesManager: React.FC = () => {
  const {
    facilities,
    territories,
    villageProfile,
    gisBootstrap,
    addFacility,
    updateFacility,
    deleteFacility,
    addToast
  } = useApp();

  const defaultViewport = useMemo(
    () =>
      resolveMapViewport({
        gisBootstrap,
        villageProfile,
        facilities
      }),
    [gisBootstrap, villageProfile, facilities]
  );

  const defaultDusunName = territories?.[0]?.name || 'Wilayah Desa';
  const defaultVillageLabel = villageProfile?.villageName || 'Desa';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<MapFacility | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MapFacility['category']>('infrastruktur');
  const [address, setAddress] = useState('');
  const [dusun, setDusun] = useState(defaultDusunName);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [plusCode, setPlusCode] = useState('');
  const [verificationStatus, setVerificationStatus] =
    useState<FacilityVerificationStatus>('PERLU_VERIFIKASI');
  const [coordinateSource, setCoordinateSource] =
    useState<FacilityCoordinateSource>('KOORDINAT_EKSPLISIT');
  const [locationNotes, setLocationNotes] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [contact, setContact] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const hasVerifiedBoundary = Boolean(gisBootstrap?.hasVerifiedBoundary);

  const unconfirmedCoordsCount = useMemo(
    () => facilities.filter((f) => !normalizeCoordinatePair(f.coordinates)).length,
    [facilities]
  );

  const inactiveCount = useMemo(
    () => facilities.filter((f) => f.isActive === false).length,
    [facilities]
  );

  const openAddModal = () => {
    setEditingFacility(null);
    setName('');
    setCategory('kantor_desa');
    setAddress('');
    setDusun(defaultDusunName);
    setLat('');
    setLng('');
    setPlusCode('');
    setVerificationStatus('PERLU_VERIFIKASI');
    setCoordinateSource('BELUM_TERKONFIRMASI');
    setLocationNotes('');
    setDescription('');
    setImageUrl('');
    setContact('');
    setIsActive(false);
    setPreviewBroken(false);
    setModalOpen(true);
  };

  const openEditModal = (item: MapFacility) => {
    const validPair = normalizeCoordinatePair(item.coordinates);
    setEditingFacility(item);
    setName(item.name);
    setCategory(item.category);
    setAddress(item.address);
    setDusun(item.dusun);
    setLat(validPair ? validPair[0].toString() : '');
    setLng(validPair ? validPair[1].toString() : '');
    setPlusCode(item.plusCode || '');
    setVerificationStatus(item.verificationStatus || 'PERLU_VERIFIKASI');
    setCoordinateSource(
      item.coordinateSource ||
        (validPair ? 'KOORDINAT_EKSPLISIT' : 'BELUM_TERKONFIRMASI')
    );
    setLocationNotes(item.locationNotes || '');
    setDescription(item.description || '');
    setImageUrl(item.imageUrl || '');
    setContact(item.contact || '');
    setIsActive(typeof item.isActive === 'boolean' ? item.isActive : Boolean(validPair));
    setPreviewBroken(false);
    setModalOpen(true);
  };

  const handleConvertPlusCode = () => {
    if (!plusCode.trim()) {
      addToast(
        'warning',
        'Plus Code Kosong',
        'Masukkan kode Plus Code terlebih dahulu, misalnya CCQJ+P7R atau 6PC5CCQJ+P7R.'
      );
      return;
    }

    try {
      const refLat = defaultViewport.isConfigured ? defaultViewport.center[0] : null;
      const refLng = defaultViewport.isConfigured ? defaultViewport.center[1] : null;
      const decoded = decodePlusCodeToLatLng(plusCode, refLat, refLng);
      setLat(decoded.latitude.toString());
      setLng(decoded.longitude.toString());
      setPlusCode(decoded.fullCode);
      setIsActive(true);
      if (coordinateSource !== 'REFERENSI_LAMA') {
        setCoordinateSource('PLUS_CODE_OLC');
      }
      addToast(
        'success',
        'Plus Code Dikonversi',
        `Koordinat ${decoded.fullCode} -> ${decoded.latitude}, ${decoded.longitude}`
      );
    } catch (error: any) {
      addToast(
        'warning',
        'Konversi Plus Code Gagal',
        error?.message || 'Format Plus Code tidak dikenali.'
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    const cleanLatStr = lat.trim();
    const cleanLngStr = lng.trim();

    let resolvedCoordinates: [number, number] | null = null;
    if (cleanLatStr !== '' || cleanLngStr !== '') {
      if (cleanLatStr === '' || cleanLngStr === '') {
        addToast(
          'warning',
          'Koordinat Belum Lengkap',
          'Isi kedua nilai Latitude dan Longitude, atau kosongkan keduanya jika koordinat belum terkonfirmasi.'
        );
        return;
      }

      const parsedLat = Number.parseFloat(cleanLatStr);
      const parsedLng = Number.parseFloat(cleanLngStr);
      if (!isValidCoordinatePair(parsedLat, parsedLng)) {
        addToast(
          'warning',
          'Koordinat Belum Valid',
          'Masukkan nilai Latitude (-90..90) dan Longitude (-180..180) yang valid.'
        );
        return;
      }
      resolvedCoordinates = [parsedLat, parsedLng];
    }

    const cleanPlusCode = plusCode.trim().toUpperCase() || undefined;
    const resolvedSource: FacilityCoordinateSource = resolvedCoordinates
      ? coordinateSource === 'BELUM_TERKONFIRMASI'
        ? cleanPlusCode
          ? 'PLUS_CODE_OLC'
          : 'KOORDINAT_EKSPLISIT'
        : coordinateSource
      : 'BELUM_TERKONFIRMASI';

    const coordinatesLabel = resolvedCoordinates
      ? `${resolvedCoordinates[0].toFixed(4)}°, ${resolvedCoordinates[1].toFixed(4)}°${
          cleanPlusCode ? ` (Plus Code ${cleanPlusCode})` : ''
        }`
      : 'Koordinat belum terkonfirmasi';

    const cleanDusun = dusun.trim() || defaultDusunName;
    const defaultDesc = `Fasilitas umum ${name.trim()} ${defaultVillageLabel}.`;
    const cleanImageUrl = imageUrl.trim();
    const tenantVillageId =
      editingFacility?.villageId || gisBootstrap?.tenantId || 'tenant_pulau_betung';
    const boundaryNote =
      editingFacility?.boundaryMembershipNote ||
      (!hasVerifiedBoundary ? DEFAULT_BOUNDARY_NOTE : undefined);

    const payload: Omit<MapFacility, 'id'> = {
      villageId: tenantVillageId,
      name: name.trim(),
      category,
      address: address.trim(),
      dusun: cleanDusun,
      coordinatesLabel,
      coordinates: resolvedCoordinates,
      description: description.trim() || defaultDesc,
      imageUrl: cleanImageUrl,
      contact: contact.trim() || undefined,
      plusCode: cleanPlusCode,
      verificationStatus,
      coordinateSource: resolvedSource,
      locationNotes: locationNotes.trim() || undefined,
      boundaryMembershipNote: boundaryNote,
      isActive: resolvedCoordinates ? isActive : isActive && Boolean(editingFacility) ? isActive : false
    };

    if (editingFacility) {
      updateFacility(editingFacility.id, payload);
      addToast('success', 'Fasilitas Diperbarui', `Data "${payload.name}" telah diperbarui.`);
    } else {
      addFacility(payload);
      addToast(
        'success',
        'Fasilitas Ditambahkan',
        payload.isActive
          ? `"${payload.name}" ditambahkan dan aktif di peta.`
          : `"${payload.name}" ditambahkan dengan status Nonaktif (tanpa GPS).`
      );
    }

    setModalOpen(false);
  };

  const handleToggleActive = (item: MapFacility) => {
    const nextActive = item.isActive === false;
    updateFacility(item.id, { isActive: nextActive });
    addToast(
      'info',
      nextActive ? 'Fasilitas Diaktifkan' : 'Fasilitas Dinonaktifkan',
      nextActive
        ? `"${item.name}" kini aktif dan tampil di peta publik.`
        : `"${item.name}" dimatikan dari peta publik.`
    );
  };

  const handleConfirmDelete = (id: string, facilityName: string) => {
    deleteFacility(id);
    setConfirmDeleteId(null);
    addToast('success', 'Fasilitas Dihapus', `"${facilityName}" telah dihapus permanen.`);
  };

  const filteredFacilities = facilities.filter((f) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q) ||
      f.dusun.toLowerCase().includes(q) ||
      (f.plusCode || '').toLowerCase().includes(q);
    const matchesCat = filterCategory === 'all' || f.category === filterCategory;
    const hasValidCoords = Boolean(normalizeCoordinatePair(f.coordinates));
    const status = f.verificationStatus || 'PERLU_VERIFIKASI';
    const itemIsActive = f.isActive !== false;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'ACTIVE'
        ? itemIsActive
        : filterStatus === 'INACTIVE'
        ? !itemIsActive
        : filterStatus === 'NO_COORDS'
        ? !hasValidCoords
        : status === filterStatus);
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Kelola Fasilitas, Tempat & Titik Peta Desa
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              {facilities.length} Lokasi
            </span>
            {inactiveCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                {inactiveCount} Nonaktif
              </span>
            )}
            {unconfirmedCoordsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                {unconfirmedCoordsCount} Koordinat Belum Terkonfirmasi
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat CRUD inventaris fasilitas publik desa: kelola titik GPS, konversi Plus Code, status verifikasi, dan foto dokumentasi asli.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-blue-700 text-white font-bold text-xs hover:bg-blue-800 flex items-center justify-center space-x-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Tempat / Fasilitas Baru</span>
        </button>
      </div>

      {/* Warning Banner when Village Boundary is unverified */}
      {!hasVerifiedBoundary && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Batas Administratif Desa Belum Terverifikasi ({gisBootstrap?.villageName || defaultVillageLabel})
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Polygon batas resmi desa belum terverifikasi pada modul WebGIS. Keanggotaan wilayah administratif fasilitas di sekitar perbatasan bersifat indikatif hingga batas desa diverifikasi dan titik lapangan dikonfirmasi.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama gedung, alamat, dusun, atau Plus Code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/60"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
        >
          <option value="all">Semua Kategori ({facilities.length})</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({facilities.filter((f) => f.category === c.value).length})
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
        >
          <option value="all">Semua Status ({facilities.length})</option>
          <option value="ACTIVE">Fasilitas Aktif ({facilities.length - inactiveCount})</option>
          <option value="INACTIVE">Nonaktif / Mati ({inactiveCount})</option>
          <option value="PERLU_VERIFIKASI">Perlu Verifikasi</option>
          <option value="TERVERIFIKASI">Terverifikasi</option>
          <option value="BELUM_TERVERIFIKASI">Belum Terverifikasi</option>
          <option value="NO_COORDS">Koordinat Belum Terkonfirmasi ({unconfirmedCoordsCount})</option>
        </select>
      </div>

      {/* Facilities Cards Grid */}
      {filteredFacilities.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600">
            Tidak ada tempat atau fasilitas yang cocok dengan filter pencarian.
          </p>
          <button
            onClick={openAddModal}
            className="mt-3 text-xs font-bold text-blue-700 hover:underline inline-flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Tempat Baru Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacilities.map((item) => {
            const catInfo = CATEGORY_OPTIONS.find((c) => c.value === item.category) || {
              label: item.category,
              badgeColor: 'bg-slate-100 text-slate-700'
            };
            const verBadge = getVerificationBadge(item.verificationStatus);
            const validPair = normalizeCoordinatePair(item.coordinates);
            const hasImage = Boolean(item.imageUrl && item.imageUrl.trim() !== '');
            const itemIsActive = item.isActive !== false;
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all shadow-sm overflow-hidden flex flex-col justify-between ${
                  itemIsActive
                    ? 'border-slate-200 bg-white hover:border-blue-300'
                    : 'border-slate-200 bg-slate-50/75 opacity-85'
                }`}
              >
                {hasImage ? (
                  <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.imageUrl!.trim()}
                      alt={item.name}
                      className={`w-full h-full object-cover ${itemIsActive ? '' : 'grayscale'}`}
                    />
                    <span className={`absolute top-2.5 left-2.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm ${catInfo.badgeColor}`}>
                      {catInfo.label}
                    </span>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm ${
                          itemIsActive
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-800 text-white border-slate-900'
                        }`}
                      >
                        {itemIsActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm ${verBadge.badgeClass}`}>
                        {verBadge.label}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pt-3.5 pb-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${catInfo.badgeColor}`}>
                      {catInfo.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                          itemIsActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-200 text-slate-700 border-slate-300'
                        }`}
                      >
                        {itemIsActive ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                        {itemIsActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${verBadge.badgeClass}`}>
                        {verBadge.label}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-2 flex-1">
                  {!hasImage && (
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Belum ada foto asli fasilitas</span>
                    </div>
                  )}

                  <h3 className="font-bold text-xs text-slate-900 leading-snug" title={item.name}>
                    {item.name}
                  </h3>

                  <div className="flex items-start text-[11px] text-slate-500 space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {item.address} ({item.dusun})
                    </span>
                  </div>

                  <div className="text-[10px] font-mono flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded ${
                        validPair
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 font-sans font-semibold'
                      }`}
                    >
                      {validPair ? (
                        <Compass className="w-3 h-3 text-slate-400 shrink-0" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                      <span>
                        {validPair
                          ? `${validPair[0].toFixed(6)}, ${validPair[1].toFixed(6)}`
                          : 'Koordinat belum terkonfirmasi'}
                      </span>
                    </span>
                    {item.plusCode && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
                        {item.plusCode}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                    {item.description || 'Fasilitas umum desa.'}
                  </p>

                  {item.locationNotes && (
                    <p className="text-[10px] text-amber-800 bg-amber-50/70 border border-amber-100 px-2.5 py-1.5 rounded-lg leading-relaxed">
                      {item.locationNotes}
                    </p>
                  )}
                </div>

                <div className="p-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-rose-700">Hapus?</span>
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(item.id, item.name)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                      >
                        Ya, Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center space-x-1 border transition-colors ${
                          itemIsActive
                            ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title={itemIsActive ? 'Matikan dari Peta Publik' : 'Aktifkan ke Peta Publik'}
                      >
                        <Power className="w-3 h-3" />
                        <span>{itemIsActive ? 'Matikan' : 'Aktifkan'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 flex items-center space-x-1 transition-colors"
                        title="Edit Data Fasilitas"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center space-x-1 transition-colors"
                        title="Hapus Tempat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FORM (TAMBAH / EDIT TEMPAT & FASILITAS) */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                  {editingFacility ? 'Ubah Informasi Tempat' : 'Tambah Tempat / Fasilitas Baru'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {editingFacility ? `Edit: ${editingFacility.name}` : 'Formulir Lokasi & Peta Desa'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Tempat / Gedung / Fasilitas: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Balai Pertemuan Desa / Poskesdes Pulau Betung"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Tempat:
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MapFacility['category'])}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wilayah / Dusun:
                  </label>
                  <input
                    type="text"
                    placeholder={defaultDusunName}
                    value={dusun}
                    onChange={(e) => setDusun(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap / Patokan Lokasi: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Desa Pulau Betung, Kecamatan Pemayung, Kabupaten Batang Hari"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Plus Code Converter */}
                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Plus Code (Open Location Code — Opsional):
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Contoh: CCQJ+P7R atau 6PC5CCQJ+P7R"
                      value={plusCode}
                      onChange={(e) => setPlusCode(e.target.value)}
                      className="flex-1 text-xs font-mono uppercase px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleConvertPlusCode}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Konversi Plus Code</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Klik konversi untuk mengisi koordinat Latitude/Longitude secara otomatis berdasarkan acuan wilayah desa aktif.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Latitude (Garis Lintang — Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika belum terkonfirmasi"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Longitude (Garis Bujur — Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Kosongkan jika belum terkonfirmasi"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Verifikasi Lokasi:
                  </label>
                  <select
                    value={verificationStatus}
                    onChange={(e) =>
                      setVerificationStatus(e.target.value as FacilityVerificationStatus)
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {VERIFICATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sumber Koordinat:
                  </label>
                  <select
                    value={coordinateSource}
                    onChange={(e) =>
                      setCoordinateSource(e.target.value as FacilityCoordinateSource)
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Verifikasi / Lokasi (Opsional):
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Menunggu survei titik GPS lapangan atau pengecekan batas desa..."
                    value={locationNotes}
                    onChange={(e) => setLocationNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontak Pengelola / Jam Buka (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Buka Senin-Jumat (08:00 - 16:00 WIB) / HP: 0812-xxxx"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Foto Asli Gedung / Fasilitas (Opsional — Kosongkan jika belum ada):
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="https://... (biarkan kosong jika belum ada foto asli)"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setPreviewBroken(false);
                      }}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    {imageUrl.trim() && !previewBroken ? (
                      <img
                        src={imageUrl.trim()}
                        alt="Preview"
                        className="w-9 h-9 rounded-xl object-cover border border-slate-300 shrink-0"
                        onError={() => setPreviewBroken(true)}
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0"
                        title="Belum ada foto asli"
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deskripsi Tempat / Layanan:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Jelaskan fasilitas yang tersedia, sarana, dan fungsi untuk warga..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 w-4 h-4"
                    />
                    <span>Aktifkan &amp; tampilkan fasilitas ini di Peta Publik dan WebGIS</span>
                  </label>
                  {(!lat.trim() || !lng.trim()) && (
                    <p className="text-[11px] text-amber-700 pl-6">
                      Catatan: Titik koordinat GPS belum diisi, sehingga fasilitas tanpa GPS otomatis disarankan berstatus Nonaktif sampai koordinat dilengkapi.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingFacility ? 'Simpan Perubahan' : 'Tambah Fasilitas'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
