import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  Users,
  Building2,
  TrendingUp,
  ShieldCheck,
  Award,
  Baby,
  Activity,
  Briefcase,
  GraduationCap,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Layers,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';
import { DusunRecord } from '../../types';
import { useResidents } from '../../hooks/useResidents';

interface VillageDemographicChartsProps {
  villageName?: string;
  totalPopulation?: number;
  totalFamilies?: number;
  territories?: DusunRecord[];
}

export const VillageDemographicCharts: React.FC<VillageDemographicChartsProps> = ({
  villageName = 'Desa Pulau Betung',
  totalPopulation = 2845,
  totalFamilies = 782,
  territories = []
}) => {
  const [activeTab, setActiveTab] = useState<'dusun' | 'usia' | 'pekerjaan' | 'pendidikan'>('dusun');
  const { residents } = useResidents();

  // Sinkronisasi data riil master kependudukan (case-insensitive)
  const activeResidents = useMemo(() => residents.filter(r => (r.status || '').toLowerCase() === 'hidup'), [residents]);
  const hasMasterData = activeResidents.length > 0;

  const effectiveTotalPopulation = hasMasterData ? activeResidents.length : (totalPopulation || 2845);
  const effectiveTotalFamilies = useMemo(() => {
    return hasMasterData 
      ? new Set(activeResidents.map(r => r.kk).filter(Boolean)).size 
      : (totalFamilies || Math.round(effectiveTotalPopulation / 3.6));
  }, [hasMasterData, activeResidents, totalFamilies, effectiveTotalPopulation]);

  // 1. Data Sebaran Penduduk per Dusun (Agregat Wilayah Desa)
  const dusunData = useMemo(() => {
    if (hasMasterData) {
      const grouped: Record<string, { total: number; kkSet: Set<string>; laki: number; perempuan: number }> = {};
      activeResidents.forEach(r => {
        const dName = r.dusun || 'Dusun 1';
        if (!grouped[dName]) {
          grouped[dName] = { total: 0, kkSet: new Set(), laki: 0, perempuan: 0 };
        }
        grouped[dName].total += 1;
        if (r.kk) grouped[dName].kkSet.add(r.kk);
        if (r.gender === 'Laki-laki') grouped[dName].laki += 1;
        else if (r.gender === 'Perempuan') grouped[dName].perempuan += 1;
      });

      return Object.entries(grouped).map(([name, stat]) => ({
        name,
        total: stat.total,
        kk: stat.kkSet.size || Math.round(stat.total / 3.6),
        laki: stat.laki,
        perempuan: stat.perempuan
      }));
    }

    // Fallback sebaran berbasis wilayah teritorial atau dusun profil
    const fallbackDusuns = territories.length > 0
      ? territories.map((t, idx) => {
          const ratio = idx === 0 ? 0.42 : idx === 1 ? 0.35 : 0.23;
          const tot = Math.round(effectiveTotalPopulation * ratio);
          return {
            name: t.name,
            total: tot,
            kk: Math.round(tot / 3.6),
            laki: Math.round(tot * 0.51),
            perempuan: Math.round(tot * 0.49)
          };
        })
      : [
          { name: 'Dusun I Betung Jaya', total: Math.round(effectiveTotalPopulation * 0.42), kk: Math.round((effectiveTotalPopulation * 0.42) / 3.6), laki: Math.round(effectiveTotalPopulation * 0.42 * 0.51), perempuan: Math.round(effectiveTotalPopulation * 0.42 * 0.49) },
          { name: 'Dusun II Betung Indah', total: Math.round(effectiveTotalPopulation * 0.35), kk: Math.round((effectiveTotalPopulation * 0.35) / 3.6), laki: Math.round(effectiveTotalPopulation * 0.35 * 0.51), perempuan: Math.round(effectiveTotalPopulation * 0.35 * 0.49) },
          { name: 'Dusun III Betung Makmur', total: Math.round(effectiveTotalPopulation * 0.23), kk: Math.round((effectiveTotalPopulation * 0.23) / 3.6), laki: Math.round(effectiveTotalPopulation * 0.23 * 0.51), perempuan: Math.round(effectiveTotalPopulation * 0.23 * 0.49) }
        ];
    return fallbackDusuns;
  }, [hasMasterData, activeResidents, territories, effectiveTotalPopulation]);

  // 2. Data Piramida / Komposisi Kelompok Usia (Standar BPS/Kemenkes)
  const ageGroupData = useMemo(() => {
    if (hasMasterData) {
      const today = new Date();
      const calculateAge = (bDate: string) => {
        if (!bDate) return null;
        const b = new Date(bDate);
        if (isNaN(b.getTime())) return null;
        
        const today = new Date();
        if (b > today) return null;

        let age = today.getFullYear() - b.getFullYear();
        const m = today.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
        
        if (age < 0 || age > 130) return null;
        return age;
      };

      const counts = [
        { range: '0 - 4 Thn (Balita)', count: 0, color: '#10b981', desc: 'Prioritas e-Posyandu & Pencegahan Stunting' },
        { range: '5 - 14 Thn (Anak/Pelajar)', count: 0, color: '#06b6d4', desc: 'Wajib Belajar Pendidikan Dasar' },
        { range: '15 - 39 Thn (Pemuda/Produktif)', count: 0, color: '#3b82f6', desc: 'Tenaga Kerja & Wirausaha Muda' },
        { range: '40 - 59 Thn (Pra-Lansia)', count: 0, color: '#f59e0b', desc: 'Penggerak Ekonomi & Rumah Tangga' },
        { range: '≥ 60 Thn (Lansia)', count: 0, color: '#8b5cf6', desc: 'Layanan Posbindu & Jaminan Sosial' },
        { range: 'Tidak Diketahui', count: 0, color: '#64748b', desc: 'Format tanggal lahir kosong atau tidak valid' }
      ];

      activeResidents.forEach(r => {
        const age = calculateAge(r.birthDate);
        if (age === null) {
          counts[5].count++;
        } else if (age <= 4) {
          counts[0].count++;
        } else if (age <= 14) {
          counts[1].count++;
        } else if (age <= 39) {
          counts[2].count++;
        } else if (age <= 59) {
          counts[3].count++;
        } else {
          counts[4].count++;
        }
      });

      const total = activeResidents.length || 1;
      return counts.map(c => ({
        range: c.range,
        jumlah: c.count,
        persentase: parseFloat(((c.count / total) * 100).toFixed(1)),
        color: c.color,
        desc: c.desc
      }));
    }

    // Fallback proporsi usia standar BPS
    const defaultRatios = [
      { range: '0 - 4 Thn (Balita)', ratio: 0.088, color: '#10b981', desc: 'Prioritas e-Posyandu & Pencegahan Stunting' },
      { range: '5 - 14 Thn (Anak/Pelajar)', ratio: 0.165, color: '#06b6d4', desc: 'Wajib Belajar Pendidikan Dasar' },
      { range: '15 - 39 Thn (Pemuda/Produktif)', ratio: 0.412, color: '#3b82f6', desc: 'Tenaga Kerja & Wirausaha Muda' },
      { range: '40 - 59 Thn (Pra-Lansia)', ratio: 0.238, color: '#f59e0b', desc: 'Penggerak Ekonomi & Rumah Tangga' },
      { range: '≥ 60 Thn (Lansia)', ratio: 0.097, color: '#8b5cf6', desc: 'Layanan Posbindu & Jaminan Sosial' }
    ];

    return defaultRatios.map(d => {
      const cnt = Math.round(effectiveTotalPopulation * d.ratio);
      return {
        range: d.range,
        jumlah: cnt,
        persentase: parseFloat((d.ratio * 100).toFixed(1)),
        color: d.color,
        desc: d.desc
      };
    });
  }, [hasMasterData, activeResidents, effectiveTotalPopulation]);

  // 3. Mata Pencaharian / Profesi Utama Warga
  const occupationData = useMemo(() => {
    if (hasMasterData) {
      const occMap: Record<string, number> = {};
      activeResidents.forEach(r => {
        const occ = r.occupation?.trim() || 'Lainnya';
        occMap[occ] = (occMap[occ] || 0) + 1;
      });

      const colors = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b', '#10b981'];
      const total = activeResidents.length || 1;
      const sorted = Object.entries(occMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

      return sorted.map(([name, val], idx) => ({
        name,
        value: val,
        pct: `${((val / total) * 100).toFixed(1)}%`,
        color: colors[idx % colors.length]
      }));
    }

    const fallbackOcc = [
      { name: 'Petani / Pekebun', pct: '48.5%', ratio: 0.485, color: '#059669' },
      { name: 'Buruh Harian Lepas', pct: '21.0%', ratio: 0.210, color: '#0284c7' },
      { name: 'Pedagang / Wiraswasta', pct: '13.5%', ratio: 0.135, color: '#d97706' },
      { name: 'Karyawan Swasta', pct: '9.2%', ratio: 0.092, color: '#7c3aed' },
      { name: 'ASN / TNI / POLRI', pct: '4.8%', ratio: 0.048, color: '#db2777' },
      { name: 'Lainnya', pct: '3.0%', ratio: 0.030, color: '#64748b' }
    ];

    return fallbackOcc.map(f => ({
      name: f.name,
      value: Math.round(effectiveTotalPopulation * f.ratio),
      pct: f.pct,
      color: f.color
    }));
  }, [hasMasterData, activeResidents, effectiveTotalPopulation]);

  // 4. Jenjang Pendidikan Terakhir (Agregat SDM Desa)
  const educationData = useMemo(() => {
    if (hasMasterData) {
      const eduMap: Record<string, number> = {};
      activeResidents.forEach(r => {
        const edu = r.education?.trim() || 'Tidak/Belum Sekolah';
        eduMap[edu] = (eduMap[edu] || 0) + 1;
      });

      const colors = ['#94a3b8', '#38bdf8', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'];
      const sorted = Object.entries(eduMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

      return sorted.map(([level, total], idx) => ({
        level,
        total,
        color: colors[idx % colors.length]
      }));
    }

    const fallbackEdu = [
      { level: 'SMA / SMK / MA', ratio: 0.42, color: '#3b82f6' },
      { level: 'SMP / MTs', ratio: 0.26, color: '#38bdf8' },
      { level: 'SD / Sederajat', ratio: 0.18, color: '#10b981' },
      { level: 'Diploma / Sarjana (S1/S2)', ratio: 0.09, color: '#8b5cf6' },
      { level: 'Belum / Tidak Tamat SD', ratio: 0.05, color: '#94a3b8' }
    ];

    return fallbackEdu.map(f => ({
      level: f.level,
      total: Math.round(effectiveTotalPopulation * f.ratio),
      color: f.color
    }));
  }, [hasMasterData, activeResidents, effectiveTotalPopulation]);

  // Custom tooltip formatter untuk Recharts (rupiah / jiwa)
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1">
          <p className="font-bold text-emerald-400">{label || payload[0]?.name}</p>
          {payload.map((entry: any, index: number) => (
            <p key={`item-${index}`} className="flex items-center justify-between gap-3 text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </span>
              <strong className="text-white font-mono">{entry.value.toLocaleString('id-ID')} Jiwa</strong>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-800 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Visualisasi Kependudukan & Demografi Desa</span>
            </div>
            {hasMasterData ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>Live Master Data ({activeResidents.length.toLocaleString('id-ID')} Jiwa)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                <span>Rekapitulasi Profil</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif">
            Statistik & Distribusi Penduduk {villageName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Data statistik agregat kependudukan yang transparan, aman, dan mematuhi kaidah UU Perlindungan Data Pribadi (UU PDP No. 27/2022) tanpa membuka data individu perorangan.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 self-start md:self-center">
          {[
            { id: 'dusun', label: 'Wilayah Dusun', icon: Building2 },
            { id: 'usia', label: 'Kelompok Usia', icon: Baby },
            { id: 'pekerjaan', label: 'Mata Pencaharian', icon: Briefcase },
            { id: 'pendidikan', label: 'Tingkat Pendidikan', icon: GraduationCap }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metric Highlights Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Penduduk</div>
          <div className="text-xl sm:text-2xl font-black text-blue-950 font-serif mt-0.5">
            {effectiveTotalPopulation.toLocaleString('id-ID')} <span className="text-xs font-semibold text-blue-700">Jiwa</span>
          </div>
          <div className="text-[10px] text-blue-600/90 mt-0.5">Penduduk aktif berdomisili</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Kepala Keluarga</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-950 font-serif mt-0.5">
            {effectiveTotalFamilies.toLocaleString('id-ID')} <span className="text-xs font-semibold text-emerald-700">KK</span>
          </div>
          <div className="text-[10px] text-emerald-600/90 mt-0.5">Rata-rata 3.6 jiwa/keluarga</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Usia Produktif</div>
          <div className="text-xl sm:text-2xl font-black text-amber-950 font-serif mt-0.5">
            {ageGroupData.length >= 4 
              ? `${(ageGroupData[2].persentase + ageGroupData[3].persentase).toFixed(1)}%` 
              : '0.0%'}
          </div>
          <div className="text-[10px] text-amber-700/90 mt-0.5">Rentang usia 15 - 59 tahun</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Sektor Terbanyak</div>
          <div className="text-xl sm:text-2xl font-black text-purple-950 font-serif mt-0.5">
            {occupationData.length > 0 ? occupationData[0].pct : '0.0%'}
          </div>
          <div className="text-[10px] text-purple-700/90 mt-0.5 line-clamp-1">
            {occupationData.length > 0 ? occupationData[0].name : 'Belum Ada Data'}
          </div>
        </div>
      </div>

      {/* CHART CONTENT TABS */}
      <div className="pt-2">
        {/* TAB 1: SEBARAN DUSUN */}
        {activeTab === 'dusun' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
              <span className="font-semibold text-slate-700">
                Grafik Perbandingan Komposisi Penduduk Laki-Laki vs Perempuan per Wilayah Dusun:
              </span>
              <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-md font-mono text-slate-600">
                Satuan: Jiwa
              </span>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <BarChart data={dusunData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip content={renderCustomTooltip} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="laki" name="Laki-laki" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="perempuan" name="Perempuan" fill="#ec4899" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sub-grid of Dusun detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {dusunData.map((d, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs space-y-1">
                  <div className="font-bold text-slate-900">{d.name}</div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Total Penduduk:</span>
                    <strong className="text-slate-900 font-mono">{d.total.toLocaleString('id-ID')} Jiwa</strong>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Jumlah KK:</span>
                    <span className="font-semibold font-mono">{d.kk} KK</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>L / P:</span>
                    <span className="font-semibold font-mono">{d.laki} L / {d.perempuan} P</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: KELOMPOK USIA */}
        {activeTab === 'usia' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-600 font-semibold">
              Distribusi Piramida Kelompok Usia Penduduk Desa (Berdasarkan Data Lahir):
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <BarChart
                  data={ageGroupData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis type="category" dataKey="range" tick={{ fontSize: 11, fill: '#334155' }} width={140} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Jiwa`, 'Jumlah Penduduk']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', backgroundColor: '#0f172a', color: '#fff' }}
                  />
                  <Bar dataKey="jumlah" name="Jumlah Jiwa" radius={[0, 8, 8, 0]}>
                    {ageGroupData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {ageGroupData.map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-start gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: item.color }} />
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900">{item.range}</div>
                    <div className="text-xs font-black font-mono text-slate-700">
                      {item.jumlah} Jiwa <span className="text-[10px] font-normal text-slate-500">({item.persentase}%)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MATA PENCAHARIAN */}
        {activeTab === 'pekerjaan' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 h-64 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <PieChart>
                  <Pie
                    data={occupationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {occupationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} Jiwa`, 'Populasi']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', backgroundColor: '#0f172a', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-6 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Rincian Sektor Profesi & Ekonomi Penduduk:
              </h4>
              <div className="space-y-2">
                {occupationData.map((occ, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: occ.color }} />
                      <span className="font-semibold text-slate-800">{occ.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{occ.value} Jiwa</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                        {occ.pct}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PENDIDIKAN */}
        {activeTab === 'pendidikan' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-600 font-semibold">
              Jenjang Pendidikan Terakhir Penduduk (Indikator Indeks Pembangunan Manusia Desa):
            </div>

            <div className="h-64 sm:h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                <BarChart data={educationData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="level" tick={{ fontSize: 11, fill: '#475569' }} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} Jiwa`, 'Jumlah Penduduk']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', backgroundColor: '#0f172a', color: '#fff' }}
                  />
                  <Bar dataKey="total" name="Jumlah Jiwa" radius={[8, 8, 0, 0]}>
                    {educationData.map((entry, index) => (
                      <Cell key={`edu-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-blue-50/60 p-3 rounded-xl border border-blue-100">
              💡 <strong>Keterangan Pembangunan SDM:</strong> Mayoritas penduduk usia produktif {villageName} telah menuntaskan program Wajib Belajar 12 Tahun (SLTA), dan tren lulusan perguruan tinggi (Diploma/Sarjana) mengalami peningkatan berkelanjutan berkat program beasiswa desa dan kemudahan akses perkuliahan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
