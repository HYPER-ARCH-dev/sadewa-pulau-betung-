import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { Users, User, UserPlus, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardStatsProps {
  totalPopulation?: number;
  maleCount?: number;
  femaleCount?: number;
  totalFamilies?: number;
  ageData?: { name: string; value: number }[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalPopulation = 0,
  maleCount = 0,
  femaleCount = 0,
  totalFamilies = 0,
  ageData = []
}) => {
  const genderData = [
    { name: 'Laki-laki', value: maleCount, color: '#0369a1' }, // Sky-700
    { name: 'Perempuan', value: femaleCount, color: '#be185d' } // Pink-700
  ];

  return (
    <section className="py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Statistik Kependudukan
          </h2>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Visualisasi data demografi Desa Pulau Betung berdasarkan integrasi pangkalan data SADEWA 360.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Update: {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="civic-card p-6 border-l-4 border-l-emerald-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="civic-badge-label mb-1">Total Penduduk</p>
              <h3 className="text-3xl font-black text-slate-900">{totalPopulation.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium italic">Jiwa Terdata</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="civic-card p-6 border-l-4 border-l-sky-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="civic-badge-label mb-1">Laki-laki</p>
              <h3 className="text-3xl font-black text-slate-900">{maleCount.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium italic">{totalPopulation > 0 ? ((maleCount/totalPopulation)*100).toFixed(1) : '0'}% Rasio</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="civic-card p-6 border-l-4 border-l-pink-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="civic-badge-label mb-1">Perempuan</p>
              <h3 className="text-3xl font-black text-slate-900">{femaleCount.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium italic">{totalPopulation > 0 ? ((femaleCount/totalPopulation)*100).toFixed(1) : '0'}% Rasio</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="civic-card p-6 border-l-4 border-l-amber-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="civic-badge-label mb-1">Total Keluarga</p>
              <h3 className="text-3xl font-black text-slate-900">{totalFamilies.toLocaleString('id-ID')}</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium italic">Kepala Keluarga (KK)</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Ratio Donut */}
        <div className="civic-card p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-emerald-600 rounded-full" />
              Rasio Jenis Kelamin
            </h4>
            <p className="text-xs text-slate-500 mt-1">Perbandingan komposisi penduduk laki-laki dan perempuan.</p>
          </div>
          
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs civic-badge-label">Gender</span>
              <span className="text-2xl font-black text-slate-900">
                {totalPopulation > 0 ? 'Balanced' : 'No Data'}
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-8 mt-4">
            {genderData.map((g) => (
              <div key={g.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-xs font-bold text-slate-700">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Age Group Bar Chart */}
        <div className="civic-card p-6 flex flex-col h-[400px]">
          <div className="mb-6">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-emerald-600 rounded-full" />
              Kelompok Usia Penduduk
            </h4>
            <p className="text-xs text-slate-500 mt-1">Distribusi jumlah penduduk berdasarkan rentang usia (Jiwa).</p>
          </div>

          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9', radius: 8 }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    fontSize: '12px'
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#047857" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
};
