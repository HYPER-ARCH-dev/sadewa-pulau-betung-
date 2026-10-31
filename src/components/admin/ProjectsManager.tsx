import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DevelopmentProject } from '../../types';
import { uploadImageService } from '../../services/uploadService';
import {
  HardHat,
  Plus,
  Edit,
  Trash2,
  Search,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  X,
  Upload,
  Image as ImageIcon,
  Loader2,
  Eye,
  Camera
} from 'lucide-react';

const FUNDING_SOURCES = [
  'Dana Desa (DDS)',
  'Alokasi Dana Desa (ADD)',
  'Bagi Hasil Pajak',
  'Swadaya Masyarakat',
  'Bantuan Keuangan Provinsi'
] as const;

export const ProjectsManager: React.FC = () => {
  const { developmentProjects, addDevelopmentProject, updateDevelopmentProject, deleteDevelopmentProject, addToast, currentUser } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<DevelopmentProject | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('RT 01 Dusun Betung Indah');
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [budget, setBudget] = useState(125000000);
  const [fundingSource, setFundingSource] = useState<DevelopmentProject['fundingSource']>('Dana Desa (DDS)');
  const [contractor, setContractor] = useState('TPK Desa Pulau Betung');
  const [progressPercent, setProgressPercent] = useState(0);
  const [status, setStatus] = useState<DevelopmentProject['status']>('perencanaan');
  const [description, setDescription] = useState('');
  const [beforeImage, setBeforeImage] = useState('https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80');
  const [inProgressImage, setInProgressImage] = useState('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80');
  const [completedImage, setCompletedImage] = useState('');

  // Anti-Fraud & Verification states
  const [isExifVerified, setIsExifVerified] = useState(true);
  const [isBpdVerified, setIsBpdVerified] = useState(true);
  const [verifiedByBpdName, setVerifiedByBpdName] = useState('BPD Desa Pulau Betung');

  // Upload refs & states
  const [uploadingTarget, setUploadingTarget] = useState<'before' | 'inProgress' | 'completed' | null>(null);
  const beforeImageInputRef = useRef<HTMLInputElement>(null);
  const inProgressImageInputRef = useRef<HTMLInputElement>(null);
  const completedImageInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'before' | 'inProgress' | 'completed') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'Ukuran Berkas Terlalu Besar', 'Maksimal ukuran foto adalah 10MB.');
      return;
    }

    setUploadingTarget(target);
    try {
      const res = await uploadImageService(file);
      if (res.success && res.url) {
        if (target === 'before') setBeforeImage(res.url);
        else if (target === 'inProgress') setInProgressImage(res.url);
        else if (target === 'completed') setCompletedImage(res.url);
        addToast('success', 'Foto Berhasil Diunggah', 'Foto dokumentasi proyek telah disimpan.');
      } else {
        addToast('error', 'Gagal Mengunggah', res.error || 'Terjadi kesalahan saat mengunggah foto.');
      }
    } catch (err) {
      addToast('error', 'Kesalahan Sistem', 'Gagal memproses berkas gambar.');
    } finally {
      setUploadingTarget(null);
      if (e.target) e.target.value = '';
    }
  };

  const openAddModal = () => {
    setEditingProject(null);
    setTitle('');
    setLocation('RT 02 Dusun Betung Indah');
    setFiscalYear(2026);
    setBudget(85000000);
    setFundingSource('Dana Desa (DDS)');
    setContractor('TPK Desa Pulau Betung');
    setProgressPercent(15);
    setStatus('sedang_berjalan');
    setDescription('');
    setBeforeImage('https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80');
    setInProgressImage('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80');
    setCompletedImage('');
    setIsExifVerified(true);
    setIsBpdVerified(true);
    setVerifiedByBpdName('BPD Desa Pulau Betung');
    setModalOpen(true);
  };

  const openEditModal = (item: DevelopmentProject) => {
    setEditingProject(item);
    setTitle(item.title);
    setLocation(item.location);
    setFiscalYear(item.fiscalYear);
    setBudget(item.budget);
    setFundingSource(item.fundingSource);
    setContractor(item.contractor);
    setProgressPercent(item.progressPercent);
    setStatus(item.status);
    setDescription(item.description);
    setBeforeImage(item.beforeImage || '');
    setInProgressImage(item.inProgressImage || '');
    setCompletedImage(item.completedImage || '');
    setIsExifVerified(item.isExifVerified ?? true);
    setIsBpdVerified(item.isBpdVerified ?? true);
    setVerifiedByBpdName(item.verifiedByBpdName || 'BPD Desa Pulau Betung');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (editingProject) {
      updateDevelopmentProject(editingProject.id, {
        title: title.trim(),
        location: location.trim(),
        fiscalYear: Number(fiscalYear) || 2026,
        budget: Number(budget) || 0,
        fundingSource,
        contractor: contractor.trim(),
        progressPercent: Number(progressPercent),
        status,
        description: description.trim() || `Pembangunan fisik ${title.trim()} untuk peningkatan sarana desa.`,
        beforeImage: beforeImage.trim() || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        inProgressImage: inProgressImage.trim(),
        completedImage: completedImage.trim(),
        isExifVerified,
        isBpdVerified,
        verifiedByBpdName: isBpdVerified ? verifiedByBpdName : ''
      });
    } else {
      addDevelopmentProject({
        title: title.trim(),
        location: location.trim(),
        fiscalYear: Number(fiscalYear) || 2026,
        budget: Number(budget) || 0,
        fundingSource,
        contractor: contractor.trim(),
        progressPercent: Number(progressPercent),
        status,
        startDate: 'Januari 2026',
        targetEndDate: 'Desember 2026',
        description: description.trim() || `Pembangunan fisik ${title.trim()} untuk peningkatan sarana desa.`,
        beforeImage: beforeImage.trim() || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80',
        inProgressImage: inProgressImage.trim(),
        completedImage: completedImage.trim(),
        isExifVerified,
        isBpdVerified,
        verifiedByBpdName: isBpdVerified ? verifiedByBpdName : ''
      });
    }

    setModalOpen(false);
  };

  const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string; isFinished: boolean } | null>(null);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const handleDelete = (proj: DevelopmentProject) => {
    const isFinished = proj.progressPercent >= 100 || proj.status === 'selesai';

    if (!isFinished && !isSuperAdmin) {
      addToast(
        'error',
        'Akses Terkunci: Hak Akses Khusus Super Admin',
        `Proyek "${proj.title}" belum 100% selesai (Progres: ${proj.progressPercent}%). Demi transparansi dan keamanan audit APBDes, proyek yang sedang berjalan hanya dapat dihapus oleh Super Admin utama!`
      );
      return;
    }

    setProjectToDelete({ id: proj.id, title: proj.title, isFinished });
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteDevelopmentProject(projectToDelete.id);
      addToast('info', 'Proyek Dihapus', `Data proyek "${projectToDelete.title}" telah dihapus dari sistem.`);
      setProjectToDelete(null);
    }
  };

  const filtered = developmentProjects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-600" />
              <span>Monitoring Proyek Pembangunan Fisik (APBDes)</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {developmentProjects.length} Proyek
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Admin desa dapat mengunggah foto dokumentasi proyek (0%, proses, & selesai 100%), memperbarui progres fisik, atau mengedit data anggaran.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Proyek Baru</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari judul proyek pembangunan, lokasi RT / dusun..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50/60"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((proj) => {
          const displayImg = proj.completedImage || proj.inProgressImage || proj.beforeImage || 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80';
          return (
            <div
              key={proj.id}
              className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 transition-all shadow-xs flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
            >
              <div className="flex items-start gap-4 flex-1">
                {/* Thumbnail Preview */}
                <div className="w-24 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 relative group">
                  <img
                    src={displayImg}
                    alt={proj.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute bottom-1 right-1 bg-slate-950/70 text-white font-mono text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs">
                    {proj.progressPercent}%
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded ${
                      proj.status === 'selesai'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : proj.status === 'sedang_berjalan'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {proj.status === 'selesai' ? 'Selesai 100%' : proj.status === 'sedang_berjalan' ? 'Sedang Dikerjakan' : 'Perencanaan'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">T.A {proj.fiscalYear}</span>
                    <span className="text-[11px] font-semibold text-slate-600">• {proj.fundingSource}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 truncate">{proj.title}</h3>
                  <p className="text-xs text-slate-500 truncate">Lokasi: {proj.location} • TPK: {proj.contractor}</p>

                  {/* Progress bar */}
                  <div className="space-y-1 max-w-md pt-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-600">Progres Fisik Lapangan:</span>
                      <span className="text-amber-700 font-mono">{proj.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${proj.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col items-end justify-between gap-3 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Pagu Anggaran</span>
                  <span className="font-mono text-sm font-extrabold text-slate-900">
                    Rp {proj.budget.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(proj)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-700" />
                    <span>Upload Foto & Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(proj)}
                    className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                      proj.progressPercent < 100 && !isSuperAdmin
                        ? 'text-slate-400 bg-slate-50 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                        : 'text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200'
                    }`}
                    title={
                      proj.progressPercent < 100 && !isSuperAdmin
                        ? 'Hanya Super Admin yang dapat menghapus proyek belum selesai'
                        : 'Hapus Proyek'
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Tambah / Edit Proyek */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  {editingProject ? 'Perbarui Data & Foto Proyek' : 'Tambah Proyek Fisik APBDes'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {editingProject ? `Edit: ${editingProject.title}` : 'Formulir Pembangunan Desa'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama / Judul Kegiatan Pembangunan: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pembangunan Rabat Beton Jalan Usaha Tani Dusun Melintang"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi (RT / Dusun):</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Anggaran:</label>
                    <input
                      type="number"
                      value={fiscalYear}
                      onChange={(e) => setFiscalYear(Number(e.target.value))}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pagu Anggaran (Rp):</label>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sumber Pembiayaan:</label>
                    <select
                      value={fundingSource}
                      onChange={(e) => setFundingSource(e.target.value as any)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      {FUNDING_SOURCES.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Progres Fisik (%): <span className="text-amber-700 font-mono font-bold">{progressPercent}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progressPercent}
                      onChange={(e) => setProgressPercent(Number(e.target.value))}
                      className="w-full accent-amber-600 mt-2"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Status Proyek:</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="perencanaan">Perencanaan</option>
                      <option value="sedang_berjalan">Sedang Dikerjakan</option>
                      <option value="selesai">Selesai 100%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pelaksana Kegiatan (TPK):</label>
                  <input
                    type="text"
                    value={contractor}
                    onChange={(e) => setContractor(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi / Sasaran Manfaat:</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* DOKUMENTASI FOTO PROYEK */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Camera className="w-4 h-4 text-amber-700" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Dokumentasi Foto Lapangan (Transparansi Fisik)
                    </h4>
                  </div>

                  {/* 1. Foto Sebelum Pembangunan (0%) */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        1. Foto Kondisi Awal (0% Sebelum Pembangunan)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Form/Unggah</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {beforeImage ? (
                          <img src={beforeImage} alt="0%" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          ref={beforeImageInputRef}
                          onChange={(e) => handleFileUpload(e, 'before')}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => beforeImageInputRef.current?.click()}
                            disabled={uploadingTarget === 'before'}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            {uploadingTarget === 'before' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            <span>{uploadingTarget === 'before' ? 'Mengunggah...' : 'Pilih Berkas Foto 0%'}</span>
                          </button>
                        </div>
                        <input
                          type="url"
                          placeholder="Atau tautan URL foto: https://..."
                          value={beforeImage}
                          onChange={(e) => setBeforeImage(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Foto Proses Pembangunan */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        2. Foto Pelaksanaan (Progres Fisik Lapangan)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Form/Unggah</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {inProgressImage ? (
                          <img src={inProgressImage} alt="Progres" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          ref={inProgressImageInputRef}
                          onChange={(e) => handleFileUpload(e, 'inProgress')}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => inProgressImageInputRef.current?.click()}
                            disabled={uploadingTarget === 'inProgress'}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            {uploadingTarget === 'inProgress' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            <span>{uploadingTarget === 'inProgress' ? 'Mengunggah...' : 'Pilih Berkas Foto Progres'}</span>
                          </button>
                        </div>
                        <input
                          type="url"
                          placeholder="Atau tautan URL foto: https://..."
                          value={inProgressImage}
                          onChange={(e) => setInProgressImage(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Foto Selesai 100% */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        3. Foto Hasil Akhir (Selesai 100%)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Form/Unggah</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-12 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {completedImage ? (
                          <img src={completedImage} alt="100%" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <input
                          type="file"
                          ref={completedImageInputRef}
                          onChange={(e) => handleFileUpload(e, 'completed')}
                          accept="image/*"
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => completedImageInputRef.current?.click()}
                            disabled={uploadingTarget === 'completed'}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            {uploadingTarget === 'completed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            <span>{uploadingTarget === 'completed' ? 'Mengunggah...' : 'Pilih Berkas Foto 100% Selesai'}</span>
                          </button>
                        </div>
                        <input
                          type="url"
                          placeholder="Atau tautan URL foto: https://..."
                          value={completedImage}
                          onChange={(e) => setCompletedImage(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingProject ? 'Simpan Data & Foto' : 'Tambah Proyek'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setProjectToDelete(null)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Konfirmasi Hapus Proyek</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed font-medium">
              Apakah Anda yakin ingin menghapus data proyek <strong className="text-slate-900">"{projectToDelete.title}"</strong> dari sistem monitoring pembangunan desa?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Proyek</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
