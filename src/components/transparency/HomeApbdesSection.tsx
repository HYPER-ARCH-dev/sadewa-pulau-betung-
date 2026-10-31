import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  PieChart,
  LayoutList,
  ArrowRight,
  TrendingUp,
  Layers,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Activity,
  Info,
  Clock
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell
} from 'recharts';
import {
  IsometricSvgDefs,
  Isometric3DDonut,
  Isometric3DDonutItem
} from './IsometricChartElements';

type VisualMode = 'donut' | 'bar' | 'classic';

const INCOME_COLORS = ['#059669', '#10b981', '#34d399', '#0d9488'];
const EXP_COLORS = ['#ea580c', '#f97316', '#f59e0b', '#fbbf24', '#f43f5e'];

export const HomeApbdesSection: React.FC = () => {
  const { apbdesData, navigateTo } = useApp();
  const [visualMode, setVisualMode] = useState<VisualMode>('donut');
  const [activeDonutPillar, setActiveDonutPillar] = useState<'income' | 'expenditure'>('income');

  // Safe numbers directly from SSOT apbdesData
  const totalIncome = apbdesData?.totalIncome || 1285400000;
  const totalIncomeRealized = apbdesData?.totalIncomeRealized ?? Math.round(totalIncome * 0.684);
  const incPercent = totalIncome > 0 ? (totalIncomeRealized / totalIncome) * 100 : 68.4;
  const incRemaining = Math.max(0, totalIncome - totalIncomeRealized);

  const totalExpenditure = apbdesData?.totalExpenditure || 1248900000;
  const totalExpenditureRealized = apbdesData?.totalExpenditureRealized ?? Math.round(totalExpenditure * 0.674);
  const expPercent = totalExpenditure > 0 ? (totalExpenditureRealized / totalExpenditure) * 100 : 67.4;
  const expRemaining = Math.max(0, totalExpenditure - totalExpenditureRealized);

  const totalFinancing = apbdesData?.totalFinancing || 36500000;
  const totalFinancingRealized = apbdesData?.totalFinancingRealized ?? totalFinancing;
  const finPercent = 100;

  // Breakdown items
  const incomeItems = (apbdesData?.incomeItems && apbdesData.incomeItems.length > 0)
    ? apbdesData.incomeItems
    : (apbdesData?.incomeBreakdown && apbdesData.incomeBreakdown.length > 0)
    ? apbdesData.incomeBreakdown.map((b) => ({
        category: b.category,
        targetBudget: b.amount,
        realizedBudget: b.realizedAmount ?? Math.round(b.amount * 0.7)
      }))
    : [
        { category: 'Dana Desa (DDS / APBN)', targetBudget: 792400000, realizedBudget: 554680000 },
        { category: 'Alokasi Dana Desa (ADD)', targetBudget: 418000000, realizedBudget: 271700000 },
        { category: 'Bagi Hasil Pajak & Retribusi', targetBudget: 42000000, realizedBudget: 29400000 },
        { category: 'Pendapatan Asli Desa (PADes)', targetBudget: 33000000, realizedBudget: 23420000 }
      ];

  const expenditureItems = (apbdesData?.expenditureItems && apbdesData.expenditureItems.length > 0)
    ? apbdesData.expenditureItems
    : (apbdesData?.expenditureBreakdown && apbdesData.expenditureBreakdown.length > 0)
    ? apbdesData.expenditureBreakdown.map((b) => ({
        category: b.category,
        targetBudget: b.amount,
        realizedBudget: b.realizedAmount ?? Math.round(b.amount * 0.65)
      }))
    : [
        { category: 'Penyelenggaraan Pemerintahan Desa', targetBudget: 425600000, realizedBudget: 297920000 },
        { category: 'Pelaksanaan Pembangunan Desa', targetBudget: 512300000, realizedBudget: 348364000 },
        { category: 'Pembinaan Kemasyarakatan', targetBudget: 112000000, realizedBudget: 76160000 },
        { category: 'Pemberdayaan Masyarakat Desa', targetBudget: 145000000, realizedBudget: 82650000 },
        { category: 'Penanggulangan Bencana & Darurat', targetBudget: 54000000, realizedBudget: 37006000 }
      ];

  const formatCompactRp = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)} M`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)} Jt`;
    return val.toLocaleString('id-ID');
  };

  // 3D Donut Dataset for Income
  const income3DDonutData: Isometric3DDonutItem[] = incomeItems.map((item, idx) => ({
    name: item.category
      .replace('Dana Desa (DDS / APBN)', 'Dana Desa (DDS)')
      .replace('Alokasi Dana Desa (ADD)', 'Alokasi ADD')
      .replace('Bagi Hasil Pajak & Retribusi', 'Bagi Hasil Pajak')
      .replace('Pendapatan Asli Desa (PADes)', 'PADes'),
    fullName: item.category,
    pagu: item.targetBudget || 0,
    value: item.targetBudget || 0,
    realisasi: item.realizedBudget ?? Math.round((item.targetBudget || 0) * 0.7),
    percent: totalIncome > 0 ? Number(((item.targetBudget || 0) / totalIncome * 100).toFixed(1)) : 0,
    color: INCOME_COLORS[idx % INCOME_COLORS.length]
  }));

  // 3D Donut Dataset for Expenditure
  const exp3DDonutData: Isometric3DDonutItem[] = expenditureItems.map((item, idx) => ({
    name: item.category
      .replace('Penyelenggaraan Pemerintahan Desa', 'Bidang Pemerintahan')
      .replace('Pelaksanaan Pembangunan Desa', 'Bidang Pembangunan')
      .replace('Pembinaan Kemasyarakatan', 'Bidang Pembinaan')
      .replace('Pemberdayaan Masyarakat Desa', 'Bidang Pemberdayaan')
      .replace('Penanggulangan Bencana & Darurat', 'Bencana & Darurat'),
    fullName: item.category,
    pagu: item.targetBudget || 0,
    value: item.targetBudget || 0,
    realisasi: item.realizedBudget ?? Math.round((item.targetBudget || 0) * 0.65),
    percent: totalExpenditure > 0 ? Number(((item.targetBudget || 0) / totalExpenditure * 100).toFixed(1)) : 0,
    color: EXP_COLORS[idx % EXP_COLORS.length]
  }));

  // Clean, Luxurious Executive Dual-Bar Comparison Data
  const comparisonBarData = [
    {
      name: 'Pendapatan (Masuk)',
      shortName: 'Pendapatan',
      pagu: totalIncome,
      realisasi: totalIncomeRealized,
      persen: incPercent.toFixed(1),
      sisa: incRemaining,
      colorReal: '#059669', // emerald
      status: 'Kas Masuk'
    },
    {
      name: 'Belanja (Keluar)',
      shortName: 'Belanja',
      pagu: totalExpenditure,
      realisasi: totalExpenditureRealized,
      persen: expPercent.toFixed(1),
      sisa: expRemaining,
      colorReal: '#ea580c', // orange/amber
      status: 'Kas Keluar'
    },
    {
      name: 'Pembiayaan (SILPA)',
      shortName: 'Pembiayaan',
      pagu: totalFinancing,
      realisasi: totalFinancingRealized,
      persen: finPercent.toFixed(1),
      sisa: 0,
      colorReal: '#2563eb', // sapphire blue
      status: 'Saldo Cadangan'
    }
  ];

  // Custom Chart Tooltip for Dual-Bar
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs p-3 rounded-2xl shadow-2xl border border-slate-700/80 z-50 pointer-events-none min-w-[220px]">
          <div className="font-extrabold text-amber-300 border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between">
            <span>{data.name || label}</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {data.persen}% Tercapai
            </span>
          </div>
          <div className="space-y-1.5 font-sans">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                <span>Pagu Target:</span>
              </span>
              <strong className="text-white font-mono">Rp {Number(data.pagu).toLocaleString('id-ID')}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span>Kas Realisasi:</span>
              </span>
              <strong className="text-emerald-400 font-mono">Rp {Number(data.realisasi).toLocaleString('id-ID')}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
              <span>Sisa Anggaran:</span>
              <span className="font-mono">Rp {Number(data.sisa).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* SVG Global Definitions for High-DPI 3D Isometric Shaders & Shadows */}
      <IsometricSvgDefs />

      <section className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg">
        {/* HEADER TOOLBAR & MODE SWITCHER */}
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-emerald-50/20 to-teal-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20 shrink-0">
              <Landmark className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full border border-emerald-300/60 whitespace-nowrap">
                  Transparansi
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 whitespace-nowrap">
                  TA {apbdesData?.year || 2026}
                </span>
              </div>
              <h3 className="text-xs sm:text-base font-black text-slate-900 tracking-tight mt-0.5 leading-tight">
                eTransparansi & Realisasi Anggaran
              </h3>
            </div>
          </div>

          <div className="flex items-center w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            {/* Visualizer Mode Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner flex items-center text-[10px] sm:text-xs font-bold text-slate-600 min-w-max">
              <button
                type="button"
                onClick={() => setVisualMode('classic')}
                className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  visualMode === 'classic'
                    ? 'bg-white text-emerald-800 shadow-sm font-extrabold border border-slate-200'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <LayoutList className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-600" />
                <span>Klasik</span>
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('donut')}
                className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  visualMode === 'donut'
                    ? 'bg-white text-emerald-800 shadow-sm font-extrabold border border-slate-200'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <PieChart className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-500" />
                <span>3D Donut</span>
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('bar')}
                className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1 cursor-pointer ${
                  visualMode === 'bar'
                    ? 'bg-white text-emerald-800 shadow-sm font-extrabold border border-slate-200'
                    : 'hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <BarChart3 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-600" />
                <span>Batang</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 SUMMARY MACRO PILLARS */}
        <div className="p-4 sm:p-5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Pilar 1: Pendapatan Desa */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-white to-teal-500/5 p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs space-y-2 relative overflow-hidden group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-xs font-extrabold text-emerald-900">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <span className="block leading-none text-[10px] sm:text-xs">Pendapatan Desa</span>
                  <span className="text-[9px] sm:text-[10px] text-emerald-700 font-medium">Realisasi Kas</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300/80 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black font-mono">
                  {incPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-2xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                Rp {totalIncome.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Precision Layered Bar */}
            <div className="space-y-1.5 pt-1.5">
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full transition-all duration-700 shadow-xs"
                  style={{ width: `${Math.min(100, incPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                <span>Pagu Target</span>
                <span className="text-emerald-800">Rp {totalIncomeRealized.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Pilar 2: Belanja Desa */}
          <div className="bg-gradient-to-br from-amber-500/10 via-white to-orange-500/5 p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-xs space-y-2 relative overflow-hidden group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:border-amber-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-xs font-extrabold text-amber-950">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <span className="block leading-none text-[10px] sm:text-xs">Belanja Desa</span>
                  <span className="text-[9px] sm:text-[10px] text-amber-700 font-medium">Serapan Kas</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="bg-amber-100 text-amber-950 border border-amber-300/80 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black font-mono">
                  {expPercent.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-2xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                Rp {totalExpenditure.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Precision Layered Bar */}
            <div className="space-y-1.5 pt-1.5">
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-700 shadow-xs"
                  style={{ width: `${Math.min(100, expPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                <span>Alokasi Pagu</span>
                <span className="text-amber-900">Rp {totalExpenditureRealized.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Pilar 3: Pembiayaan & SILPA */}
          <div className="bg-gradient-to-br from-blue-500/10 via-white to-indigo-500/5 p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs space-y-2 relative overflow-hidden group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:border-blue-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5 text-xs font-extrabold text-blue-950">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="block leading-none text-[10px] sm:text-xs">Pembiayaan Neto</span>
                  <span className="text-[9px] sm:text-[10px] text-blue-700 font-medium">Status SILPA</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="bg-blue-100 text-blue-950 border border-blue-300/80 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black font-mono">
                  100%
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-2xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                Rp {totalFinancing.toLocaleString('id-ID')}
              </div>
            </div>

            {/* Precision Layered Bar */}
            <div className="space-y-1.5 pt-1.5">
              <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-700 shadow-xs"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                <span>Fiskal Desa</span>
                <span className="text-blue-800">Rp {totalFinancingRealized.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* VISUALIZATION CANVAS */}
        <div className="p-4 sm:p-6">
          {/* MODE 1: 3D DONUT CHART (The Signature 3D Exploded Isometric Donut) */}
          {visualMode === 'donut' && (
            <div className="space-y-5">
              {/* Pillar Switcher within 3D Donut */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="max-w-md">
                  <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Proporsi Anggaran Desa 3D</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Sentuh bagian diagram untuk melihat rincian pagu target dan realisasi kas.
                  </p>
                </div>

                <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-[10px] font-bold shrink-0 self-start sm:self-auto overflow-x-auto hide-scrollbar min-w-max">
                  <button
                    type="button"
                    onClick={() => setActiveDonutPillar('income')}
                    className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                      activeDonutPillar === 'income'
                        ? 'bg-emerald-700 text-white shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-3 h-3" />
                    <span>Pendapatan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDonutPillar('expenditure')}
                    className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer ${
                      activeDonutPillar === 'expenditure'
                        ? 'bg-amber-600 text-white shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Belanja</span>
                  </button>
                </div>
              </div>

              {/* 3D Isometric Donut Component */}
              <div className="bg-slate-50/50 rounded-3xl p-3 sm:p-4 border border-slate-200/80">
                {activeDonutPillar === 'income' ? (
                  <Isometric3DDonut
                    data={income3DDonutData}
                    dataKey="pagu"
                    nameKey="name"
                    centerLabel="Realisasi Kas"
                    centerValue={`${incPercent.toFixed(1)}%`}
                    showCalloutLines={true}
                    showInteractiveLegend={true}
                  />
                ) : (
                  <Isometric3DDonut
                    data={exp3DDonutData}
                    dataKey="pagu"
                    nameKey="name"
                    centerLabel="Serapan Kas"
                    centerValue={`${expPercent.toFixed(1)}%`}
                    showCalloutLines={true}
                    showInteractiveLegend={true}
                  />
                )}
              </div>
            </div>
          )}

          {/* MODE 2: DIAGRAM BATANG KOMPARASI (Easy to read, clean, executive dual-bar) */}
          {visualMode === 'bar' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Komparasi Pagu Target vs Realisasi Kas Nyata (eTransparansi TA {apbdesData?.year || 2026})</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grafik bersih & mewah yang membandingkan target eTransparansi dengan uang kas yang telah terealisasi.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 font-bold text-slate-600">
                    <span className="w-3 h-3 rounded-md bg-slate-300 inline-block" />
                    <span>Pagu (Target)</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block" />
                    <span>Kas Nyata (Realisasi)</span>
                  </div>
                </div>
              </div>

              {/* Crystal-Clear Dual-Bar Chart */}
              <div className="w-full h-72 sm:h-80 bg-slate-50/60 rounded-2xl border border-slate-200/80 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                  <RechartsBarChart
                    data={comparisonBarData}
                    margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={(value) => `${(value / 1_000_000).toFixed(0)} Jt`}
                    />
                    <RechartsTooltip content={<CustomBarTooltip />} />
                    <Bar
                      dataKey="pagu"
                      name="Pagu Anggaran"
                      fill="#94a3b8"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                    <Bar
                      dataKey="realisasi"
                      name="Kas Realisasi"
                      fill="#059669"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    >
                      {comparisonBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.colorReal} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>

              {/* Informative Highlights Pill Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/70 flex items-start gap-2.5 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-emerald-950 font-bold">Penerimaan Pendapatan ({incPercent.toFixed(1)}%)</strong>
                    <p className="text-[11px] text-emerald-800 leading-snug">
                      Penerimaan Dana Desa (DDS) dan ADD tahap berjalan terserap sesuai kalender kas.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/70 flex items-start gap-2.5 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
                  <div className="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-amber-950 font-bold">Realisasi Belanja ({expPercent.toFixed(1)}%)</strong>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Dialokasikan pada kegiatan pembangunan fisik, pembinaan, dan pemberdayaan masyarakat.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200/70 flex items-start gap-2.5 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <strong className="block text-blue-950 font-bold">Kondisi Kas Sehat & Terkendali</strong>
                    <p className="text-[11px] text-blue-800 leading-snug">
                      Kas desa terjaga akuntabel, tanpa defisit dan tertib administrasi keuangan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: MODE KLASIK (Rincian Sumber & 5 Bidang) */}
          {visualMode === 'classic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Rincian Sumber Pendapatan */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                    Sumber Dana Pendapatan ({incomeItems.length})
                  </h4>
                  <span className="text-xs font-black text-emerald-800">
                    Rp {totalIncome.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {incomeItems.map((item, idx) => {
                    const target = item.targetBudget || 1;
                    const real = item.realizedBudget ?? Math.round(target * 0.7);
                    const pct = Math.min(100, (real / target) * 100);
                    return (
                      <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
                        <div className="flex justify-between items-start text-xs font-bold text-slate-900">
                          <span className="truncate pr-2">{item.category}</span>
                          <span className="shrink-0 text-emerald-800 font-mono">Rp {target.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>Realisasi Kas: Rp {real.toLocaleString('id-ID')}</span>
                          <span className="font-extrabold text-emerald-700">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rincian 5 Bidang Belanja */}
              <div className="p-4 sm:p-5 rounded-3xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                    Alokasi 5 Bidang Belanja
                  </h4>
                  <span className="text-xs font-black text-amber-900">
                    Rp {totalExpenditure.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {expenditureItems.map((item, idx) => {
                    const target = item.targetBudget || 1;
                    const real = item.realizedBudget ?? Math.round(target * 0.65);
                    const pct = Math.min(100, (real / target) * 100);
                    return (
                      <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md">
                        <div className="flex justify-between items-start text-xs font-bold text-slate-900">
                          <span className="truncate pr-2">{idx + 1}. {item.category}</span>
                          <span className="shrink-0 text-amber-900 font-mono">Rp {target.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>Realisasi Kas: Rp {real.toLocaleString('id-ID')}</span>
                          <span className="font-extrabold text-amber-800">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER CALL-TO-ACTION */}
        <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sesuai amanat UU Keterbukaan Informasi Publik (KIP) & Regulasi Kemendagri / Kemendes PDTT.
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('transparansi')}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <span>Halaman Transparansi Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
