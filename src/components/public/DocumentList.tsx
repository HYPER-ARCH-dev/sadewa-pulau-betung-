import React, { useState } from 'react';
import { VillageService } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Search,
  CheckCircle2,
  ChevronRight,
  Clock,
  Briefcase,
  FileCheck2,
  Scale,
  Landmark,
  HeartHandshake,
  Truck,
  Users,
  ShieldCheck,
  Heart,
  UserCheck,
  Wallet,
  Baby,
  Building2,
  Home
} from 'lucide-react';

/**
 * Pemetaan icon resmi Lucide untuk masing-masing jenis layanan surat SADEWA
 */
export function getServiceIconMeta(name: string = '', id: string = '') {
  const q = (name + ' ' + id).toLowerCase();
  if (q.includes('usaha') || q.includes('sku')) {
    return { Icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', cardBg: 'bg-amber-50 hover:bg-amber-100 border-slate-200 hover:border-amber-300', topBar: 'bg-amber-400' };
  }
  if (q.includes('beda') || q.includes('identitas')) {
    return { Icon: FileCheck2, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', cardBg: 'bg-blue-50 hover:bg-blue-100 border-slate-200 hover:border-blue-300', topBar: 'bg-blue-400' };
  }
  if (q.includes('waris')) {
    return { Icon: Scale, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', cardBg: 'bg-purple-50 hover:bg-purple-100 border-slate-200 hover:border-purple-300', topBar: 'bg-purple-400' };
  }
  if (q.includes('sporadik') || q.includes('tanah')) {
    return { Icon: Landmark, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', cardBg: 'bg-emerald-50 hover:bg-emerald-100 border-slate-200 hover:border-emerald-300', topBar: 'bg-emerald-400' };
  }
  if (q.includes('nikah') || q.includes('kua') || q.includes('n1')) {
    return { Icon: HeartHandshake, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', cardBg: 'bg-rose-50 hover:bg-rose-100 border-slate-200 hover:border-rose-300', topBar: 'bg-rose-400' };
  }
  if (q.includes('pindah')) {
    return { Icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', cardBg: 'bg-indigo-50 hover:bg-indigo-100 border-slate-200 hover:border-indigo-300', topBar: 'bg-indigo-400' };
  }
  if (q.includes('janda') || q.includes('duda')) {
    return { Icon: Users, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', cardBg: 'bg-pink-50 hover:bg-pink-100 border-slate-200 hover:border-pink-300', topBar: 'bg-pink-400' };
  }
  if (q.includes('hilang') || q.includes('kehilangan')) {
    return { Icon: Search, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', cardBg: 'bg-orange-50 hover:bg-orange-100 border-slate-200 hover:border-orange-300', topBar: 'bg-orange-400' };
  }
  if (q.includes('skck') || q.includes('polisi')) {
    return { Icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', cardBg: 'bg-emerald-50 hover:bg-emerald-100 border-slate-200 hover:border-emerald-300', topBar: 'bg-emerald-400' };
  }
  if (q.includes('tidak mampu') || q.includes('sktm')) {
    return { Icon: Heart, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', cardBg: 'bg-red-50 hover:bg-red-100 border-slate-200 hover:border-red-300', topBar: 'bg-red-400' };
  }
  if (q.includes('belum nikah') || q.includes('lajang')) {
    return { Icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', cardBg: 'bg-teal-50 hover:bg-teal-100 border-slate-200 hover:border-teal-300', topBar: 'bg-teal-400' };
  }
  if (q.includes('penghasilan') || q.includes('gaji')) {
    return { Icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', cardBg: 'bg-emerald-50 hover:bg-emerald-100 border-slate-200 hover:border-emerald-300', topBar: 'bg-emerald-400' };
  }
  if (q.includes('lahir') || q.includes('kelahiran')) {
    return { Icon: Baby, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', cardBg: 'bg-cyan-50 hover:bg-cyan-100 border-slate-200 hover:border-cyan-300', topBar: 'bg-cyan-400' };
  }
  if (q.includes('rumah') || q.includes('kpr')) {
    return { Icon: Building2, color: 'text-stone-600', bg: 'bg-stone-50', border: 'border-stone-200', cardBg: 'bg-stone-50 hover:bg-stone-100 border-slate-200 hover:border-stone-300', topBar: 'bg-stone-400' };
  }
  if (q.includes('domisili')) {
    return { Icon: Home, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', cardBg: 'bg-sky-50 hover:bg-sky-100 border-slate-200 hover:border-sky-300', topBar: 'bg-sky-400' };
  }
  return { Icon: FileText, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', cardBg: 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300', topBar: 'bg-slate-400' };
}

interface DocumentListProps {
  onSelectService: (svc: VillageService) => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ onSelectService }) => {
  const { services } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredServices = services.filter((svc) => {
    const matchesSearch =
      svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      svc.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === 'all') return matchesSearch;
    return svc.category === selectedCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Filters & High-Tech Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-900/60 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Semua Kategori' },
            { id: 'kependudukan', label: 'Kependudukan & Nikah' },
            { id: 'usaha', label: 'Usaha & Niaga' },
            { id: 'sosial', label: 'Sosial & Bantuan' },
            { id: 'umum', label: 'Umum & Kepolisian' }
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-1 ring-amber-400 font-black'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari jenis surat / layanan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 shadow-inner"
          />
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((svc) => {
          const { Icon: SvcIcon, color: iconColor, bg: iconBg, cardBg, topBar } = getServiceIconMeta(svc.name, svc.id);
          return (
            <div
              key={svc.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm transition-all duration-300 flex flex-col justify-between relative overflow-hidden group ${cardBg}`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 opacity-80 ${topBar}`} />
              
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
                    <SvcIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {['srv-6', 'srv-7', 'srv-8', 'srv-9', 'srv-nikah-bundle'].includes(svc.id) && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Baru
                      </span>
                    )}
                    <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 shadow-xs">
                      {svc.cost}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">{svc.name}</h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{svc.description}</p>
                </div>

                {/* Requirements List */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 block mb-1.5">
                    Persyaratan Utama:
                  </span>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {svc.requirements.slice(0, 3).map((req, idx) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est: {svc.estimatedDays}</span>
                </span>
                <button
                  onClick={() => onSelectService(svc)}
                  className={`w-full sm:w-auto px-5 py-2.5 ${topBar} hover:brightness-90 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center space-x-1.5 cursor-pointer`}
                >
                  <span>Ajukan Surat</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
