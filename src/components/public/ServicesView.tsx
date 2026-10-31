import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  CheckCircle2,
  BadgeCheck,
  ClipboardList,
  Search,
  PenTool
} from 'lucide-react';
import { DocumentList } from './DocumentList';
import { LetterForm } from './LetterForm';
import { PrintPortal } from './PrintPortal';
import { VillageService } from '../../types';

type ActiveTabType = 'catalog' | 'apply' | 'track';

export const ServicesView: React.FC = () => {
  const { setSelectedServiceId } = useApp();
  const [activeTab, setActiveTab] = useState<ActiveTabType>('catalog');
  const [trackCode, setTrackCode] = useState<string>('');

  const handleSelectServiceFromCatalog = (svc: VillageService) => {
    setSelectedServiceId(svc.id);
    setActiveTab('apply');
  };

  const handleTrackCodeFromForm = (code: string) => {
    setTrackCode(code);
    setActiveTab('track');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 space-y-8" id="services-portal-view">
      {/* LUXURY BANNER: Layanan Surat Online (The Golden Obsidian Edition) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border-2 border-amber-500/30 shadow-2xl group mb-4"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(245,158,11,0.15),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,_rgba(251,191,36,0.1),_transparent_50%)]"></div>
        <div className="absolute -right-12 -bottom-12 opacity-10 text-amber-500 transform rotate-12 pointer-events-none group-hover:scale-110 group-hover:rotate-6 transition-transform duration-700">
          <FileText className="w-64 h-64" />
        </div>

        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-[0.2em]">
              <BadgeCheck className="w-3 h-3 animate-pulse" />
              Pelayanan Administrasi Terpadu Desa (PATEN)
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Layanan <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 animate-shimmer">Surat Online</span> Mandiri
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-400 max-w-2xl leading-relaxed">
              Ajukan permohonan surat keterangan desa secara online dari ponsel Anda dan pantau proses verifikasi dokumen secara real-time. Cepat, legal, dan transparan.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              {['Verifikasi Digital', 'Otentikasi QR Code', 'Bebas Pungli'].map((tag) => (
                <div key={tag} className="flex items-center gap-1.5 text-xs text-amber-200/70 font-semibold bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                  <CheckCircle2 className="w-3 h-3 text-amber-500" />
                  {tag}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* High-Tech Cyber Segmented Tab Controls */}
      <div className="flex justify-center p-1.5 bg-slate-900/90 dark:bg-slate-950/90 rounded-2xl max-w-lg mx-auto border border-amber-500/30 shadow-xl backdrop-blur-md ring-1 ring-amber-500/20">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 scale-[1.02]'
              : 'text-slate-400 hover:text-amber-200'
          }`}
          id="tab-service-catalog"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Katalog Layanan</span>
        </button>

        <button
          onClick={() => setActiveTab('apply')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'apply'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 scale-[1.02]'
              : 'text-slate-400 hover:text-amber-200'
          }`}
          id="tab-service-apply"
        >
          <PenTool className="w-4 h-4" />
          <span>Isi Formulir</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('track');
            setTrackCode('');
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeTab === 'track'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 scale-[1.02]'
              : 'text-slate-400 hover:text-amber-200'
          }`}
          id="tab-service-track"
        >
          <Search className="w-4 h-4" />
          <span>Lacak Resi</span>
        </button>
      </div>

      {/* Dynamic Tab Panel Content with Smooth Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -25, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          {activeTab === 'catalog' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <DocumentList onSelectService={handleSelectServiceFromCatalog} />
            </motion.div>
          )}

          {activeTab === 'apply' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <LetterForm
                onBackToCatalog={() => setActiveTab('catalog')}
                onTrackCode={handleTrackCodeFromForm}
              />
            </motion.div>
          )}

          {activeTab === 'track' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <PrintPortal initialTrackingCode={trackCode} />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
export default ServicesView;
