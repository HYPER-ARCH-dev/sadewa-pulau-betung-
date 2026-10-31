import React, { useState } from 'react';
import { Download, Smartphone, X, ExternalLink, CheckCircle2, Share2, PlusSquare, MonitorDown } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'footer' | 'mobile' | 'compact';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already installed and running standalone, hide the prompt
  if (isInstalled) {
    if (variant === 'footer') {
      return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium ${className}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>SADEWA PWA Terpasang</span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 4000);
      }
    } else {
      // If browser hasn't fired beforeinstallprompt (e.g. iframe preview or iOS Safari)
      setShowGuideModal(true);
    }
  };

  // Header variant (Desktop navbar)
  if (variant === 'header') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          id="btn-install-pwa-header"
          title="Pasang Aplikasi SADEWA di Perangkat Anda"
          className={`relative group inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 whitespace-nowrap ${
            isInstallable
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm hover:shadow ring-1 ring-emerald-400/40'
              : 'bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-300/80'
          } ${className}`}
        >
          <Download className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 ${isInstallable ? 'text-white' : 'text-emerald-700'}`} />
          <span className="hidden xl:inline">Install App</span>
          <span className="xl:hidden">App</span>
          {isInstallable && (
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
          )}
        </button>

        {showGuideModal && (
          <InstallGuideModal 
            isIOS={isIOS} 
            isInstallable={isInstallable} 
            onClose={() => setShowGuideModal(false)} 
          />
        )}
      </>
    );
  }

  // Mobile drawer variant
  if (variant === 'mobile') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          id="btn-install-pwa-mobile"
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            isInstallable
              ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-md'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100'
          } ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isInstallable ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
              <Download className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="font-extrabold text-xs sm:text-sm">Install Aplikasi SADEWA</div>
              <div className={`text-[11px] font-normal ${isInstallable ? 'text-emerald-100' : 'text-emerald-600'}`}>
                Akses cepat di layar beranda tanpa ribet
              </div>
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${isInstallable ? 'bg-amber-400 text-slate-900' : 'bg-emerald-200/70 text-emerald-800'}`}>
            {isInstallable ? 'Pasang' : 'Info'}
          </span>
        </button>

        {showGuideModal && (
          <InstallGuideModal 
            isIOS={isIOS} 
            isInstallable={isInstallable} 
            onClose={() => setShowGuideModal(false)} 
          />
        )}
      </>
    );
  }

  // Footer variant
  if (variant === 'footer') {
    return (
      <>
        <div className={`rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 p-4 sm:p-5 text-left shadow-lg ${className}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white tracking-wide">
                    Pasang Aplikasi Portal Desa (PWA)
                  </h4>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Gratis & Ringan
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  Buka layanan surat digital, warta desa, dan nomor darurat langsung dari layar HP atau laptop Anda seperti aplikasi native tanpa perlu download dari PlayStore.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClick}
              id="btn-install-pwa-footer"
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md hover:shadow-emerald-500/20 transition-all group"
            >
              <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>{isInstallable ? 'Install Sekarang' : 'Pasang di Perangkat'}</span>
            </button>
          </div>
        </div>

        {showGuideModal && (
          <InstallGuideModal 
            isIOS={isIOS} 
            isInstallable={isInstallable} 
            onClose={() => setShowGuideModal(false)} 
          />
        )}
      </>
    );
  }

  // Compact variant (e.g. icon/pill)
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        id="btn-install-pwa-compact"
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install</span>
      </button>

      {showGuideModal && (
        <InstallGuideModal 
          isIOS={isIOS} 
          isInstallable={isInstallable} 
          onClose={() => setShowGuideModal(false)} 
        />
      )}
    </>
  );
};

// Modal Helper for installation guidance across iOS, Android, and desktop browsers
interface InstallGuideModalProps {
  isIOS: boolean;
  isInstallable: boolean;
  onClose: () => void;
}

const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ isIOS, isInstallable, onClose }) => {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Pasang Aplikasi SADEWA
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Progressive Web App (PWA) Resmi Desa
            </p>
          </div>
        </div>

        {/* Iframe Notice */}
        {isInIframe && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <ExternalLink className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Sedang Di Dalam Jendela Preview</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Browser membatasi dialog instalasi otomatis di dalam frame preview. Silakan buka aplikasi di tab baru browser untuk menginstal langsung dengan 1 klik!
            </p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition"
            >
              <span>Buka di Tab Penuh</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Device Specific Guidance */}
        {isIOS ? (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Petunjuk Pemasangan di iPhone / iPad (Safari):
            </div>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 mt-0.5">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Langkah 1:</strong> Ketuk tombol <strong>Bagikan (Share)</strong> di bilah navigasi bawah Safari.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Langkah 2:</strong> Gulir ke bawah lalu pilih opsi <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Petunjuk di Google Chrome / Edge / Android:
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 mt-0.5">
                  <MonitorDown className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Di Laptop/PC:</strong> Klik ikon <strong>Install Aplikasi</strong> (ikon monitor dengan panah ke bawah) di ujung kanan bilah alamat URL (Address Bar) Chrome atau Edge.
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white">Di HP Android:</strong> Ketuk tombol <strong>Menu (titik tiga)</strong> di pojok kanan atas browser, lalu pilih <strong>"Instal Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold transition"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
