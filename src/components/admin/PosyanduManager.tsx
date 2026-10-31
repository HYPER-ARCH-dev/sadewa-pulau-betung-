import React, { useState } from 'react';
import { ToddlerRecord, ToddlerMeasurement, PosyanduSchedule } from '../../types/posyandu';
import { INITIAL_TODDLERS, INITIAL_POSYANDU_SCHEDULES } from '../../data/initialPosyanduData';
import { calculateAgeInMonths, calculateZScoreHeightForAge, calculateZScoreWeightForAge, calculateZScoreWeightForHeight, evaluateOverallStatus, generateNutritionAdvice } from '../../utils/whoZScoreCalculator';
import { KmsDigitalChart } from '../posyandu/KmsDigitalChart';
import { PosyanduSpatialMap } from '../posyandu/PosyanduSpatialMap';
import { PosyanduReportPrintModal } from '../posyandu/PosyanduReportPrintModal';
import { KiaCardPrintModal } from '../posyandu/KiaCardPrintModal';
import { useApp } from '../../context/AppContext';
import { useToddlers } from '../../hooks/useToddlers';
import { useResidents } from '../../hooks/useResidents';
import { useServiceRequests } from '../../hooks/useServiceRequests';
import {
  Baby,
  Plus,
  Search,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Phone,
  Printer,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Map,
  ShieldCheck,
  User,
  X,
  Send,
  Activity
} from 'lucide-react';

export const PosyanduManager: React.FC = () => {
  const { villageProfile, territories, addToast } = useApp();
  const { toddlers, loading: toddlersLoading, addToddler, updateToddler, seedInitialData: seedToddlers } = useToddlers();
  const { residents } = useResidents();
  const { serviceRequests, loading: reqLoading } = useServiceRequests();
  const [schedules] = useState<PosyanduSchedule[]>(INITIAL_POSYANDU_SCHEDULES);

  // Use React.useEffect to trigger seeding
  React.useEffect(() => {
    seedToddlers();
  }, []);

  const [activeTab, setActiveTab] = useState<'records' | 'map' | 'schedule'>('records');
  const [selectedToddler, setSelectedToddler] = useState<ToddlerRecord | null>(null);

  // Initialize selectedToddler when toddlers load
  React.useEffect(() => {
    if (!selectedToddler && toddlers.length > 0) {
      setSelectedToddler(toddlers[0]);
    }
  }, [toddlers, selectedToddler]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMeasureModalOpen, setIsMeasureModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isKiaModalOpen, setIsKiaModalOpen] = useState(false);
  const [kiaModalToddler, setKiaModalToddler] = useState<ToddlerRecord | null>(null);
  const [isNewKiaRegistration, setIsNewKiaRegistration] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDusunFilter, setSelectedDusunFilter] = useState('all');

  // Form states for New Toddler Registration
  const [newNik, setNewNik] = useState('');
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState<'L' | 'P'>('L');
  const [newBirthDate, setNewBirthDate] = useState('2025-03-10');
  const [newBirthWeight, setNewBirthWeight] = useState('3.2');
  const [newBirthHeight, setNewBirthHeight] = useState('49.5');
  const [newParentNik, setNewParentNik] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('0812-3456-7890');
  // Parent Lookup Logic
  const handleParentLookup = (nik: string) => {
    setNewParentNik(nik);
    if (nik.length === 16) {
      const found = residents.find(r => r.nik === nik);
      if (found) {
        setNewParentName(found.name);
        if (found.phone) setNewParentPhone(found.phone);
        if (found.dusun) setNewParentDusun(found.dusun);
        if (found.rt && found.rw) setNewRtRw(`RT ${found.rt} / RW ${found.rw}`);
        addToast('success', 'Data Orang Tua Ditemukan', `Profil ${found.name} otomatis dimuat dari database master.`);
      }
    }
  };

  const [newParentDusun, setNewParentDusun] = useState('Dusun Betung Indah');
  const [newRtRw, setNewRtRw] = useState('RT 01 / RW 01');
  const [newCoords, setNewCoords] = useState<[number, number] | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Form states for New Monthly Measurement
  const [measureDate, setMeasureDate] = useState(new Date().toISOString().split('T')[0]);
  const [measureWeight, setMeasureWeight] = useState('10.5');
  const [measureHeight, setMeasureHeight] = useState('82.0');
  const [measureHead, setMeasureHead] = useState('46.5');
  const [measureVitA, setMeasureVitA] = useState(true);
  const [measureDeworming, setMeasureDeworming] = useState(false);
  const [measureImmunization, setMeasureImmunization] = useState('Lengkap');
  const [measureNotes, setMeasureNotes] = useState('');

  // Sub-tab for Records
  const [recordTab, setRecordTab] = useState<'aktif' | 'lulus'>('aktif');

  // Categorize Toddlers
  const todayStr = new Date().toISOString().split('T')[0];
  const activeToddlers = toddlers.filter(t => calculateAgeInMonths(t.birthDate, todayStr) <= 60);
  const graduatedToddlers = toddlers.filter(t => calculateAgeInMonths(t.birthDate, todayStr) > 60);

  const displayedToddlers = recordTab === 'aktif' ? activeToddlers : graduatedToddlers;

  // Stats calculation (ONLY FOR ACTIVE TODDLERS)
  const total = activeToddlers.length;
  const severelyStunted = activeToddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Severely Stunted';
  }).length;
  const stunted = activeToddlers.filter((t) => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Stunted';
  }).length;

  const totalStunted = severelyStunted + stunted;
  const prevalencePct = total > 0 ? ((totalStunted / total) * 100).toFixed(1) : '0';

  // Filtered Toddlers
  const filteredToddlers = displayedToddlers.filter((t) => {
    const matchesQuery =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.nik.includes(searchQuery) ||
      t.kmsCardNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDusun = selectedDusunFilter === 'all' || t.dusunName === selectedDusunFilter;
    return matchesQuery && matchesDusun;
  });

  // Handle Add New Toddler
  const handleCreateToddler = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newNik) {
      addToast('warning', 'Form Belum Lengkap', 'Silakan isi nama dan NIK balita');
      return;
    }

    const birthWeightNum = parseFloat(newBirthWeight) || 3.0;
    const birthHeightNum = parseFloat(newBirthHeight) || 49.0;
    const ageInMonths = calculateAgeInMonths(newBirthDate, measureDate);

    const { zScore: zTb, category: catTb } = calculateZScoreHeightForAge(birthHeightNum, ageInMonths, newGender);
    const { zScore: zBb, category: catBb } = calculateZScoreWeightForAge(birthWeightNum, ageInMonths, newGender);
    const { zScore: zBbTb } = calculateZScoreWeightForHeight(birthWeightNum, birthHeightNum, newGender);
    const overall = evaluateOverallStatus(catTb, catBb);

    const newRecord: ToddlerRecord = {
      id: `T-${Date.now().toString().slice(-4)}`,
      nik: newNik,
      name: newName,
      gender: newGender,
      birthDate: newBirthDate,
      birthWeightKg: birthWeightNum,
      birthHeightCm: birthHeightNum,
      parentNik: newParentNik,
      parentName: newParentName || 'Orang Tua Balita',
      parentPhone: newParentPhone,
      dusunName: newParentDusun,
      rtRw: newRtRw,
      address: `${newRtRw} ${newParentDusun}`,
      coordinates: newCoords ? newCoords : [-1.6050 + (Math.random() - 0.5) * 0.008, 103.3500 + (Math.random() - 0.5) * 0.008],
      kmsCardNumber: `KIA-PB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      isInterventionTarget: catTb === 'Severely Stunted' || catTb === 'Stunted',
      measurements: [
        {
          id: `M-${Date.now()}`,
          toddlerId: `T-${Date.now().toString().slice(-4)}`,
          measurementDate: measureDate,
          ageInMonths,
          weightKg: birthWeightNum,
          heightCm: birthHeightNum,
          headCircumferenceCm: 34.0,
          vitA: true,
          deworming: false,
          immunizationStatus: 'Lengkap DPT 1',
          zScoreHeightForAge: zTb,
          zScoreWeightForAge: zBb,
          zScoreWeightForHeight: zBbTb,
          stuntingCategory: catTb,
          weightCategory: catBb,
          overallStatus: overall,
          cadreNotes: 'Registrasi awal balita di Posyandu SADEWA.',
          measuredBy: 'Kader Posyandu'
        }
      ]
    };

    addToddler(newRecord);
    setSelectedToddler(newRecord);
    setIsAddModalOpen(false);

    // Buka otomatis panel cetak Kartu KIA untuk balita baru
    setKiaModalToddler(newRecord);
    setIsNewKiaRegistration(true);
    setIsKiaModalOpen(true);

    addToast('success', 'Balita Terdaftar & KIA Siap Cetak', `Ananda ${newName} berhasil dicatat dengan No. KIA ${newRecord.kmsCardNumber}`);
  };

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      addToast('error', 'GPS Tidak Tersedia', 'Browser atau perangkat Anda tidak mendukung pelacakan lokasi GPS.');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewCoords([position.coords.latitude, position.coords.longitude]);
        addToast('success', 'GPS Terkunci', 'Koordinat balita berhasil direkam berdasarkan lokasi akurat saat ini.');
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error mendapatkan GPS:', error);
        addToast('warning', 'Akses GPS Ditolak / Gagal', 'Gagal melacak lokasi. Mohon izinkan akses lokasi pada browser Anda, atau titik peta akan diacak otomatis.');
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Add Monthly Measurement
  const handleAddMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToddler) return;

    const wNum = parseFloat(measureWeight) || 10.0;
    const hNum = parseFloat(measureHeight) || 80.0;
    const headNum = parseFloat(measureHead) || 46.0;

    const ageInMonths = calculateAgeInMonths(selectedToddler.birthDate, measureDate);

    const { zScore: zTb, category: catTb } = calculateZScoreHeightForAge(hNum, ageInMonths, selectedToddler.gender);
    const { zScore: zBb, category: catBb } = calculateZScoreWeightForAge(wNum, ageInMonths, selectedToddler.gender);
    const { zScore: zBbTb } = calculateZScoreWeightForHeight(wNum, hNum, selectedToddler.gender);
    const overall = evaluateOverallStatus(catTb, catBb);

    const newMeasure: ToddlerMeasurement = {
      id: `M-${Date.now()}`,
      toddlerId: selectedToddler.id,
      measurementDate: measureDate,
      ageInMonths,
      weightKg: wNum,
      heightCm: hNum,
      headCircumferenceCm: headNum,
      vitA: measureVitA,
      deworming: measureDeworming,
      immunizationStatus: measureImmunization,
      zScoreHeightForAge: zTb,
      zScoreWeightForAge: zBb,
      zScoreWeightForHeight: zBbTb,
      stuntingCategory: catTb,
      weightCategory: catBb,
      overallStatus: overall,
      cadreNotes: measureNotes || 'Penimbangan rutin bulanan.',
      measuredBy: 'Bidan / Kader Posyandu'
    };

    const updatedRecord = {
      ...selectedToddler,
      isInterventionTarget: catTb === 'Severely Stunted' || catTb === 'Stunted',
      measurements: [...selectedToddler.measurements, newMeasure]
    };

    updateToddler(updatedRecord);
    setSelectedToddler(updatedRecord);
    setIsMeasureModalOpen(false);
    addToast('success', 'Hasil Timbang Tersimpan', `Penimbangan balita ${selectedToddler.name} berhasil dihitung Z-Score WHO`);
  };

  // WhatsApp Intervensi Gizi & Pengingat Trigger
  const sendWhatsAppIntervention = (toddler: ToddlerRecord) => {
    const latest = toddler.measurements[toddler.measurements.length - 1];
    const phoneClean = toddler.parentPhone.replace(/[^0-9]/g, '');

    const adviceText = latest
      ? generateNutritionAdvice(toddler.name, latest.stuntingCategory, latest.weightCategory)
      : 'Mohon hadir pada jadwal penimbangan Posyandu mendatang.';

    const message = `Assalamu’alaikum Warahmatullahi Wabarakatuh.\n\n` +
      `Pemberitahuan Resmi e-Posyandu & Tim Pendamping Keluarga (TPK) ${villageProfile.villageName || 'Desa'}:\n` +
      `Kepada Yth. Ibu/Bapak *${toddler.parentName}* (Orang Tua dari Ananda *${toddler.name}*).\n\n` +
      `Berdasarkan hasil penimbangan antropometri standar WHO terakhir pada tanggal *${latest?.measurementDate || '-'}*:\n` +
      `• Usia Balita: *${latest?.ageInMonths || 0} Bulan*\n` +
      `• Tinggi Badan: *${latest?.heightCm || 0} cm* (Z-Score: ${latest?.zScoreHeightForAge || 0} SD)\n` +
      `• Status Tumbuh Kembang: *${latest?.overallStatus || 'Diperiksa'}*\n\n` +
      `💡 *Rekomendasi Intervensi Gizi:* ${adviceText}\n\n` +
      `Dimohon kehadiran Ibu/Bapak pada kegiatan Posyandu rutin bulanan mendatang guna mendapatkan Suplementasi Vitamin A & Makanan Tambahan (PMT) Protein Hewani.\n\n` +
      `_Pemerintah ${villageProfile.villageName || 'Desa'} & Bidan Desa Pemayung_`;

    const waUrl = `https://wa.me/${phoneClean.startsWith('0') ? '62' + phoneClean.slice(1) : phoneClean}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendWaBroadcast = (sch: PosyanduSchedule) => {
    const text = `*PENGINGAT JADWAL POSYANDU ${sch.posyanduName.toUpperCase()}*\n\nKepada Yth. Ibu-Ibu Orang Tua Balita di *${sch.dusunName}*,\n\nMengingatkan kembali agenda penimbangan, imunisasi & pengukuran tumbuh kembang balita:\n🗓 *Hari/Tgl:* ${sch.scheduleDate}\n⏰ *Waktu:* ${sch.startTime} - ${sch.endTime} WIB\n📍 *Lokasi:* ${sch.location}\n👩‍⚕️ *Bidan/Kader:* ${sch.bidanInCharge} (${sch.cadreInCharge})\n\n📌 *Catatan:* ${sch.notes || 'Harap membawa Buku KIA / Kartu KMS Balita.'}\n\nMari bersama kita cegah stunting demi masa depan anak-anak ${villageProfile?.villageName || 'Desa Pulau Betung'}!`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    addToast('success', 'WhatsApp Terbuka', `Pesan broadcast jadwal Posyandu ${sch.posyanduName} siap dikirim.`);
  };

  return (
    <div className="space-y-8">
      {/* Header Dashboard Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
            Modul Birokrasi Kesehatan & TPK Desa
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Dasbor e-Posyandu & Monitoring Stunting Spasial
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            Sistem informasi tumbuh kembang balita dengan kalkulator Z-Score WHO, pemetaan spasial stunting WebGIS, serta pengirim pesan intervensi WhatsApp terintegrasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Cetak Rekap Laporan KIA (PDF)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Daftar Balita Baru</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">Total Terdata</span>
            <Baby className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{total} Balita</div>
          <p className="text-[11px] text-slate-500">Tersebar di {schedules.length} Dusun</p>
        </div>

        <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-bold uppercase">Sangat Pendek (Severe)</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-900">{severelyStunted} Anak</div>
          <p className="text-[11px] text-rose-700 font-medium">Z-Score TB/U &lt; -3.0 SD</p>
        </div>

        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold uppercase">Pendek (Stunting)</span>
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900">{stunted} Anak</div>
          <p className="text-[11px] text-amber-800 font-medium">Z-Score TB/U -3SD s/d -2SD</p>
        </div>

        <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase">Prevalensi Stunting</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900">{prevalencePct}%</div>
          <p className="text-[11px] text-emerald-800 font-medium">Target Nasional &lt; 14%</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'records'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Baby className="w-4 h-4" />
          <span>Daftar Balita & KMS Digital</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'map'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>Peta Spasial Stunting (WebGIS)</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'schedule'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Jadwal Posyandu & Broadcast WA</span>
        </button>
      </div>

      {/* TAB 1: Daftar Balita & KMS */}
      {activeTab === 'records' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Filterable List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setRecordTab('aktif')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${recordTab === 'aktif' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Balita Aktif (&le; 60 bln)
                </button>
                <button
                  onClick={() => setRecordTab('lulus')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${recordTab === 'lulus' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Alumni / Lulus (&gt; 60 bln)
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <h3 className="font-extrabold text-slate-900 text-sm">Cari & Filter {recordTab === 'aktif' ? 'Balita' : 'Alumni'}</h3>
                <span className="text-xs font-bold text-emerald-800">{filteredToddlers.length} data</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Cari nama, NIK, atau no. KIA..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={selectedDusunFilter}
                onChange={(e) => setSelectedDusunFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-800"
              >
                <option value="all">Semua Wilayah Dusun</option>
                {territories.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* List Cards */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredToddlers.map((t) => {
                const latest = t.measurements[t.measurements.length - 1];
                const isSelected = selectedToddler?.id === t.id;
                const isStunted = latest && (latest.stuntingCategory === 'Severely Stunted' || latest.stuntingCategory === 'Stunted');

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedToddler(t)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-300 shadow-sm'
                        : isStunted
                        ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isStunted ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {latest ? latest.overallStatus : 'Belum Ditimbang'}
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900 mt-1">{t.name}</h4>
                        <p className="text-xs text-slate-600">Ortu: {t.parentName} ({t.parentPhone})</p>
                      </div>

                      {isStunted && (
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-1" />
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span>{t.dusunName}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setKiaModalToddler(t);
                            setIsNewKiaRegistration(false);
                            setIsKiaModalOpen(true);
                          }}
                          className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                          title="Cetak Kartu KIA Balita"
                        >
                          <Printer className="w-2.5 h-2.5 text-emerald-600" />
                          <span>KIA</span>
                        </button>
                      </div>
                      <span className="font-mono font-bold text-slate-700">
                        {latest ? `${latest.heightCm} cm (${latest.zScoreHeightForAge}SD)` : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected KMS & Action Button */}
          <div className="lg:col-span-7 space-y-6">
            {selectedToddler ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Aksi Bidan Desa & TPK:</span>
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setKiaModalToddler(selectedToddler);
                        setIsNewKiaRegistration(false);
                        setIsKiaModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                      title="Cetak Kartu Identitas Anak (KIA) & KMS Lengkap dengan QR Code"
                    >
                      <Printer className="w-4 h-4 text-amber-300" />
                      <span>Cetak Kartu KIA</span>
                    </button>

                    {recordTab === 'aktif' && (
                      <button
                        onClick={() => setIsMeasureModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Catat Penimbangan Bulanan</span>
                      </button>
                    )}

                    <button
                      onClick={() => sendWhatsAppIntervention(selectedToddler)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm flex items-center gap-1.5"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Kirim WA Intervensi Gizi</span>
                    </button>
                  </div>
                </div>

                <KmsDigitalChart toddler={selectedToddler} />
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <Baby className="w-12 h-12 text-slate-400 mx-auto" />
                <h4 className="text-lg font-bold text-slate-800">Pilih Data Balita</h4>
                <p className="text-xs text-slate-500">
                  Pilih salah satu nama balita di sebelah kiri untuk melihat grafik KMS dan menginput penimbangan.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Peta Spasial Stunting (WebGIS) */}
      {activeTab === 'map' && (
        <PosyanduSpatialMap
          toddlers={toddlers}
          onSelectToddler={(t) => {
            setSelectedToddler(t);
            setActiveTab('records');
          }}
          onSendWhatsAppIntervention={(t) => sendWhatsAppIntervention(t)}
        />
      )}

      {/* TAB 3: Jadwal Posyandu & Broadcast WA Dusun */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-xs uppercase tracking-wider mb-1">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Pengiriman Pengingat Pesan Otomatis</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Jadwal Posyandu Dusun & WhatsApp Broadcast
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Kirim pengingat resmi ke grup WhatsApp warga di tiap Dusun dengan satu klik.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-300 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase">
                      {sch.dusunName}
                    </span>
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {sch.startTime} - {sch.endTime} WIB
                    </span>
                  </div>

                  <h4 className="text-lg font-black text-slate-900">{sch.posyanduName}</h4>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{sch.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-bold text-slate-900">{sch.scheduleDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Bidan: <strong>{sch.bidanInCharge}</strong> ({sch.cadreInCharge})</span>
                    </div>
                  </div>

                  {sch.notes && (
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
                      <strong>Catatan:</strong> {sch.notes}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSendWaBroadcast(sch)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Broadcast WA Dusun</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal 1: Register New Toddler */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Pendaftaran Balita Baru (KIA Digital)</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateToddler} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">NIK Balita (16 Digit)</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: 150401..."
                  value={newNik}
                  onChange={(e) => setNewNik(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Lengkap Balita</label>
                <input
                  type="text"
                  required
                  placeholder="Nama balita..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jenis Kelamin</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value as 'L' | 'P')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    required
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Berat Lahir (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newBirthWeight}
                    onChange={(e) => setNewBirthWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Panjang Lahir (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newBirthHeight}
                    onChange={(e) => setNewBirthHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-black text-[10px] text-slate-700 uppercase tracking-widest">Identitas Orang Tua (SSOT Sync)</span>
                </div>
                
                <div>
                  <label className="font-bold text-slate-600 block mb-1">NIK Ibu / Ayah (Auto-Lookup SSOT)</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      maxLength={16}
                      placeholder="Masukkan 16 digit NIK atau cari warga..."
                      value={newParentNik}
                      onChange={(e) => handleParentLookup(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {newParentNik.trim().length >= 3 && newParentNik.length < 16 && (
                    <div className="mt-1 max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm z-10">
                      {residents
                        .filter(r => (r.status || '').toLowerCase() === 'hidup' && (r.nik.includes(newParentNik) || r.name.toLowerCase().includes(newParentNik.toLowerCase())))
                        .slice(0, 4)
                        .map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setNewParentNik(r.nik);
                              setNewParentName(r.name);
                              if (r.phone) setNewParentPhone(r.phone);
                              if (r.dusun) setNewParentDusun(r.dusun);
                              if (r.rt && r.rw) setNewRtRw(`RT ${r.rt} / RW ${r.rw}`);
                              addToast('success', 'Data Orang Tua Terhubung', `Profil ${r.name} otomatis dimuat.`);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 flex justify-between items-center text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900">{r.name}</span>
                              <span className="text-slate-500 ml-2 font-mono text-[11px]">{r.nik}</span>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">{r.dusun || 'Desa'}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nama Orang Tua</label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Ibu/Ayah..."
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">No. WhatsApp</label>
                    <input
                      type="text"
                      required
                      placeholder="08..."
                      value={newParentPhone}
                      onChange={(e) => setNewParentPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Dusun</label>
                    <select
                      value={newParentDusun}
                      onChange={(e) => setNewParentDusun(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold"
                    >
                      {territories.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">RT / RW</label>
                    <input
                      type="text"
                      value={newRtRw}
                      onChange={(e) => setNewRtRw(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Geolocator API Input Area */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isGettingLocation || newCoords !== null}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-xs w-full ${
                    newCoords 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed' 
                      : 'bg-white hover:bg-slate-100 border border-slate-300 text-slate-700'
                  }`}
                >
                  <MapPin className={`w-4 h-4 ${newCoords ? 'text-emerald-600' : 'text-slate-500'} ${isGettingLocation && 'animate-bounce'}`} />
                  {isGettingLocation ? 'Melacak Sinyal GPS...' : newCoords ? 'Titik Peta (GIS) Terkunci' : 'Lacak Titik Peta (GPS) Saat Ini'}
                </button>
                {newCoords && (
                  <button 
                    type="button" 
                    onClick={() => setNewCoords(null)} 
                    className="text-rose-500 hover:text-rose-700 p-2"
                    title="Hapus / Acak ulang koordinat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md"
                >
                  Simpan Balita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Monthly Measurement */}
      {isMeasureModalOpen && selectedToddler && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Input Penimbangan Posyandu Bulanan</h3>
                <p className="text-xs text-slate-500">Ananda: <strong>{selectedToddler.name}</strong> ({selectedToddler.kmsCardNumber})</p>
              </div>
              <button onClick={() => setIsMeasureModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMeasurement} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tanggal Penimbangan</label>
                <input
                  type="date"
                  required
                  value={measureDate}
                  onChange={(e) => setMeasureDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Berat Badan (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={measureWeight}
                    onChange={(e) => setMeasureWeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tinggi Badan (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={measureHeight}
                    onChange={(e) => setMeasureHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lingkar Kepala (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={measureHead}
                    onChange={(e) => setMeasureHead(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={measureVitA}
                    onChange={(e) => setMeasureVitA(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-800">Diberi Vitamin A</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={measureDeworming}
                    onChange={(e) => setMeasureDeworming(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-800">Diberi Obat Cacing</span>
                </label>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status Imunisasi</label>
                <input
                  type="text"
                  value={measureImmunization}
                  onChange={(e) => setMeasureImmunization(e.target.value)}
                  placeholder="Misal: Imunisasi Dasar Lengkap..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan Kader / PMT</label>
                <textarea
                  rows={2}
                  value={measureNotes}
                  onChange={(e) => setMeasureNotes(e.target.value)}
                  placeholder="Misal: Diberi PMT biskuit & telur rebus 2 butir..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMeasureModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-md"
                >
                  Kalkulasi Z-Score WHO & Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Print Official Report */}
      {isReportModalOpen && (
        <PosyanduReportPrintModal
          toddlers={activeToddlers}
          schedules={schedules}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {/* Modal 4: Print Kartu KIA & KMS with QR Code */}
      {isKiaModalOpen && kiaModalToddler && (
        <KiaCardPrintModal
          toddler={kiaModalToddler}
          isNewRegistration={isNewKiaRegistration}
          onClose={() => {
            setIsKiaModalOpen(false);
            setKiaModalToddler(null);
            setIsNewKiaRegistration(false);
          }}
        />
      )}
    </div>
  );
};
