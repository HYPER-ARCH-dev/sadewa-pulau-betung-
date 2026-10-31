import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Folder,
  FolderOpen,
  Archive,
  Search,
  Filter,
  Calendar,
  Printer,
  MessageSquare,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Layers,
  FileText,
  Tag,
  ShieldCheck,
  Check,
  AlertCircle,
  BookOpen,
  ExternalLink,
  BadgeCheck,
  Trash2,
  X
} from 'lucide-react';
import { ServiceRequest } from '../../types';
import { ServiceStatusBadge } from '../common/StatusBadge';
import { getLetterClassification } from '../../utils/letterNumbering';
import { ArchiveTableContainer } from './ArchiveTableContainer';
import { DeletedLettersLogTable } from './DeletedLettersLogTable';
import { useApp } from '../../context/AppContext';
import { generateReportPDF } from '../../utils/pdfEngine';

interface LetterArchivesManagerProps {
  requests: ServiceRequest[];
  onSelectRequest: (req: ServiceRequest) => void;
  onPreviewLetter: (req: ServiceRequest) => void;
  onSendWhatsApp: (req: ServiceRequest) => void;
  onDeleteRequest?: (reqId: string, reason?: string) => void;
  onBulkDeleteRequest?: (reqIds: string[], reason?: string) => void;
}

interface LetterArchiveGroup {
  label: string;
  code: string;
  title: string;
  categoryName: string;
  items: ServiceRequest[];
}

interface FilteredArchiveGroup extends LetterArchiveGroup {
  completedCount: number;
  pendingCount: number;
  latestOfficialNumber?: string;
}

// Helper to identify applications that are active in queue requiring processing or verification
const isPendingQueueStatus = (status: string) =>
  status === 'diajukan' ||
  status === 'diverifikasi' ||
  status === 'diproses' ||
  status === 'perlu_perbaikan';

export const LetterArchivesManager: React.FC<LetterArchivesManagerProps> = ({
  requests,
  onSelectRequest,
  onPreviewLetter,
  onSendWhatsApp,
  onDeleteRequest,
  onBulkDeleteRequest
}) => {
  const { villageProfile, addToast, deletedRequests } = useApp();
  const sadewaLogoUrl = villageProfile?.heroBackgroundUrl?.trim() || '/images/hero-pulau-betung.webp';

  // State Filter & View Mode
  const [viewMode, setViewMode] = useState<'folders' | 'table' | 'deleted_logs'>('folders');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // SMART ACCORDION: Default State Tertutup (Collapsed by Default)
  // Folder/kategori surat dalam kondisi tertutup semua saat halaman pertama kali dimuat.
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [deleteCandidate, setDeleteCandidate] = useState<ServiceRequest | null>(null);
  const [deletionReasonOption, setDeletionReasonOption] = useState<string>('Data Uji Coba / Testing Sistem');
  const [customDeletionReason, setCustomDeletionReason] = useState<string>('');

  // Extract available months for monthly archive selection (e.g. "2026-09", "2026-08")
  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, string>();
    requests.forEach((req) => {
      const d = req.completedAt || req.requestDate;
      if (d && d.length >= 7) {
        const ym = d.substring(0, 7);
        const [y, m] = ym.split('-');
        const monthNames = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        const monthIndex = parseInt(m, 10) - 1;
        const label = `${monthNames[monthIndex] || m} ${y}`;
        monthMap.set(ym, label);
      }
    });
    return Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [requests]);

  // Group all requests by letter type classification
  const groupedArchives = useMemo<Record<string, LetterArchiveGroup>>(() => {
    const groups: Record<string, LetterArchiveGroup> = {};

    requests.forEach((req) => {
      const classification = getLetterClassification(req.serviceName);
      const key = classification.label;

      if (!groups[key]) {
        groups[key] = {
          label: classification.label,
          code: classification.code,
          title: classification.title,
          categoryName: classification.categoryName,
          items: []
        };
      }
      groups[key].items.push(req);
    });

    return groups;
  }, [requests]);

  // Distinct letter types for the quick pill filters, sorted by active queue priority
  const letterTypes = useMemo(() => {
    return (Object.values(groupedArchives) as LetterArchiveGroup[])
      .map((g) => {
        const pendingCount = g.items.filter((r) => isPendingQueueStatus(r.status)).length;
        return {
          label: g.label,
          code: g.code,
          title: g.title,
          count: g.items.length,
          pendingCount
        };
      })
      .sort((a, b) => {
        // Smart sorting: kategori dengan antrean terbanyak di depan
        if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
        return b.count - a.count;
      });
  }, [groupedArchives]);

  // Apply filters (type, status, month, search query)
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const classification = getLetterClassification(req.serviceName);

      // Filter by Letter Type
      if (selectedTypeFilter !== 'all' && classification.label !== selectedTypeFilter) {
        return false;
      }

      // Filter by Status
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'selesai_valid') {
          if (req.status !== 'selesai' && req.status !== 'disetujui') return false;
        } else if (selectedStatusFilter === 'proses') {
          if (req.status !== 'diajukan' && req.status !== 'diverifikasi' && req.status !== 'diproses') return false;
        } else if (req.status !== selectedStatusFilter) {
          return false;
        }
      }

      // Filter by Month
      if (selectedMonthFilter !== 'all') {
        const d = req.completedAt || req.requestDate;
        if (!d || !d.startsWith(selectedMonthFilter)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchResi = req.trackingCode.toLowerCase().includes(q);
        const matchName = req.citizenName.toLowerCase().includes(q);
        const matchNik = req.citizenNikMasked.toLowerCase().includes(q) || (req.citizenNik && req.citizenNik.includes(q));
        const matchService = req.serviceName.toLowerCase().includes(q);
        const matchOfficialNumber = req.officialLetterNumber ? req.officialLetterNumber.toLowerCase().includes(q) : false;
        const matchNotes = req.notes ? req.notes.toLowerCase().includes(q) : false;
        if (!matchResi && !matchName && !matchNik && !matchService && !matchOfficialNumber && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [requests, selectedTypeFilter, selectedStatusFilter, selectedMonthFilter, searchQuery]);

  // SMART SORTING: Group the filtered items for the folder view
  // Urutan prioritas antrean: Kategori dengan berkas status "Proses", "Diajukan",
  // atau "Menunggu Verifikasi" terbanyak DIDAHULUKAN di posisi teratas.
  // Folder dengan antrean 0 (hanya 'Terbit' / 'Selesai') berada di urutan bawah.
  const filteredGroups = useMemo<FilteredArchiveGroup[]>(() => {
    const groups: Record<string, FilteredArchiveGroup> = {};

    filteredRequests.forEach((req) => {
      const classification = getLetterClassification(req.serviceName);
      const key = classification.label;

      if (!groups[key]) {
        groups[key] = {
          label: classification.label,
          code: classification.code,
          title: classification.title,
          categoryName: classification.categoryName,
          items: [],
          completedCount: 0,
          pendingCount: 0
        };
      }

      groups[key].items.push(req);

      if (req.status === 'selesai' || req.status === 'disetujui') {
        groups[key].completedCount += 1;
        if (req.officialLetterNumber) {
          groups[key].latestOfficialNumber = req.officialLetterNumber;
        }
      } else if (isPendingQueueStatus(req.status)) {
        groups[key].pendingCount += 1;
      }
    });

    const list = Object.values(groups) as FilteredArchiveGroup[];

    // Smart Sorting Algorithm:
    // 1. Kategori dengan pendingCount terbanyak diletakkan di paling atas (index 0, 1, 2, dst)
    // 2. Kategori dengan antrean 0 (hanya Terbit/Selesai) di urutan bawah
    // 3. Jika pendingCount sama, urutkan berdasarkan total item terbanyak, lalu nama judul
    list.sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      if (b.items.length !== a.items.length) {
        return b.items.length - a.items.length;
      }
      return a.title.localeCompare(b.title);
    });

    // Urutkan berkas di dalam setiap folder: antrean proses di atas, lalu tanggal pengajuan terbaru
    list.forEach((grp) => {
      grp.items.sort((a, b) => {
        const aPending = isPendingQueueStatus(a.status) ? 1 : 0;
        const bPending = isPendingQueueStatus(b.status) ? 1 : 0;
        if (bPending !== aPending) return bPending - aPending;
        return (b.requestDate || '').localeCompare(a.requestDate || '');
      });
    });

    return list;
  }, [filteredRequests]);

  const toggleFolder = (label: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const expandAllFolders = () => {
    const newState: Record<string, boolean> = {};
    filteredGroups.forEach((g) => {
      newState[g.label] = true;
    });
    letterTypes.forEach((t) => {
      newState[t.label] = true;
    });
    setExpandedFolders(newState);
  };

  const collapseAllFolders = () => {
    setExpandedFolders({});
  };

  // Export CSV Handler
  const handleExportFilteredCsv = () => {
    const headers = [
      'No Urut',
      'Kode Resi',
      'Kode Klasifikasi',
      'Singkatan Surat',
      'Jenis Layanan',
      'Nomor Surat Resmi',
      'Nama Pemohon',
      'NIK Masked',
      'Wilayah Dusun',
      'Kontak WA',
      'Tanggal Pengajuan',
      'Tanggal Selesai',
      'Status',
      'Catatan Petugas / Pemohon'
    ];

    const rows = filteredRequests.map((r, idx) => {
      const cls = getLetterClassification(r.serviceName);
      return [
        idx + 1,
        `"${r.trackingCode}"`,
        `"${cls.code}"`,
        `"${cls.label}"`,
        `"${r.serviceName}"`,
        `"${r.officialLetterNumber || '-'}"`,
        `"${r.citizenName}"`,
        `"${r.citizenNikMasked}"`,
        `"${r.addressDusun}"`,
        `"${r.phone || '-'}"`,
        `"${r.requestDate}"`,
        `"${r.completedAt || '-'}"`,
        `"${r.status}"`,
        `"${(r.staffNotes || r.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);

    const typeSuffix = selectedTypeFilter !== 'all' ? `_${selectedTypeFilter}` : '';
    const monthSuffix = selectedMonthFilter !== 'all' ? `_${selectedMonthFilter}` : '';
    link.setAttribute(
      'download',
      `Buku_Arsip_Surat_Desa_Pulau_Betung${typeSuffix}${monthSuffix}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    link.click();
    addToast('success', 'Ekspor CSV Berhasil', 'Rekapitulasi arsip surat berhasil diunduh.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card with SADEWA Watermark Branding */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-6 text-white shadow-md border border-slate-700/50">
        {/* Watermark Logo SADEWA Background Layer (Inverted White at ~10% Opacity) */}
        {sadewaLogoUrl && (
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 md:w-1/2 pointer-events-none select-none overflow-hidden flex items-center justify-end pr-2 sm:pr-6 z-0">
            <img
              src={sadewaLogoUrl}
              alt="Watermark SADEWA"
              className="h-[120%] sm:h-[140%] max-h-none w-auto max-w-[280px] sm:max-w-[380px] md:max-w-[460px] object-contain object-right opacity-10 brightness-0 invert pointer-events-none select-none transition-all"
            />
          </div>
        )}

        {/* Header Content Protected by relative z-10 */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <Archive className="w-3.5 h-3.5" />
              <span>Buku Kendali & Arsip Surat Digital Desa</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Pengelompokan Arsip Surat per Klasifikasi
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Seluruh permohonan surat dikelompokkan secara otomatis berdasarkan jenis (SKU, Nikah KUA, SKTM, SKCK, Beda Nama, Kehilangan, dll.) dengan sistem penomoran berstandar Permendagri yang me-reset setiap awal bulan.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportFilteredCsv}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center space-x-2 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
              title="Unduh rekap berkas surat terpilih dalam format spreadsheet CSV"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Rekap CSV</span>
            </button>
            <button
              onClick={() => {
                const data = filteredRequests.map(r => [
                  r.trackingCode,
                  r.serviceName,
                  r.officialLetterNumber || '-',
                  r.citizenName,
                  r.status
                ]);
                generateReportPDF('Buku Arsip Surat', ['Kode', 'Layanan', 'No. Surat', 'Pemohon', 'Status'], data, villageProfile);
                addToast('success', 'PDF Dicetak', 'Buku arsip surat resmi PDF berhasil diunduh.');
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center space-x-2 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Cetak PDF</span>
            </button>

            {/* View Mode Toggle */}
            <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700 flex items-center flex-wrap gap-1">
              <button
                onClick={() => setViewMode('folders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'folders'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Mode Folder Arsip</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'table'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Daftar Tabel</span>
              </button>
              <button
                onClick={() => setViewMode('deleted_logs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 cursor-pointer flex items-center space-x-1.5 ${
                  viewMode === 'deleted_logs'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Log Surat Dihapus</span>
                {deletedRequests.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      viewMode === 'deleted_logs' ? 'bg-white text-rose-800' : 'bg-rose-600 text-white'
                    }`}
                  >
                    {deletedRequests.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Summary Badges Protected by relative z-10 */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-medium">Total Berkas Masuk</span>
            <strong className="text-xl font-black text-white">{requests.length}</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">Semua jenis surat</span>
          </div>
          <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
            <span className="text-[11px] text-emerald-300 block font-medium">Surat Resmi Diterbitkan</span>
            <strong className="text-xl font-black text-emerald-400">
              {requests.filter((r) => r.status === 'selesai' || r.status === 'disetujui').length}
            </strong>
            <span className="text-[10px] text-emerald-300/80 block mt-0.5">Telah bernomor & ber-QR</span>
          </div>
          <div className="bg-amber-500/10 rounded-2xl p-3 border border-amber-500/20">
            <span className="text-[11px] text-amber-300 block font-medium">Sedang Diproses</span>
            <strong className="text-xl font-black text-amber-400">
              {requests.filter((r) => r.status === 'diajukan' || r.status === 'diverifikasi' || r.status === 'diproses').length}
            </strong>
            <span className="text-[10px] text-amber-300/80 block mt-0.5">Antrean operator</span>
          </div>
          <div className="bg-blue-500/10 rounded-2xl p-3 border border-blue-500/20">
            <span className="text-[11px] text-blue-300 block font-medium">Jenis Klasifikasi Aktif</span>
            <strong className="text-xl font-black text-blue-400">{Object.keys(groupedArchives).length}</strong>
            <span className="text-[10px] text-blue-300/80 block mt-0.5">Kelompok berkas</span>
          </div>
          <div
            onClick={() => setViewMode('deleted_logs')}
            className={`rounded-2xl p-3 border cursor-pointer transition-all duration-200 ${
              viewMode === 'deleted_logs'
                ? 'bg-rose-500/20 border-rose-400/60 ring-2 ring-rose-500/30'
                : 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15'
            }`}
            title="Klik untuk membuka tabel log surat yang dihapus"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-rose-300 block font-medium">Log Surat Dihapus</span>
              <span className="text-[10px] text-rose-400 underline">Buka</span>
            </div>
            <strong className="text-xl font-black text-rose-400">{deletedRequests.length}</strong>
            <span className="text-[10px] text-rose-300/80 block mt-0.5">Audit trail & pulihkan</span>
          </div>
        </div>
      </div>

      {/* VIEW MODE CONDITIONAL: LOG SURAT DIHAPUS vs ARSIP AKTIF */}
      {viewMode === 'deleted_logs' ? (
        <DeletedLettersLogTable onBackToArchives={() => setViewMode('folders')} />
      ) : (
        <>
          {/* Filter and Control Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Row 1: Search & Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama pemohon, NIK, kode resi (REQ-PB), atau nomor surat resmi..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-slate-50 focus:bg-white"
            />
          </div>

          {/* Month Filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="all">Semua Periode Bulan</option>
                {availableMonths.map(([ym, label]) => (
                  <option key={ym} value={ym}>
                    Periode: {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                <option value="all">Semua Status Berkas</option>
                <option value="selesai_valid">Hanya Selesai / Disetujui (Arsip Sah)</option>
                <option value="proses">Dalam Proses Antrean</option>
                <option value="diajukan">1. Diajukan</option>
                <option value="diverifikasi">2. Diverifikasi</option>
                <option value="diproses">3. Diproses</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 2: Pills for Letter Types */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 flex-nowrap">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedTypeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>Semua Jenis Surat</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedTypeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}
              >
                {requests.length}
              </span>
            </button>

            {letterTypes.map((t) => {
              const isActive = selectedTypeFilter === t.label;
              return (
                <button
                  key={t.label}
                  onClick={() => setSelectedTypeFilter(t.label)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-75">{t.code}</span>
                  <span>{t.label}</span>
                  {t.pendingCount > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                      title={`${t.pendingCount} berkas perlu diproses`}
                    />
                  )}
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {viewMode === 'folders' && (
            <div className="flex items-center gap-1.5 shrink-0 text-xs">
              <button
                onClick={expandAllFolders}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-[11px] font-bold transition-colors"
                title="Buka semua folder arsip sekaligus"
              >
                Buka Semua
              </button>
              <span className="text-slate-300">•</span>
              <button
                onClick={collapseAllFolders}
                className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-[11px] font-bold transition-colors"
                title="Tutup semua folder arsip (tampilan ringkas)"
              >
                Tutup Semua
              </button>
            </div>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: FOLDER ARSIP TERKELOMPOK (SMART ACCORDION) */}
      {viewMode === 'folders' && (
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 space-y-2">
              <Folder className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-800">Tidak ada arsip berkas yang cocok dengan filter.</p>
              <p className="text-xs text-slate-400">Silakan ubah pencarian atau filter jenis surat / periode.</p>
            </div>
          ) : (
            filteredGroups.map((group, groupIdx) => {
              const isExpanded = !!expandedFolders[group.label];
              const hasActiveQueue = group.pendingCount > 0;
              return (
                <div
                  key={group.label}
                  className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-xs ${
                    hasActiveQueue
                      ? 'border-amber-200/80 hover:border-amber-300'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(group.label)}
                    className={`p-5 cursor-pointer select-none transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isExpanded ? 'bg-slate-50' : 'bg-slate-50/50 hover:bg-slate-50/90'
                    }`}
                  >
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                          hasActiveQueue
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isExpanded ? (
                          <FolderOpen className="w-5 h-5" />
                        ) : (
                          <Folder className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-mono text-[10px] font-extrabold uppercase">
                            Kode {group.code}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold text-[10px] uppercase tracking-wide">
                            {group.label}
                          </span>
                          {hasActiveQueue ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px] uppercase tracking-wide border border-amber-300 flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-700" />
                              <span>{group.pendingCount} Perlu Proses</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200/60 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Semua Terbit</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-500 hidden sm:inline">
                            • {group.categoryName}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">
                          {group.title}
                        </h3>
                      </div>
                    </div>

                    {/* Right side stats & toggle */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold">
                          {group.items.length} Berkas
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{group.completedCount} Terbit</span>
                        </span>
                        {group.pendingCount > 0 && (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>{group.pendingCount} Proses</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label="Toggle folder"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-700" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Folder Items Body: Smooth Accordion Animation */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key={`folder-body-${group.label}`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.04, 0.62, 0.23, 0.98] }}
                        className="overflow-hidden"
                      >
                        <div className="p-0 sm:p-2 border-t border-slate-100">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50/90 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                  <th className="p-3 pl-4">No. Agenda Resmi</th>
                                  <th className="p-3">Pemohon & NIK</th>
                                  <th className="p-3">Wilayah / Dusun</th>
                                  <th className="p-3">Tgl Pengajuan</th>
                                  <th className="p-3">Status Berkas</th>
                                  <th className="p-3">Keperluan / Keterangan</th>
                                  <th className="p-3 pr-4 text-right">Aksi Dokumen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {group.items.map((req, idx) => (
                                  <tr
                                    key={req.id}
                                    className={`transition-colors group ${
                                      ['ditolak', 'dibatalkan', 'rejected', 'cancelled', 'batal'].some((k) =>
                                        (req.status || '').toLowerCase().includes(k)
                                      )
                                        ? 'bg-orange-50/90 hover:bg-orange-100/90 border-l-4 border-l-orange-500'
                                        : 'hover:bg-slate-50/90'
                                    }`}
                                  >
                                    <td className="p-3 pl-4">
                                      <div className="font-mono text-xs font-bold text-slate-900">
                                        {req.trackingCode}
                                      </div>
                                      {req.officialLetterNumber ? (
                                        <div className="font-mono text-[10px] text-emerald-800 font-bold mt-0.5 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span>{req.officialLetterNumber}</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">
                                          Nomor terbit saat disetujui
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <strong className="text-slate-900 block">{req.citizenName}</strong>
                                      <span className="font-mono text-[10px] text-slate-400">
                                        {req.citizenNikMasked}
                                      </span>
                                      {req.ktpAttachmentUrl && (
                                        <a
                                          href={req.ktpAttachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-0.5 hover:bg-emerald-100"
                                          title="Buka Berkas KTP Pemohon"
                                        >
                                          <FileText className="w-2.5 h-2.5 text-emerald-600" />
                                          <span>KTP Terlampir</span>
                                          <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                                        </a>
                                      )}
                                    </td>
                                    <td className="p-3 text-slate-600">{req.addressDusun}</td>
                                    <td className="p-3 text-slate-500 whitespace-nowrap">
                                      {req.requestDate}
                                      {req.completedAt && (
                                        <div className="text-[10px] text-emerald-700">
                                          Selesai: {req.completedAt}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <ServiceStatusBadge status={req.status} />
                                    </td>
                                    <td className="p-3 max-w-[200px]">
                                      <p className="text-slate-600 truncate text-[11px]" title={req.notes || '-'}>
                                        {req.notes || '-'}
                                      </p>
                                    </td>
                                    <td className="p-3 pr-4 text-right whitespace-nowrap space-x-1">
                                      {/* Print / Preview */}
                                      <button
                                        onClick={() => onPreviewLetter(req)}
                                        title="Pratinjau & Cetak Lembar Surat Resmi (A4)"
                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors inline-flex items-center"
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                      </button>

                                      {/* WhatsApp Notification */}
                                      {req.phone && (
                                        <button
                                          onClick={() => onSendWhatsApp(req)}
                                          title="Kirim Notifikasi WhatsApp ke Warga"
                                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition-colors inline-flex items-center"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5" />
                                        </button>
                                      )}

                                      {/* Update Status */}
                                      <button
                                        onClick={() => onSelectRequest(req)}
                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-colors"
                                      >
                                        Update
                                      </button>

                                      {/* Hapus Berkas Uji Coba */}
                                      {onDeleteRequest && (
                                        <button
                                          type="button"
                                          onClick={() => setDeleteCandidate(req)}
                                          title="Hapus Berkas / Data Uji Coba"
                                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors inline-flex items-center"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: TABEL TUNGGAL TERPADU */}
      {viewMode === 'table' && (
        <ArchiveTableContainer
          requests={requests}
          onSelectRequest={onSelectRequest}
          onPreviewLetter={onPreviewLetter}
          onSendWhatsApp={onSendWhatsApp}
          onDeleteRequest={onDeleteRequest}
          onBulkDeleteRequest={onBulkDeleteRequest}
        />
      )}
        </>
      )}
      {/* Legal Reference & Regulatory Basis Box */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-emerald-400">
          <BookOpen className="w-5 h-5" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Matriks Validasi Dasar Hukum Administrasi & Tata Naskah Dinas Desa
          </h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Sistem kearsipan dan penomoran surat Desa Pulau Betung disusun dengan pemilahan yuridis yang jelas sesuai hierarki perundang-undangan Republik Indonesia:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-emerald-300">A. Tata Naskah Dinas</span>
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong>Permendagri No. 1 Tahun 2023:</strong> Mengatur standar susunan naskah dinas, bentuk kop surat berlogo daerah, penggunaan paraf hierarki, dan stempel dinas pemerintah daerah.
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-cyan-300">B. Kode Klasifikasi Arsip</span>
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong>Permendagri No. 83 Tahun 2022:</strong> Pedoman penyusunan kode klasifikasi arsip kependudukan (470), perekonomian (500), ketertiban (330), dan kesra (400).
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-amber-300">C. Administrasi Pemerintahan Desa</span>
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong>Permendagri No. 47 Tahun 2016:</strong> Penyelenggaraan buku register umum, buku ekspedisi, buku agenda surat masuk/keluar, dan register kependudukan desa.
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
            <span className="font-bold text-rose-300">D. Perlindungan Data Pribadi</span>
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong>UU No. 27 Tahun 2022:</strong> Kewajiban redaksi/masking NIK publik, pembatasan hak akses lampiran berkas sensitif KTP/KK, dan integritas basis data warga.
            </p>
          </div>

          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1 md:col-span-2 lg:col-span-2">
            <span className="font-bold text-purple-300">E. Ketentuan Pemerintah Kabupaten Batang Hari</span>
            <p className="text-[11px] text-slate-300 leading-normal">
              <strong>Regulasi Daerah Kab. Batang Hari & Kec. Pemayung:</strong> Format penamaan nomenklatur jabatan Kepala Desa, lambang daerah Kabupaten Batang Hari pada kop surat dinas, serta prosedur operasional standar (SOP) pengantar pelayanan kecamatan.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Data Permohonan / Uji Coba */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-700">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-700" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Hapus Berkas / Data Uji Coba</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Apakah Anda yakin ingin memproses penghapusan berkas pengajuan ini?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 font-mono text-[11px]">
                <div><span className="text-slate-400 font-sans">Kode Resi:</span> <strong className="text-slate-900">{deleteCandidate.trackingCode}</strong></div>
                <div><span className="text-slate-400 font-sans">Jenis Surat:</span> <span className="text-slate-800 font-sans">{deleteCandidate.serviceName}</span></div>
                <div><span className="text-slate-400 font-sans">Pemohon:</span> <span className="text-slate-800 font-sans">{deleteCandidate.citizenName}</span></div>
                {deleteCandidate.officialLetterNumber && (
                  <div><span className="text-slate-400 font-sans">No. Surat:</span> <span className="text-emerald-800">{deleteCandidate.officialLetterNumber}</span></div>
                )}
              </div>

              {/* Alasan Penghapusan Dropdown & Input */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-800 block text-[11px]">
                  Alasan Penghapusan (Wajib Dicatat ke Log):
                </label>
                <select
                  value={deletionReasonOption}
                  onChange={(e) => setDeletionReasonOption(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="Data Uji Coba / Testing Sistem">Data Uji Coba / Testing Sistem</option>
                  <option value="Dibatalkan oleh Pemohon">Dibatalkan oleh Pemohon</option>
                  <option value="Pengajuan Ganda / Duplikat">Pengajuan Ganda / Duplikat</option>
                  <option value="Salah Input / Koreksi Data">Salah Input / Koreksi Data</option>
                  <option value="Lainnya">Lainnya (Ketik Alasan)</option>
                </select>

                {deletionReasonOption === 'Lainnya' && (
                  <input
                    type="text"
                    value={customDeletionReason}
                    onChange={(e) => setCustomDeletionReason(e.target.value)}
                    placeholder="Tuliskan keterangan spesifik alasan penghapusan..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs mt-1 bg-white text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                )}
              </div>

              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                  <span>Keamanan & Audit Terjamin</span>
                </div>
                <p className="text-[10px] leading-relaxed text-rose-700">
                  Data ini akan dipindahkan ke <strong>Tabel Log Surat Terhapus</strong> beserta identitas akun Anda, waktu, dan alasan. Anda dapat memulihkannya kembali sewaktu-waktu.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteRequest) {
                    const finalReason =
                      deletionReasonOption === 'Lainnya'
                        ? (customDeletionReason.trim() || 'Alasan Lainnya')
                        : deletionReasonOption;
                    onDeleteRequest(deleteCandidate.id, finalReason);
                    addToast('info', 'Data Dipindahkan ke Log', `Berkas ${deleteCandidate.trackingCode} telah dicatat ke Buku Kendali & Log Surat Terhapus.`);
                    setDeleteCandidate(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus & Catat ke Log</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
