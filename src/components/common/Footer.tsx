import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  ExternalLink,
  Lock,
  ChevronRight
} from 'lucide-react';
import { SadewaHouseLogo } from './SadewaHouseLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { PublicViewType } from '../../types';

interface FooterProps {
  onOpenSearch?: () => void;
  onOpenAdminModal?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenSearch, onOpenAdminModal }) => {
  const { navigateTo, villageProfile } = useApp();
  const [logoError, setLogoError] = useState(false);
  const [sadewaLogoError, setSadewaLogoError] = useState(false);

  const quickLinks: { label: string; view: PublicViewType }[] = [
    { label: 'Beranda Portal', view: 'beranda' },
    { label: 'Profil & Wilayah Desa', view: 'profil' },
    { label: 'Pemerintahan & BPD', view: 'pemerintahan' },
    { label: 'Layanan Surat Online', view: 'layanan' },
    { label: 'eTransparansi', view: 'transparansi' },
    { label: 'Progres Pembangunan', view: 'pembangunan' },
    { label: 'Kabar Berita Desa', view: 'berita' },
    { label: 'Direktori UMKM Warga', view: 'umkm' },
    { label: 'Peta & Sarana Publik', view: 'peta' }
  ];

  return (
    <footer className="bg-slate-950 text-slate-400 pt-20 pb-10 border-t border-white/5 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-6">
               <div className="flex items-center space-x-5">
                  <div className="flex-shrink-0">
                    {villageProfile.villageLogoUrl && villageProfile.villageLogoUrl.length > 10 && !logoError ? (
                      <img
                        src={villageProfile.villageLogoUrl.trim()}
                        alt="Logo Desa"
                        className="h-14 w-auto max-w-[72px] object-contain drop-shadow-2xl brightness-110"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-xl shadow-emerald-950 border border-white/10">
                        <ShieldCheck className="w-7 h-7 text-amber-300" />
                      </div>
                    )}
                  </div>
                  <div className="w-px h-10 bg-white/10 hidden sm:block"></div>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-black tracking-[0.3em] text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                      PORTAL RESMI
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tighter uppercase leading-tight truncate">
                      {villageProfile.villageName || 'Pemerintah Desa'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      {villageProfile.district || 'Kecamatan'} | {villageProfile.regency || 'Kabupaten'}
                    </p>
                  </div>
               </div>
               
               <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md font-medium">
                Sistem Administrasi Digital Desa (SADEWA) adalah ekosistem layanan mandiri warga terpadu. Mewujudkan pelayanan publik yang cepat, transparan, dan akuntabel.
               </p>

               <div className="pt-2">
                 <PWAInstallButton variant="footer" />
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="p-4 rounded-[1.5rem] bg-white/5 border border-white/5 space-y-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs text-slate-300 leading-tight">
                    {villageProfile.addressStreet || 'Jalan Lintas Jambi - Muara Bulian KM. 32'}, {villageProfile.postalCode || '36657'}
                  </p>
               </div>
               <div className="p-4 rounded-[1.5rem] bg-white/5 border border-white/5 space-y-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <p className="text-xs text-slate-300 leading-tight">
                    {villageProfile.operatingHours?.weekdays || 'Senin - Jumat: 08.00 - 15.00 WIB'}
                  </p>
               </div>
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-6">
               <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Layanan Warga</h4>
               <ul className="space-y-3">
                 <li><button onClick={() => navigateTo('layanan')} className="text-xs font-bold hover:text-white transition-colors">Surat Mandiri Online</button></li>
                 <li><button onClick={() => navigateTo('bansos')} className="text-xs font-bold hover:text-white transition-colors">Cek Penerima Bansos</button></li>
                 <li><button onClick={() => navigateTo('posyandu')} className="text-xs font-bold hover:text-white transition-colors">ePosyandu & KIA Digital</button></li>
                 <li><button onClick={() => navigateTo('pengaduan')} className="text-xs font-bold hover:text-white transition-colors">Pengaduan & Aspirasi</button></li>
               </ul>
            </div>

            <div className="space-y-6">
               <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Tata Kelola</h4>
               <ul className="space-y-3">
                 <li><button onClick={() => navigateTo('transparansi')} className="text-xs font-bold hover:text-white transition-colors">Transparansi APBDes</button></li>
                 <li><button onClick={() => navigateTo('pembangunan')} className="text-xs font-bold hover:text-white transition-colors">Progres Pembangunan</button></li>
                 <li><button onClick={() => navigateTo('pemerintahan')} className="text-xs font-bold hover:text-white transition-colors">Pemerintah Desa</button></li>
                 <li><button onClick={() => navigateTo('potensi')} className="text-xs font-bold hover:text-white transition-colors">Potensi & UMKM</button></li>
               </ul>
            </div>

            <div className="space-y-6 col-span-2 md:col-span-1">
               <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Akses Staf</h4>
               <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4">
                  <div className="flex items-center space-x-2">
                     <Lock className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-white uppercase tracking-widest">Portal Petugas</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (onOpenAdminModal) onOpenAdminModal();
                      else navigateTo('admin_dashboard');
                    }}
                    className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-950"
                  >
                    MASUK ADMIN
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex flex-col md:flex-row items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span>© {new Date().getFullYear()} Pemerintah {villageProfile.villageName || 'Desa Pulau Betung'}</span>
              <span className="hidden md:block">|</span>
              <span>Hak Cipta Dilindungi</span>
           </div>
           
           <div className="flex items-center space-x-2">
              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">SISTEM INFORMASI DESA</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,1)]"></div>
           </div>
        </div>
      </div>
    </footer>
  );
};

