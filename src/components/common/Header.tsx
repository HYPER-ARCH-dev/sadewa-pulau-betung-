import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PublicViewType } from '../../types';
import {
  Search,
  Menu,
  X,
  FileText,
  AlertCircle,
  BarChart3,
  Building2,
  Users,
  Info,
  Phone,
  Clock,
  Compass,
  ShoppingBag,
  ShieldCheck,
  ChevronDown,
  Lock,
  LayoutDashboard,
  Heart,
  Baby,
  Sun,
  Moon,
  CloudSun,
  Type,
  MessageSquare,
  PhoneCall,
  Coins
} from 'lucide-react';

import { SadewaHouseLogo, SadewaFullLogo } from './SadewaHouseLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { motion } from 'motion/react';

interface HeaderProps {
  onOpenLogin?: () => void;
  onOpenAdminModal?: () => void;
  onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenLogin, onOpenAdminModal, onOpenSearch }) => {
  const { 
    currentView, 
    navigateTo, 
    currentUser, 
    loginAs, 
    setIsSearchOpen, 
    villageProfile, 
    darkMode, 
    toggleDarkMode
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [sadewaLogoError, setSadewaLogoError] = useState(false);

  // Live Office Operational Status & WIB Clock
  const [officeStatus, setOfficeStatus] = useState<{ isOpen: boolean; text: string }>({ isOpen: true, text: 'Buka' });
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  useEffect(() => {
    const updateOfficeStatus = () => {
      const now = new Date();
      // Calculate WIB (UTC+7)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const wibDate = new Date(utc + (3600000 * 7));
      const day = wibDate.getDay(); // 0 = Sun, 1 = Mon ... 5 = Fri, 6 = Sat
      const hours = wibDate.getHours();
      const minutes = wibDate.getMinutes();

      const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} WIB`;
      setCurrentTimeStr(timeFormatted);

      const isWeekday = day >= 1 && day <= 5;
      const isOpenHour = hours >= 8 && (hours < 15 || (hours === 15 && minutes === 0));

      if (isWeekday && isOpenHour) {
        setOfficeStatus({ isOpen: true, text: 'Kantor Buka' });
      } else if (isWeekday) {
        setOfficeStatus({ isOpen: false, text: 'Kantor Tutup (Buka 08:00 WIB)' });
      } else {
        setOfficeStatus({ isOpen: false, text: 'Kantor Libur Akhir Pekan' });
      }
    };

    updateOfficeStatus();
    const timer = setInterval(updateOfficeStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenLoginModal = () => {
    if (onOpenLogin) onOpenLogin();
    else if (onOpenAdminModal) onOpenAdminModal();
  };

  const handleOpenSearchModal = () => {
    if (onOpenSearch) onOpenSearch();
    else setIsSearchOpen(true);
  };

  const handleNav = (view: PublicViewType) => {
    navigateTo(view);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  const isPublicActive = (views: string[]) => {
    return views.includes(currentView);
  };

  return (
    <header id="main-site-header" className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 transition-all duration-300">
      {/* Top Ribbon: Official Government Bar + Live Status + Weather + Font Resizer */}
      <div className="bg-slate-900 dark:bg-black text-slate-300 text-[10px] sm:text-[11px] py-1.5 px-4 sm:px-8 border-b border-white/5 font-medium">
        <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-4">
          {/* Left: Administrative hierarchy & Live Office Indicator */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex items-center space-x-2 overflow-hidden">
              <span className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${officeStatus.isOpen ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'}`}></span>
              <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                <span className="font-bold text-white tracking-wider uppercase text-[9px] truncate">{villageProfile.villageName || 'Desa'}</span>
                <span className="opacity-40 text-white/50">|</span>
                <span className="text-slate-400 truncate">{(villageProfile.district || 'Kecamatan').toUpperCase()}</span>
              </div>
            </div>

            {/* Live Office Status Badge */}
            <span className={`hidden sm:flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest items-center space-x-1.5 whitespace-nowrap ${
              officeStatus.isOpen 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              <span>{officeStatus.isOpen ? 'Buka' : 'Tutup'}</span>
              {currentTimeStr && <span className="opacity-60 font-mono">[{currentTimeStr}]</span>}
            </span>
          </div>

          {/* Right: Weather Ticker, Contact & Admin Tag */}
          <div className="flex items-center space-x-4 text-slate-400 text-[10px] shrink-0">
            {/* Live Weather Ticker (Compact) */}
            <div className="flex items-center space-x-2 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10 text-slate-200">
              <CloudSun className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white font-bold">29°C</span>
              <span className="hidden sm:inline opacity-40">Cerah</span>
            </div>

            {currentUser && (
              <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full text-[9px] uppercase font-black tracking-tighter flex items-center whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 mr-1 shrink-0" />
                <span className="truncate max-w-[80px]">{currentUser.roleTitle}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar - Clean White with Shadow & Dark Text */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Brand Identity (Village Logo + SADEWA Branding) */}
          <button
            onClick={() => handleNav('beranda')}
            className="flex items-center space-x-3 text-left group focus:outline-none shrink-0"
            id="btn-brand-home"
          >
            <div className="relative">
              {villageProfile.villageLogoUrl && villageProfile.villageLogoUrl.length > 10 && !logoError ? (
                <img
                  src={villageProfile.villageLogoUrl.trim()}
                  alt="Logo Pemda"
                  className="h-10 w-auto max-w-[48px] sm:max-w-[64px] object-contain group-hover:scale-110 transition-all duration-500 shrink-0 filter drop-shadow-md"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-emerald-500/20 border border-white/10">
                  <ShieldCheck className="w-6 h-6 text-amber-300" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-slate-900 rounded-full border-2 border-slate-50 dark:border-slate-950 flex items-center justify-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-black leading-none tracking-tighter text-slate-900 dark:text-white uppercase group-hover:text-emerald-600 transition-colors">
                  {villageProfile.villageName || 'DESA PULAU BETUNG'}
                </h1>
                <span className="px-1.5 py-0.5 text-[8px] uppercase font-black tracking-widest rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                  RESMI
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
                  {(villageProfile.district || 'Kec. Pemayung').toUpperCase()}
                </p>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
                  Jambi
                </p>
              </div>
            </div>
          </button>

          {/* Desktop Navigation - Centered, Clean & Balanced */}
          <nav className="hidden lg:flex items-center justify-center flex-1 mx-4 space-x-1 text-[11px] font-bold uppercase tracking-widest shrink-0">
            <button
              onClick={() => handleNav('beranda')}
              className={`relative transition-all py-2 px-3 rounded-xl group ${
                currentView === 'beranda'
                  ? 'text-emerald-700 dark:text-emerald-400 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              id="nav-beranda"
            >
              <span className="relative z-10">Beranda</span>
              {currentView === 'beranda' && (
                <motion.div layoutId="nav-pill" className="absolute inset-0 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl" />
              )}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-emerald-500 group-hover:w-full transition-all duration-300"></div>
            </button>

            {/* Dropdown: Profil & Pemerintahan */}
            <div className="relative group">
              <button
                className={`flex items-center space-x-1.5 transition-all py-2 px-3 rounded-xl ${
                  isPublicActive(['profil', 'pemerintahan', 'peta'])
                    ? 'text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                onMouseEnter={() => setActiveDropdown('profil')}
                id="nav-dropdown-profil"
              >
                <span>Profil</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:rotate-180 transition-transform duration-300" />
              </button>

              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-slate-800/60 p-2 hidden group-hover:block transition-all z-50 text-slate-800 dark:text-slate-200 normal-case backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <button
                  onClick={() => handleNav('profil')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Tentang Desa</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Sejarah & Visi Misi</div>
                  </div>
                </button>
                <button
                  onClick={() => handleNav('pemerintahan')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Pemerintahan</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Struktur & Perangkat</div>
                  </div>
                </button>
                <button
                  onClick={() => handleNav('peta')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <Compass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Peta Fasilitas</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Navigasi Sarana Publik</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Dropdown: Layanan & ePosyandu */}
            <div className="relative group">
              <button
                className={`flex items-center space-x-1.5 transition-all py-2 px-3 rounded-xl ${
                  isPublicActive(['layanan', 'posyandu', 'bansos'])
                    ? 'text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                id="nav-dropdown-layanan"
              >
                <span>Layanan</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:rotate-180 transition-transform duration-300" />
              </button>
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-slate-800/60 p-2 hidden group-hover:block transition-all z-50 text-slate-800 dark:text-slate-200 normal-case backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <button
                  onClick={() => handleNav('layanan')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Layanan Mandiri</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Pengajuan Surat Online</div>
                  </div>
                </button>
                <button
                  onClick={() => handleNav('posyandu')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-800 dark:hover:text-rose-400 flex items-center space-x-3 transition-colors mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400 fill-current" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">ePosyandu</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">KMS Digital & Kesehatan</div>
                  </div>
                </button>
                <button
                  onClick={() => handleNav('bansos')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-800 dark:hover:text-amber-400 flex items-center space-x-3 transition-colors mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>Cek Bansos</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[8px] font-black rounded-full uppercase tracking-tighter">BARU</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Status Penerima Manfaat</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Transparency & Development */}
            <div className="relative group">
              <button
                className={`flex items-center space-x-1.5 transition-all py-2 px-3 rounded-xl ${
                  isPublicActive(['transparansi', 'pembangunan'])
                    ? 'text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                id="nav-dropdown-transparansi"
              >
                <span>Transparansi</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:rotate-180 transition-transform duration-300" />
              </button>
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-slate-800/60 p-2 hidden group-hover:block transition-all z-50 text-slate-800 dark:text-slate-200 normal-case backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <button
                  onClick={() => handleNav('transparansi')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">APBDes 2026</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Realisasi & Grafik Anggaran</div>
                  </div>
                </button>
                <button
                  onClick={() => handleNav('pembangunan')}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-800 dark:hover:text-emerald-400 flex items-center space-x-3 transition-colors mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 dark:text-white">Pembangunan</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Progres Fisik Proyek</div>
                  </div>
                </button>
              </div>
            </div>

            {/* News & Updates */}
            <div className="relative group">
              <button
                className={`flex items-center space-x-1.5 transition-all py-2 px-3 rounded-xl ${
                  isPublicActive(['berita', 'pengumuman', 'agenda', 'galeri', 'potensi', 'umkm'])
                    ? 'text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                id="nav-dropdown-informasi"
              >
                <span>Warta</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-40 group-hover:rotate-180 transition-transform duration-300" />
              </button>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-200/60 dark:border-slate-800/60 p-2 hidden group-hover:block transition-all z-50 text-slate-800 dark:text-slate-200 normal-case backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
                <button onClick={() => handleNav('berita')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Warta Terkini</button>
                <button onClick={() => handleNav('pengumuman')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors mt-0.5">Pengumuman Resmi</button>
                <button onClick={() => handleNav('agenda')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors mt-0.5">Agenda Kegiatan</button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2"></div>
                <button onClick={() => handleNav('potensi')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">Potensi Desa</button>
                <button onClick={() => handleNav('umkm')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors mt-0.5">Katalog UMKM</button>
                <button onClick={() => handleNav('galeri')} className="w-full text-left px-3 py-2 text-[11px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors mt-0.5">Galeri Foto</button>
              </div>
            </div>

            {/* Complaints */}
            <button
              onClick={() => handleNav('pengaduan')}
              className={`transition-all py-2 px-3 rounded-xl ${
                currentView === 'pengaduan'
                  ? 'text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pengaduan
            </button>

            {/* Clean Utility Divider */}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

            {/* Right Action: Search & Login */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleOpenSearchModal}
                className="p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-90"
                id="btn-global-search-header"
              >
                <Search className="w-5 h-5" />
              </button>

              {currentUser ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigateTo('admin_dashboard')}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-black/10 dark:shadow-white/10 flex items-center space-x-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleOpenLoginModal}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center space-x-2"
                  id="btn-open-login-modal"
                >
                  <Lock className="w-4 h-4 text-emerald-200" />
                  <span>Masuk</span>
                </button>
              )}
            </div>
          </nav>

          {/* Right Action Controls for Mobile screens (below lg) */}
          <div className="flex lg:hidden items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={handleOpenSearchModal}
              className="p-2 rounded-lg text-slate-700 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
              title="Cari"
              id="btn-mobile-search"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
            </button>

            {currentUser ? (
              <button
                onClick={() => navigateTo('admin_dashboard')}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-2.5 sm:px-3 py-1.5 rounded-lg text-xs uppercase transition-all flex items-center space-x-1 shadow-sm shrink-0"
                id="btn-mobile-admin"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-900" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            ) : (
              <button
                onClick={handleOpenLoginModal}
                className="bg-emerald-700 hover:bg-emerald-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all text-white flex items-center space-x-1 shadow-sm shrink-0"
                id="btn-mobile-login"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-800 hover:text-emerald-700 hover:bg-slate-100 focus:outline-none transition-colors shrink-0"
              id="btn-toggle-mobile-menu"
              aria-label="Buka Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b-2 border-slate-200 shadow-xl px-4 pt-2 pb-6 space-y-1 max-h-[80vh] overflow-y-auto text-slate-800">
          <div className="flex items-center justify-between p-3 mb-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              {villageProfile.sadewaIconUrl && villageProfile.sadewaIconUrl.trim() !== '' ? (
                <div className="flex items-center space-x-2">
                  <img
                    src={villageProfile.sadewaIconUrl.trim()}
                    alt="SADEWA"
                    className="h-9 w-9 object-contain drop-shadow-md"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black tracking-widest text-slate-900 leading-none">SADEWA</span>
                    <span className="text-[8px] font-bold tracking-widest text-emerald-600 uppercase leading-none mt-1">Digital Service</span>
                  </div>
                </div>
              ) : (
                <SadewaFullLogo 
                  size={32} 
                  subtitle="Digital Service" 
                  color="#047857" 
                />
              )}
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Versi Sistem</div>
              <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">v2.0.4-Luxe</div>
            </div>
          </div>

          {/* PWA Mobile Quick Install Action */}
          <div className="mb-3">
            <PWAInstallButton variant="mobile" />
          </div>

          <div className="p-2 mb-2 bg-slate-100 rounded-lg border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Navigasi Portal</span>
            <button
              onClick={handleOpenSearchModal}
              className="inline-flex items-center space-x-1 text-emerald-800 font-semibold"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari Informasi</span>
            </button>
          </div>

          {/* Direct Admin Access Banner in Mobile Drawer */}
          <div className="p-2.5 rounded-xl bg-slate-900 text-white flex items-center justify-between mb-2 shadow-sm">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-xs font-bold text-white">Panel Kelola Staf / Admin</div>
                <div className="text-[10px] text-slate-300">
                  {currentUser ? `Login: ${currentUser.name}` : 'Akses verifikasi & tata kelola'}
                </div>
              </div>
            </div>
            {currentUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigateTo('admin_dashboard');
                }}
                className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded font-bold text-xs"
              >
                Buka Panel
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenLoginModal();
                }}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs"
              >
                Login
              </button>
            )}
          </div>

          {/* Theme Mode Toggle Button for Mobile */}


          <button
            onClick={() => handleNav('beranda')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              currentView === 'beranda' ? 'bg-emerald-600 text-white' : 'text-slate-800 hover:bg-slate-100'
            }`}
          >
            Beranda
          </button>

          <div className="pt-2 pb-1 text-xs font-bold text-slate-600 px-3 uppercase tracking-wider">
            Informasi Desa
          </div>
          <button
            onClick={() => handleNav('profil')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Profil & Sejarah Desa
          </button>
          <button
            onClick={() => handleNav('pemerintahan')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Struktur Pemerintahan & BPD
          </button>
          <button
            onClick={() => handleNav('peta')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Peta Digital Fasilitas Umum
          </button>

          <div className="pt-2 pb-1 text-xs font-bold text-slate-600 px-3 uppercase tracking-wider">
            Layanan & Aspirasi Warga
          </div>
          <button
            onClick={() => handleNav('layanan')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center justify-between"
          >
            <span className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Layanan Surat Online</span>
            </span>
            <span className="text-[11px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded">PTSP</span>
          </button>
          <button
            onClick={() => handleNav('bansos')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center justify-between mt-1"
          >
            <span className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Cek Bansos & KPM (Cari NIK)</span>
            </span>
            <span className="text-[10px] font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full">KPM</span>
          </button>
          <button
            onClick={() => handleNav('posyandu')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-900 border border-rose-200 flex items-center justify-between mt-1"
          >
            <span className="flex items-center space-x-2">
              <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
              <span>ePosyandu & KIA Digital</span>
            </span>
            <span className="text-[10px] font-bold bg-rose-200 text-rose-950 px-2 py-0.5 rounded-full">KMS</span>
          </button>
          <button
            onClick={() => handleNav('pengaduan')}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold bg-amber-50 text-amber-900 border border-amber-200 flex items-center space-x-2 mt-1"
          >
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <span>Pengaduan & Aspirasi</span>
          </button>

          <div className="pt-2 pb-1 text-xs font-bold text-slate-600 px-3 uppercase tracking-wider">
            eTransparansi & Pembangunan
          </div>
          <button
            onClick={() => handleNav('transparansi')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            eTransparansi TA 2026
          </button>
          <button
            onClick={() => handleNav('pembangunan')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Progres Proyek Pembangunan
          </button>

          <div className="pt-2 pb-1 text-xs font-bold text-slate-600 px-3 uppercase tracking-wider">
            Publikasi & Potensi
          </div>
          <button
            onClick={() => handleNav('berita')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Kabar Berita Desa
          </button>
          <button
            onClick={() => handleNav('pengumuman')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Pengumuman Resmi
          </button>
          <button
            onClick={() => handleNav('agenda')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Agenda Kegiatan Desa
          </button>
          <button
            onClick={() => handleNav('potensi')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Potensi Sumber Daya Alam
          </button>
          <button
            onClick={() => handleNav('umkm')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Direktori UMKM Warga
          </button>
          <button
            onClick={() => handleNav('galeri')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Galeri Dokumentasi
          </button>
          <button
            onClick={() => handleNav('kontak')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
          >
            Kontak & Jam Layanan Kantor
          </button>
        </div>
      )}
    </header>
  );
};
