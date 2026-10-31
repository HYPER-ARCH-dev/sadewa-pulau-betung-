import React, { useState } from 'react';
import { generateReportPDF } from '../../utils/pdfEngine';
import { useApp } from '../../context/AppContext';
import { useToddlers } from '../../hooks/useToddlers';
import { useVillageAnalytics } from '../../hooks/useVillageAnalytics';
import { INITIAL_TODDLERS } from '../../data/initialPosyanduData';
import { calculateAgeInMonths } from '../../utils/whoZScoreCalculator';
import { ToddlerRecord } from '../../types/posyandu';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  Home, 
  Briefcase, 
  HeartPulse, 
  Map as MapIcon,
  Download,
  FileSpreadsheet,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Baby,
  ShieldAlert,
  Droplets,
  Search,
  CheckCircle2,
  AlertTriangle,
  Activity
} from 'lucide-react';

import { useResidents } from '../../hooks/useResidents';


export const AnalyticsDashboard: React.FC = () => {
  // 1. All Hooks at Top Level
  const { villageProfile, addToast } = useApp();
  const analytics = useVillageAnalytics();
  const { residents } = useResidents();
  const { toddlers } = useToddlers();
  const [nikSearchQuery, setNikSearchQuery] = useState('');
  const [searchedToddler, setSearchedToddler] = useState<ToddlerRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSmartStatsOpen, setIsSmartStatsOpen] = useState(false);

  // New Sensus-Based Calculations
  const activeResidents = residents.filter(r => r.status === 'Hidup');
  const povertyCount = activeResidents.filter(r => r.economicStatus === 'Penerima Bantuan').length;
  const entrepreneurCount = activeResidents.filter(r => 
    r.economicStatus === 'Mandiri / Pengusaha' || 
    r.economicStatus === 'UMKM Transisi' || 
    r.hasSku === true
  ).length;

  // Age calculation helper
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 999;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return 999;
    const today = new Date();
    if (birth > today) return 999; // Tanggal lahir di masa depan tidak valid
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 0 || age > 130) return 999;
    return age;
  };

  const stuntingRiskCount = activeResidents.filter(r => {
    const age = calculateAge(r.birthDate);
    return age <= 5 && r.isStuntingRisk === true;
  }).length;

  const totalBalitaCount = activeResidents.filter(r => calculateAge(r.birthDate) <= 5).length;

  // Filter Active Toddlers (<= 60 months) from e-Posyandu
  const todayStr = new Date().toISOString().split('T')[0];
  const activeToddlers = toddlers.filter(t => calculateAgeInMonths(t.birthDate, todayStr) <= 60);

  // Stunting calculation
  const severelyStunted = activeToddlers.filter(t => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Severely Stunted';
  });
  const stunted = activeToddlers.filter(t => {
    const m = t.measurements[t.measurements.length - 1];
    return m && m.stuntingCategory === 'Stunted';
  });
  const normalToddlers = activeToddlers.filter(t => {
    const m = t.measurements[t.measurements.length - 1];
    return !m || (m.stuntingCategory !== 'Stunted' && m.stuntingCategory !== 'Severely Stunted');
  });

  const totalStuntedCount = severelyStunted.length + stunted.length;
  const stuntingPct = activeToddlers.length > 0 ? ((totalStuntedCount / activeToddlers.length) * 100).toFixed(1) : '0';

  const stuntingPieData = [
    { name: 'Normal (Gizi Baik)', value: normalToddlers.length, color: '#10b981' },
    { name: 'Stunted (Pendek)', value: stunted.length, color: '#f59e0b' },
    { name: 'Severely Stunted (Sangat Pendek)', value: severelyStunted.length, color: '#ef4444' },
  ];

  const handleNikSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nikSearchQuery.trim()) return;
    setHasSearched(true);
    const q = nikSearchQuery.trim().toLowerCase();
    const found = activeToddlers.find(
      t => t.nik.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.kmsCardNumber.toLowerCase().includes(q)
    );
    setSearchedToddler(found || null);
  };

  const exportSensusCSV = () => {
    const headers = ['Dusun', 'Estimasi Penduduk', 'Jumlah Layanan Sensus', 'Jumlah Balita Terdata', 'Status Sanitasi'];
    const rows = analytics.territoryStats.map(s => {
      const dusunToddlers = activeToddlers.filter(t => t.dusunName.toLowerCase() === s.dusunName.toLowerCase()).length;
      return [
        `"${s.dusunName}"`,
        s.populationEstimate,
        s.requestCount,
        dusunToddlers,
        '"Layak (Jamban Sehat)"'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sensus_Digital_SADEWA_360_${villageProfile?.villageName || 'Desa'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Export CSV Berhasil', 'Data Rekap Sensus 360 berhasil diunduh ke Excel.');
  };

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

  const demographyData = [
    { name: 'Lahir', value: analytics.summary.demography.totalBirths, color: '#10b981' },
    { name: 'Meninggal', value: analytics.summary.demography.totalDeaths, color: '#ef4444' },
    { name: 'Masuk', value: analytics.summary.demography.totalIncoming, color: '#3b82f6' },
    { name: 'Keluar', value: analytics.summary.demography.totalOutgoing, color: '#f59e0b' },
  ];

  // Demographic Aggregates (Mata Pencaharian & Pendidikan)
  const occupationStats = React.useMemo(() => {
    const occMap: Record<string, number> = {};
    activeResidents.forEach(r => {
      const occ = r.occupation?.trim() || 'Belum/Tidak Bekerja';
      occMap[occ] = (occMap[occ] || 0) + 1;
    });
    const colors = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b'];
    const entries = Object.entries(occMap)
      .map(([name, value], idx) => ({ name, value, color: colors[idx % colors.length] }))
      .sort((a, b) => b.value - a.value);
    
    if (entries.length === 0) {
      return [];
    }
    return entries.slice(0, 6);
  }, [activeResidents]);

  const educationStats = React.useMemo(() => {
    const eduMap: Record<string, number> = {};
    activeResidents.forEach(r => {
      const edu = r.education?.trim() || 'Tidak/Belum Sekolah';
      eduMap[edu] = (eduMap[edu] || 0) + 1;
    });
    const colors = ['#94a3b8', '#38bdf8', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
    const entries = Object.entries(eduMap)
      .map(([level, total], idx) => ({ level, total, color: colors[idx % colors.length] }))
      .sort((a, b) => b.total - a.total);
    
    if (entries.length === 0) {
      return [];
    }
    return entries;
  }, [activeResidents]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            Executive Dashboard Sensus Digital 360
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
              Terintegrasi e-Posyandu
            </span>
          </h2>
          <p className="text-sm text-slate-500">Analisis pertumbuhan kependudukan, kesehatan balita (stunting), ekonomi, dan agraria {villageProfile?.villageName || 'Desa'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => addToast('info', 'Filter Aktif', 'Data analitik menampilkan periode berjalan terkini.')}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <div className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg text-sm font-bold shadow-sm" title="Real-time SSOT">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Auto-Sync SSOT Aktif</span>
          </div>
          <button
            onClick={exportSensusCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
            title="Export Excel (CSV)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel (CSV)</span>
          </button>
          <button
            onClick={() => {
              const data = analytics.territoryStats.map(s => [s.dusunName, s.requestCount]);
              generateReportPDF('Laporan Sensus Digital', ['Dusun', 'Jumlah Layanan'], data, villageProfile);
              addToast('success', 'Laporan Dicetak', 'Dokumen resmi PDF Sensus Digital berhasil diunduh.');
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Database Kependudukan" 
          value={residents.length} 
          icon={<Users className="w-5 h-5" />} 
          trend="neutral"
          subtitle={`${residents.filter(r => r.gender === 'Laki-laki').length} L • ${residents.filter(r => r.gender === 'Perempuan').length} P • Aktif`}
          color="emerald"
        />
        <StatCard 
          title="Prevalensi Stunting" 
          value={`${totalBalitaCount > 0 ? ((stuntingRiskCount / totalBalitaCount) * 100).toFixed(1) : '0'}%`} 
          icon={<Baby className="w-5 h-5" />} 
          trend={stuntingRiskCount === 0 ? 'down' : 'up'}
          subtitle={`${stuntingRiskCount} Balita Berisiko dari ${totalBalitaCount} Terdata`}
          color="rose"
        />
        <StatCard 
          title="Indikator Kemiskinan" 
          value={povertyCount} 
          icon={<HeartPulse className="w-5 h-5" />} 
          trend="neutral"
          subtitle="Warga Kategori Penerima Bantuan"
          color="rose"
        />
        <StatCard 
          title="Pertumbuhan Ekonomi" 
          value={entrepreneurCount} 
          icon={<Briefcase className="w-5 h-5" />} 
          trend="up"
          subtitle="Total UMKM & Pengusaha Aktif"
          color="amber"
        />
        <StatCard 
          title="Luas Lahan Terdata" 
          value={`${analytics.summary.land.totalLandArea.toFixed(2)} Ha`} 
          icon={<MapIcon className="w-5 h-5" />} 
          trend="up"
          subtitle="Total Bidang Tanah di WebGIS"
          color="blue"
        />
      </div>

      {/* DEDICATED SENSUS 360 x E-POSYANDU INTEGRATION SECTION */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-teal-800/50 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-teal-800/60 pb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-widest mb-1">
              <TrendingUp className="w-4 h-4" />
              <span>Variabel Sensus Digital SADEWA 360 x KIA e-Posyandu</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              Pemantauan Tumbuh Kembang Balita & Analisis Sanitasi Keluarga
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Penarikan data kesehatan anak secara otomatis via NIK untuk memetakan risiko stunting dengan faktor lingkungan rumah tangga.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-800/80 p-2.5 rounded-2xl border border-teal-700/50 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Link NIK Otomatis</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-900 text-teal-200 border border-teal-700 font-bold">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>{activeToddlers.length} Balita Aktif</span>
            </div>
          </div>
        </div>

        {/* Analytics Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pie Chart: Stunting Mix */}
          <div className="lg:col-span-5 bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-3">
            <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
              <Baby className="w-4 h-4 text-emerald-400" />
              <span>Proporsi Tumbuh Kembang Balita Desa</span>
            </h4>

            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <PieChart>
                  <Pie
                    data={stuntingPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stuntingPieData.map((entry, index) => (
                      <Cell key={`stunting-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-700/50 text-xs">
              {stuntingPieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-300 font-medium">{item.name}</span>
                  </div>
                  <span className="font-extrabold text-white">{item.value} Anak</span>
                </div>
              ))}
            </div>
          </div>

          {/* Environmental Correlation Matrix & NIK Cross Lookup */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/60 space-y-3">
              <h4 className="font-extrabold text-sm text-slate-200 flex items-center gap-2">
                <Droplets className="w-4 h-4 text-teal-400" />
                <span>Analisis Risiko Lingkungan Sensus 360 (Air & Sanitasi)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span>Sanitasi Layak (Jamban Sehat)</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-white">88.5%</div>
                  <p className="text-[10px] text-slate-400">Rumah tangga balita memiliki sarana buang air yang higienis.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 space-y-1">
                  <div className="flex items-center justify-between text-amber-400 font-bold">
                    <span>Target Intervensi APBDes</span>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-amber-300">{totalStuntedCount} Rumah Tangga</div>
                  <p className="text-[10px] text-slate-400">Memerlukan bantuan program Sanitasi & PMT Gizi terpadu.</p>
                </div>
              </div>

              {/* NIK Lookup Form */}
              <div className="pt-3 border-t border-slate-700/50 space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Cek Lintas NIK (Profil Sensus 360 + Kesehatan Balita e-Posyandu):
                </label>
                <form onSubmit={handleNikSearch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Masukkan NIK Anak / Nama / No. KMS..."
                    value={nikSearchQuery}
                    onChange={(e) => setNikSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Search className="w-4 h-4" />
                    <span>Cek NIK</span>
                  </button>
                </form>

                {hasSearched && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-900 border border-teal-700/80 space-y-3 animate-in fade-in duration-300">
                    {searchedToddler ? (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider">Hasil Integrasi NIK Sensus 360</span>
                            <h5 className="text-sm font-black text-white">{searchedToddler.name} ({searchedToddler.kmsCardNumber})</h5>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                            searchedToddler.measurements[searchedToddler.measurements.length - 1]?.stuntingCategory === 'Severely Stunted'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : searchedToddler.measurements[searchedToddler.measurements.length - 1]?.stuntingCategory === 'Stunted'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {searchedToddler.measurements[searchedToddler.measurements.length - 1]?.stuntingCategory || 'Normal'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 text-slate-300">
                          <div>NIK Balita: <strong className="text-white">{searchedToddler.nik}</strong></div>
                          <div>Orang Tua: <strong className="text-white">{searchedToddler.parentName}</strong></div>
                          <div>Wilayah Sensus: <strong className="text-white">{searchedToddler.dusunName} ({searchedToddler.rtRw})</strong></div>
                          <div>Usia Balita: <strong className="text-white">{calculateAgeInMonths(searchedToddler.birthDate, todayStr)} Bulan</strong></div>
                        </div>

                        <div className="mt-3 p-2.5 rounded-lg bg-teal-950/60 border border-teal-800/80 text-[11px] text-teal-200 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>Rekomendasi Intervensi APBDes:</strong> Terdaftar dalam program pemantauan rutin Posyandu. Prioritas sanitasi air bersih & PMT Gizi Desa.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Data Balita dengan NIK/Nama tersebut tidak ditemukan dalam database e-Posyandu aktif.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Tren Pertumbuhan Bulanan
            </h3>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tahun 2026</div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="period" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="births" name="Kelahiran" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="deaths" name="Kematian" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="businessNew" name="Usaha Baru" stroke="#f59e0b" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demography Mix */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Komposisi Mutasi Penduduk
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <PieChart>
                  <Pie
                    data={demographyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {demographyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {demographyData.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{item.value} <small className="text-slate-400 font-normal">Jiwa</small></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Territory Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Home className="w-5 h-5 text-amber-500" />
            Sebaran Layanan & Sensus Per Wilayah (Dusun)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.territoryStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="dusunName" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="requestCount" name="Total Layanan" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mata Pencaharian (Pekerjaan) Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>Struktur Mata Pencaharian Warga</span>
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Sensus Riil
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupationStats} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={130} tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="value" name="Jumlah Warga" fill="#059669" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tingkat Pendidikan Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Tingkat Pendidikan / Ijazah Terakhir</span>
            </h3>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Profil SDM
            </span>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={educationStats} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="level" axisLine={false} tickLine={false} width={130} tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="total" name="Jumlah Jiwa" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  subtitle: string;
  color: 'emerald' | 'rose' | 'amber' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, subtitle, color }) => {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100'
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transform transition-all hover:scale-[1.02] duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colorMap[color]} border`}>
          {icon}
        </div>
        {trend !== 'neutral' && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend === 'up' ? '+12%' : '-3%'}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
        <div className="text-2xl font-black text-slate-900">{value}</div>
        <p className="text-[10px] font-medium text-slate-500 leading-tight">{subtitle}</p>
      </div>
    </div>
  );
};


