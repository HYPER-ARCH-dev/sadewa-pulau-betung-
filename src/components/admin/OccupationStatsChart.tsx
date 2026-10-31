import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { useResidents } from '../../hooks/useResidents';
import { useApp } from '../../context/AppContext';
import {
  Briefcase,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Users,
  Wheat,
  Hammer,
  Store,
  Building2,
  GraduationCap,
  Sparkles,
  HelpCircle,
  ShoppingBag,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportOccupationReportPDF, exportOccupationReportCSV } from '../../utils/occupationReportExport';

interface OccupationStatsChartProps {
  onSelectOccupationFilter?: (occupation: string) => void;
  className?: string;
}

interface SectorStat {
  key: string;
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  color: string;
  fillColor: string;
  icon: React.ReactNode;
  description: string;
}

export const OccupationStatsChart: React.FC<OccupationStatsChartProps> = ({
  onSelectOccupationFilter,
  className = ''
}) => {
  const { residents, loading } = useResidents();
  const { villageProfile, addToast } = useApp();
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [activeSectorKey, setActiveSectorKey] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter only living residents
  const livingResidents = useMemo(() => {
    return residents.filter(r => r.status === 'Hidup');
  }, [residents]);

  // Aggregate by normalized occupation categories
  const { sectorStats, totalCount, hasData } = useMemo(() => {
    const rawTotal = livingResidents.length;
    if (rawTotal === 0) {
      return { sectorStats: [], totalCount: 0, hasData: false };
    }

    // Counters for main categories requested: Tani, Buruh, Wiraswasta, Dagang, Lainnya
    let tani = 0;
    let buruh = 0;
    let wiraswasta = 0;
    let dagang = 0;
    let lainnya = 0;

    livingResidents.forEach(r => {
      const occ = (r.occupation || '').toLowerCase().trim();
      if (/tani|kebun|petani|pekebun|nelayan|ternak|sawah|ladang/.test(occ)) {
        tani++;
      } else if (/buruh|kuli|tukang|harian lepas|pekerja kasar/.test(occ)) {
        buruh++;
      } else if (/wiraswasta|umkm|wirausaha|pengusaha|bengkel|jasa/.test(occ)) {
        wiraswasta++;
      } else if (/dagang|pedagang|toko|warung|jual|penjual|pasar|kelontong/.test(occ)) {
        dagang++;
      } else {
        lainnya++;
      }
    });

    const total = rawTotal;
    const computedStats: SectorStat[] = [
      {
        key: 'tani',
        name: 'Petani / Pekebun (Tani)',
        shortName: 'Tani',
        count: tani,
        percentage: Number(((tani / total) * 100).toFixed(1)),
        color: '#059669',
        fillColor: '#10b981',
        icon: <Wheat className="w-4 h-4 text-emerald-600" />,
        description: 'Pertanian pangan, perkebunan & tambak'
      },
      {
        key: 'buruh',
        name: 'Buruh Harian Lepas',
        shortName: 'Buruh',
        count: buruh,
        percentage: Number(((buruh / total) * 100).toFixed(1)),
        color: '#d97706',
        fillColor: '#f59e0b',
        icon: <Hammer className="w-4 h-4 text-amber-600" />,
        description: 'Pekerja harian, buruh tani & pertukangan'
      },
      {
        key: 'wiraswasta',
        name: 'Wiraswasta / UMKM',
        shortName: 'Wiraswasta',
        count: wiraswasta,
        percentage: Number(((wiraswasta / total) * 100).toFixed(1)),
        color: '#0284c7',
        fillColor: '#38bdf8',
        icon: <Building2 className="w-4 h-4 text-sky-600" />,
        description: 'Usaha mandiri, jasa & industri mikro'
      },
      {
        key: 'dagang',
        name: 'Pedagang / Dagang',
        shortName: 'Dagang',
        count: dagang,
        percentage: Number(((dagang / total) * 100).toFixed(1)),
        color: '#7c3aed',
        fillColor: '#a855f7',
        icon: <Store className="w-4 h-4 text-purple-600" />,
        description: 'Perniagaan kelontong, sembako & kuliner'
      },
      {
        key: 'lainnya',
        name: 'Lainnya (ASN, Karyawan, IRT, Pelajar)',
        shortName: 'Lainnya',
        count: lainnya,
        percentage: Number(((lainnya / total) * 100).toFixed(1)),
        color: '#64748b',
        fillColor: '#94a3b8',
        icon: <Users className="w-4 h-4 text-slate-500" />,
        description: 'Karyawan, ASN, Guru, IRT & Belum Bekerja'
      }
    ];

    return { sectorStats: computedStats, totalCount: total, hasData: true };
  }, [livingResidents]);

  // Chart Data format for Recharts
  const chartData = useMemo(() => {
    return sectorStats.map(s => ({
      name: s.shortName,
      fullName: s.name,
      value: s.count,
      percentage: s.percentage,
      color: s.color,
      description: s.description
    }));
  }, [sectorStats]);

  // Export Handlers
  const handleDownloadPDF = () => {
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      exportOccupationReportPDF(residents, sectorStats, villageProfile);
      addToast('success', 'Laporan PDF Berhasil Diunduh', 'Dokumen resmi statistik mata pencaharian siap dicetak/diarsipkan.');
    } catch (err) {
      console.error('Gagal membuat PDF:', err);
      addToast('error', 'Gagal Mengunduh PDF', 'Terjadi kendala saat menyusun berkas dokumen.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      exportOccupationReportCSV(residents, sectorStats, villageProfile);
      addToast('success', 'Laporan CSV Berhasil Diunduh', 'Data rekapitulasi dan rincian warga berhasil diekspor untuk Excel.');
    } catch (err) {
      console.error('Gagal membuat CSV:', err);
      addToast('error', 'Gagal Mengunduh CSV', 'Terjadi kendala saat memproses berkas spreadsheet.');
    } finally {
      setIsExporting(false);
    }
  };

  // Custom Tooltip Component for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700 text-xs min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold text-slate-200">{data.fullName}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-black" style={{ backgroundColor: data.color, color: '#fff' }}>
              {data.percentage}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span>Jumlah Penduduk:</span>
              <strong className="text-white text-sm font-mono">{data.value.toLocaleString('id-ID')} Jiwa</strong>
            </div>
            <p className="text-[10px] text-slate-400 italic pt-1">{data.description}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 ${className}`}>
      {/* Header Widget */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-serif">
                  Statistik Mata Pencaharian Penduduk
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visualisasi sebaran sektor profesi utama (Tani, Buruh, Wiraswasta, Dagang, Lainnya)
              </p>
            </div>
          </div>
        </div>

        {/* Actions: View Toggle + Download Report */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {/* View Toggle: Bar vs Pie */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan Diagram Batang"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Batang</span>
            </button>
            <button
              onClick={() => setChartType('pie')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartType === 'pie'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tampilkan Diagram Lingkaran (Donut)"
            >
              <PieIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Lingkaran</span>
            </button>
          </div>

          {/* Unduh Laporan Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Unduh Laporan Statistik Pekerjaan Penduduk"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Laporan</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 space-y-1"
                >
                  <div className="px-2.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pilih Format Berkas
                  </div>

                  <button
                    onClick={handleDownloadPDF}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                        Dokumen PDF Resmi (.pdf)
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        Lengkap Kop Desa, sebaran dusun & lembar pengesahan Kades.
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={handleDownloadCSV}
                    className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-emerald-50 transition-colors group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                        Spreadsheet Excel / CSV (.csv)
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        Rekap statistik & data detail per warga (UTF-8 siap Excel).
                      </div>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {!hasData ? (
          <div className="lg:col-span-12 flex flex-col items-center justify-center text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-3xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
              <Briefcase className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-lg">
              <h4 className="text-sm font-bold text-slate-800">Data Penduduk Masih Kosong</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Basis data kependudukan aktif Desa Pulau Betung saat ini belum terisi atau seluruh penduduk berstatus non-aktif. Silakan daftarkan atau impor data warga baru terlebih dahulu melalui panel Database Kependudukan.
              </p>
            </div>
            <button
              onClick={() => onSelectOccupationFilter && onSelectOccupationFilter('tambah_penduduk')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 transition-all active:scale-95 cursor-pointer"
            >
              Tambahkan Warga Baru (Database Kependudukan)
            </button>
          </div>
        ) : (
          <>
            {/* Recharts Container (7 Cols on desktop) */}
            <div className="lg:col-span-7 h-[280px] w-full relative">
              {loading ? (
                <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 italic">
                  Memproses kalkulasi sensus kependudukan...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                  {chartType === 'bar' ? (
                    <BarChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }}
                        interval={0}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="value"
                        radius={[8, 8, 0, 0]}
                        barSize={36}
                        animationDuration={800}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            cursor="pointer"
                            opacity={activeSectorKey === null || activeSectorKey === sectorStats[index].key ? 1 : 0.4}
                            onMouseEnter={() => setActiveSectorKey(sectorStats[index].key)}
                            onMouseLeave={() => setActiveSectorKey(null)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <PieChart>
                      <Tooltip content={<CustomTooltip />} />
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={4}
                        dataKey="value"
                        animationDuration={800}
                      >
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-pie-${index}`}
                            fill={entry.color}
                            stroke="#ffffff"
                            strokeWidth={2}
                            cursor="pointer"
                            opacity={activeSectorKey === null || activeSectorKey === sectorStats[index].key ? 1 : 0.4}
                            onMouseEnter={() => setActiveSectorKey(sectorStats[index].key)}
                            onMouseLeave={() => setActiveSectorKey(null)}
                          />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-[11px] font-bold text-slate-700 mr-2">{value}</span>
                        )}
                      />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              )}

              {/* Central Donut Total Indicator (when in Pie mode) */}
              {chartType === 'pie' && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Jiwa</span>
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {totalCount.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </div>

            {/* Sector Stat Cards Grid (5 Cols on desktop) */}
            <div className="lg:col-span-5 space-y-2.5">
              {sectorStats.map((sector) => {
                const isHovered = activeSectorKey === sector.key;
                return (
                  <div
                    key={sector.key}
                    onMouseEnter={() => setActiveSectorKey(sector.key)}
                    onMouseLeave={() => setActiveSectorKey(null)}
                    onClick={() => onSelectOccupationFilter && onSelectOccupationFilter(sector.shortName)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      isHovered
                        ? 'border-slate-400 bg-slate-50/90 shadow-sm scale-[1.02]'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shadow-2xs"
                          style={{ backgroundColor: `${sector.color}15`, color: sector.color }}
                        >
                          {sector.icon}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{sector.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {sector.description}
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-2">
                        <div className="text-xs font-black text-slate-900 font-mono">
                          {sector.count.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-400">Jiwa</span>
                        </div>
                        <div className="text-[10px] font-bold" style={{ color: sector.color }}>
                          {sector.percentage}%
                        </div>
                      </div>
                    </div>

                    {/* Micro Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(sector.percentage, 100)}%`,
                          backgroundColor: sector.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer Info & Census Source Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {hasData ? (
              <>Terkalkulasi otomatis dari <strong>{totalCount} data warga aktif</strong> di master kependudukan desa.</>
            ) : (
              <>Menampilkan estimasi basis data profil kependudukan (Tambahkan data penduduk untuk sinkronisasi otomatis).</>
            )}
          </span>
        </div>
        <div className="font-mono text-[10px] text-slate-400">
          SADEWA 360 • Real-Time Census Engine
        </div>
      </div>
    </div>
  );
};
