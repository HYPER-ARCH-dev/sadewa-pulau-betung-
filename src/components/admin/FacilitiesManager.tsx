import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MapFacility } from '../../types';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  Building2,
  Phone,
  Compass,
  X
} from 'lucide-react';

const CATEGORY_OPTIONS: { value: MapFacility['category']; label: string; badgeColor: string }[] = [
  { value: 'kantor_desa', label: 'Kantor & Balai Desa', badgeColor: 'bg-emerald-100 text-emerald-800' },
  { value: 'kesehatan', label: 'Layanan Kesehatan / Poskesdes', badgeColor: 'bg-rose-100 text-rose-800' },
  { value: 'pendidikan', label: 'Pendidikan & Sekolah', badgeColor: 'bg-amber-100 text-amber-800' },
  { value: 'ibadah', label: 'Tempat Ibadah (Masjid/Musholla)', badgeColor: 'bg-teal-100 text-teal-800' },
  { value: 'infrastruktur', label: 'Infrastruktur & Dermaga Air', badgeColor: 'bg-blue-100 text-blue-800' },
  { value: 'ekonomi', label: 'Ekonomi / Pasar Desa', badgeColor: 'bg-purple-100 text-purple-800' },
  { value: 'wisata', label: 'Wisata & Alam Desa', badgeColor: 'bg-indigo-100 text-indigo-800' },
  { value: 'olahraga', label: 'Fasilitas Olahraga / Lapangan', badgeColor: 'bg-orange-100 text-orange-800' },
  { value: 'lainnya', label: 'Tempat Lainnya', badgeColor: 'bg-slate-100 text-slate-800' }
];

const DEFAULT_FACILITY_IMAGES = [
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519817650390-64a93db51149?w=800&auto=format&fit=crop&q=80'
];

export const FacilitiesManager: React.FC = () => {
  const { facilities, addFacility, updateFacility, deleteFacility } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<MapFacility | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MapFacility['category']>('infrastruktur');
  const [address, setAddress] = useState('');
  const [dusun, setDusun] = useState('Dusun Betung Indah');
  const [lat, setLat] = useState('-1.5284');
  const [lng, setLng] = useState('103.3142');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(DEFAULT_FACILITY_IMAGES[0]);
  const [contact, setContact] = useState('');

  const openAddModal = () => {
    setEditingFacility(null);
    setName('');
    setCategory('kantor_desa');
    setAddress('');
    setDusun('Dusun Betung Indah');
    setLat('-1.5284');
    setLng('103.3142');
    setDescription('');
    setImageUrl(DEFAULT_FACILITY_IMAGES[Math.floor(Math.random() * DEFAULT_FACILITY_IMAGES.length)]);
    setContact('');
    setModalOpen(true);
  };

  const openEditModal = (item: MapFacility) => {
    setEditingFacility(item);
    setName(item.name);
    setCategory(item.category);
    setAddress(item.address);
    setDusun(item.dusun);
    setLat(item.coordinates ? item.coordinates[0].toString() : '-1.5284');
    setLng(item.coordinates ? item.coordinates[1].toString() : '103.3142');
    setDescription(item.description);
    setImageUrl(item.imageUrl || DEFAULT_FACILITY_IMAGES[0]);
    setContact(item.contact || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    const parsedLat = parseFloat(lat) || -1.5284;
    const parsedLng = parseFloat(lng) || 103.3142;
    const coordinatesLabel = `${parsedLat.toFixed(4)}°, ${parsedLng.toFixed(4)}°`;

    if (editingFacility) {
      updateFacility(editingFacility.id, {
        name: name.trim(),
        category,
        address: address.trim(),
        dusun: dusun.trim(),
        coordinatesLabel,
        coordinates: [parsedLat, parsedLng],
        description: description.trim() || `Fasilitas umum ${name.trim()} Desa Pulau Betung.`,
        imageUrl: imageUrl.trim() || DEFAULT_FACILITY_IMAGES[0],
        contact: contact.trim() || undefined
      });
    } else {
      addFacility({
        name: name.trim(),
        category,
        address: address.trim(),
        dusun: dusun.trim(),
        coordinatesLabel,
        coordinates: [parsedLat, parsedLng],
        description: description.trim() || `Fasilitas umum ${name.trim()} Desa Pulau Betung.`,
        imageUrl: imageUrl.trim() || DEFAULT_FACILITY_IMAGES[0],
        contact: contact.trim() || undefined
      });
    }

    setModalOpen(false);
  };

  const handleDelete = (id: string, facilityName: string) => {
    if (window.confirm(`Hapus fasilitas/tempat "${facilityName}" dari peta dan pangkalan data desa?`)) {
      deleteFacility(id);
    }
  };

  const filteredFacilities = facilities.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.dusun.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = filterCategory === 'all' || f.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Kelola Fasilitas, Tempat & Titik Peta Desa
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              {facilities.length} Lokasi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin dapat mengubah nama gedung/tempat, menambah titik lokasi baru, memperbarui koordinat GPS, atau menghapus fasilitas desa dari peta digital.
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

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama gedung, fasilitas, jalan, atau nama dusun..."
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
      </div>

      {/* Facilities Cards Grid */}
      {filteredFacilities.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600">Tidak ada tempat atau fasilitas yang cocok dengan pencarian.</p>
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

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-sm overflow-hidden flex flex-col justify-between"
              >
                {item.imageUrl && item.imageUrl.trim() !== '' && (
                  <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                    <img
                      src={item.imageUrl.trim() ? item.imageUrl : DEFAULT_FACILITY_IMAGES[0]}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_FACILITY_IMAGES[0];
                      }}
                    />
                    <span className={`absolute top-2.5 left-2.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm ${catInfo.badgeColor}`}>
                      {catInfo.label}
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-2 flex-1">
                  <h3 className="font-bold text-xs text-slate-900 leading-snug line-clamp-1" title={item.name}>
                    {item.name}
                  </h3>
                  <div className="flex items-center text-[11px] text-slate-500 space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{item.address} ({item.dusun})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                    <Compass className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>GPS: {item.coordinatesLabel || (item.coordinates ? `${item.coordinates[0]}, ${item.coordinates[1]}` : '-')}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                    {item.description || 'Fasilitas umum desa.'}
                  </p>
                </div>

                <div className="p-3 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
                  <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 flex items-center space-x-1 transition-colors"
                      title="Edit Data Fasilitas"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center space-x-1 transition-colors"
                      title="Hapus Tempat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
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

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
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
                    placeholder="Contoh: Balai Pertemuan Desa / Dermaga Nelayan RT 03"
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
                    onChange={(e) => setCategory(e.target.value as any)}
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
                    Wilayah Dusun:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Dusun Betung Indah / Dusun Teluk Melintang"
                    value={dusun}
                    onChange={(e) => setDusun(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap / Patokan Jalan: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Jl. Lintas Pemayung No. 12, Dekat Jembatan Utama"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Latitude (Garis Lintang):
                  </label>
                  <input
                    type="text"
                    placeholder="-1.5284"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Longitude (Garis Bujur):
                  </label>
                  <input
                    type="text"
                    placeholder="103.3142"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kontak Pengelola / Jam Buka (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Buka Setiap Hari (08:00 - 16:00 WIB) / HP: 0812-xxxx"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Foto Gedung / Fasilitas:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <img
                      src={imageUrl?.trim() ? imageUrl : DEFAULT_FACILITY_IMAGES[0]}
                      alt="Preview"
                      className="w-9 h-9 rounded-xl object-cover border border-slate-300 shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_FACILITY_IMAGES[0];
                      }}
                    />
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
