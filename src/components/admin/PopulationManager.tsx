import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useResidents } from '../../hooks/useResidents';
import { Resident } from '../../types/resident';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  ChevronDown,
  X,
  UserPlus,
  HeartPulse,
  UserMinus,
  Baby,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  XCircle,
  Eye,
  Briefcase,
  GraduationCap,
  Sparkles,
  Upload,
  SlidersHorizontal,
  Check,
  ShieldCheck,
  Layers,
  MessageSquare,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cleanCitizenName, cleanCitizenNik } from '../../utils/formatting';
import { SmartStatsModal } from './SmartStatsModal';
import { api } from '../../services/api';

export const STANDARD_OCCUPATIONS = [
  'Petani / Pekebun',
  'Wiraswasta / UMKM / Pedagang',
  'Buruh Harian Lepas',
  'Karyawan Swasta / BUMN',
  'ASN / TNI / Polri / Guru',
  'Mengurus Rumah Tangga (IRT)',
  'Pelajar / Mahasiswa',
  'Belum/Tidak Bekerja',
  'Pensiunan',
  'Lainnya'
];

export const STANDARD_EDUCATIONS = [
  'Tidak/Belum Sekolah',
  'SD / Sederajat',
  'SMP / MTs',
  'SMA / SMK / MA',
  'Diploma (D1-D3)',
  'Diploma / Sarjana (S1-S2)',
  'Pascasarjana (S2/S3)'
];

export const PopulationManager: React.FC = () => {
  const { villageProfile, addToast, updateVillageProfile, serviceRequests, territories } = useApp();
  const { residents, loading, addResident, updateResident, deleteResident, refreshResidents } = useResidents();

  const availableDusuns = useMemo(() => {
    if (territories && territories.length > 0) {
      return territories.map(t => ({ id: t.id, name: t.name }));
    }
    return [
      { id: 'dus-1', name: 'Dusun Betung Indah' },
      { id: 'dus-2', name: 'Dusun Teluk Melintang' }
    ];
  }, [territories]);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDusun, setSelectedDusun] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('Hidup');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('all');
  const [selectedOccupation, setSelectedOccupation] = useState('all');
  const [selectedEducation, setSelectedEducation] = useState('all');
  const [showStuntingRiskOnly, setShowStuntingRiskOnly] = useState(false);
  const [showBansosOnly, setShowBansosOnly] = useState(false);
  const [showSkuOnly, setShowSkuOnly] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'nik' | 'age'>('name');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingArchiveNik, setViewingArchiveNik] = useState<string | null>(null);
  const [selected360Resident, setSelected360Resident] = useState<Resident | null>(null);
  const [active360Tab, setActive360Tab] = useState<'biodata' | 'bansos' | 'surat' | 'posyandu' | 'aduan'>('biodata');
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  // Quick Edit Modal for Occupation & Education
  const [quickEditResident, setQuickEditResident] = useState<Resident | null>(null);
  const [quickOccupation, setQuickOccupation] = useState('');
  const [quickEducation, setQuickEducation] = useState('');

  // Form State for Add / Full Edit
  const [formData, setFormData] = useState<Omit<Resident, 'updatedAt'>>({
    nik: '',
    kk: '',
    name: '',
    gender: 'Laki-laki',
    birthDate: '',
    birthPlace: '',
    address: '',
    dusun: '',
    dusunId: '',
    rt: '01',
    rw: '01',
    religion: 'Islam',
    maritalStatus: 'Belum Kawin',
    occupation: 'Petani / Pekebun',
    education: 'SMA / SMK / MA',
    status: 'Hidup',
    hasBansos: false,
    hasSku: false,
    isStuntingRisk: false,
    economicStatus: 'Umum',
    mutationType: undefined
  });

  const residentArchives = useMemo(() => {
    if (!viewingArchiveNik) return [];
    return serviceRequests.filter(req => req.citizenNik === viewingArchiveNik);
  }, [viewingArchiveNik, serviceRequests]);

  // Sync with Village Profile Stats (Manual Refresh Button)
  const handleSyncToProfile = async () => {
    setIsSyncingProfile(true);
    try {
      const res = await api.syncResidentProfile();
      if (!res.success) {
        throw new Error(res.error || 'Gagal sinkronisasi');
      }
      await refreshResidents();
      const stats = res.data;
      addToast('success', 'Sinkronisasi Berhasil', `Statistik profil desa diperbarui dari database: ${stats?.totalPop || 0} Jiwa (${stats?.malePop || 0} L / ${stats?.femalePop || 0} P), ${stats?.totalFamilies || 0} KK.`);
    } catch (err: any) {
      addToast('error', 'Gagal Sinkron', err.message || 'Terjadi kesalahan saat menyelaraskan ke profil desa.');
    } finally {
      setIsSyncingProfile(false);
    }
  };

  // Multi-Criteria Filtering
  const filteredResidents = useMemo(() => {
    let result = residents.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || r.nik.includes(q) || r.name.toLowerCase().includes(q) || r.kk.includes(q);
      const matchDusun = selectedDusun === 'all' || r.dusun === selectedDusun || r.dusunId === selectedDusun;
      const matchStatus = selectedStatus === 'all' || 
        r.status?.toUpperCase() === selectedStatus.toUpperCase();
      const matchGender = selectedGender === 'all' || r.gender === selectedGender;
      
      const age = calculateAge(r.birthDate);
      let matchAgeGroup = true;
      if (selectedAgeGroup === 'balita') matchAgeGroup = age <= 5;
      else if (selectedAgeGroup === 'anak') matchAgeGroup = age > 5 && age <= 12;
      else if (selectedAgeGroup === 'remaja') matchAgeGroup = age > 12 && age <= 18;
      else if (selectedAgeGroup === 'dewasa') matchAgeGroup = age > 18 && age <= 60;
      else if (selectedAgeGroup === 'lansia') matchAgeGroup = age > 60;

      const isStuntingRisk = age <= 5 && r.status?.toUpperCase() === 'HIDUP' && r.isStuntingRisk;
      const matchStunting = !showStuntingRiskOnly || isStuntingRisk;
      const matchBansos = !showBansosOnly || r.hasBansos;
      const matchSku = !showSkuOnly || r.hasSku;
      const matchLetter = !selectedLetter || r.name.toUpperCase().startsWith(selectedLetter);

      // Filter Pekerjaan & Pendidikan
      const matchOccupation = selectedOccupation === 'all' || (r.occupation && r.occupation.toLowerCase().includes(selectedOccupation.toLowerCase()));
      const matchEducation = selectedEducation === 'all' || (r.education && r.education.toLowerCase().includes(selectedEducation.toLowerCase()));

      return matchQuery && matchDusun && matchStatus && matchGender && matchAgeGroup && matchStunting && matchBansos && matchSku && matchLetter && matchOccupation && matchEducation;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'nik') return a.nik.localeCompare(b.nik);
      if (sortBy === 'age') return calculateAge(b.birthDate) - calculateAge(a.birthDate);
      return 0;
    });
  }, [
    residents, 
    searchQuery, 
    selectedDusun, 
    selectedStatus, 
    selectedGender, 
    selectedAgeGroup, 
    selectedOccupation, 
    selectedEducation, 
    showStuntingRiskOnly, 
    showBansosOnly, 
    showSkuOnly, 
    sortBy, 
    selectedLetter
  ]);

  // Quick Stats
  const stats = useMemo(() => {
    return {
      total: residents.length,
      alive: residents.filter(r => r.status?.toUpperCase() === 'HIDUP').length,
      deceased: residents.filter(r => r.status?.toUpperCase() === 'MENINGGAL').length,
      moved: residents.filter(r => r.status?.toUpperCase() === 'PINDAH').length
    };
  }, [residents]);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      nik: '',
      kk: '',
      name: '',
      gender: 'Laki-laki',
      birthDate: '',
      birthPlace: '',
      address: '',
      dusun: availableDusuns[0]?.name || '',
      dusunId: availableDusuns[0]?.id || '',
      rt: '01',
      rw: '01',
      religion: 'Islam',
      maritalStatus: 'Belum Kawin',
      occupation: 'Petani / Pekebun',
      education: 'SMA / SMK / MA',
      status: 'Hidup',
      hasBansos: false,
      hasSku: false,
      isStuntingRisk: false,
      economicStatus: 'Umum',
      mutationType: undefined
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (res: Resident) => {
    setEditingId(res.id || null);
    const matchedDusun = availableDusuns.find(d => d.id === res.dusunId || d.name === res.dusun) || availableDusuns[0];
    setFormData({
      ...res,
      name: cleanCitizenName(res.name),
      nik: cleanCitizenNik(res.nik),
      kk: cleanCitizenNik(res.kk || res.kkNumber || ''),
      birthPlace: res.birthPlace || '',
      address: res.address || '',
      dusun: matchedDusun?.name || res.dusun || '',
      dusunId: matchedDusun?.id || res.dusunId || '',
      rt: res.rt || '01',
      rw: res.rw || '01',
      religion: res.religion || 'Islam',
      maritalStatus: res.maritalStatus || 'Kawin',
      occupation: res.occupation || 'Belum/Tidak Bekerja',
      education: res.education || 'SMA / SMK / MA',
      hasBansos: !!res.hasBansos,
      hasSku: !!res.hasSku,
      isStuntingRisk: !!res.isStuntingRisk,
      economicStatus: res.economicStatus || 'Umum'
    });
    setIsModalOpen(true);
  };

  const handleOpenQuickEdit = (res: Resident) => {
    setQuickEditResident(res);
    setQuickOccupation(res.occupation || 'Belum/Tidak Bekerja');
    setQuickEducation(res.education || 'SMA / SMK / MA');
  };

  const handleSaveQuickEdit = async () => {
    if (!quickEditResident || !quickEditResident.id) return;
    try {
      await updateResident({
        ...quickEditResident,
        occupation: quickOccupation,
        education: quickEducation
      });
      addToast('success', 'Profil Diperbarui', `Pekerjaan & Pendidikan ${cleanCitizenName(quickEditResident.name)} berhasil disimpan.`);
      setQuickEditResident(null);
    } catch (err) {
      addToast('error', 'Gagal', 'Gagal memperbarui profil data penduduk.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = cleanCitizenName(formData.name);
    const cleanNik = cleanCitizenNik(formData.nik);
    const cleanKk = cleanCitizenNik(formData.kk);
    const cleanBirthPlace = (formData.birthPlace || '').trim();
    const cleanAddress = (formData.address || '').trim();

    if (!cleanNik || !cleanName) {
      addToast('error', 'Gagal', 'NIK dan Nama Lengkap wajib diisi.');
      return;
    }
    if (cleanNik.length !== 16) {
      addToast('error', 'Gagal', 'NIK harus terdiri dari 16 digit angka.');
      return;
    }
    if (!cleanKk) {
      addToast('error', 'Gagal', 'No. KK wajib diisi.');
      return;
    }
    if (cleanKk.length !== 16) {
      addToast('error', 'Gagal', 'No. KK harus terdiri dari 16 digit angka.');
      return;
    }
    if (!cleanBirthPlace) {
      addToast('error', 'Gagal', 'Tempat Lahir wajib diisi.');
      return;
    }
    if (!formData.birthDate) {
      addToast('error', 'Gagal', 'Tanggal Lahir wajib diisi.');
      return;
    }
    if (!cleanAddress) {
      addToast('error', 'Gagal', 'Alamat domisili lengkap wajib diisi.');
      return;
    }

    const bDate = new Date(formData.birthDate);
    if (bDate > new Date()) {
      addToast('error', 'Gagal', 'Tanggal lahir tidak boleh di masa depan.');
      return;
    }

    const selectedDusunObj = availableDusuns.find(d => d.id === formData.dusunId) || 
                             availableDusuns.find(d => d.name === formData.dusun) || 
                             availableDusuns[0];

    const payload: Resident = {
      ...formData,
      name: cleanName.toUpperCase(),
      fullName: cleanName.toUpperCase(),
      nik: cleanNik,
      kk: cleanKk,
      kkNumber: cleanKk,
      birthPlace: cleanBirthPlace,
      address: cleanAddress,
      dusun: selectedDusunObj?.name || formData.dusun || '',
      dusunId: selectedDusunObj?.id || formData.dusunId || undefined,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateResident({ ...payload, id: editingId });
        addToast('success', 'Berhasil', 'Data penduduk diperbarui.');
      } else {
        await addResident(payload);
        addToast('success', 'Berhasil', 'Penduduk baru ditambahkan ke database.');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      addToast('error', 'Gagal', err?.message || 'Terjadi kesalahan saat menyimpan data.');
    }
  };

  const dirtyResidentsCount = useMemo(() => {
    return residents.filter(r => 
      /^nama\s*:\s*/i.test(r.name) || 
      /nik\s*:\s*/i.test(r.nik) || 
      /^[\d]+\.\s*/.test(r.nik)
    ).length;
  }, [residents]);

  const handleBatchCleanFormatting = async () => {
    const targets = residents.filter(r => 
      /^nama\s*:\s*/i.test(r.name) || 
      /nik\s*:\s*/i.test(r.nik) || 
      /^[\d]+\.\s*/.test(r.nik)
    );
    if (targets.length === 0) return;
    setIsCleaning(true);
    let success = 0;
    for (const r of targets) {
      try {
        await updateResident({
          ...r,
          name: cleanCitizenName(r.name),
          nik: cleanCitizenNik(r.nik)
        });
        success++;
      } catch (err) {
        console.error('Gagal membersihkan resident:', r.id, err);
      }
    }
    setIsCleaning(false);
    addToast('success', 'Format Dirapikan', `Berhasil membersihkan format Nama & NIK pada ${success} data penduduk.`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Hapus data penduduk ${name}? Tindakan ini permanen.`)) {
      await deleteResident(id);
      addToast('info', 'Dihapus', `Data ${name} telah dihapus.`);
    }
  };

  const exportCSV = () => {
    const headers = [
      'NIK', 'No KK', 'Nama Lengkap', 'Jenis Kelamin', 'Tanggal Lahir', 'Umur', 'Tempat Lahir', 
      'Dusun', 'RT', 'RW', 'Alamat', 'Agama', 'Status Perkawinan', 'Mata Pencaharian / Pekerjaan', 
      'Pendidikan Terakhir', 'Status Kehidupan', 'Status Ekonomi', 'Penerima Bansos', 'Punya SKU Usaha', 'Risiko Stunting'
    ];
    const rows = filteredResidents.map(r => [
      `'${r.nik}`, 
      `'${r.kk}`, 
      `"${r.name}"`, 
      r.gender, 
      r.birthDate, 
      calculateAge(r.birthDate),
      `"${r.birthPlace || ''}"`, 
      `"${r.dusun}"`, 
      `'${r.rt || '01'}`, 
      `'${r.rw || '01'}`, 
      `"${r.address || ''}"`,
      r.religion || 'Islam',
      r.maritalStatus || 'Kawin',
      `"${r.occupation || 'Belum/Tidak Bekerja'}"`,
      `"${r.education || 'SMA / SMK / MA'}"`,
      r.status,
      r.economicStatus || 'Umum',
      r.hasBansos ? 'Ya' : 'Tidak',
      r.hasSku ? 'Ya' : 'Tidak',
      r.isStuntingRisk ? 'Ya' : 'Tidak'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Master_Data_Penduduk_Lengkap_${villageProfile.villageName || 'Desa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* --- HEADER: Judul & Tombol Aksi Utama --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Master Data Kependudukan & Sensus Desa</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">Database Kependudukan Lengkap</h2>
          <p className="text-xs text-slate-500 italic">
            Kelola data biodata warga, mata pencaharian, pendidikan terakhir, dan riwayat siklus hidup desa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dirtyResidentsCount > 0 && (
            <button 
              onClick={handleBatchCleanFormatting} 
              disabled={isCleaning}
              className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs animate-pulse"
              title="Bersihkan awalan Nama: dan NIK: berlebih pada database penduduk"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isCleaning ? 'animate-spin' : ''}`} />
              <span>{isCleaning ? 'Merapikan...' : `Rapikan Format (${dirtyResidentsCount})`}</span>
            </button>
          )}

          <div className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-xs" title="Sistem sinkronisasi real-time SSOT">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-Sync SSOT Aktif</span>
          </div>

          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Buka Mesin Import Cerdas CSV / Excel / Sheet 360"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV/Excel 360</span>
          </button>

          <button 
            onClick={exportCSV} 
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button 
            onClick={handleOpenAddModal} 
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Penduduk</span>
          </button>
        </div>
      </div>

      {/* --- KARTU INDIKATOR --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Terdaftar" value={stats.total} icon={<Users className="w-5 h-5" />} color="blue" />
        <StatCard label="Warga Hidup" value={stats.alive} icon={<HeartPulse className="w-5 h-5" />} color="emerald" />
        <StatCard label="Meninggal Dunia" value={stats.deceased} icon={<UserMinus className="w-5 h-5" />} color="rose" />
        <StatCard label="Pindah Domisili" value={stats.moved} icon={<RefreshCw className="w-5 h-5" />} color="amber" />
      </div>

      {/* --- PANEL FILTER & PENCARIAN MULTI-DIMENSI --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Filter Abjad */}
        <div className="flex flex-wrap items-center gap-1 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedLetter(null)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
              selectedLetter === null 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            SEMUA
          </button>
          {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => (
            <button
              key={letter}
              onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${
                selectedLetter === letter 
                  ? 'bg-blue-600 text-white shadow-xs scale-105' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>

        {/* Filter Row 1: Search, Dusun, Status, Pekerjaan, Pendidikan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari NIK, Nama, atau No. KK..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <select 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" 
              value={selectedDusun} 
              onChange={e => setSelectedDusun(e.target.value)}
            >
              <option value="all">Semua Dusun</option>
              {availableDusuns.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" 
              value={selectedOccupation} 
              onChange={e => setSelectedOccupation(e.target.value)}
            >
              <option value="all">Semua Mata Pencaharian</option>
              {STANDARD_OCCUPATIONS.map(occ => (
                <option key={occ} value={occ}>{occ}</option>
              ))}
            </select>
          </div>

          <div>
            <select 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" 
              value={selectedEducation} 
              onChange={e => setSelectedEducation(e.target.value)}
            >
              <option value="all">Semua Pendidikan</option>
              {STANDARD_EDUCATIONS.map(edu => (
                <option key={edu} value={edu}>{edu}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Row 2: Status Hidup, Umur, Sorting & Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <select 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none cursor-pointer" 
              value={selectedStatus} 
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Status: Semua</option>
              <option value="Hidup">Status: Hidup</option>
              <option value="Meninggal">Status: Meninggal</option>
              <option value="Pindah">Status: Pindah</option>
            </select>

            <select 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none cursor-pointer" 
              value={selectedAgeGroup} 
              onChange={e => setSelectedAgeGroup(e.target.value)}
            >
              <option value="all">Umur: Semua</option>
              <option value="balita">Balita (0-5 Thn)</option>
              <option value="anak">Anak (6-12 Thn)</option>
              <option value="remaja">Remaja (13-18 Thn)</option>
              <option value="dewasa">Dewasa (19-60 Thn)</option>
              <option value="lansia">Lansia ({'>'}60 Thn)</option>
            </select>

            <select 
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 focus:outline-none cursor-pointer" 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="name">Urut: Nama (A-Z)</option>
              <option value="nik">Urut: NIK</option>
              <option value="age">Urut: Usia Tertua</option>
            </select>

            {/* Quick Toggles */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <input 
                type="checkbox" 
                checked={showBansosOnly} 
                onChange={e => setShowBansosOnly(e.target.checked)} 
                className="rounded text-emerald-600 focus:ring-0 cursor-pointer" 
              />
              <span>Bansos</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <input 
                type="checkbox" 
                checked={showSkuOnly} 
                onChange={e => setShowSkuOnly(e.target.checked)} 
                className="rounded text-amber-600 focus:ring-0 cursor-pointer" 
              />
              <span>Usaha / SKU</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
              <input 
                type="checkbox" 
                checked={showStuntingRiskOnly} 
                onChange={e => setShowStuntingRiskOnly(e.target.checked)} 
                className="rounded text-rose-600 focus:ring-0 cursor-pointer" 
              />
              <span>Risiko Stunting</span>
            </label>
          </div>
          
          <div className="text-[11px] text-slate-400 font-medium">
            Menampilkan <strong>{filteredResidents.length}</strong> dari <strong>{residents.length}</strong> warga
          </div>
        </div>
      </div>

      {/* --- TABEL MASTER KEPENDUDUKAN --- */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Data Warga (NIK / KK)</th>
                <th className="px-6 py-4">Wilayah & Alamat</th>
                <th className="px-6 py-4">Siklus & Usia</th>
                <th className="px-6 py-4">Mata Pencaharian & Pendidikan</th>
                <th className="px-6 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm italic font-medium">
                    Memuat database kependudukan...
                  </td>
                </tr>
              ) : filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm italic font-medium">
                    Tidak ada data warga ditemukan dengan filter ini.
                  </td>
                </tr>
              ) : filteredResidents.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50/70 transition-colors ${r.status?.toUpperCase() === 'MENINGGAL' ? 'bg-slate-50/40 opacity-70' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <button 
                        onClick={() => setSelected360Resident(r)}
                        className="text-left font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                        title="Buka Profil 360° Lengkap Warga"
                      >
                        {cleanCitizenName(r.name)}
                      </button>
                      {r.hasBansos && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-emerald-600 text-white font-black shadow-xs">
                          BANSOS {r.bansosList && r.bansosList.length > 0 ? `(${r.bansosList.length})` : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                        NIK: {cleanCitizenNik(r.nik)}
                      </div>
                      {r.hasSku && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-amber-100 text-amber-700 font-black border border-amber-200">
                          SKU
                        </span>
                      )}
                      {r.hasSktm && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-purple-100 text-purple-700 font-black border border-purple-200">
                          SKTM
                        </span>
                      )}
                      {r.hasToddler && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-100 text-blue-700 font-black border border-blue-200">
                          BALITA
                        </span>
                      )}
                      {r.isStuntingRisk && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-rose-100 text-rose-700 font-black border border-rose-200">
                          RISIKO STUNTING
                        </span>
                      )}
                      {r.hasComplaint && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-orange-100 text-orange-700 font-black border border-orange-200">
                          ADUAN {r.complaintList && r.complaintList.length > 0 ? `(${r.complaintList.length})` : ''}
                        </span>
                      )}
                      <button 
                        onClick={() => setSelected360Resident(r)}
                        className="flex items-center gap-0.5 text-[8px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer shadow-xs" 
                        title="Buka Profil 360° Terpadu (Semua Jejak Modul)"
                      >
                        <Eye className="w-2.5 h-2.5 text-indigo-600" />
                        <span>PROFIL 360°</span>
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="text-xs font-bold text-slate-700">{r.dusun}</div>
                    <div className="text-[10px] text-slate-400">RT {r.rt || '01'} / RW {r.rw || '01'}</div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                          r.status?.toUpperCase() === 'HIDUP' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          r.status?.toUpperCase() === 'MENINGGAL' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {r.status?.toUpperCase() === 'HIDUP' ? <HeartPulse className="w-3 h-3" /> : 
                           r.status?.toUpperCase() === 'MENINGGAL' ? <UserMinus className="w-3 h-3" /> : 
                           <RefreshCw className="w-3 h-3" />}
                          {r.status?.toUpperCase() === 'HIDUP' ? 'Hidup' : r.status?.toUpperCase() === 'MENINGGAL' ? 'Meninggal' : 'Pindah'}
                        </span>
                        
                        {r.mutationType === 'Masuk' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200">
                            MASUK
                          </span>
                        )}
                        {r.mutationType === 'Keluar' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                            KELUAR
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {calculateAge(r.birthDate)} Thn ({r.gender === 'Laki-laki' ? 'L' : 'P'})
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-emerald-600" />
                          <span>{r.occupation || 'Belum/Tidak Bekerja'}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-blue-600" />
                          <span>{r.education || 'SMA / SMK / MA'}</span>
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Tombol Profil 360° Terpadu */}
                      <button 
                        onClick={() => setSelected360Resident(r)}
                        className="px-2 py-1.5 hover:bg-indigo-50 text-indigo-700 rounded-lg transition-all cursor-pointer border border-indigo-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                        title="Buka Profil 360° Warga Lengkap"
                      >
                        <Eye className="w-3 h-3 text-indigo-600" />
                        <span className="hidden sm:inline">360°</span>
                      </button>

                      {/* Tombol Quick Edit Profesi & Pendidikan */}
                      <button 
                        onClick={() => handleOpenQuickEdit(r)}
                        className="px-2 py-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-all cursor-pointer border border-emerald-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                        title="Ubah Cepat Mata Pencaharian & Pendidikan"
                      >
                        <SlidersHorizontal className="w-3 h-3 text-emerald-600" />
                        <span className="hidden sm:inline">Ubah Profesi</span>
                      </button>

                      {/* Tombol Edit Lengkap */}
                      <button 
                        onClick={() => handleOpenEditModal(r)} 
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-all cursor-pointer border border-blue-100"
                        title="Edit Seluruh Biodata"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Tombol Hapus */}
                      <button 
                        onClick={() => handleDelete(r.id!, r.name)} 
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition-all cursor-pointer border border-rose-100"
                        title="Hapus Warga"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- QUICK EDIT MODAL (Pekerjaan & Pendidikan Cepat) --- */}
      <AnimatePresence>
        {quickEditResident && (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setQuickEditResident(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-serif uppercase tracking-tight flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                    <span>Ubah Pekerjaan & Pendidikan</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {cleanCitizenName(quickEditResident.name)} (NIK: {cleanCitizenNik(quickEditResident.nik)})
                  </p>
                </div>
                <button 
                  onClick={() => setQuickEditResident(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-full transition-colors cursor-pointer text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mata Pencaharian / Pekerjaan</span>
                  </label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    value={quickOccupation}
                    onChange={e => setQuickOccupation(e.target.value)}
                  >
                    {STANDARD_OCCUPATIONS.map(occ => (
                      <option key={occ} value={occ}>{occ}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                    <span>Tingkat Pendidikan Terakhir</span>
                  </label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={quickEducation}
                    onChange={e => setQuickEducation(e.target.value)}
                  >
                    {STANDARD_EDUCATIONS.map(edu => (
                      <option key={edu} value={edu}>{edu}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button 
                  onClick={() => setQuickEditResident(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer shadow-2xs"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveQuickEdit}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 360° VIEW WARGA SADEWA --- */}
      <AnimatePresence>
        {selected360Resident && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelected360Resident(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-black text-xl shadow-inner">
                    {selected360Resident.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold font-serif tracking-tight text-white">
                        {cleanCitizenName(selected360Resident.name)}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        selected360Resident.status?.toUpperCase() === 'HIDUP' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {selected360Resident.status || 'HIDUP'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-indigo-200 font-mono">
                      <span>NIK: {cleanCitizenNik(selected360Resident.nik)}</span>
                      <span>•</span>
                      <span>No. KK: {selected360Resident.kk || '-'}</span>
                      <span>•</span>
                      <span>{selected360Resident.dusun} (RT {selected360Resident.rt || '01'}/RW {selected360Resident.rw || '01'})</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelected360Resident(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-100 bg-slate-50 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActive360Tab('biodata')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    active360Tab === 'biodata' 
                      ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Biodata Kependudukan</span>
                </button>

                <button
                  onClick={() => setActive360Tab('bansos')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    active360Tab === 'bansos' 
                      ? 'border-emerald-600 text-emerald-700 bg-white shadow-2xs font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Status Bansos</span>
                  {selected360Resident.bansosList && selected360Resident.bansosList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-600 text-white font-mono">
                      {selected360Resident.bansosList.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActive360Tab('surat')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    active360Tab === 'surat' 
                      ? 'border-blue-600 text-blue-700 bg-white shadow-2xs font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Riwayat Surat</span>
                  {selected360Resident.serviceList && selected360Resident.serviceList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-600 text-white font-mono">
                      {selected360Resident.serviceList.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActive360Tab('posyandu')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    active360Tab === 'posyandu' 
                      ? 'border-rose-600 text-rose-700 bg-white shadow-2xs font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  <span>e-Posyandu & KIA</span>
                  {selected360Resident.toddlerList && selected360Resident.toddlerList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-600 text-white font-mono">
                      {selected360Resident.toddlerList.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActive360Tab('aduan')}
                  className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
                    active360Tab === 'aduan' 
                      ? 'border-orange-600 text-orange-700 bg-white shadow-2xs font-black' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Aduan Warga</span>
                  {selected360Resident.complaintList && selected360Resident.complaintList.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-orange-600 text-white font-mono">
                      {selected360Resident.complaintList.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Content Body */}
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                {/* 1. BIODATA */}
                {active360Tab === 'biodata' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Identitas Diri</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400 text-[10px]">Tempat, Tanggal Lahir</p>
                          <p className="font-bold text-slate-800">{selected360Resident.birthPlace || '-'}, {selected360Resident.birthDate ? new Date(selected360Resident.birthDate).toLocaleDateString('id-ID') : '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Jenis Kelamin</p>
                          <p className="font-bold text-slate-800">{selected360Resident.gender}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Agama</p>
                          <p className="font-bold text-slate-800">{selected360Resident.religion || 'Islam'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Status Pernikahan</p>
                          <p className="font-bold text-slate-800">{selected360Resident.maritalStatus || 'Belum Kawin'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">Sosial & Ekonomi</h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-slate-400 text-[10px]">Mata Pencaharian</p>
                          <p className="font-bold text-slate-800">{selected360Resident.occupation || 'Belum/Tidak Bekerja'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Pendidikan Terakhir</p>
                          <p className="font-bold text-slate-800">{selected360Resident.education || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Klasifikasi Ekonomi</p>
                          <p className="font-bold text-slate-800">{selected360Resident.economicStatus || 'Umum'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px]">Alamat Domisili</p>
                          <p className="font-bold text-slate-800">{selected360Resident.address || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. BANSOS */}
                {active360Tab === 'bansos' && (
                  <div className="space-y-3">
                    {(!selected360Resident.bansosList || selected360Resident.bansosList.length === 0) ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                        <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">Tidak Terdaftar Penerima Bansos</p>
                        <p className="text-xs text-slate-400 mt-1">Warga ini belum tercatat dalam data penerima bansos (PKH, BPNT, BLT-DD) aktif.</p>
                      </div>
                    ) : (
                      selected360Resident.bansosList.map((b, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                          <div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase">
                              {b.programName}
                            </span>
                            <h5 className="font-bold text-sm text-slate-900 mt-1">{b.criteria || 'Penerima Bantuan Sosial'}</h5>
                            <p className="text-xs text-slate-500">Tahun Anggaran: {b.year} {b.stage ? `• Tahap ${b.stage}` : ''}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-emerald-700">
                              {b.nominal ? `Rp ${b.nominal.toLocaleString('id-ID')}` : 'Tersalurkan'}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5 uppercase font-mono">{b.disbursementStatus || 'Disalurkan'}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. SURAT & ARSIP */}
                {active360Tab === 'surat' && (
                  <div className="space-y-3">
                    {(!selected360Resident.serviceList || selected360Resident.serviceList.length === 0) ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">Belum Ada Riwayat Surat</p>
                        <p className="text-xs text-slate-400 mt-1">Warga ini belum pernah mengajukan surat administrasi (SKU, SKTM, dsb) secara digital.</p>
                      </div>
                    ) : (
                      selected360Resident.serviceList.map((s, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center">
                              {s.serviceName?.substring(0, 3).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-bold text-xs text-slate-800">{s.serviceName}</h5>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">KODE: {s.trackingCode || s.id}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              s.status === 'selesai' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {s.status}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">{s.requestDate ? new Date(s.requestDate).toLocaleDateString('id-ID') : '-'}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. POSYANDU & KIA */}
                {active360Tab === 'posyandu' && (
                  <div className="space-y-3">
                    {(!selected360Resident.toddlerList || selected360Resident.toddlerList.length === 0) ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                        <Baby className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">Tidak Ada Data Balita / KIA</p>
                        <p className="text-xs text-slate-400 mt-1">Tidak terdaftar data anak balita atau pemantauan gizi/stunting pada NIK ini.</p>
                      </div>
                    ) : (
                      selected360Resident.toddlerList.map((t, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-rose-100 bg-rose-50/40 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-slate-900">{t.name}</h5>
                              {t.isInterventionTarget && (
                                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white uppercase">
                                  Prioritas Intervensi Stunting
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">NIK Anak: {t.nik} • KMS: {t.kmsCardNumber || '-'}</p>
                            <p className="text-[10px] text-slate-400">Tgl Lahir: {t.birthDate ? new Date(t.birthDate).toLocaleDateString('id-ID') : '-'}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 5. ADUAN WARGA */}
                {active360Tab === 'aduan' && (
                  <div className="space-y-3">
                    {(!selected360Resident.complaintList || selected360Resident.complaintList.length === 0) ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                        <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">Tidak Ada Riwayat Aduan</p>
                        <p className="text-xs text-slate-400 mt-1">Warga ini belum pernah mengirimkan laporan pengaduan ke Posko Aduan Desa.</p>
                      </div>
                    ) : (
                      selected360Resident.complaintList.map((c, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">TIKET: {c.ticketNumber} • {c.category || 'Umum'}</span>
                            <h5 className="font-bold text-xs text-slate-800 mt-0.5">{c.title}</h5>
                            <p className="text-[10px] text-slate-400 mt-1">{c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID') : '-'}</p>
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              c.status === 'selesai' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                            }`}>
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">SADEWA 360° MASTER DATA ENGINE</span>
                <button
                  onClick={() => setSelected360Resident(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer shadow-xs"
                >
                  Tutup Profil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL ARSIP DIGITAL --- */}
      <AnimatePresence>
        {viewingArchiveNik && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingArchiveNik(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-serif uppercase tracking-tighter">Riwayat Arsip & Surat Digital</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Database Berkas NIK: {viewingArchiveNik}</p>
                </div>
                <button 
                  onClick={() => setViewingArchiveNik(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-3">
                {residentArchives.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium italic">Tidak ada berkas digital ditemukan untuk warga ini.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {residentArchives.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                            {req.serviceName.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs uppercase tracking-tight">{req.serviceName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">NOMOR: {req.id.substring(0, 8).toUpperCase()} | {req.completedAt ? new Date(req.completedAt).toLocaleDateString('id-ID') : req.requestDate}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            req.status === 'selesai' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {req.status}
                          </span>
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            onClick={() => {
                              addToast('info', 'Membuka Berkas', 'Membuka dokumen riwayat pelayanan...');
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setViewingArchiveNik(null)}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
                >
                  Tutup Database Berkas
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL TAMBAH / EDIT BIODATA LENGKAP --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-200">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
                <h3 className="font-bold font-serif text-base">{editingId ? 'Edit Data Kependudukan' : 'Input Penduduk Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">NIK (16 Digit) *</label>
                    <input type="text" maxLength={16} required placeholder="16 digit angka NIK" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value.replace(/\D/g, '')})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">No. KK (16 Digit) *</label>
                    <input type="text" maxLength={16} required placeholder="16 digit angka No. KK" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" value={formData.kk} onChange={e => setFormData({...formData, kk: e.target.value.replace(/\D/g, '')})} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Nama Lengkap *</label>
                    <input type="text" required placeholder="Nama lengkap sesuai KTP" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Jenis Kelamin</label>
                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Tempat Lahir *</label>
                    <input type="text" required placeholder="Contoh: Pulau Betung" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.birthPlace} onChange={e => setFormData({...formData, birthPlace: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Tanggal Lahir *</label>
                    <input type="date" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Agama</label>
                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.religion || 'Islam'} onChange={e => setFormData({...formData, religion: e.target.value})}>
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Buddha">Buddha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Status Perkawinan</label>
                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.maritalStatus || 'Belum Kawin'} onChange={e => setFormData({...formData, maritalStatus: e.target.value})}>
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
                    </select>
                  </div>
                  
                  {/* Wilayah Dusun & RT/RW */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Wilayah Dusun *</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" 
                      value={formData.dusunId || availableDusuns[0]?.id} 
                      onChange={e => {
                        const selected = availableDusuns.find(d => d.id === e.target.value);
                        setFormData({
                          ...formData, 
                          dusunId: e.target.value,
                          dusun: selected?.name || ''
                        });
                      }}
                    >
                      {availableDusuns.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">RT</label>
                      <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.rt || '01'} onChange={e => setFormData({...formData, rt: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase">RW</label>
                      <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={formData.rw || '01'} onChange={e => setFormData({...formData, rw: e.target.value})} />
                    </div>
                  </div>

                  {/* Alamat Lengkap */}
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Alamat Domisili Lengkap *</label>
                    <textarea 
                      required 
                      rows={2} 
                      placeholder="Contoh: RT 01 RW 01 Dusun Betung Indah, Desa Pulau Betung" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium resize-none" 
                      value={formData.address} 
                      onChange={e => setFormData({...formData, address: e.target.value})} 
                    />
                  </div>
                  
                  {/* Pekerjaan / Mata Pencaharian */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-emerald-600" />
                      <span>Mata Pencaharian / Pekerjaan</span>
                    </label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-900" 
                      value={formData.occupation || 'Petani / Pekebun'} 
                      onChange={e => setFormData({...formData, occupation: e.target.value})}
                    >
                      {STANDARD_OCCUPATIONS.map(occ => (
                        <option key={occ} value={occ}>{occ}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pendidikan Terakhir */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
                      <GraduationCap className="w-3 h-3 text-blue-600" />
                      <span>Tingkat Pendidikan Terakhir</span>
                    </label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-blue-900" 
                      value={formData.education || 'SMA / SMK / MA'} 
                      onChange={e => setFormData({...formData, education: e.target.value})}
                    >
                      {STANDARD_EDUCATIONS.map(edu => (
                        <option key={edu} value={edu}>{edu}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Status Kehidupan</label>
                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-rose-600" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                      <option value="Hidup">Hidup (Aktif)</option>
                      <option value="Meninggal">Meninggal Dunia</option>
                      <option value="Pindah">Pindah Datang/Keluar</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Status Ekonomi</label>
                    <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium" value={formData.economicStatus || 'Umum'} onChange={e => setFormData({...formData, economicStatus: e.target.value as any})}>
                      <option value="Umum">Umum / Reguler</option>
                      <option value="Penerima Bantuan">Penerima Bantuan (DTKS/Bansos)</option>
                      <option value="UMKM Transisi">UMKM Transisi</option>
                      <option value="Mandiri / Pengusaha">Mandiri / Pengusaha</option>
                    </select>
                  </div>
                </div>

                {/* Checklist Flags */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.hasBansos || false} 
                      onChange={e => setFormData({...formData, hasBansos: e.target.checked})} 
                      className="rounded text-emerald-600 focus:ring-0" 
                    />
                    <span>Penerima Bantuan Sosial (Bansos)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.hasSku || false} 
                      onChange={e => setFormData({...formData, hasSku: e.target.checked})} 
                      className="rounded text-amber-600 focus:ring-0" 
                    />
                    <span>Memiliki Usaha / SKU</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-rose-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.isStuntingRisk || false} 
                      onChange={e => setFormData({...formData, isStuntingRisk: e.target.checked})} 
                      className="rounded text-rose-600 focus:ring-0" 
                    />
                    <span>Risiko Stunting (Balita)</span>
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold cursor-pointer">Batal</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer shadow-lg shadow-blue-600/20">Simpan Data</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL IMPORT CSV / EXCEL SENSUS 360 --- */}
      <SmartStatsModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />
    </div>
  );
};

const StatCard = ({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1 transform transition-all hover:scale-[1.02] duration-200">
      <div className={`w-9 h-9 rounded-xl ${colors[color]} border flex items-center justify-center mb-1`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 leading-none">{value.toLocaleString('id-ID')}</h4>
    </div>
  );
};

const calculateAge = (birthDate: string) => {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};
