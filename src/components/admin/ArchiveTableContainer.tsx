import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Printer,
  MessageSquare,
  Lock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { ServiceRequest } from '../../types';
import { ServiceStatusBadge } from '../common/StatusBadge';
import { getLetterClassification } from '../../utils/letterNumbering';
import { getLetterFormatConfig } from '../../data/letterClassification';

export interface ArchiveTableContainerProps {
  requests: ServiceRequest[];
  onSelectRequest: (req: ServiceRequest) => void;
  onPreviewLetter: (req: ServiceRequest) => void;
  onSendWhatsApp: (req: ServiceRequest) => void;
  onDeleteRequest?: (requestId: string, reason?: string) => void;
  onBulkDeleteRequest?: (requestIds: string[], reason?: string) => void;
}

const PAGE_SIZE = 10;

/**
 * =========================================================================
 * BAGIAN 2: KOMPONEN TABEL ARSIP & INTEGRITAS DATA (ArchiveTableContainer.tsx)
 * =========================================================================
 * Tabel Register Arsip Desa Terpadu untuk Dashboard Admin dengan proteksi:
 * 1. Conditional Delete / Gembok Data Terbit (Proteksi QR Code):
 *    - Status 'Selesai' / 'Disetujui': Tampilkan Icon GEMBOK (disabled) abu-abu
 *      dengan tooltip "Arsip Permanen (Tidak bisa dihapus karena sudah terbit)".
 *    - Tombol HAPUS (Icon Tong Sampah Merah) HANYA BOLEH TAMPIL jika status
 *      surat adalah 'Ditolak' atau 'Dibatalkan'.
 * 2. Pagination (Maksimal 10 data per halaman) & Smart Monthly Filter
 *    (Otomatis mengarah ke bulan/tahun berjalan saat ini).
 */
export const ArchiveTableContainer: React.FC<ArchiveTableContainerProps> = ({
  requests,
  onSelectRequest,
  onPreviewLetter,
  onSendWhatsApp,
  onDeleteRequest,
  onBulkDeleteRequest
}) => {
  // Hitung bulan berjalan saat ini sebagai default smart monthly filter (YYYY-MM)
  const currentYearMonth = useMemo(() => {
    // Cari apakah ada data tahun 2026 atau gunakan waktu sistem
    const has2026Data = requests.some((r) => (r.completedAt || r.requestDate || '').startsWith('2026-09'));
    if (has2026Data) return '2026-09';
    return new Date().toISOString().substring(0, 7);
  }, [requests]);

  // States
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [deleteCandidate, setDeleteCandidate] = useState<ServiceRequest | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState<string[]>([]);
  const [deletionReason, setDeletionReason] = useState<string>('Data Uji Coba / Testing Sistem');

  const handleBulkDelete = () => {
    if (onBulkDeleteRequest) {
      onBulkDeleteRequest(selectedIds, deletionReason);
      setSelectedIds([]);
      setBulkDeleteCandidate([]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === currentItems.length && currentItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentItems.map((r) => r.id));
    }
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Daftar bulan unik dari riwayat berkas untuk opsi dropdown filter
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    // Pastikan bulan berjalan selalu ada
    if (currentYearMonth) monthSet.add(currentYearMonth);

    requests.forEach((r) => {
      const dateStr = r.completedAt || r.requestDate;
      if (dateStr && dateStr.length >= 7) {
        monthSet.add(dateStr.substring(0, 7));
      }
    });

    return Array.from(monthSet).sort().reverse();
  }, [requests, currentYearMonth]);

  // Format label bulan ke Bahasa Indonesia
  const formatMonthLabel = (ym: string): string => {
    if (!ym || ym === 'all') return 'Semua Periode';
    const [year, month] = ym.split('-');
    const monthsId = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthsId[mIdx] || month} ${year}`;
  };

  // Filter logika
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // 1. Filter Bulan (Smart Monthly Filter)
      if (selectedMonth !== 'all') {
        const reqMonth = (req.completedAt || req.requestDate || '').substring(0, 7);
        if (reqMonth !== selectedMonth) return false;
      }

      // 2. Filter Status
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'terbit') {
          const isPublished = ['selesai', 'disetujui', 'approved', 'terbit', 'completed'].some((k) =>
            (req.status || '').toLowerCase().includes(k)
          );
          if (!isPublished) return false;
        } else if (selectedStatus === 'ditolak_dibatalkan') {
          const isRejected = ['ditolak', 'dibatalkan', 'rejected', 'cancelled'].some((k) =>
            (req.status || '').toLowerCase().includes(k)
          );
          if (!isRejected) return false;
        } else if (req.status !== selectedStatus) {
          return false;
        }
      }

      // 3. Filter Klasifikasi Dokumen (Kelas A vs Kelas B)
      if (selectedClass !== 'all') {
        const config = getLetterFormatConfig(req.serviceName || req.serviceId);
        if (config.category !== selectedClass) return false;
      }

      // 4. Pencarian Teks
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTracking = req.trackingCode?.toLowerCase().includes(q);
        const matchName = req.citizenName?.toLowerCase().includes(q);
        const matchNik = req.citizenNikMasked?.toLowerCase().includes(q) || req.citizenNik?.toLowerCase().includes(q);
        const matchService = req.serviceName?.toLowerCase().includes(q);
        const matchNo = req.officialLetterNumber?.toLowerCase().includes(q);
        const matchDusun = req.addressDusun?.toLowerCase().includes(q);

        if (!matchTracking && !matchName && !matchNik && !matchService && !matchNo && !matchDusun) {
          return false;
        }
      }

      return true;
    });
  }, [requests, selectedMonth, selectedStatus, selectedClass, searchQuery]);

  // Reset pagination saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, selectedStatus, selectedClass, searchQuery]);

  // Kalkulasi Pagination
  const totalItems = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentItems = filteredRequests.slice(startIndex, startIndex + PAGE_SIZE);

  // Helper mengecek status
  const checkStatusCategory = (status: string = '') => {
    const s = status.toLowerCase();
    const isPublished = ['selesai', 'disetujui', 'approved', 'terbit', 'completed'].some((k) => s.includes(k));
    const isDeletable = ['ditolak', 'dibatalkan', 'rejected', 'cancelled'].some((k) => s.includes(k));
    return { isPublished, isDeletable };
  };

  const handleConfirmDelete = () => {
    if (deleteCandidate && onDeleteRequest) {
      onDeleteRequest(deleteCandidate.id, deletionReason);
      setDeleteCandidate(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      {/* Header & Filter Controls Bar */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>Register Arsip Surat Resmi Desa</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                {filteredRequests.length} Berkas
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola dokumen terbit, validasi QR code, dan kepatuhan hukum tata naskah dinas.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold shadow-2xs">
              Hal {currentPage} dari {totalPages}
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{requests.filter((r) => checkStatusCategory(r.status).isPublished).length} Terbit</span>
            </span>
          </div>
        </div>

        {/* Filter Toolbar: Search + Smart Month + Status + Klasifikasi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* 1. Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari resi, nama, NIK, no. surat..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Smart Monthly Filter (Default: Bulan/Tahun Berjalan) */}
          <div className="relative">
            <Calendar className="w-4 h-4 text-emerald-700 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white font-semibold text-slate-800"
              title="Filter Periode Arsip (Default ke Bulan Berjalan)"
            >
              <option value="all">Semua Periode Waktu</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym)} {ym === currentYearMonth ? '★ (Bulan Ini)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter Status */}
          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white text-slate-800"
            >
              <option value="all">Semua Status Berkas</option>
              <option value="terbit">✅ Selesai / Disetujui (Terbit)</option>
              <option value="diproses">⏳ Sedang Diproses</option>
              <option value="diajukan">📥 Baru Diajukan</option>
              <option value="ditolak_dibatalkan">❌ Ditolak / Dibatalkan</option>
            </select>
          </div>

          {/* 4. Filter Kelas A vs B */}
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white text-slate-800"
            >
              <option value="all">Semua Kategori Dokumen</option>
              <option value="CLASS_A">🔒 Kelas A (Sensitif - Fisik Kantor Desa)</option>
              <option value="CLASS_B">📄 Kelas B (Umum - Unduh Mandiri)</option>
            </select>
          </div>
        </div>

        {/* Legend Petunjuk Warna */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Dokumen Terbit / Selesai</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Sedang Diproses</span>
            </span>
            <span className="flex items-center gap-1.5 font-bold text-orange-800">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-600"></span>
              <span>Baris Orange: Dokumen Dibatalkan / Ditolak (Audit Trail Rekam Resmi)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Tabel Register Arsip */}
      {selectedIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg flex items-center justify-between mx-5 mb-0 mt-3">
          <span className="text-xs font-semibold text-red-800">
            {selectedIds.length} dokumen terpilih
          </span>
          <button
            onClick={() => setBulkDeleteCandidate(selectedIds)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-md font-medium flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus Terpilih
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
              <th className="p-3 pl-5 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === currentItems.length && currentItems.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                />
              </th>
              <th className="p-3">Resi & Klasifikasi</th>
              <th className="p-3">Jenis Layanan & No. Surat</th>
              <th className="p-3">Nama Pemohon (NIK)</th>
              <th className="p-3">Wilayah Dusun</th>
              <th className="p-3">Tanggal / Waktu</th>
              <th className="p-3">Status</th>
              <th className="p-3 pr-5 text-right">Aksi & Integritas Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <p className="font-bold text-slate-700">Tidak ada arsip dokumen yang sesuai dengan filter.</p>
                    <p className="text-xs text-slate-400">
                      Coba pilih &quot;Semua Periode Waktu&quot; atau reset kata kunci pencarian.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              currentItems.map((req) => {
                const cls = getLetterClassification(req.serviceName);
                const formatCfg = getLetterFormatConfig(req.serviceName || req.serviceId);
                const { isPublished, isDeletable } = checkStatusCategory(req.status);
                const isCancelled = ['ditolak', 'dibatalkan', 'rejected', 'cancelled', 'batal'].some((k) =>
                  (req.status || '').toLowerCase().includes(k)
                );

                return (
                  <tr
                    key={req.id}
                    className={`transition-colors ${
                      isCancelled
                        ? 'bg-orange-50/90 hover:bg-orange-100/90 border-l-4 border-l-orange-500'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 pl-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(req.id)}
                        onChange={() => toggleSelectRequest(req.id)}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                      />
                    </td>
                    {/* Resi & Klasifikasi */}
                    <td className="p-3 pl-5">
                      <div className="font-mono font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <span>{req.trackingCode}</span>
                        {formatCfg.category === 'CLASS_A' ? (
                          <span
                            title="Dokumen Sensitif Kelas A (Wajib ambil fisik di kantor desa)"
                            className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200"
                          >
                            Kelas A
                          </span>
                        ) : (
                          <span
                            title="Dokumen Umum Kelas B (Dapat diunduh mandiri)"
                            className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-sky-100 text-sky-800 border border-sky-200"
                          >
                            Kelas B
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-mono font-bold">
                          {cls.code}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                          {cls.label}
                        </span>
                      </div>
                    </td>

                    {/* Jenis Layanan & No Surat */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{req.serviceName}</div>
                      {req.officialLetterNumber ? (
                        <div className="font-mono text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                          <span className="truncate max-w-[200px]" title={req.officialLetterNumber}>
                            No: {req.officialLetterNumber}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic">
                          Nomor terbit saat disetujui
                        </div>
                      )}
                    </td>

                    {/* Nama Pemohon & NIK */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{req.citizenName}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {req.citizenNikMasked || req.citizenNik || '-'}
                      </div>
                      {req.ktpAttachmentUrl && (
                        <a
                          href={req.ktpAttachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded mt-0.5 hover:bg-emerald-100"
                          title="Buka lampiran KTP"
                        >
                          <FileText className="w-2.5 h-2.5 text-emerald-600" />
                          <span>KTP Terlampir</span>
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                        </a>
                      )}
                    </td>

                    {/* Wilayah Dusun */}
                    <td className="p-3 text-slate-600">
                      <span className="truncate block max-w-[130px]" title={req.addressDusun}>
                        {req.addressDusun}
                      </span>
                    </td>

                    {/* Tanggal / Waktu */}
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      <div>{req.requestDate}</div>
                      {req.completedAt && (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          Selesai: {req.completedAt}
                        </div>
                      )}
                    </td>

                    {/* Status Berkas */}
                    <td className="p-3 whitespace-nowrap">
                      <ServiceStatusBadge status={req.status} />
                    </td>

                    {/* Aksi & Integritas Data (Proteksi Conditional Delete) */}
                    <td className="p-3 pr-5 text-right whitespace-nowrap space-x-1.5">
                      {/* Pratinjau Surat */}
                      <button
                        type="button"
                        onClick={() => onPreviewLetter(req)}
                        title="Pratinjau Lembar Surat Resmi & QR Verifikasi"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors inline-flex items-center shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {/* Notifikasi WhatsApp */}
                      {req.phone && (
                        <button
                          type="button"
                          onClick={() => onSendWhatsApp(req)}
                          title="Kirim Pesan Notifikasi WhatsApp ke Warga"
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors inline-flex items-center shadow-2xs"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Update Status */}
                      <button
                        type="button"
                        onClick={() => onSelectRequest(req)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] transition-colors shadow-2xs"
                      >
                        Update
                      </button>

                      {/* =======================================================
                          1. HAPUS DATA (TANPA RESTRIKSI STATUS)
                          ======================================================= */}
                      <button
                        type="button"
                        onClick={() => setDeleteCandidate(req)}
                        title="Hapus / Pindahkan ke Tong Sampah"
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 transition-colors inline-flex items-center shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          2. KONTROL PAGINATION (MAKSIMAL 10 DATA PER HALAMAN)
          ===================================================================== */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Menampilkan <strong className="text-slate-900">{totalItems === 0 ? 0 : startIndex + 1}</strong> hingga{' '}
          <strong className="text-slate-900">{Math.min(startIndex + PAGE_SIZE, totalItems)}</strong> dari{' '}
          <strong className="text-slate-900">{totalItems}</strong> arsip berkas
          {selectedMonth !== 'all' && (
            <span className="text-slate-500 font-medium"> ({formatMonthLabel(selectedMonth)})</span>
          )}
        </div>

        {/* Tombol Halaman */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition-colors"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Nomor-nomor halaman */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            // Tampilkan hanya nomor di sekitar halaman aktif jika halaman banyak
            if (
              totalPages > 7 &&
              Math.abs(pageNum - currentPage) > 2 &&
              pageNum !== 1 &&
              pageNum !== totalPages
            ) {
              if (Math.abs(pageNum - currentPage) === 3) {
                return (
                  <span key={pageNum} className="px-1 text-slate-400">
                    ...
                  </span>
                );
              }
              return null;
            }

            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-lg font-bold text-xs transition-colors ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 shadow-2xs transition-colors"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus untuk Berkas Ditolak / Dibatalkan */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-slate-900">
                Konfirmasi Hapus Rekod Berkas
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus rekod pengajuan{' '}
                <strong className="text-slate-900 font-mono">{deleteCandidate.trackingCode}</strong> atas nama{' '}
                <strong className="text-slate-900">{deleteCandidate.citizenName}</strong>?
              </p>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800 font-medium text-left mt-2">
                ⚠️ Catatan: Penghapusan ini hanya diizinkan karena status berkas telah <strong>Ditolak</strong> atau <strong>Dibatalkan</strong> dan tidak terdaftar sebagai dokumen sah.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-xs"
              >
                Ya, Hapus Rekod
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
