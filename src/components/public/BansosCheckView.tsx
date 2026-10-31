import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { BansosProgramType, BansosRecipient } from '../../types/bansos';
import { BANSOS_PROGRAM_LIST } from '../../data/bansosData';
import { useKpmData } from '../../hooks/useKpmData';
import { BansosReceiptModal } from './BansosReceiptModal';
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  Download,
  Share2,
  Users,
  Coins,
  Package,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  Send,
  UploadCloud,
  Eye,
  AlertTriangle,
  Info,
  Loader2,
  ChevronDown,
  Printer,
  Lock,
  MessageCircle,
  ClipboardList,
  ArrowRight
} from 'lucide-react';

export const BansosCheckView: React.FC = () => {
  const {
    territories,
    villageProfile,
    submitBansosComplaint,
    addToast,
    currentUser,
    navigateTo
  } = useApp();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDusun, setSelectedDusun] = useState<string>('all');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [isQrVerified, setIsQrVerified] = useState(false);
  const [selectedRecipientForReceipt, setSelectedRecipientForReceipt] = useState<BansosRecipient | null>(null);

  // Auto-search if navigated from QR scan (e.g. ?tab=bansos&nik=1504...&verify=true)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const nikParam = searchParams.get('nik') || searchParams.get('bansos_nik') || searchParams.get('q') || searchParams.get('search');
      const verifyParam = searchParams.get('verify');
      
      if (nikParam) {
        setSearchQuery(nikParam);
        setHasSearched(true);
        if (verifyParam === 'true' || verifyParam === '1') {
          setIsQrVerified(true);
        }
      }
    }
  }, []);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'cek_nik' | 'statistik' | 'informasi_program'>('cek_nik');

  // Modal Sanggahan / Usulan State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'usulan_baru' | 'sanggahan_tidak_layak'>('usulan_baru');
  const [formData, setFormData] = useState({
    namaPelapor: '',
    nikPelapor: '',
    phonePelapor: '',
    dusun: 'Dusun I Betung Jaya',
    rt: '01',
    targetNikOrName: '',
    programTarget: 'BLT_DD' as BansosProgramType | 'SEMUA',
    alasan: '',
    fotoKondisiRumahUrl: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetching via TanStack Query (Audit: Server-side filtering)
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading, 
    isError 
  } = useKpmData({
    programType: selectedProgram === 'all' ? '' : selectedProgram,
  });

  const flatData = useMemo(() => 
    data?.pages.flatMap(page => page.data) ?? [], 
  [data]);

  const isSearchActive = hasSearched || searchQuery.trim().length >= 3 || isQrVerified;

  // Filtered Recipients - strictly restricted to on-demand search to protect privacy (UU PDP)
  const filteredRecipients = useMemo(() => {
    if (!isSearchActive) return [];

    const q = searchQuery.trim().toLowerCase();
    return flatData.filter(item => {
      const matchQuery = !q ? true : (
        (item.nik && item.nik.toLowerCase().includes(q)) ||
        (item.nikMasked && item.nikMasked.toLowerCase().includes(q)) || 
        (item.noKk && item.noKk.toLowerCase().includes(q)) ||
        (item.noKkMasked && item.noKkMasked.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.nameMasked && item.nameMasked.toLowerCase().includes(q))
      );

      const matchDusun = selectedDusun === 'all' || item.dusun.toLowerCase().includes(selectedDusun.toLowerCase());
      const matchProgram = selectedProgram === 'all' || item.programType === selectedProgram;

      return matchQuery && matchDusun && matchProgram;
    });
  }, [flatData, searchQuery, selectedDusun, selectedProgram, isSearchActive]);

  // Statistics Calculation (Based on fetched data - ideally should be a separate aggregate query for full accuracy)
  const stats = useMemo(() => {
    const total = flatData.length;
    const bltCount = flatData.filter(r => r.programType === 'BLT_DD').length;
    const pkhCount = flatData.filter(r => r.programType === 'PKH').length;
    const bpntCount = flatData.filter(r => r.programType === 'BPNT').length;
    const berasCount = flatData.filter(r => r.programType === 'BERAS_CPP').length;
    const kisCount = flatData.filter(r => r.programType === 'KIS_PBI').length;

    const tersalurkanCount = flatData.filter(r => r.status === 'tersalurkan').length;
    const siapDiambilCount = flatData.filter(r => r.status === 'siap_diambil').length;

    return {
      total,
      bltCount,
      pkhCount,
      bpntCount,
      berasCount,
      kisCount,
      tersalurkanCount,
      siapDiambilCount
    };
  }, [flatData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && selectedDusun === 'all' && selectedProgram === 'all') {
      addToast('info', 'Masukkan Kata Kunci', 'Ketikkan NIK 16 digit atau Nomor Kartu Keluarga untuk memeriksa status bantuan Anda.');
      return;
    }
    setHasSearched(true);
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setSelectedDusun('all');
    setSelectedProgram('all');
    setHasSearched(false);
    setIsQrVerified(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.namaPelapor || !formData.nikPelapor || !formData.alasan) {
      addToast('error', 'Form Belum Lengkap', 'Mohon lengkapi nama, NIK, dan alasan usulan/sanggahan.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitBansosComplaint({
        type: modalType,
        namaPelapor: formData.namaPelapor,
        nikPelapor: formData.nikPelapor,
        phonePelapor: formData.phonePelapor || '-',
        dusun: formData.dusun,
        rt: formData.rt,
        targetNikOrName: formData.targetNikOrName,
        programTarget: formData.programTarget,
        alasan: formData.alasan,
        fotoKondisiRumahUrl: formData.fotoKondisiRumahUrl
      });

      addToast('success', 'Usulan Berhasil Dikirim', 'Data usulan warga berhasil didaftarkan untuk agenda Musdesus berikutnya.');
      setIsModalOpen(false);
      setFormData({
        namaPelapor: '',
        nikPelapor: '',
        phonePelapor: '',
        dusun: 'Dusun I Betung Jaya',
        rt: '01',
        targetNikOrName: '',
        programTarget: 'BLT_DD',
        alasan: '',
        fotoKondisiRumahUrl: ''
      });
    } catch (err: any) {
      addToast('error', 'Gagal Mengirim', err.message || 'Terjadi kesalahan pada server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shareViaWhatsApp = (recipient: BansosRecipient) => {
    const text = `*INFORMASI PENYALURAN BANSOS DESA PULAU BETUNG*\n\nNama: ${recipient.nameMasked}\nProgram: ${recipient.programName}\nStatus: ${recipient.status === 'siap_diambil' ? 'SIAP DIAMBIL' : recipient.status === 'tersalurkan' ? 'TELAH TERSALURKAN' : 'PROSES VERIFIKASI'}\nJadwal: ${recipient.distributionDate || 'Menunggu Pengumuman'}\nLokasi: ${recipient.distributionLocation || 'Kantor Desa Pulau Betung'}\n\n_Pastikan membawa KTP & KK Asli saat pengambilan._`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/70 pb-24 text-slate-800 flex flex-col">
      {/* Hero Header Section - Standardized Card Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 mb-8 sm:mb-12">
        <div className="relative bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 lg:p-12 overflow-hidden shadow-xl border border-emerald-800/30">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="relative max-w-5xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] sm:text-xs font-semibold backdrop-blur-sm mx-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sistem Transparansi Bantuan Sosial & KPM Desa</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight font-serif">
              Cek Penerima Bantuan Sosial
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Layanan resmi pengecekan data Keluarga Penerima Manfaat (KPM) BLT Dana Desa, PKH, BPNT, Beras CPP, dan KIS PBI di Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'}.
            </p>

            {/* Quick Metrics Grid - Standardized */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-3xl mx-auto">
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center transition-transform hover:scale-105">
                <div className="text-2xl font-bold text-emerald-400">{stats.total}</div>
                <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Total KPM</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center transition-transform hover:scale-105">
                <div className="text-2xl font-bold text-amber-400">{stats.siapDiambilCount}</div>
                <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Siap Ambil</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center transition-transform hover:scale-105">
                <div className="text-2xl font-bold text-blue-400">{stats.bltCount}</div>
                <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">KPM BLT-DD</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center transition-transform hover:scale-105">
                <div className="text-2xl font-bold text-teal-400">{stats.berasCount}</div>
                <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Penerima Beras</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections - Standardized Flow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12 w-full">
        
        {/* High-Tech Cyber Navigation Tabs */}
        <div className="bg-slate-900/90 dark:bg-slate-950/90 rounded-2xl p-2.5 shadow-2xl border border-emerald-500/30 mb-8 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md ring-1 ring-emerald-500/20">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('cek_nik')}
              className={`px-4 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'cek_nik'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Search className="w-4 h-4 text-emerald-300" />
              <span>Cek NIK / No KK</span>
            </button>
            <button
              onClick={() => setActiveTab('statistik')}
              className={`px-4 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'statistik'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-300" />
              <span>Rekapitulasi Penyaluran</span>
            </button>
            <button
              onClick={() => setActiveTab('informasi_program')}
              className={`px-4 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'informasi_program'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-emerald-300" />
              <span>Informasi Kriteria Bantuan</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalType('usulan_baru');
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer"
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span>Usulkan Warga Baru</span>
            </button>
            <button
              onClick={() => {
                setModalType('sanggahan_tidak_layak');
                setIsModalOpen(true);
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/80 font-bold text-xs flex items-center space-x-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Sanggahan KPM</span>
            </button>
          </div>
        </div>

        {/* TAB 1: CEK NIK / PENCARIAN */}
        <AnimatePresence mode="wait">
          {activeTab === 'cek_nik' && (
            <motion.div
              key="cek_nik"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
            {/* Search Box Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2 font-serif">
                  <Search className="w-5 h-5 text-emerald-700" />
                  <span>Cari Data Penerima Bantuan Sosial</span>
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ketikkan 16 digit NIK, Nomor KK, atau Nama Lengkap Kepala Keluarga untuk mencari riwayat dan jadwal penyaluran bansos Anda.
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Masukkan NIK / No KK / Nama (Contoh: 150401... atau Ahmad Sobri)"
                    className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-slate-50/80 border border-slate-300 text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all shadow-inner"
                  />
                  <Search className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-24 top-3.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 font-medium"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-2 top-2 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center space-x-1.5"
                  >
                    <span>Cari</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Wilayah Dusun</span>
                    </label>
                    <select
                      value={selectedDusun}
                      onChange={(e) => setSelectedDusun(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">Semua Dusun</option>
                      {territories && territories.length > 0 ? (
                        territories.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="Dusun 1">Dusun 1</option>
                          <option value="Dusun 2">Dusun 2</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center space-x-1">
                      <Filter className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Jenis Program Bantuan</span>
                    </label>
                    <select
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">Semua Program Bansos</option>
                      {BANSOS_PROGRAM_LIST.map(p => (
                        <option key={p.type} value={p.type}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Privacy Badge Warning */}
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs flex items-start space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Kepatuhan UU Perlindungan Data Pribadi (PDP):</strong> Sebagian digit NIK dan Nama Kepala Keluarga disamarkan untuk melindungi privasi warga.
                  </p>
                </div>
              </form>
            </div>

            {/* SEARCH RESULTS OR DEFAULT INQUIRY GUIDE */}
            <div className="space-y-6">
              {/* QR Scan Verification Banner if scanned from phone */}
              {isQrVerified && filteredRecipients.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border-2 border-emerald-400 shadow-xl space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-500/30">
                    <div className="flex items-center space-x-2 text-emerald-300 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <span>HASIL SCAN QR RESI BANSOS RESMI</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-xs font-mono font-bold tracking-wider">
                      ✓ DATA DITEMUKAN & TERVERIFIKASI SAH
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Nama Penerima Manfaat (KPM):</span>
                      <h4 className="text-xl sm:text-2xl font-black text-white font-serif tracking-tight">
                        {filteredRecipients[0].name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100/90 pt-1">
                        <span className="font-mono bg-black/30 px-2 py-0.5 rounded border border-white/10">NIK: {filteredRecipients[0].nikMasked}</span>
                        <span>&bull;</span>
                        <span className="font-bold text-amber-300">{filteredRecipients[0].programName}</span>
                        <span>&bull;</span>
                        <span>{filteredRecipients[0].dusun}, RT {filteredRecipients[0].rt}</span>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                      Status: Terverifikasi Sah
                    </div>
                  </div>

                  <p className="text-xs text-emerald-100/80 leading-relaxed">
                    Data di atas sesuai dengan arsip Surat Perintah Penyaluran Bansos TA 2026 Pemerintah Desa Pulau Betung.
                  </p>
                </motion.div>
              )}

              {/* Notice for Village Officials if logged in */}
              {currentUser && (
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-900">
                        Akses Aparatur Desa Terdeteksi ({currentUser.name})
                      </div>
                      <div className="text-[11px] text-indigo-700">
                        Halaman publik dibatasi untuk menjaga privasi warga. Untuk mengelola data KPM, mencetak BAST, atau ekspor laporan, silakan buka Dashboard Admin.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => navigateTo('admin_bansos')}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0 transition-colors shadow-xs flex items-center space-x-1.5"
                  >
                    <span>Panel Admin Bansos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* CASE 1: USER HAS NOT PERFORMED A SEARCH (PANDUAN & TRANSPARANSI AGREGAT) */}
              {!isSearchActive ? (
                <div className="space-y-6">
                  {/* Privacy & Dignity Official Notice */}
                  <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white rounded-3xl p-6 sm:p-8 border border-emerald-200/80 shadow-xs space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Pencegahan Pelanggaran Privasi & Kepatuhan UU PDP</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-serif">
                          Pengecekan Bantuan Dilakukan Secara Mandiri & Tertutup (*Inquiry-Based*)
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                          Sesuai amanat <strong>UU No. 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)</strong> serta standar resmi Kementerian Sosial RI, Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'} tidak mempublikasikan daftar nama warga penerima bansos secara gelondongan. Hal ini bertujuan untuk <strong>mencegah stigmatisasi sosial, melindungi privasi keluarga, serta menjaga kerukunan dan kehormatan warga</strong>.
                        </p>
                      </div>
                    </div>

                    {/* 3 Langkah Mudah */}
                    <div className="pt-3 border-t border-emerald-200/60">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
                        <ClipboardList className="w-4 h-4 text-emerald-700" />
                        <span>Cara Mengecek Status Bantuan Keluarga Anda:</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-1.5">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                            1
                          </div>
                          <div className="text-xs font-bold text-slate-900">Siapkan Identitas Asli</div>
                          <div className="text-[11px] text-slate-500 leading-relaxed">
                            Siapkan Kartu Tanda Penduduk (KTP-el) atau Kartu Keluarga (KK) Kepala Keluarga.
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-1.5">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                            2
                          </div>
                          <div className="text-xs font-bold text-slate-900">Ketikkan NIK pada Form</div>
                          <div className="text-[11px] text-slate-500 leading-relaxed">
                            Ketikkan 16 digit NIK atau Nomor KK pada kolom pencarian di atas, lalu klik <strong>Cari</strong>.
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-1.5">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                            3
                          </div>
                          <div className="text-xs font-bold text-slate-900">Hasil Verifikasi Terbuka</div>
                          <div className="text-[11px] text-slate-500 leading-relaxed">
                            Sistem hanya menampilkan status, nominal, jadwal, dan syarat pengambilan milik Anda.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agregat Transparansi Desa (Data Agregat yang Sah Ditampilkan Terbuka) */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 font-serif">
                          Rekapitulasi Kuota Program Bantuan Sosial Desa TA 2026
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Data agregat resmi hasil penetapan Musyawarah Desa Khusus (Musdesus) & Kemensos RI.
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200/80 w-fit">
                        Total Kuota: {stats.total} KPM
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                        <div className="text-xs font-bold text-emerald-900">BLT Dana Desa (BLT-DD)</div>
                        <div className="text-2xl font-black text-emerald-950 font-serif">{stats.bltCount} KPM</div>
                        <div className="text-[11px] text-emerald-700 leading-snug">
                          Alokasi Rp 300.000/bln untuk keluarga kemiskinan ekstrem / desil 1.
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2">
                        <div className="text-xs font-bold text-blue-900">Program Keluarga Harapan</div>
                        <div className="text-2xl font-black text-blue-950 font-serif">{stats.pkhCount} KPM</div>
                        <div className="text-[11px] text-blue-700 leading-snug">
                          Bantuan tunai bersyarat komponen kesehatan & pendidikan Kemensos RI.
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                        <div className="text-xs font-bold text-amber-900">BPNT / Sembako</div>
                        <div className="text-2xl font-black text-amber-950 font-serif">{stats.bpntCount} KPM</div>
                        <div className="text-[11px] text-amber-700 leading-snug">
                          Bantuan pangan non-tunai sembako bulanan melalui kartu KKS.
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 space-y-2">
                        <div className="text-xs font-bold text-teal-900">Cadangan Pangan (CPP)</div>
                        <div className="text-2xl font-black text-teal-950 font-serif">{stats.berasCount} KPM</div>
                        <div className="text-[11px] text-teal-700 leading-snug">
                          Penyaluran beras 10 Kg per KPM dari Bapanas & Perum Bulog.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dokumen & Syarat Pengambilan */}
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-900 font-serif flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>Dokumen Wajib Dibawa Saat Pengambilan Bantuan</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>KTP Elektronik Asli</strong>
                          <p className="text-[11px] text-slate-500 mt-0.5">Sesuai nama Kepala Keluarga penerima yang terdaftar di SK.</p>
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Kartu Keluarga (KK) Asli</strong>
                          <p className="text-[11px] text-slate-500 mt-0.5">Membuktikan keabsahan susunan keluarga di wilayah Desa Pulau Betung.</p>
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Surat Undangan RT / Kupon</strong>
                          <p className="text-[11px] text-slate-500 mt-0.5">Surat pemberitahuan resmi jadwal pengambilan dari RT setempat.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Banner Usulan Mandiri */}
                  <div className="p-6 rounded-3xl bg-amber-50/90 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-amber-950 font-serif">
                        Merasa Memenuhi Kriteria namun Belum Terdaftar?
                      </h4>
                      <p className="text-xs text-amber-800 max-w-2xl leading-relaxed">
                        Pemerintah Desa Pulau Betung membuka pintu partisipasi warga melalui usulan mandiri. Data usulan akan diverifikasi lapangan oleh tim verifikator desa dan diputuskan secara musyawarah pada Musdesus.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setModalType('usulan_baru');
                          setIsModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-sm transition-colors flex items-center space-x-1.5"
                      >
                        <Users className="w-4 h-4" />
                        <span>Ajukan Usulan Baru</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('informasi_program')}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300/80 font-bold text-xs transition-colors"
                      >
                        Lihat Kriteria
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASE 2: USER HAS PERFORMED A SEARCH */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 font-serif">
                        Hasil Pengecekan Bantuan Sosial ({filteredRecipients.length} Data Ditemukan)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Hasil pencarian untuk kata kunci: <strong className="text-slate-700 font-mono">"{searchQuery || selectedDusun}"</strong>
                      </p>
                    </div>
                    <button
                      onClick={handleResetSearch}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-bold underline"
                    >
                      Reset & Kembali ke Halaman Utama
                    </button>
                  </div>

                  {filteredRecipients.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-slate-200 shadow-xs space-y-4 max-w-xl mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-lg font-bold text-slate-900 font-serif">Data Tidak Ditemukan</h4>
                        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                          NIK atau nama yang Anda masukkan tidak terdaftar dalam Surat Keputusan (SK) Penerima Bantuan Sosial aktif periode ini di Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'}.
                        </p>
                        <p className="text-[11px] text-slate-400 italic">
                          Pastikan 16 digit NIK ditulis lengkap tanpa spasi atau tanda baca.
                        </p>
                      </div>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setModalType('usulan_baru');
                            setIsModalOpen(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors flex items-center space-x-2"
                        >
                          <Users className="w-4 h-4" />
                          <span>Ajukan Usulan KPM Baru (Musdesus)</span>
                        </button>
                        <button
                          onClick={handleResetSearch}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                        >
                          Cari NIK Lain
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredRecipients.map((recipient) => {
                        const isSiap = recipient.status === 'siap_diambil';
                        const isTersalurkan = recipient.status === 'tersalurkan';
                        const isVerif = recipient.status === 'proses_verifikasi';

                        return (
                          <motion.div
                            key={recipient.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-5"
                          >
                            <div className="space-y-4">
                              {/* Top Tag & Status */}
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                                  {recipient.programName}
                                </span>
                                
                                {isSiap && (
                                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center space-x-1 shrink-0">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Siap Diambil</span>
                                  </span>
                                )}
                                {isTersalurkan && (
                                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1 shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Tersalurkan</span>
                                  </span>
                                )}
                                {isVerif && (
                                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold flex items-center space-x-1 shrink-0">
                                    <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Proses Verifikasi</span>
                                  </span>
                                )}
                              </div>

                              {/* Recipient Details */}
                              <div>
                                <h4 className="text-lg font-bold text-slate-900 font-serif">
                                  {recipient.nameMasked}
                                </h4>
                                <div className="text-xs text-slate-500 font-mono mt-0.5">
                                  NIK: {recipient.nikMasked} &bull; No KK: {recipient.noKkMasked}
                                </div>
                                <div className="text-xs font-medium text-slate-600 mt-1 flex items-center space-x-1">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{recipient.dusun}, RT {recipient.rt}</span>
                                </div>
                              </div>

                              {/* Nominal / Items Card */}
                              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                                  <span>Bentuk & Besaran Bantuan:</span>
                                  <span className="text-slate-700 font-bold">{recipient.period}</span>
                                </div>
                                <div className="text-sm sm:text-base font-extrabold text-emerald-800">
                                  {recipient.nominalOrItem}
                                </div>
                              </div>

                              {/* Distribution Info Schedule */}
                              {recipient.distributionDate && (
                                <div className="space-y-1 text-xs text-slate-600">
                                  <div className="flex items-center space-x-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span><strong>Jadwal:</strong> {recipient.distributionDate} {recipient.distributionTime ? `(${recipient.distributionTime})` : ''}</span>
                                  </div>
                                  <div className="flex items-center space-x-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span><strong>Lokasi:</strong> {recipient.distributionLocation || 'Aula Kantor Desa Pulau Betung'}</span>
                                  </div>
                                </div>
                              )}

                              {/* Requirements Checklist */}
                              {recipient.requirements && recipient.requirements.length > 0 && (
                                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60 space-y-1">
                                  <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">
                                    Dokumen Wajib Dibawa:
                                  </div>
                                  <div className="space-y-0.5">
                                    {recipient.requirements.map((req: string, idx: number) => (
                                      <div key={idx} className="flex items-center space-x-1.5 text-xs text-emerald-800">
                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>{req}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {recipient.keterangan && (
                                <p className="text-xs text-slate-500 italic">
                                  Catatan: {recipient.keterangan}
                                </p>
                              )}
                            </div>

                            {/* Action Buttons: Secure & Dignified */}
                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-400 italic">
                                *Wajib bawa KTP-el asli
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setSelectedRecipientForReceipt(recipient)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Bukti Cek</span>
                                </button>
                                <a
                                  href={`https://wa.me/${(villageProfile.phone || '6282281990112').replace(/\D/g, '')}?text=${encodeURIComponent(`Halo Petugas Bansos Desa Pulau Betung, saya ingin konfirmasi jadwal penyaluran bansos atas nama ${recipient.nameMasked} (Program: ${recipient.programName}).`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                                  title="Hubungi Petugas Penyalur Desa"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Bantuan</span>
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                  <p className="text-slate-500 text-sm font-bold">Sinkronisasi Data Real-time...</p>
                </div>
              )}

              {isError && (
                <div className="p-10 text-center bg-rose-50 rounded-3xl border border-rose-100 text-rose-700">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="font-extrabold">Gangguan Koneksi Basis Data</p>
                  <p className="text-xs mt-1">Kami gagal menghubungi server desa. Silakan coba beberapa saat lagi.</p>
                </div>
              )}

              {hasNextPage && isSearchActive && !isLoading && (
                <div className="flex justify-center pt-4">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="flex items-center space-x-2 px-8 py-3 bg-white hover:bg-slate-50 text-emerald-700 rounded-2xl border border-slate-200 font-black text-xs transition-all shadow-sm hover:shadow-md disabled:opacity-50 active:scale-95"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    <span>{isFetchingNextPage ? 'Memuat Data...' : 'Lihat Lebih Banyak Data KPM'}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: REKAPITULASI & STATISTIK */}
        {activeTab === 'statistik' && (
          <motion.div
            key="statistik"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 font-serif">
                  Statistik Penyaluran Bantuan Sosial TA 2026
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Laporan transparansi alokasi dan realisasi program jaring pengaman sosial di Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    BLT Dana Desa (Desil 1)
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-950 font-serif">
                    {stats.bltCount} KPM
                  </div>
                  <p className="text-xs text-emerald-700">
                    Alokasi Rp 300.000 / KPM / Bulan dari APBDes.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                  <div className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                    Program PKH & BPNT
                  </div>
                  <div className="text-3xl font-extrabold text-blue-950 font-serif">
                    {stats.pkhCount + stats.bpntCount} KPM
                  </div>
                  <p className="text-xs text-blue-700">
                    Bantuan Kemensos RI melalui penyalur Himbara/e-Warong.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                  <div className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                    Cadangan Pangan (Beras CPP)
                  </div>
                  <div className="text-3xl font-extrabold text-teal-950 font-serif">
                    {stats.berasCount} KPM
                  </div>
                  <p className="text-xs text-teal-700">
                    Penyaluran beras 10 Kg Bapanas & Perum Bulog.
                  </p>
                </div>
              </div>
            </div>

            {/* Alur Penyaluran & Jadwal */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 space-y-6">
              <h3 className="text-lg font-bold text-slate-900 font-serif">
                Alur & Syarat Pengambilan Bantuan di Kantor Desa
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Undangan Resmi RT</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Warga menerima surat undangan penyaluran dari Ketua RT setempat.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Siapkan Berkas Asli</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bawa KTP-el Asli dan Kartu Keluarga (KK) Asli sesuai nama penerima.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Verifikasi Loket Desa</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Petugas memindai NIK & mencocokkan data penerima dengan daftar BPD.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                    4
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Penerimaan & Bukti</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Penyerahan dana/beras dan penandatanganan daftar tanda terima sah.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: INFORMASI PROGRAM & KRITERIA */}
        {activeTab === 'informasi_program' && (
          <motion.div
            key="informasi_program"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/90 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 font-serif">
                  Kriteria & Jenis Bantuan Sosial Pemerintah
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Penetapan penerima bantuan dilakukan secara transparan melalui Musyawarah Desa Khusus (Musdesus) yang melibatkan Kepala Desa, BPD, Pendamping Desa, serta Tokoh Masyarakat.
                </p>
              </div>

              <div className="space-y-4">
                {BANSOS_PROGRAM_LIST.map((prog) => (
                  <div
                    key={prog.type}
                    className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${prog.badgeBg}`}>
                          {prog.shortName}
                        </span>
                        <h4 className="text-base font-bold text-slate-900">
                          {prog.name}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-slate-500">
                        Sumber Dana: {prog.source}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {prog.description}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-xs font-bold text-slate-700">Kriteria Penerima Utama:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {prog.criteria.map((c, i) => (
                          <div key={i} className="flex items-start space-x-2 text-xs text-slate-600">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>

      {/* MODAL USULAN & SANGGAHAN WARGA */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-6 my-8"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-serif">
                    {modalType === 'usulan_baru' ? 'Formulir Usulan KPM Baru' : 'Formulir Sanggahan Penerima Bantuan'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {modalType === 'usulan_baru' 
                      ? 'Daftarkan keluarga rentan/miskin yang layak dipertimbangkan dalam Musdesus.'
                      : 'Laporkan bila ada penerima yang dinilai sudah mampu agar dialihkan ke yang lebih berhak.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Lengkap Anda (Pelapor) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.namaPelapor}
                      onChange={(e) => setFormData({ ...formData, namaPelapor: e.target.value })}
                      placeholder="Nama Pelapor"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIK Pelapor (16 Digit) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={16}
                      value={formData.nikPelapor}
                      onChange={(e) => setFormData({ ...formData, nikPelapor: e.target.value.replace(/\D/g, '') })}
                      placeholder="150401..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. WhatsApp / HP
                    </label>
                    <input
                      type="text"
                      value={formData.phonePelapor}
                      onChange={(e) => setFormData({ ...formData, phonePelapor: e.target.value })}
                      placeholder="08..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dusun Domisili
                    </label>
                    <select
                      value={formData.dusun}
                      onChange={(e) => setFormData({ ...formData, dusun: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      {territories && territories.length > 0 ? (
                        territories.map(t => (
                          <option key={t.id} value={t.name}>{t.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="Dusun 1">Dusun 1</option>
                          <option value="Dusun 2">Dusun 2</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      RT
                    </label>
                    <input
                      type="text"
                      value={formData.rt}
                      onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
                      placeholder="01"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {modalType === 'sanggahan_tidak_layak' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama / NIK Penerima yang Disanggah *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.targetNikOrName}
                      onChange={(e) => setFormData({ ...formData, targetNikOrName: e.target.value })}
                      placeholder="Nama atau NIK yang dilaporkan"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Program Bantuan yang Dituju
                  </label>
                  <select
                    value={formData.programTarget}
                    onChange={(e) => setFormData({ ...formData, programTarget: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="BLT_DD">BLT Dana Desa (BLT-DD)</option>
                    <option value="PKH">Program Keluarga Harapan (PKH)</option>
                    <option value="BPNT">Bantuan Pangan Non Tunai (BPNT)</option>
                    <option value="BERAS_CPP">Cadangan Pangan Pemerintah (Beras 10 Kg)</option>
                    <option value="KIS_PBI">Kartu Indonesia Sehat (KIS PBI)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan dan Kondisi Riil Lapangan *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.alasan}
                    onChange={(e) => setFormData({ ...formData, alasan: e.target.value })}
                    placeholder={modalType === 'usulan_baru' 
                      ? 'Jelaskan kondisi ekonomi, pekerjaan, tanggungan keluarga, kondisi rumah...'
                      : 'Jelaskan mengapa penerima tersebut dinilai sudah mampu secara ekonomi...'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors flex items-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Mengirim...' : 'Kirim Laporan ke Pemdes'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CETAK BUKTI RESI BANSOS */}
      {selectedRecipientForReceipt && (
        <BansosReceiptModal
          recipient={selectedRecipientForReceipt}
          onClose={() => setSelectedRecipientForReceipt(null)}
          villageName={villageProfile.villageName || 'Desa Pulau Betung'}
          villageAddress={villageProfile.addressStreet || 'Jl. Lintas Jambi - Muara Bulian KM. 35, Kec. Pemayung, Kab. Batang Hari'}
          kadesName="M. Yamin, S.Pd"
          onToast={addToast}
        />
      )}

    </div>
  );
};
