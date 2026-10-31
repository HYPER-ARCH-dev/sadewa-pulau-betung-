import React from 'react';
import { useApp } from '../../context/AppContext';
import { ViewType } from '../../types';
import { Building2, FileText, Baby, MessageSquarePlus, Coins } from 'lucide-react';
import { SadewaHouseLogo } from './SadewaHouseLogo';

export const StickyShortcutBar: React.FC = () => {
  const { currentView, navigateTo, villageProfile } = useApp();

  const navItems = [
    { id: 'beranda', label: 'Beranda', icon: Building2 },
    { id: 'layanan', label: 'Surat Online', icon: FileText },
    { id: 'bansos', label: 'Cek Bansos', icon: Coins, badge: 'NIK' },
    { id: 'posyandu', label: 'ePosyandu', icon: Baby, badge: 'KIA' },
    { id: 'pengaduan', label: 'Aspirasi', icon: MessageSquarePlus },
    { id: 'transparansi', label: 'eTransparansi', icon: Coins },
  ];

  return (
    <nav
      className="sticky top-[88px] sm:top-[106px] z-30 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-md transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar scroll-smooth">
        {/* Left Branding for SADEWA (Mobile only focus) */}
        <div 
          onClick={() => navigateTo('beranda')}
          className="flex lg:hidden items-center shrink-0 pr-2 border-r border-slate-800 mr-1 cursor-pointer active:scale-90 transition-transform"
        >
          {villageProfile.sadewaIconUrl && villageProfile.sadewaIconUrl.trim() !== '' ? (
            <img 
              src={villageProfile.sadewaIconUrl.trim()} 
              alt="SADEWA" 
              className="h-7 w-7 object-contain drop-shadow-sm" 
            />
          ) : (
            <SadewaHouseLogo size={24} className="text-emerald-400" />
          )}
        </div>

        <div className="flex items-center gap-2 min-w-max mx-auto sm:mx-0">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline-block">
            Akses Cepat:
          </span>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id as ViewType)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 font-black border-emerald-400 shadow-sm scale-105'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700/80 font-semibold'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-emerald-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${isActive ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
