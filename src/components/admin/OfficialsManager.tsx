import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { VillageOfficial } from '../../types';
import { api } from '../../services/api';
import { uploadImageService } from '../../services/uploadService';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  Phone,
  UserCheck,
  ShieldAlert,
  X,
  ArrowUp,
  ArrowDown,
  Upload,
  Image as ImageIcon,
  Check,
  Eye,
  Power,
  RotateCcw,
  User,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  CheckSquare,
  Square
} from 'lucide-react';

const SECTION_OPTIONS: { value: VillageOfficial['section']; label: string; badgeColor: string }[] = [
  { value: 'kepala_desa', label: 'Kepala Desa', badgeColor: 'bg-amber-100 text-amber-800' },
  { value: 'sekretariat', label: 'Sekretariat Desa', badgeColor: 'bg-blue-100 text-blue-800' },
  { value: 'kasi', label: 'Kepala Seksi (Kasi)', badgeColor: 'bg-emerald-100 text-emerald-800' },
  { value: 'kaur', label: 'Kepala Urusan (Kaur)', badgeColor: 'bg-indigo-100 text-indigo-800' },
  { value: 'kadus', label: 'Kepala Dusun (Kadus)', badgeColor: 'bg-purple-100 text-purple-800' },
  { value: 'rt_rw', label: 'Rukun Tetangga (RT / RW)', badgeColor: 'bg-teal-100 text-teal-800' },
  { value: 'karang_taruna', label: 'Karang Taruna', badgeColor: 'bg-rose-100 text-rose-800' },
  { value: 'bpd', label: 'BPD (Badan Permusyawaratan)', badgeColor: 'bg-orange-100 text-orange-800' },
  { value: 'pkk', label: 'TP PKK Desa', badgeColor: 'bg-pink-100 text-pink-800' },
  { value: 'posyandu', label: 'Kader Posyandu', badgeColor: 'bg-cyan-100 text-cyan-800' },
  { value: 'lpm', label: 'Lembaga Pemberdayaan (LPM)', badgeColor: 'bg-slate-100 text-slate-800' },
  { value: 'lainnya', label: 'Lembaga / Tokoh Lainnya', badgeColor: 'bg-gray-100 text-gray-800' }
];

export const OfficialsManager: React.FC = () => {
  const { currentUser, officials, addOfficial, updateOfficial, deleteOfficial, addToast } = useApp();

  const isSuperAdmin = !currentUser || currentUser.role === 'super_admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'admin_only'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState<VillageOfficial | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [section, setSection] = useState<VillageOfficial['section']>('kadus');
  const [nip, setNip] = useState('');
  const [tenure, setTenure] = useState('Periode 2024 - 2029');
  const [bio, setBio] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<VillageOfficial['gender']>('Laki-laki');
  const [birthDate, setBirthDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAddModal = () => {
    setEditingOfficial(null);
    setName('');
    setPosition('');
    setSection('rt_rw');
    setNip('');
    setTenure('Periode 2024 - 2029');
    setBio('');
    setImageUrl('');
    setPhone('');
    setGender('Laki-laki');
    setBirthDate('');
    setIsActive(true);
  // Find highest current displayOrder and increment
  const maxOrder = officials.reduce((max, o) => Math.max(max, o.displayOrder || 0), 0);
    setDisplayOrder(maxOrder + 1);
    setModalOpen(true);
  };

  const openEditModal = (item: VillageOfficial) => {
    setEditingOfficial(item);
    setName(item.name);
    setPosition(item.position);
    setSection(item.section);
    setNip(item.nip || '');
    setTenure(item.tenure);
    setBio(item.bio || '');
    setImageUrl(item.imageUrl);
    setPhone(item.phone || '');
    setGender(item.gender || 'Laki-laki');
    setBirthDate(item.birthDate || '');
    setIsActive(item.isActive !== false);
    setDisplayOrder(item.displayOrder ?? 999);
    setModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      addToast('error', 'Berkas Terlalu Besar', 'Maksimal ukuran foto adalah 15MB.');
      return;
    }

    setIsUploading(true);
    try {
      const result = await uploadImageService(file, { maxWidth: 1000, maxHeight: 1000, quality: 0.8 });
      if (result.success && result.url) {
        setImageUrl(result.url);
        const statsInfo = result.stats
          ? ` (${result.stats.formattedOriginal} ➔ ${result.stats.formattedCompressed}, Hemat ${result.stats.savedPercentage}%)`
          : '';
        if (result.isLocalFallback) {
          addToast('success', 'Foto Siap Digunakan', `Foto profil aparatur desa berhasil dioptimalkan${statsInfo}.`);
        } else {
          addToast('success', 'Foto Berhasil Diunggah', `Foto profil aparatur desa berhasil diunggah ke server${statsInfo}.`);
        }
      } else {
        addToast('error', 'Gagal Memuat Foto', result.error || 'Terjadi kesalahan saat memproses foto.');
      }
    } catch (err: unknown) {
      addToast('error', 'Unggah Gagal', err instanceof Error ? err.message : String(err) || 'Gagal mengunggah foto.');
    } finally {
      setIsUploading(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !position.trim() || !birthDate) {
      addToast('error', 'Data Belum Lengkap', 'Nama, Jabatan, dan Tanggal Lahir wajib diisi sebagai identitas absensi.');
      return;
    }

    const payload = {
      name: name.trim(),
      position: position.trim(),
      section,
      nip: nip.trim() || undefined,
      tenure: tenure.trim() || 'Aktif',
      bio: bio.trim() || `Bertanggung jawab sebagai ${position.trim()} Desa Pulau Betung.`,
      imageUrl: imageUrl.trim(),
      phone: phone.trim() || undefined,
      gender,
      birthDate,
      isActive,
      displayOrder: Number(displayOrder) || 999,
      hasAdminAccess: !!editingOfficial?.hasAdminAccess,
    };

    if (editingOfficial) {
      updateOfficial(editingOfficial.id, payload);
      addToast('success', 'Data Diperbarui', `Profil aparatur ${name.trim()} berhasil diperbarui.`);
    } else {
      addOfficial(payload);
      addToast('success', 'Aparatur Ditambahkan', `Perangkat desa baru ${name.trim()} berhasil ditambahkan.`);
    }

    setModalOpen(false);
  };

  const toggleStatus = (id: string, currentStatus: boolean | undefined) => {
    const nextStatus = currentStatus === false ? true : false;
    updateOfficial(id, { isActive: nextStatus });
  };

  const handleMoveOrder = (item: VillageOfficial, direction: 'up' | 'down') => {
    const currentIdx = sortedOfficials.findIndex((o) => o.id === item.id);
    if (currentIdx === -1) return;

    const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= sortedOfficials.length) return;

    const targetItem = sortedOfficials[targetIdx];
    const currentOrder = item.displayOrder ?? (currentIdx + 1);
    const targetOrder = targetItem.displayOrder ?? (targetIdx + 1);

    // Swap their display order values
    updateOfficial(item.id, { displayOrder: targetOrder });
    updateOfficial(targetItem.id, { displayOrder: currentOrder });
  };

  const handleDelete = (id: string, officialName: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus data perangkat "${officialName}" dari pangkalan data?`)) {
      deleteOfficial(id);
    }
  };

  // Sort officials by displayOrder ascending, fallback to name
  const sortedOfficials = [...officials].sort((a, b) => {
    const orderA = a.displayOrder ?? 999;
    const orderB = b.displayOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  const filteredOfficials = sortedOfficials.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.nip && o.nip.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSection = filterSection === 'all' || o.section === filterSection;
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'active'
        ? o.isActive !== false
        : o.isActive === false;
    return matchesSearch && matchesSection && matchesStatus;
  });

  const activeCount = officials.filter((o) => o.isActive !== false).length;
  const inactiveCount = officials.length - activeCount;
  const adminCount = officials.filter((o) => o.hasAdminAccess).length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Kelola Pemerintahan Desa, Aparatur & Hak Akses Admin
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              {officials.length} Total
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              {activeCount} Aktif
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
              <span>{adminCount} Admin Akses</span>
            </span>
            {inactiveCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                {inactiveCount} Nonaktif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola struktur kepengurusan desa, ganti foto staf, atur hak akses login admin/operator per modul (RBAC), dan sesuaikan urutan tampil secara langsung.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 flex items-center justify-center space-x-2 shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pejabat / Staf Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-6">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama aparatur, jabatan, NIP, username admin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50/60"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterSection}
            onChange={(e) => setFilterSection(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          >
            <option value="all">Semua Struktur ({officials.length})</option>
            {SECTION_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label} ({officials.filter((o) => o.section === s.value).length})
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
          >
            <option value="all">Semua Status ({officials.length})</option>
            <option value="active">Hanya Aktif ({activeCount})</option>
            <option value="admin_only">Hanya Punya Akses Admin ({adminCount})</option>
            <option value="inactive">Hanya Nonaktif ({inactiveCount})</option>
          </select>
        </div>
      </div>

      {/* Grid of Officials Cards */}
      {filteredOfficials.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold text-slate-600">Tidak ada data perangkat desa yang sesuai kriteria.</p>
          <button
            onClick={openAddModal}
            className="mt-3 text-xs font-bold text-emerald-700 hover:underline inline-flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pejabat Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfficials.map((item, index) => {
            const secInfo = SECTION_OPTIONS.find((s) => s.value === item.section) || {
              label: item.section,
              badgeColor: 'bg-slate-100 text-slate-700'
            };
            const itemIsActive = item.isActive !== false;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col justify-between space-y-3 relative ${
                  itemIsActive
                    ? 'bg-white border-slate-200 hover:border-emerald-300'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                {/* Header card with order tag & active toggle */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Urutan #{item.displayOrder ?? index + 1}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Order buttons */}
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(item, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Geser ke Atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrder(item, 'down')}
                      disabled={index === filteredOfficials.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Geser ke Bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Active/Inactive Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleStatus(item.id, item.isActive)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                        itemIsActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title="Klik untuk mengubah status aktif"
                    >
                      <Power className="w-2.5 h-2.5" />
                      <span>{itemIsActive ? 'Aktif' : 'Nonaktif'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="relative w-16 h-16 shrink-0">
                    {item.imageUrl && item.imageUrl.trim() !== '' ? (
                      <img
                        src={item.imageUrl.trim()}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shadow-sm">
                        <User className="w-7 h-7 text-slate-400" />
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Tanpa Foto</span>
                      </div>
                    )}
                    {!itemIsActive && (
                      <div className="absolute inset-0 bg-slate-900/40 rounded-xl flex items-center justify-center text-[9px] font-bold text-white uppercase">
                        Nonaktif
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded mb-1 ${secInfo.badgeColor}`}>
                      {secInfo.label}
                    </span>
                    <h3 className="font-bold text-xs text-slate-900 truncate" title={item.name}>
                      {item.name}
                    </h3>
                    <p className="text-xs font-semibold text-emerald-800 line-clamp-1">{item.position}</p>
                    <p className="text-[11px] text-slate-500">{item.tenure}</p>
                    {item.nip && (
                      <p className="text-[10px] text-slate-400 font-mono truncate">NIP/SK: {item.nip}</p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                  {item.bio || 'Bertanggung jawab atas koordinasi pemerintahan desa.'}
                </p>

                {/* Info Hak Akses Admin */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    {item.hasAdminAccess ? (
                      <div className="flex items-center space-x-1.5 text-emerald-800 font-bold text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Terdaftar sebagai Admin/Operator</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5 text-slate-500 font-medium text-[11px]">
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Akses Publik (Non-Admin)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">ID: {item.id.replace('off-', '')}</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => openEditModal(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Edit Data Pejabat"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Sunting</span>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center space-x-1 transition-colors cursor-pointer"
                      title="Hapus Pejabat"
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

      {/* MODAL FORM (TAMBAH / EDIT PEJABAT) DENGAN LIVE PREVIEW */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {editingOfficial ? 'Ubah Data Pejabat' : 'Tambah Pejabat Baru'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {editingOfficial ? `Edit: ${editingOfficial.name}` : 'Formulir Pejabat & Staf Pemerintahan Desa'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LIVE PREVIEW CARD */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="w-3 h-3 text-emerald-600" />
                  <span>Pratinjau Kartu (Live Preview)</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isActive ? 'Aktif Tayang' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                {imageUrl && imageUrl.trim() !== '' ? (
                  <img
                    src={imageUrl.trim()}
                    alt="Preview"
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                    <User className="w-6 h-6 text-slate-400" />
                    <span className="text-[8px] font-bold text-slate-400">Kosong (0)</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {name || 'Nama Pejabat Belum Diisi'}
                  </p>
                  <p className="text-xs font-semibold text-emerald-800 truncate">
                    {position || 'Nama Jabatan'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {tenure} {nip ? `• NIP/SK: ${nip}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-600 line-clamp-1 mt-1">
                    {bio || 'Keterangan uraian tugas / bio aparatur.'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap & Gelar: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: H. Sudirman, S.E. / Ahmad Fauzi (Ketua RT 02)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Jabatan: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kepala Desa / Sekretaris Desa / Ketua RT 01"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori / Struktur Lembaga:
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    {SECTION_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Masa Bakti / Periode:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Periode 2024 - 2029 / Aktif"
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    NIP / NIAP / Nomor SK (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 19850112 201001 1 004"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Urutan Tampil (Display Order):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Nomor urut terkecil akan tampil paling atas.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Jabatan:
                  </label>
                  <div className="flex items-center gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span>{isActive ? 'Aktif (Tampil di Website)' : 'Nonaktif (Arsip)'}</span>
                    </label>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 0812-3456-7890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Kelamin:
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Lahir: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">*Digunakan sebagai kode absensi 6 angka.</p>
                </div>

                {/* UPLOAD FOTO PROFIL */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Foto Profil Aparatur:
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      placeholder="https://url-foto... atau pilih file upload di samping"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-600" />
                      <span>{isUploading ? 'Mengunggah...' : 'Unggah Foto Baru'}</span>
                    </button>

                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 flex items-center justify-center gap-1 shrink-0 cursor-pointer transition-colors"
                        title="Kosongkan foto (0)"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Kosongkan Foto (0)</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-500 italic">
                    * Kosongkan URL/Foto (0) jika belum ada foto resmi. Anda dapat mengunggah foto asli aparatur langsung dari galeri HP/Komputer.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Uraian Tugas Singkat / Keterangan:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Uraikan tanggung jawab pokok dalam pemerintahan desa..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* PENUNJUK MANAJEMEN AKSES */}
                <div className="sm:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs font-bold text-slate-900">
                      Otorisasi Akses Portal Admin
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Pengaturan hak akses modul (RBAC), username, dan password untuk perangkat desa kini dikelola secara terpusat melalui tab <strong>"Manajemen Pengguna"</strong>. 
                    Silakan hubungkan akun pengguna dengan aparatur ini di sana untuk menentukan modul apa saja yang boleh diakses.
                  </p>
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
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingOfficial ? 'Simpan Perubahan' : 'Simpan Pejabat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
