import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BudgetYearData } from '../../types';
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  PieChart as PieChartIcon,
  DollarSign,
  Layers,
  ArrowDownToLine,
  AlertTriangle,
  Info,
  Landmark,
  Calendar,
  Zap,
  ArrowRight,
  Search,
  Users
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  Cell,
  CartesianGrid
} from 'recharts';
import { motion } from 'motion/react';
import { VillageDemographicCharts } from '../transparency/VillageDemographicCharts';

export const TransparencyView: React.FC = () => {
  const { budget, budgetHistory, villageProfile, territories, addToast } = useApp();

  const [selectedYear, setSelectedYear] = useState<number>(budget.year || 2026);
  const [selectedDocType, setSelectedDocType] = useState<'murni' | 'perubahan'>(
    budget.documentType || 'murni'
  );

  // Active budget dataset selected
  const activeBudget: BudgetYearData =
    budgetHistory.find(
      (b) => b.year === selectedYear && (b.documentType || 'murni') === selectedDocType
    ) || budget;

  const handleDownloadDoc = (docTitle: string, status: string) => {
    if (status === 'DATA BELUM TERSEDIA') {
      addToast(
        'warning',
        'Dokumen Belum Tersedia',
        `Dokumen resmi "${docTitle}" belum diunggah oleh Pemerintah ${villageProfile.villageName}. File asli akan dapat diunduh setelah dokumen Perdes APBDes disahkan BPD.`
      );
    } else {
      addToast(
        'info',
        'Unduh Berkas Demo',
        `File draf simulasi "${docTitle}" dibuka untuk keperluan tinjauan format.`
      );
    }
  };

  const incTotal = activeBudget.totalIncome || 1;
  const incRealized = activeBudget.totalIncomeRealized ?? Math.round(incTotal * 0.684);
  const incPct = Math.min(100, (incRealized / incTotal) * 100);

  const expTotal = activeBudget.totalExpenditure || 1;
  const expRealized = activeBudget.totalExpenditureRealized ?? Math.round(expTotal * 0.674);
  const expPct = Math.min(100, (expRealized / expTotal) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 space-y-10">
      {/* LUXURY BANNER: Transparansi APBDes (The Sapphire Vault) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 border-2 border-blue-500/30 shadow-2xl group mb-8"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.15),_transparent_50%)]"></div>
        <div className="absolute -left-8 -top-8 opacity-10 text-blue-400 transform -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-700">
          <BarChart3 className="w-56 h-56" />
        </div>
        
        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] sm:text-xs font-semibold backdrop-blur-sm">
              <Landmark className="w-4 h-4 text-blue-400" />
              <span>Keterbukaan Informasi Publik (KIP Desa)</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight font-serif">
              Transparansi & Akuntabilitas Publik
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-300 max-w-2xl leading-relaxed">
              Pusat keterbukaan informasi tata kelola eTransparansi, realisasi anggaran kas, data agregat demografi kependudukan, serta dokumen pertanggungjawaban resmi {villageProfile.villageName || 'Desa Pulau Betung'}.
            </p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-blue-200/90 font-semibold bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                <span>eTransparansi & Realisasi Kas</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-200/90 font-semibold bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                <Users className="w-3.5 h-3.5 text-emerald-300" />
                <span>Statistik & Demografi Warga</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-200/80 font-semibold bg-white/10 px-3 py-1 rounded-lg border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                <span>{activeBudget.legalRefNumber || `PERDES NO. 02 TAHUN ${activeBudget.year}`}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Overlay */}
          <div className="shrink-0 w-full lg:w-72 space-y-3">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-[10px] font-black text-blue-300 tracking-wider">
                <span>REALISASI PENDAPATAN</span>
                <span className="text-white text-xs">{incPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${incPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-black text-blue-300 tracking-wider">
                <span>REALISASI BELANJA</span>
                <span className="text-white text-xs">{expPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${expPct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* High-Tech Cyber Tahun Anggaran & Document Switcher */}
      <div className="bg-slate-900/90 dark:bg-slate-950/90 rounded-2xl p-4 sm:p-5 text-white shadow-2xl border border-blue-500/30 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md ring-1 ring-blue-500/20">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <Calendar className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-200">
            Pilih Tahun Anggaran & Dokumen:
          </span>
          <div className="flex items-center space-x-2">
            {[2026, 2025].map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedYear === yr
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 scale-105'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                }`}
              >
                TA {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Murni vs Perubahan Switcher */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setSelectedDocType('murni')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              selectedDocType === 'murni'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            eTransparansi Murni
          </button>
          <button
            onClick={() => setSelectedDocType('perubahan')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              selectedDocType === 'perubahan'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            eTransparansi Perubahan
          </button>
        </div>
      </div>

      {/* Regulatory Transparency Notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex items-start gap-3.5 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <p className="font-bold uppercase tracking-wide text-emerald-900">
            TRANSPARANSI KEUANGAN RESMI PEMERINTAH {villageProfile.villageName.toUpperCase()}:
          </p>
          <p className="text-emerald-800 leading-relaxed">
            Data ini telah disahkan berdasarkan <strong>{activeBudget.legalRefNumber || `Peraturan ${villageProfile.villageName}`}</strong> dan disetujui BPD. Seluruh warga dan pihak publik berhak memantau serapan anggaran pembangunan dan program masyarakat desa.
          </p>
        </div>
      </div>

      {/* Big Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
              {incPct.toFixed(1)}% REALISASI
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">Total Pendapatan Desa:</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-900 tracking-tight">
            Rp {activeBudget.totalIncome.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            Realisasi: Rp {incRealized.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900">
              {expPct.toFixed(1)}% REALISASI
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">Total Belanja Desa:</span>
          <div className="text-xl sm:text-2xl font-black text-amber-900 tracking-tight">
            Rp {activeBudget.totalExpenditure.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-amber-800 font-semibold">
            Realisasi: Rp {expRealized.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900">
              NETO BALANCED
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">Pembiayaan Neto (SILPA):</span>
          <div className="text-xl sm:text-2xl font-black text-blue-900 tracking-tight">
            Rp {activeBudget.totalFinancing.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold">SILPA Tahun Sebelumnya</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-900">
              AKUNTABEL
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">Status Capaian Fisik:</span>
          <div className="text-xl sm:text-2xl font-black text-purple-900 tracking-tight">
            {activeBudget.realizationPercentage}%
          </div>
          <div className="text-[11px] text-purple-700 font-semibold">Capaian Kegiatan Pembangunan</div>
        </div>
      </div>

      {/* RECHARTS VISUALIZATION: Perbandingan Target vs Realisasi APBDes */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Grafik Komparasi eTransparansi {villageProfile.villageName}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 font-serif">
              Visualisasi Target Anggaran vs Realisasi Kas (TA {activeBudget.year})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grafik interaktif serapan dana desa untuk memudahkan warga memahami perbandingan pagu dan realisasi belanja.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-[11px] font-bold bg-emerald-50 text-emerald-900 px-3 py-1 rounded-full border border-emerald-200">
              Dokumen {selectedDocType === 'perubahan' ? 'eTransparansi Perubahan' : 'eTransparansi Murni'}
            </span>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <RechartsBarChart
              data={[
                {
                  kategori: 'Pendapatan Desa',
                  Target: activeBudget.totalIncome,
                  Realisasi: incRealized,
                  pct: incPct.toFixed(1)
                },
                {
                  kategori: 'Belanja Desa',
                  Target: activeBudget.totalExpenditure,
                  Realisasi: expRealized,
                  pct: expPct.toFixed(1)
                },
                {
                  kategori: 'Pembiayaan Neto',
                  Target: activeBudget.totalFinancing,
                  Realisasi: activeBudget.totalFinancing,
                  pct: '100.0'
                }
              ]}
              margin={{ top: 20, right: 15, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="kategori" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => {
                  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} M`;
                  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} Jt`;
                  return `${val}`;
                }}
              />
              <RechartsTooltip
                formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Nominal']}
                contentStyle={{
                  borderRadius: '16px',
                  fontSize: '12px',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  border: '1px solid #334155'
                }}
              />
              <RechartsLegend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="Target" name="Pagu Target (Rp)" fill="#94a3b8" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Realisasi" name="Realisasi Berjalan (Rp)" fill="#059669" radius={[8, 8, 0, 0]} />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Serapan Pendapatan:</span>
            <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              {incPct.toFixed(1)}%
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Serapan Belanja:</span>
            <span className="text-xs font-black font-mono text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
              {expPct.toFixed(1)}%
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900">Capaian Fisik Lapangan:</span>
            <span className="text-xs font-black font-mono text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
              {activeBudget.realizationPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* RECHARTS VISUALIZATION: Demografi & Kependudukan Desa */}
      <VillageDemographicCharts
        villageName={villageProfile.villageName}
        totalPopulation={villageProfile.totalPopulation || 2845}
        totalFamilies={villageProfile.totalFamilies || 782}
        territories={territories}
      />

      {/* Detailed Breakdown: Pendapatan & Belanja */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rincian Sumber Pendapatan */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">Rincian Sumber Pendapatan Desa</h2>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
              TA {activeBudget.year}
            </span>
          </div>

          <div className="space-y-4">
            {activeBudget.incomeBreakdown.map((item, idx) => {
              const itemReal = item.realizedAmount ?? Math.round(item.amount * 0.7);
              const pct = Math.min(100, (itemReal / item.amount) * 100);

              return (
                <div key={idx} className="space-y-1.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                  <div className="flex justify-between text-xs font-bold text-slate-900">
                    <span>{item.category}</span>
                    <span className="font-mono text-emerald-900">
                      Rp {item.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Realisasi: Rp {itemReal.toLocaleString('id-ID')}</span>
                    <span className="font-bold text-emerald-700">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">{item.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rincian Pos Belanja Desa */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-amber-700" />
              <h2 className="text-lg font-bold text-slate-900">Rincian 5 Bidang Belanja Desa</h2>
            </div>
            <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg">
              TA {activeBudget.year}
            </span>
          </div>

          <div className="space-y-4">
            {activeBudget.expenditureBreakdown.map((item, idx) => {
              const itemReal = item.realizedAmount ?? Math.round(item.amount * 0.65);
              const pct = Math.min(100, (itemReal / item.amount) * 100);

              return (
                <div key={idx} className="space-y-1.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                  <div className="flex justify-between text-xs font-bold text-slate-900">
                    <span>{item.category}</span>
                    <span className="font-mono text-amber-900">
                      Rp {item.amount.toLocaleString('id-ID')} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Realisasi: Rp {itemReal.toLocaleString('id-ID')}</span>
                    <span className="font-bold text-amber-800">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Download Dokumen Publik Resmi */}
      <section className="bg-slate-50 rounded-3xl p-6 sm:p-10 border border-slate-200 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dokumen Publik & Peraturan Desa eTransparansi</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Unduh salinan resmi Perdes eTransparansi dan Laporan Keuangan Desa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeBudget.publicDocuments.map((doc, idx) => (
            <div
              key={doc.id || idx}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between hover:border-slate-300 transition-all"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                    {doc.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold uppercase">
                      {doc.category}
                    </span>
                    <span className="text-[11px] text-slate-400">Ukuran: {doc.fileSize}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDownloadDoc(doc.title, 'DATA RESMI')}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-emerald-700 hover:text-white text-slate-700 transition-colors shrink-0 ml-3 cursor-pointer"
                title="Unduh Dokumen"
              >
                <ArrowDownToLine className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
