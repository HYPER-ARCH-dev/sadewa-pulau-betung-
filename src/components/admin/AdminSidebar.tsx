import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderArchive,
  MessageSquareWarning,
  UserCheck,
  HandHeart,
  MapPin,
  Activity,
  Landmark,
  TrendingUp,
  BarChart3,
  Newspaper,
  Megaphone,
  Store,
  Building,
  Network,
  UserCog,
  Building2,
  ShieldAlert,
  ShieldCheck,
  X,
  ChevronRight,
  Calendar,
  Home
} from 'lucide-react';

import { VillageProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';

export type AdminTabType =
  | 'overview'
  | 'analytics'
  | 'residents'
  | 'services'
  | 'bansos'
  | 'complaints'
  | 'webgis'
  | 'posyandu'
  | 'apbdes'
  | 'potential'
  | 'profile'
  | 'territories'
  | 'officials'
  | 'facilities'
  | 'news'
  | 'announcements'
  | 'umkm'
  | 'attendance'
  | 'users'
  | 'audit'
  | 'backup';

interface AdminSidebarProps {
  activeTab: AdminTabType;
  setActiveTab: (tab: AdminTabType) => void;
  isOpen: boolean;
  onClose: () => void;
  pendingRequests: number;
  activeComplaints: number;
  developmentProjectsCount: number;
  territoriesCount: number;
  officialsCount: number;
  facilitiesCount: number;
  umkmCount: number;
  newsCount: number;
  villageProfile?: VillageProfile;
}

interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  badge?: string | number;
  badgeColor?: string;
  roles?: string[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  pendingRequests,
  activeComplaints,
  developmentProjectsCount,
  territoriesCount,
  officialsCount,
  facilitiesCount,
  umkmCount,
  newsCount,
  villageProfile
}) => {
  const { currentUser, navigateTo } = useApp();
  const [villageLogoError, setVillageLogoError] = useState(false);
  const [sadewaLogoError, setSadewaLogoError] = useState(false);
  const userRole = currentUser?.role || 'operator';
  const userPermissions = currentUser?.permissions || {};
  const isSuperAdmin = userRole.toLowerCase().includes('super');

  // Helper to check if a user has access to a specific item
  const hasAccess = (item: SidebarNavItem, categoryTitle: string) => {
    // 1. Super Admin has access to EVERYTHING
    if (isSuperAdmin) return true;

    // 2. Explicit Permission Override (Checklist support)
    if (userPermissions[item.id] === true) return true;

    // 3. Role-Based Default Logic
    switch (userRole) {
      case 'admin_desa':
        // admin_desa: Operasional, Data Master, Informasi, & Tematik (Exclude Audit & Backup)
        if (item.id === 'users') return true;
        return categoryTitle !== 'SISTEM & KEAMANAN';
      
      case 'operator':
        // operator: Operasional (Surat & Aduan) & Informasi Publikasi
        return categoryTitle === 'OPERASIONAL UTAMA' || categoryTitle === 'INFORMASI & PUBLIKASI';
      
      case 'editor':
        // editor: HANYA Modul Informasi & Publikasi (Berita, Pengumuman, UMKM)
        return categoryTitle === 'INFORMASI & PUBLIKASI';
      
      case 'admin_posyandu':
        // admin_posyandu: Modul Tematik Posyandu/KMS & Analisis Sensus
        return item.id === 'posyandu' || item.id === 'analytics';
      
      default:
        return false;
    }
  };

  const categories = [
    {
      title: 'OPERASIONAL UTAMA',
      items: [
        { id: 'overview', label: 'Ikhtisar Ringkas', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analisis & Sensus Digital', icon: BarChart3, iconColor: 'text-blue-600' },
        { id: 'services', label: 'Buku Arsip & Surat', icon: FolderArchive, badge: pendingRequests, badgeColor: 'bg-rose-600' },
        { id: 'complaints', label: 'Aduan Warga', icon: MessageSquareWarning, badge: activeComplaints, badgeColor: 'bg-amber-500' },
        { id: 'attendance', label: 'Kehadiran Perangkat', icon: UserCheck, iconColor: 'text-emerald-600' },
      ]
    },
    {
      title: 'MODUL TEMATIK DESA',
      items: [
        { id: 'bansos', label: 'Bantuan Sosial & KPM Desa', icon: HandHeart, iconColor: 'text-amber-500' },
        { id: 'webgis', label: 'WebGIS & Peta Spasial (PBB/SPORADIK)', icon: MapPin, iconColor: 'text-emerald-500' },
        { id: 'posyandu', label: 'ePosyandu & Stunting TPK', icon: Activity, iconColor: 'text-rose-500' },
        { id: 'apbdes', label: 'eTransparansi & Baliho', icon: Landmark, iconColor: 'text-emerald-500', badge: developmentProjectsCount, badgeColor: 'bg-emerald-100 text-emerald-800' },
        { id: 'potential', label: 'Manajemen Potensi Desa', icon: TrendingUp, iconColor: 'text-emerald-600' },
      ]
    },
    {
      title: 'INFORMASI & PUBLIKASI',
      items: [
        { id: 'news', label: 'Manajemen Berita & Warta', icon: Newspaper, badge: newsCount, badgeColor: 'bg-slate-100 text-slate-600' },
        { id: 'announcements', label: 'Pengumuman & Agenda', icon: Megaphone },
        { id: 'umkm', label: 'Katalog UMKM', icon: Store, badge: umkmCount, badgeColor: 'bg-teal-100 text-teal-800' },
      ]
    },
    {
      title: 'DATA MASTER & KELOLA',
      items: [
        { id: 'residents', label: 'Buku Induk Penduduk (SSOT)', icon: Users, iconColor: 'text-blue-600' },
        { id: 'profile', label: 'Identitas & Kop Surat', icon: Building },
        { id: 'territories', label: 'Master Wilayah (Dusun/RW/RT)', icon: Network, badge: territoriesCount, badgeColor: 'bg-emerald-100 text-emerald-800' },
        { id: 'officials', label: 'Aparatur & RT/Lembaga', icon: UserCog, badge: officialsCount, badgeColor: 'bg-emerald-100 text-emerald-800' },
        { id: 'facilities', label: 'Fasilitas & Peta', icon: Building2, badge: facilitiesCount, badgeColor: 'bg-blue-100 text-blue-800' },
      ]
    },
    {
      title: 'SISTEM & KEAMANAN',
      items: [
        { id: 'users', label: 'Manajemen Pengguna', icon: UserCog, iconColor: 'text-indigo-600' },
        {
          id: 'audit',
          label: 'Log Audit Keamanan',
          icon: ShieldAlert,
          badge: isSuperAdmin ? undefined : 'Khusus Super Admin',
          badgeColor: 'bg-purple-100 text-purple-800 border border-purple-200'
        },
        {
          id: 'backup',
          label: 'Pemeliharaan & Backup',
          icon: ShieldCheck,
          iconColor: 'text-purple-600',
          badge: 'Super Admin',
          badgeColor: 'bg-slate-100 text-slate-500'
        },
      ]
    }
  ];

  // Filter categories and their items based on access logic
  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      items: cat.items.filter(item => hasAccess(item, cat.title))
    }))
    .filter(cat => cat.items.length > 0);

  const NavItem = ({ item }: { item: SidebarNavItem }) => {
    const isActive = activeTab === item.id;
    const Icon = item.icon;

    return (
      <button
        onClick={() => {
          setActiveTab(item.id as AdminTabType);
          if (window.innerWidth < 1024) onClose();
        }}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ease-out group ${
          isActive
            ? 'bg-emerald-800 text-white shadow-md'
            : 'text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-900'
        }`}
      >
        <div className="flex items-center space-x-3 overflow-hidden">
          <Icon className={`w-4 h-4 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${isActive ? 'text-white' : item.iconColor || 'text-slate-400 group-hover:text-emerald-600'}`} />
          <span className="truncate transition-transform duration-300 group-hover:translate-x-2 inline-block origin-left">{item.label}</span>
        </div>
        
        {item.badge !== undefined && (typeof item.badge === 'string' || item.badge > 0) && (
          <span className={`min-w-[1.25rem] h-5 rounded-full ${item.badgeColor || 'bg-slate-100 text-slate-700'} ${item.badgeColor?.includes('text') ? '' : 'text-white'} text-[10px] flex items-center justify-center font-bold px-1.5`}>
            {item.badge}
          </span>
        )}

        {isActive && (
          <ChevronRight className="w-3.5 h-3.5 text-white/60 ml-1" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60] lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 z-[70] w-72 lg:z-30 lg:translate-x-0 lg:sticky lg:top-[74px] lg:h-[calc(100vh-90px)] lg:shrink-0 lg:border lg:border-slate-200/90 lg:rounded-2xl lg:shadow-sm lg:bg-white/95 lg:backdrop-blur-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-5 space-y-6 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
          <div className="flex flex-col space-y-4 pb-4 border-b border-slate-100 lg:border-b-0 lg:pb-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col space-y-3">
                {/* Logo Desa / Kabupaten (Identitas Wilayah) */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1.5 shadow-sm">
                    {villageProfile?.villageLogoUrl && villageProfile.villageLogoUrl.length > 10 && !villageLogoError ? (
                      <img 
                        src={villageProfile.villageLogoUrl} 
                        alt="Logo Desa" 
                        className="w-full h-full object-contain" 
                        onError={() => setVillageLogoError(true)}
                      />
                    ) : (
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Desa</span>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight truncate max-w-[140px]">
                      {villageProfile?.villageName || 'Pulau Betung'}
                    </span>
                  </div>
                </div>

                {/* Logo Induk SADEWA (Identitas Platform) - Unified Dynamic Branding */}
                <div className="flex items-center gap-2 px-1">
                  {villageProfile?.sadewaIconUrl && villageProfile.sadewaIconUrl.length > 10 && !sadewaLogoError ? (
                    <div className="flex items-center gap-2">
                      <img 
                        src={villageProfile.sadewaIconUrl} 
                        alt="SADEWA" 
                        className="h-7 w-auto object-contain" 
                        onError={() => setSadewaLogoError(true)}
                      />
                      <div className="h-3 w-px bg-slate-200"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">SADEWA</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Digital Service</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-800 rounded-lg p-1 shadow-sm">
                        <SadewaHouseLogo size={20} className="text-white" />
                      </div>
                      <div className="h-3 w-px bg-slate-200"></div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">SADEWA</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Digital Service</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <button onClick={onClose} className="p-2 rounded-lg bg-slate-100 text-slate-500 lg:hidden self-start">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Switch to Public Home */}
            <button
              onClick={() => {
                navigateTo('beranda');
                if (window.innerWidth < 1024) onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border border-slate-200/80 transition-all group active:scale-95"
              title="Buka Beranda Publik (Sesi Admin tetap tersimpan)"
            >
              <div className="flex items-center space-x-2.5">
                <Home className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="font-extrabold">Buka Beranda Publik</span>
              </div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Lihat
              </span>
            </button>
          </div>

          {filteredCategories.map((cat, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center px-3 mb-2">
                <h3 className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
                  {cat.title}
                </h3>
                <div className="flex-1 h-px bg-slate-100 ml-3"></div>
              </div>
              <div className="space-y-1">
                {cat.items.map((item) => (
                  <NavItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};
