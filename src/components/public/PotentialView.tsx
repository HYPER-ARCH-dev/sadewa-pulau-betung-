import React from 'react';
import { useApp } from '../../context/AppContext';
import { Compass, TrendingUp, ShoppingBag, CheckCircle2, ChevronRight, Trees, Fish } from "lucide-react";
import { ErrorBoundary } from '../common/ErrorBoundary';

export const PotentialView: React.FC = () => {
  return (
    <ErrorBoundary>
      <PotentialViewContent />
    </ErrorBoundary>
  );
};

const PotentialViewContent: React.FC = () => {
  const { potentials, navigateTo, villageProfile } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Kekayaan Alam & Ekonomi Produktif
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Potensi Unggulan {villageProfile.villageName || 'Desa'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Menelusuri keunggulan komoditas perkebunan rakyat, sumber daya hayati perairan Sungai Batang Hari, dan kerajinan kriya tradisional warisan leluhur.
          </p>
        </div>

        <button
          onClick={() => navigateTo('umkm')}
          className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center space-x-2 self-start md:self-auto"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Katalog Produk UMKM Warga</span>
        </button>
      </div>

      {/* Potentials Detail Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {potentials.map((pot) => (
          <div
            key={pot.id}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="h-56 w-full bg-slate-100 relative overflow-hidden">
                <img
                  src={pot.imageUrl?.trim() ? pot.imageUrl : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80'}
                  alt={pot.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-4 left-4 px-3 py-1 text-xs font-bold uppercase rounded-lg bg-emerald-950/80 text-white backdrop-blur">
                  {pot.category}
                </span>
                <div className="absolute bottom-4 right-4 bg-white/95 text-slate-900 px-3 py-1 rounded-xl text-xs font-bold shadow-md">
                  {pot.highlightStat}
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                  {pot.name}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {pot.description}
                </p>

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block mb-2">
                    Keunggulan & Prospek Pengembangan:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {(pot.keyOpportunities || []).map((opp, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 pt-0">
              <button
                onClick={() => navigateTo('umkm')}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-emerald-800 text-xs font-bold border border-slate-200 hover:border-emerald-300 transition-colors flex items-center justify-center space-x-1"
              >
                <span>Lihat Produk Olahan Terkait di UMKM Warga</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Investment & Development Notice */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Kemitraan & Peluang Kerjasama
          </span>
          <h3 className="text-xl sm:text-2xl font-bold">
            Bermitra dengan BUMDes & Kelompok Tani {villageProfile.villageName || 'Desa'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Pemerintah {villageProfile.villageName || 'Desa'} membuka pintu sinergi bagi perguruan tinggi, koperasi pengolahan, dan pihak swasta untuk peningkatan nilai tambah komoditas lokal dan hilirisasi produk desa.
          </p>
        </div>
        <button
          onClick={() => navigateTo('kontak')}
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-colors whitespace-nowrap"
        >
          Hubungi Tim Ekonomi Desa
        </button>
      </div>
    </div>
  );
};
