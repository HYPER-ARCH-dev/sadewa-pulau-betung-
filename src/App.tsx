import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppProvider, useApp as useAppContext } from './context/AppContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { GlobalSearch } from './components/common/GlobalSearch';
import { NotificationToast } from './components/common/NotificationToast';
import { AdminLoginModal } from './components/admin/AdminLoginModal';
import { VillageAiAssistant } from './components/common/VillageAiAssistant';
import { DocumentVerificationModal as DocumentValidationModal } from './components/common/DocumentVerificationModal';
import { StickyShortcutBar } from './components/common/StickyShortcutBar';
import { SadewaHouseLogo, SadewaFullLogo } from './components/common/SadewaHouseLogo';
import { ShieldCheck, Lock, Loader2, RefreshCw } from 'lucide-react';

// Enhanced retry helper with exponential backoff for dynamic imports
async function retryImport<T>(fn: () => Promise<T>, retriesLeft = 5, interval = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retriesLeft <= 0) {
      // If dynamic import failed, check if we should auto-reload once to fetch fresh assets
      if (typeof window !== 'undefined') {
        const lastReload = sessionStorage.getItem('sadewa_last_chunk_reload');
        const now = Date.now();
        if (!lastReload || now - Number(lastReload) > 30000) {
          sessionStorage.setItem('sadewa_last_chunk_reload', String(now));
          window.location.reload();
          // Stop execution while reloading
          return new Promise(() => {});
        }
      }
      throw error;
    }
    console.warn(`Dynamic import failed, retrying in ${interval}ms... (${retriesLeft} retries left)`);
    await new Promise((resolve) => setTimeout(resolve, interval));
    return retryImport(fn, retriesLeft - 1, interval * 1.5);
  }
}

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  name: string
) {
  return lazy(async () => {
    try {
      const component = await retryImport(componentImport, 3, 500);
      return component;
    } catch (error) {
      console.error(`Failed to load component: ${name}`, error);
      throw error;
    }
  });
}

// Public Views (Lazy Loaded with both named and default export fallbacks)
const HomeView = lazyWithRetry(() => import('./components/public/HomeView').then((m: any) => ({ default: m.HomeView || m.default })), 'HomeView');
const ProfileView = lazyWithRetry(() => import('./components/public/ProfileView').then((m: any) => ({ default: m.ProfileView || m.default })), 'ProfileView');
const GovernmentView = lazyWithRetry(() => import('./components/public/GovernmentView').then((m: any) => ({ default: m.GovernmentView || m.default })), 'GovernmentView');
const ServicesView = lazyWithRetry(() => import('./components/public/ServicesView').then((m: any) => ({ default: m.ServicesView || m.default })), 'ServicesView');
const ComplaintsView = lazyWithRetry(() => import('./components/public/ComplaintsView').then((m: any) => ({ default: m.ComplaintsView || m.default })), 'ComplaintsView');
const TransparencyView = lazyWithRetry(() => import('./components/public/TransparencyView').then((m: any) => ({ default: m.TransparencyView || m.default })), 'TransparencyView');
const DevelopmentView = lazyWithRetry(() => import('./components/public/DevelopmentView').then((m: any) => ({ default: m.DevelopmentView || m.default })), 'DevelopmentView');
const NewsView = lazyWithRetry(() => import('./components/public/NewsView').then((m: any) => ({ default: m.NewsView || m.default })), 'NewsView');
const AnnouncementsView = lazyWithRetry(() => import('./components/public/AnnouncementsView').then((m: any) => ({ default: m.AnnouncementsView || m.default })), 'AnnouncementsView');
const PotentialView = lazyWithRetry(() => import('./components/public/PotentialView').then((m: any) => ({ default: m.PotentialView || m.default })), 'PotentialView');
const UmkmView = lazyWithRetry(() => import('./components/public/UmkmView').then((m: any) => ({ default: m.UmkmView || m.default })), 'UmkmView');
const AgendaView = lazyWithRetry(() => import('./components/public/AgendaView').then((m: any) => ({ default: m.AgendaView || m.default })), 'AgendaView');
const GalleryView = lazyWithRetry(() => import('./components/public/GalleryView').then((m: any) => ({ default: m.GalleryView || m.default })), 'GalleryView');
const VillageMapView = lazyWithRetry(() => import('./components/public/VillageMapView').then((m: any) => ({ default: m.VillageMapView || m.default })), 'VillageMapView');
const PosyanduPublicView = lazyWithRetry(() => import('./components/public/PosyanduPublicView').then((m: any) => ({ default: m.PosyanduPublicView || m.default })), 'PosyanduPublicView');
const BansosCheckView = lazyWithRetry(() => import('./components/public/BansosCheckView').then((m: any) => ({ default: m.BansosCheckView || m.default })), 'BansosCheckView');
const ContactView = lazyWithRetry(() => import('./components/public/ContactView').then((m: any) => ({ default: m.ContactView || m.default })), 'ContactView');

// Admin View (Lazy loaded with retry to handle chunk failures)
const AdminDashboard = lazyWithRetry(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard || (m as any).default })), 'AdminDashboard');
const PosyanduManager = lazyWithRetry(() => import('./components/admin/PosyanduManager').then(m => ({ default: m.PosyanduManager || (m as any).default })), 'PosyanduManager');
const TestDynamicForm = lazyWithRetry(() => import('./components/admin/TestDynamicForm').then(m => ({ default: m.TestDynamicForm || (m as any).default })), 'TestDynamicForm');

const PageSkeleton = () => {
  const { villageProfile } = useAppContext();
  const logoUrl = villageProfile?.sadewaLogoUrl?.trim() || villageProfile?.sadewaIconUrl?.trim();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col items-center justify-center min-h-[45vh] space-y-6 text-center">
        {logoUrl ? (
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={logoUrl} 
            alt="Logo" 
            className="h-16 w-auto object-contain opacity-40 grayscale"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-emerald-100/80 dark:bg-emerald-950/50 flex items-center justify-center ring-1 ring-emerald-500/20">
            <Loader2 className="w-7 h-7 text-emerald-700 dark:text-emerald-400 animate-spin" />
          </div>
        )}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">
            Sinkronisasi Data...
          </p>
        </div>
      </div>
    </div>
  );
};


class ModuleErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; showDetails: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ModuleErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-4 ring-1 ring-amber-200 dark:ring-amber-800">
            <RefreshCw className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Kendala Sinkronisasi Modul</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            {this.state.error?.message || 'Terjadi kesalahan saat memuat komponen modul ini.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Coba Muat Ulang</span>
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
            >
              <span>Kembali ke Beranda</span>
            </button>
          </div>

          {this.state.error && (
            <div className="mt-4 w-full text-left">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline block mx-auto"
              >
                {this.state.showDetails ? 'Sembunyikan Rincian Teknis' : 'Lihat Rincian Teknis Error'}
              </button>
              {this.state.showDetails && (
                <div className="mt-2 p-3 bg-slate-900 text-rose-300 text-[10px] font-mono rounded-xl overflow-x-auto max-h-40 border border-slate-800">
                  <p className="font-bold text-rose-400 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                  <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const MainContent: React.FC = () => {
  const { currentView, currentUser, navigateTo, villageProfile, setIsSearchOpen, isLoading, setIsLoading } = useAppContext();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Failsafe: Ensure splash screen doesn't stay stuck forever (max 5s)
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        if (setIsLoading) setIsLoading(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, setIsLoading]);

  // Logo for Splash Screen
  const logoUrl = villageProfile?.sadewaLogoUrl?.trim() || villageProfile?.sadewaIconUrl?.trim();
  const [verificationModal, setVerificationModal] = useState<{
    isOpen: boolean;
    trackingCode: string;
    letterNumber?: string;
  }>({ isOpen: false, trackingCode: '' });

  // Check URL pathname, query parameters, and hash for authentic document verification (from QR code scans)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash || '';
      let targetCode = '';
      let targetNoSurat = searchParams.get('noSurat') || searchParams.get('letterNumber') || undefined;

      // Check if this is a bansos direct verification scan (?tab=bansos or ?nik=... or ?verify_bansos=...)
      const tabParam = searchParams.get('tab') || searchParams.get('view');
      const bansosNik = searchParams.get('nik') || searchParams.get('bansos_nik') || searchParams.get('verify_bansos');
      if (tabParam === 'bansos' || bansosNik) {
        navigateTo('bansos' as any);
        return;
      }

      // 1. Check pathname: /verify/REQ-PB-2026-001 or /verify-document
      if (pathname.startsWith('/verify/')) {
        targetCode = decodeURIComponent(pathname.replace(/^\/verify\//, '').trim());
      } else if (pathname === '/verify' || pathname === '/verify-document') {
        targetCode = searchParams.get('trackingCode') || searchParams.get('id') || searchParams.get('resi') || searchParams.get('code') || '';
      }

      // 2. Check query params: ?verify=REQ-PB-2026-001 or ?resi=... or ?trackingCode=...
      if (!targetCode) {
        const verifyParam = searchParams.get('verify');
        const resi = searchParams.get('resi') || searchParams.get('trackingCode') || searchParams.get('code') || searchParams.get('id');

        if (verifyParam && verifyParam !== 'surat' && verifyParam !== 'true' && verifyParam !== '1') {
          targetCode = verifyParam;
        } else if (resi) {
          targetCode = resi;
        }
      }

      // 3. Check hash for SPAs/proxies: #/verify/REQ-PB-2026-001 or #verify=...
      if (!targetCode && hash) {
        if (hash.includes('/verify/')) {
          const parts = hash.split('/verify/');
          if (parts[1]) targetCode = decodeURIComponent(parts[1].split('?')[0].split('&')[0].trim());
        } else if (hash.includes('resi=') || hash.includes('trackingCode=') || hash.includes('verify=')) {
          const match = hash.match(/(?:resi|trackingCode|verify|code)=([^&]+)/i);
          if (match && match[1]) targetCode = decodeURIComponent(match[1].trim());
        }
      }

      // Clean trailing slashes or queries
      if (targetCode) {
        targetCode = targetCode.split('?')[0].split('#')[0].trim();
        const matchReq = targetCode.match(/REQ-PB-[A-Za-z0-9-]+/i);
        if (matchReq && matchReq[0]) {
          targetCode = matchReq[0];
        }

        setVerificationModal({
          isOpen: true,
          trackingCode: targetCode,
          letterNumber: targetNoSurat
        });
      }

      // 4. Temporary Internal Route for Playground
      if (pathname === '/test-form') {
        navigateTo('test_form' as any);
      }
    }
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  // Dynamic Meta Tags (SEO)
  useEffect(() => {
    const vName = villageProfile.villageName || (villageProfile as Record<string, any>).name || 'Desa';
    const appName = "Portal " + vName;
    document.title = appName;
    
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', villageProfile.vision || `Website Resmi ${appName}`);
    }

    // Update Favicon dynamically - PRIORITIZE SADEWA ICON (House)
    const faviconUrl = villageProfile.sadewaIconUrl || villageProfile.villageLogoUrl || villageProfile.regencyLogoUrl || '/favicon.svg';
    let linkIcon = document.querySelector('link[rel="icon"]');
    if (linkIcon) {
      linkIcon.setAttribute('href', faviconUrl);
    } else {
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.href = faviconUrl;
      document.head.appendChild(newLink);
    }
  }, [villageProfile.villageName, villageProfile.sadewaIconUrl, villageProfile.villageLogoUrl, villageProfile.regencyLogoUrl, villageProfile.vision]);

  // Watermark ASCII Art SADEWA untuk Console DevTools
  useEffect(() => {
    const asciiBanner = `
  ███████╗░█████╗░██████╗░███████╗██╗░░░██╗░█████╗░
  ██╔════╝██╔══██╗██╔══██╗██╔════╝██║░░░██║██╔══██╗
  ███████╗███████║██║░░██║█████╗░░██║░░░██║███████║
  ╚════██║██╔══██║██║░░██║██╔══╝░░██║░░░██║██╔══██║
  ███████║██║░░██║██████╔╝███████╗╚██████╔╝██║░░██║
  ╚══════╝╚═╝░░╚═╝╚═════╝░╚══════╝░╚═════╝░╚═╝░░╚═╝
     --- S A D E W A   D I G I T A L   S E R V I C E ---
     System Version 2.0 | Powered by Desa Pulau Betung
     `;

    console.log(
      `%c${asciiBanner}`,
      "color: #00FF66; font-weight: bold; background: #0F172A; padding: 12px; border-radius: 8px; font-family: monospace;"
    );
    console.log(
      "%c[SYSTEM INFO] SADEWA Core Engine v2.0 Active & Secured.",
      "color: #38BDF8; font-weight: bold;"
    );
  }, []);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'beranda':
        return <HomeView />;
      case 'profil':
        return <ProfileView />;
      case 'pemerintahan':
        return <GovernmentView />;
      case 'layanan':
        return <ServicesView />;
      case 'pengaduan':
        return <ComplaintsView />;
      case 'transparansi':
        return <TransparencyView />;
      case 'pembangunan':
        return <DevelopmentView />;
      case 'berita':
        return <NewsView />;
      case 'pengumuman':
        return <AnnouncementsView />;
      case 'potensi':
        return <PotentialView />;
      case 'umkm':
        return <UmkmView />;
      case 'agenda':
        return <AgendaView />;
      case 'galeri':
        return <GalleryView />;
      case 'peta':
        return <VillageMapView />;
      case 'posyandu':
        return <PosyanduPublicView />;
      case 'bansos':
        return <BansosCheckView />;
      case 'kontak':
        return <ContactView />;
      case 'admin_posyandu':
        if (!currentUser) {
          return (
            <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center mx-auto shadow-md">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Akses Terbatas Staf Desa</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Halaman pengelolaan e-Posyandu ini hanya diperuntukkan bagi Bidan Desa, TPK, dan Aparatur Desa.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Buka Otentikasi Masuk Admin</span>
                </button>
              </div>
            </div>
          );
        }
        return <PosyanduManager />;
      case 'admin':
      case 'admin_dashboard':
        if (!currentUser) {
          return (
            <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center mx-auto shadow-md">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Akses Terbatas Staf Desa</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Halaman pengelolaan ini hanya diperuntukkan bagi perangkat dan aparatur Pemerintah {villageProfile.villageName || 'Desa'} berwenang.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Buka Otentikasi Masuk Admin</span>
                </button>
              </div>
              <button
                onClick={() => navigateTo('beranda')}
                className="text-xs text-slate-400 hover:text-slate-600 block mx-auto underline"
              >
                Kembali ke Halaman Beranda Publik
              </button>
            </div>
          );
        }
        return <AdminDashboard />;
      case 'test_form' as any:
        return <TestDynamicForm />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-emerald-200 selection:text-emerald-950">
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-8"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col items-center w-full max-w-3xl"
            >
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="SADEWA Logo" 
                  className="w-full max-w-[550px] h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <SadewaFullLogo 
                  size={110} 
                  variant="horizontal"
                  className="scale-110 sm:scale-125"
                />
              )}

              <div className="mt-20 flex flex-col items-center">
                <Loader2 className="w-5 h-5 text-slate-200 animate-spin mb-2" />
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">Memuat Data...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!currentView.startsWith('admin') && (
        <>
          <Header
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
          />
          <StickyShortcutBar />
        </>
      )}

      {/* Area Konten Utama Aplikasi: Menghilangkan pt-10 berlebih dan double padding agar mobile dan desktop presisi */}
      <main className="flex-1 w-full pt-0">
        <ModuleErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              className="w-full"
              initial={{ opacity: 0, x: 20, y: 4 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -20, y: -4 }}
              transition={{ 
                duration: 0.35, 
                ease: [0.22, 1, 0.36, 1]
              }}
            >
              <Suspense fallback={<PageSkeleton />}>
                {renderCurrentView()}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </ModuleErrorBoundary>
      </main>

      {!currentView.startsWith('admin') && (
        <Footer
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
        />
      )}

      <GlobalSearch />

      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      <DocumentValidationModal
        isOpen={verificationModal.isOpen}
        onClose={() => {
          setVerificationModal((prev) => ({ ...prev, isOpen: false }));
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/verify')) {
            window.history.replaceState({}, '', '/');
          }
        }}
        trackingCode={verificationModal.trackingCode}
        letterNumber={verificationModal.letterNumber}
      />

      <VillageAiAssistant />

      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
