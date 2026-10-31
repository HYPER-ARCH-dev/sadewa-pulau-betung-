import React, { useState, useMemo, useRef } from 'react';
import {
  RotateCcw,
  Trash2,
  Eye,
  Download,
  Search,
  ShieldCheck,
  History,
  User,
  Calendar,
  FileText,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  Lock,
  Zap
} from 'lucide-react';
import { DeletedServiceRequestRecord } from '../../types';
import { useData } from '../../context/DataContext';
import { useApp } from '../../context/AppContext';
import { getLetterClassification } from '../../utils/letterNumbering';
import { uploadImageService } from '../../services/uploadService';

interface DeletedLettersLogTableProps {
  onBackToArchives?: () => void;
}

export const DeletedLettersLogTable: React.FC<DeletedLettersLogTableProps> = ({
  onBackToArchives
}) => {
  const {
    deletedRequests,
    restoreDeletedServiceRequest,
    permanentlyDeleteServiceRequestLog,
    clearAllDeletedServiceRequests,
    currentUser
  } = useData();
  const { addToast, villageProfile, updateVillageProfile } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [inspectItem, setInspectItem] = useState<DeletedServiceRequestRecord | null>(null);
  const [wipeConfirmItem, setWipeConfirmItem] = useState<DeletedServiceRequestRecord | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);

  // System Branding upload state for Super Admin (Panel Log Keamanan)
  const [uploadingTarget, setUploadingTarget] = useState<'sadewa' | 'sadewaIcon' | null>(null);
  const sadewaLogoInputRef = useRef<HTMLInputElement>(null);
  const sadewaIconInputRef = useRef<HTMLInputElement>(null);

  const handleBrandingUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'sadewa' | 'sadewaIcon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'Ukuran Terlalu Besar', 'Maksimal ukuran berkas adalah 10MB.');
      return;
    }

    setUploadingTarget(target);
    try {
      const result = await uploadImageService(file);
      if (result.success && result.url) {
        if (target === 'sadewa') {
          await updateVillageProfile({ sadewaLogoUrl: result.url });
          addToast('success', 'Logo SADEWA Diperbarui', 'Logo branding sistem berhasil diperbarui.');
        } else {
          await updateVillageProfile({ sadewaIconUrl: result.url });
          addToast('success', 'Ikon SADEWA Diperbarui', 'Ikon branding sistem berhasil diperbarui.');
        }
      } else {
        addToast('error', 'Gagal Unggah', result.error || 'Gagal memproses gambar branding.');
      }
    } catch (err: any) {
      addToast('error', 'Kesalahan Sistem', err?.message || 'Gagal mengunggah berkas.');
    } finally {
      setUploadingTarget(null);
      if (e.target) e.target.value = '';
    }
  };

  // Available letter types in deleted logs
  const availableTypes = useMemo(() => {
    const map = new Map<string, string>();
    deletedRequests.forEach((item) => {
      const cls = getLetterClassification(item.serviceName);
      map.set(cls.label, `${cls.code} - ${cls.label} (${item.serviceName})`);
    });
    return Array.from(map.entries());
  }, [deletedRequests]);

  // Filtered deleted requests
  const filteredList = useMemo(() => {
    return deletedRequests.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTracking = (item.trackingCode || '').toLowerCase().includes(q);
        const matchCitizen = (item.citizenName || '').toLowerCase().includes(q);
        const matchService = (item.serviceName || '').toLowerCase().includes(q);
        const matchDeleter = (item.deletedByUserName || '').toLowerCase().includes(q);
        const matchLetterNum = (item.officialLetterNumber || '').toLowerCase().includes(q);
        const matchReason = (item.deletionReason || '').toLowerCase().includes(q);
        if (!matchTracking && !matchCitizen && !matchService && !matchDeleter && !matchLetterNum && !matchReason) {
          return false;
        }
      }

      // Reason filter
      if (selectedReasonFilter !== 'all') {
        const r = (item.deletionReason || '').toLowerCase();
        if (selectedReasonFilter === 'uji_coba' && !r.includes('uji') && !r.includes('test')) return false;
        if (selectedReasonFilter === 'batal' && !r.includes('batal')) return false;
        if (selectedReasonFilter === 'duplikat' && !r.includes('ganda') && !r.includes('duplikat')) return false;
        if (selectedReasonFilter === 'koreksi' && !r.includes('koreksi') && !r.includes('salah')) return false;
      }

      // Type filter
      if (selectedTypeFilter !== 'all') {
        const cls = getLetterClassification(item.serviceName);
        if (cls.label !== selectedTypeFilter) return false;
      }

      return true;
    });
  }, [deletedRequests, searchQuery, selectedReasonFilter, selectedTypeFilter]);

  // Quick statistics
  const testCount = useMemo(
    () => deletedRequests.filter((d) => (d.deletionReason || '').toLowerCase().includes('uji') || (d.deletionReason || '').toLowerCase().includes('test')).length,
    [deletedRequests]
  );
  const cancelCount = useMemo(
    () => deletedRequests.filter((d) => (d.deletionReason || '').toLowerCase().includes('batal')).length,
    [deletedRequests]
  );

  // Restore action
  const handleRestore = async (item: DeletedServiceRequestRecord) => {
    setIsRestoringId(item.id);
    try {
      const success = await restoreDeletedServiceRequest(item.id);
      if (success) {
        addToast('success', 'Surat Dipulihkan', `Permohonan surat ${item.trackingCode} (${item.citizenName}) telah dikembalikan ke arsip aktif.`);
        if (inspectItem?.id === item.id) setInspectItem(null);
      } else {
        addToast('error', 'Gagal Pulihkan', 'Terjadi kendala saat memulihkan berkas.');
      }
    } catch {
      addToast('error', 'Gagal Pulihkan', 'Terjadi kesalahan sistem.');
    } finally {
      setIsRestoringId(null);
    }
  };

  // Permanent wipe single
  const handlePermanentWipe = async (item: DeletedServiceRequestRecord) => {
    try {
      const success = await permanentlyDeleteServiceRequestLog(item.id);
      if (success) {
        addToast('info', 'Catatan Dihapus Permanen', `Log penghapusan untuk resi ${item.trackingCode} telah dihapus selamanya.`);
        setWipeConfirmItem(null);
      }
    } catch {
      addToast('error', 'Gagal Menghapus', 'Tidak dapat menghapus catatan log.');
    }
  };

  // Clear all
  const handleClearAll = async () => {
    try {
      const count = deletedRequests.length;
      const success = await clearAllDeletedServiceRequests();
      if (success) {
        addToast('info', 'Log Dibersihkan', `Sebanyak ${count} catatan log surat terhapus berhasil dikosongkan.`);
        setIsClearAllModalOpen(false);
      }
    } catch {
      addToast('error', 'Gagal Mengosongkan', 'Tidak dapat mengosongkan log.');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (deletedRequests.length === 0) {
      addToast('warning', 'Data Kosong', 'Tidak ada riwayat log surat yang dapat diekspor.');
      return;
    }

    const headers = [
      'No',
      'Waktu Dihapus',
      'Kode Resi',
      'Jenis Surat',
      'Nomor Surat Resmi',
      'Nama Pemohon',
      'NIK Masked',
      'Kontak WA',
      'Dusun',
      'Tanggal Permohonan',
      'Status Terakhir',
      'Dihapus Oleh (Nama)',
      'Dihapus Oleh (Role)',
      'Alasan Penghapusan'
    ];

    const rows = filteredList.map((item, idx) => [
      idx + 1,
      `"${new Date(item.deletedAt).toLocaleString('id-ID')}"`,
      `"${item.trackingCode}"`,
      `"${item.serviceName}"`,
      `"${item.officialLetterNumber || '-'}"`,
      `"${item.citizenName}"`,
      `"${item.citizenNikMasked}"`,
      `"${item.phone || '-'}"`,
      `"${item.addressDusun}"`,
      `"${item.requestDate}"`,
      `"${item.lastStatus}"`,
      `"${item.deletedByUserName}"`,
      `"${item.deletedByUserRole}"`,
      `"${(item.deletionReason || '-').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Log_Surat_Dihapus_Pulau_Betung_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('success', 'Ekspor CSV Berhasil', 'Unduhan berkas audit log surat terhapus telah dibuat.');
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB';
    } catch {
      return iso;
    }
  };

  return (
    <div id="deleted-letters-log-view" className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Log Keamanan & Audit SPBE
              </span>
              <span className="text-xs text-slate-400">• Standar Akuntabilitas Pelayanan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2 flex items-center gap-2">
              <History className="w-6 h-6 text-rose-400" />
              Tabel Log & Buku Kendali Surat Terhapus
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Mencatat riwayat lengkap seluruh surat yang dibatalkan atau dihapus dari arsip, termasuk data uji coba sistem. Dilengkapi identitas pemohon, petugas eksekutor, alasan, serta opsi pemulihan seketika (Instant Restore).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onBackToArchives && (
              <button
                type="button"
                onClick={onBackToArchives}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 border border-slate-700"
              >
                <span>&larr; Kembali ke Arsip Surat</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={deletedRequests.length === 0}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor CSV Audit</span>
            </button>
            {currentUser?.role === 'super_admin' && deletedRequests.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 text-xs font-bold transition-all duration-200 cursor-pointer flex items-center space-x-1.5"
                title="Hanya Super Admin yang dapat mengosongkan seluruh log sampah"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Kosongkan Log</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Total Surat Tercatat Dihapus</span>
            <strong className="text-2xl font-black text-white">{deletedRequests.length}</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">Semua data terhapus</span>
          </div>

          <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-300 block font-medium">Data Uji Coba / Testing</span>
            <strong className="text-2xl font-black text-emerald-400">{testCount}</strong>
            <span className="text-[10px] text-emerald-300/80 block mt-0.5">Pembersihan simulasi</span>
          </div>

          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/20">
            <span className="text-[11px] text-amber-300 block font-medium">Batal / Salah Pengajuan</span>
            <strong className="text-2xl font-black text-amber-400">{cancelCount}</strong>
            <span className="text-[10px] text-amber-300/80 block mt-0.5">Permintaan warga</span>
          </div>

          <div className="bg-rose-500/10 rounded-2xl p-3 border border-rose-500/20">
            <span className="text-[11px] text-rose-300 block font-medium">Status Keamanan Log</span>
            <strong className="text-xs font-black text-rose-300 block mt-1">Audit Trail Aktif</strong>
            <span className="text-[10px] text-rose-400/80 block mt-0.5">Dapat dipulihkan kapan saja</span>
          </div>
        </div>
      </div>

      {/* Super Admin Branding Upload Card (Panel Log Keamanan) */}
      {currentUser?.role === 'super_admin' && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  Pengaturan Logo Branding System SADEWA
                </h3>
                <p className="text-[11px] text-slate-400">
                  Panel khusus Super Admin untuk mengunggah logo &amp; ikon branding sistem SADEWA. Kop Surat Desa terpisah &amp; 100% aman.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto">
              Khusus Super Admin
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Logo Induk SADEWA */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                Logo Induk SADEWA (Footer &amp; Sidebar Aplikasi):
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center p-2 shrink-0">
                  {villageProfile?.sadewaLogoUrl && villageProfile.sadewaLogoUrl.length > 10 ? (
                    <img src={villageProfile.sadewaLogoUrl} alt="Logo SADEWA" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Zap className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input type="file" ref={sadewaLogoInputRef} onChange={(e) => handleBrandingUpload(e, 'sadewa')} accept="image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => sadewaLogoInputRef.current?.click()}
                    disabled={uploadingTarget === 'sadewa'}
                    className="w-full px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-900/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTarget === 'sadewa' ? 'Mengunggah...' : 'Unggah Logo Branding'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400">PNG Transparan / SVG (Maks 10MB)</p>
                </div>
              </div>
            </div>

            {/* Ikon Simbol SADEWA */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <label className="block text-xs font-bold text-slate-200">
                Ikon Simbol SADEWA (Header Mobile &amp; Favicon):
              </label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl border border-slate-700 bg-slate-950 flex items-center justify-center p-2 shrink-0">
                  {villageProfile?.sadewaIconUrl && villageProfile.sadewaIconUrl.length > 10 ? (
                    <img src={villageProfile.sadewaIconUrl} alt="Ikon SADEWA" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input type="file" ref={sadewaIconInputRef} onChange={(e) => handleBrandingUpload(e, 'sadewaIcon')} accept="image/*" className="hidden" />
                  <button
                    type="button"
                    onClick={() => sadewaIconInputRef.current?.click()}
                    disabled={uploadingTarget === 'sadewaIcon'}
                    className="w-full px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-purple-900/30"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTarget === 'sadewaIcon' ? 'Mengunggah...' : 'Unggah Ikon Simbol'}</span>
                  </button>
                  <p className="text-[10px] text-slate-400">Rasio 1:1 Persegi (Maks 10MB)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari resi, nama pemohon, jenis surat, petugas yang menghapus, atau alasan..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Letter Type Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 text-slate-700"
            >
              <option value="all">Semua Jenis Surat ({deletedRequests.length})</option>
              {availableTypes.map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedReasonFilter}
              onChange={(e) => setSelectedReasonFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50 text-slate-700"
            >
              <option value="all">Semua Alasan Penghapusan</option>
              <option value="uji_coba">Uji Coba / Testing Sistem</option>
              <option value="batal">Dibatalkan Pemohon</option>
              <option value="duplikat">Data Ganda / Duplikat</option>
              <option value="koreksi">Salah Input / Koreksi</option>
            </select>
          </div>
        </div>

        {/* Results summary bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div>
            Menampilkan <strong>{filteredList.length}</strong> dari <strong>{deletedRequests.length}</strong> catatan log surat terhapus
          </div>
          {(searchQuery || selectedReasonFilter !== 'all' || selectedTypeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedReasonFilter('all');
                setSelectedTypeFilter('all');
              }}
              className="text-rose-600 hover:underline font-bold text-[11px]"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <History className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {deletedRequests.length === 0
                ? 'Belum Ada Surat yang Dihapus'
                : 'Tidak Ditemukan Data yang Sesuai Filter'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {deletedRequests.length === 0
                ? 'Seluruh permohonan surat masih tersimpan aman dalam Buku Kendali & Arsip aktif desa.'
                : 'Coba ubah kata kunci pencarian atau bersihkan filter di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="p-3.5 text-center w-12">No</th>
                  <th className="p-3.5">Waktu Dihapus</th>
                  <th className="p-3.5">Jenis Surat / Layanan</th>
                  <th className="p-3.5">No. Resi & Surat</th>
                  <th className="p-3.5">Yang Mengajukan (Pemohon)</th>
                  <th className="p-3.5">Dihapus Oleh (Petugas)</th>
                  <th className="p-3.5">Alasan Penghapusan</th>
                  <th className="p-3.5 text-center w-36">Aksi Keamanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredList.map((item, idx) => {
                  const cls = getLetterClassification(item.serviceName);
                  const isTestReason =
                    (item.deletionReason || '').toLowerCase().includes('uji') ||
                    (item.deletionReason || '').toLowerCase().includes('test');
                  const isCancelReason = (item.deletionReason || '').toLowerCase().includes('batal');

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-rose-50/30 transition-colors group"
                    >
                      {/* No */}
                      <td className="p-3.5 text-center font-mono text-slate-400 font-semibold">
                        {idx + 1}
                      </td>

                      {/* Waktu Dihapus */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDateTime(item.deletedAt)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tgl Pengajuan: {item.requestDate}
                        </div>
                      </td>

                      {/* Jenis Surat */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {cls.code} • {cls.label}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 leading-tight">
                          {item.serviceName}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Status terakhir: <span className="capitalize font-medium">{item.lastStatus}</span>
                        </div>
                      </td>

                      {/* Resi & No Surat */}
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block border border-emerald-200 text-[11px]">
                          {item.trackingCode}
                        </div>
                        {item.officialLetterNumber ? (
                          <div className="text-[10px] font-mono text-slate-700 mt-1 font-semibold">
                            No: {item.officialLetterNumber}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            Belum diterbitkan nomor
                          </div>
                        )}
                      </td>

                      {/* Pemohon */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.citizenName}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          NIK: {item.citizenNikMasked}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.addressDusun} {item.phone ? `• WA: ${item.phone}` : ''}
                        </div>
                      </td>

                      {/* Petugas Penghapus */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                          <span>{item.deletedByUserName}</span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              item.deletedByUserRole === 'super_admin'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {item.deletedByUserRole || 'operator'}
                          </span>
                        </div>
                      </td>

                      {/* Alasan Penghapusan */}
                      <td className="p-3.5 max-w-xs">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            isTestReason
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isCancelReason
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {item.deletionReason || 'Data Uji Coba / Testing'}
                        </span>
                      </td>

                      {/* Aksi Keamanan */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Pulihkan / Restore Button */}
                          <button
                            type="button"
                            onClick={() => handleRestore(item)}
                            disabled={isRestoringId === item.id}
                            title="Pulihkan kembali ke daftar permohonan surat aktif"
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold px-2.5"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRestoringId === item.id ? 'animate-spin' : ''}`} />
                            <span className="hidden xl:inline">Pulihkan</span>
                          </button>

                          {/* Snapshot Button */}
                          <button
                            type="button"
                            onClick={() => setInspectItem(item)}
                            title="Lihat snapshot rincian lengkap berkas"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Wipe Log Button */}
                          {currentUser?.role === 'super_admin' && (
                            <button
                              type="button"
                              onClick={() => setWipeConfirmItem(item)}
                              title="Hapus permanen catatan log ini (Super Admin)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Detail Snapshot Berkas yang Dihapus */}
      {inspectItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Snapshot Rekam Jejak Surat Terhapus
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Kode Resi: <strong className="font-mono text-emerald-700">{inspectItem.trackingCode}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Deletion Audit Banner */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs space-y-1.5 text-rose-950">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <ShieldCheck className="w-4 h-4 text-rose-600" />
                <span>Catatan Audit Penghapusan</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div>
                  <span className="text-rose-700 font-sans">Dihapus Pada:</span>{' '}
                  <strong>{formatDateTime(inspectItem.deletedAt)}</strong>
                </div>
                <div>
                  <span className="text-rose-700 font-sans">Petugas:</span>{' '}
                  <strong>{inspectItem.deletedByUserName}</strong> ({inspectItem.deletedByUserRole})
                </div>
                <div className="sm:col-span-2">
                  <span className="text-rose-700 font-sans">Alasan:</span>{' '}
                  <span className="font-sans font-bold bg-white px-2 py-0.5 rounded border border-rose-200">
                    {inspectItem.deletionReason}
                  </span>
                </div>
              </div>
            </div>

            {/* Applicant & Service Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data Pemohon</span>
                <div className="font-bold text-slate-900 text-sm">{inspectItem.citizenName}</div>
                <div className="font-mono text-slate-600 text-[11px]">NIK: {inspectItem.citizenNikMasked}</div>
                <div className="text-slate-500 text-[11px]">Wilayah: {inspectItem.addressDusun}</div>
                <div className="text-slate-500 text-[11px]">Kontak: {inspectItem.phone || '-'}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Layanan Surat</span>
                <div className="font-bold text-slate-900 text-sm">{inspectItem.serviceName}</div>
                <div className="text-slate-600 text-[11px]">
                  Nomor Surat: <strong>{inspectItem.officialLetterNumber || 'Belum Terbit'}</strong>
                </div>
                <div className="text-slate-500 text-[11px]">Tanggal Pengajuan: {inspectItem.requestDate}</div>
                <div className="text-slate-500 text-[11px]">Status Terakhir: <strong className="uppercase">{inspectItem.lastStatus}</strong></div>
              </div>
            </div>

            {/* Form Snapshot Payload */}
            {inspectItem.fullRequestSnapshot && inspectItem.fullRequestSnapshot.formData && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Isian Formulir Pemohon (Snapshot Asli)
                </h4>
                <div className="p-3.5 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono max-h-48 overflow-y-auto space-y-1">
                  {Object.entries(inspectItem.fullRequestSnapshot.formData).map(([k, v]) => (
                    <div key={k} className="flex flex-col sm:flex-row sm:justify-between py-0.5 border-b border-slate-800">
                      <span className="text-emerald-400">{k}:</span>
                      <span className="text-slate-300 font-sans">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => handleRestore(inspectItem)}
                disabled={isRestoringId === inspectItem.id}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Pulihkan Berkas Ini Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Konfirmasi Hapus Permanen Catatan Log */}
      {wipeConfirmItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-sm">Hapus Permanen Catatan Log?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan memusnahkan riwayat audit penghapusan untuk surat resi{' '}
              <strong className="font-mono text-slate-900">{wipeConfirmItem.trackingCode}</strong> secara permanen dari basis data server. Data ini tidak akan dapat dipulihkan kembali.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWipeConfirmItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handlePermanentWipe(wipeConfirmItem)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Konfirmasi Kosongkan Seluruh Log */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-sm">Kosongkan Seluruh Catatan Log?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengosongkan seluruh{' '}
              <strong className="text-rose-600">{deletedRequests.length} catatan log</strong> surat yang dihapus? Seluruh riwayat audit dan opsi pemulihan permohonan akan hilang selamanya.
            </p>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-900">
              Akses ini khusus otoritas Super Admin untuk membersihkan lingkungan setelah pengujian selesai.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Ya, Kosongkan Semua Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
