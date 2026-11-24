import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  User,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Users
} from 'lucide-react';
import { VillageOfficial, VillageProfile } from '../../types';

interface OfficialsSpotlightCardProps {
  officials: VillageOfficial[];
  villageProfile: VillageProfile;
  onNavigateProfile: () => void;
  onNavigateGovernment: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  kepala_desa: 'Pimpinan Desa',
  sekretariat: 'Sekretariat Desa',
  kasi: 'Kepala Seksi',
  kaur: 'Kepala Urusan',
  kadus: 'Kepala Dusun',
  rt_rw: 'Ketua RT / RW',
  bpd: 'BPD Desa',
  lpm: 'LPM Desa',
  karang_taruna: 'Karang Taruna',
  pkk: 'Tim Penggerak PKK',
  posyandu: 'Kader Posyandu',
  lainnya: 'Perangkat Desa',
};

export const OfficialsSpotlightCard: React.FC<OfficialsSpotlightCardProps> = ({
  officials,
  villageProfile,
  onNavigateProfile,
  onNavigateGovernment,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const defaultGreeting =
    villageProfile.kadesGreeting ||
    `Assalamu’alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Pemerintah ${
      villageProfile.villageName || 'Desa'
    }, ${
      villageProfile.district || 'Kecamatan'
    }. Kehadiran portal ini merupakan ikhtiar nyata kami menghadirkan tata kelola desa yang transparan, bersih dari pungli, serta memudahkan warga mengurus surat-menyurat secara online dari mana saja.`;

  const slides = useMemo(() => {
    const activeList = (officials || [])
      .filter((o) => o.isActive !== false)
      .sort((a, b) => {
        const isKadesA = a.section === 'kepala_desa' || a.position.toLowerCase().includes('kepala desa');
        const isKadesB = b.section === 'kepala_desa' || b.position.toLowerCase().includes('kepala desa');
        if (isKadesA && !isKadesB) return -1;
        if (!isKadesA && isKadesB) return 1;
        const orderA = a.displayOrder ?? 999;
        const orderB = b.displayOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });

    const mapped = activeList.map((official) => {
      const isKades =
        official.section === 'kepala_desa' ||
        official.position.toLowerCase().includes('kepala desa');

      return {
        id: official.id,
        name: isKades ? villageProfile.kadesName || official.name : official.name,
        position: official.position,
        sectionLabel: SECTION_LABELS[official.section] || 'Aparatur Desa',
        nip: isKades ? villageProfile.kadesNip || official.nip || '' : official.nip || '',
        tenure: official.tenure || '',
        photo: isKades ? villageProfile.kadesPhotoUrl || official.imageUrl || '' : official.imageUrl || '',
        quote: isKades ? defaultGreeting : official.bio || `Melayani masyarakat ${villageProfile.villageName || 'Desa'} dengan amanah dan profesional.`,
        isKades,
      };
    });

    const hasKades = mapped.some((m) => m.isKades);
    if (!hasKades) {
      mapped.unshift({
        id: 'kades-profile-fallback',
        name: villageProfile.kadesName || 'Kepala Desa',
        position: `Kepala ${villageProfile.villageName || 'Desa'}`,
        sectionLabel: 'Pimpinan Desa',
        nip: villageProfile.kadesNip || '',
        tenure: 'Aktif Menjabat',
        photo: villageProfile.kadesPhotoUrl || '',
        quote: defaultGreeting,
        isKades: true,
      });
    }

    return mapped;
  }, [officials, villageProfile, defaultGreeting]);

  // Keep activeIndex valid if officials array changes
  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  const goToSlide = useCallback(
    (nextIndex: number, dir?: number) => {
      if (slides.length <= 1) return;
      const wrapped = (nextIndex + slides.length) % slides.length;
      setDirection(dir ?? (wrapped > activeIndex ? 1 : -1));
      setActiveIndex(wrapped);
    },
    [slides.length, activeIndex]
  );

  const handleNext = useCallback(() => {
    goToSlide(activeIndex + 1, 1);
  }, [activeIndex, goToSlide]);

  const handlePrev = useCallback(() => {
    goToSlide(activeIndex - 1, -1);
  }, [activeIndex, goToSlide]);

  // Auto-slide every 5 seconds unless paused, hovered, or reduced-motion
  useEffect(() => {
    if (slides.length <= 1 || isHovered || isManualPaused || prefersReducedMotion) {
      return;
    }
    const timer = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [slides.length, isHovered, isManualPaused, prefersReducedMotion]);

  // 60fps CSS-variable cursor spotlight tracking (zero React re-renders on mousemove)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || prefersReducedMotion) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--spot-x', `${x}px`);
    cardRef.current.style.setProperty('--spot-y', `${y}px`);
  };

  // Touch swipe support for mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) > 42) {
      if (delta > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const current = slides[activeIndex] || slides[0];
  const hasPhoto = Boolean(current?.photo?.trim()) && !imgErrors[current.id];

  const slideVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: prefersReducedMotion ? 0 : dir > 0 ? 32 : -32,
      scale: prefersReducedMotion ? 1 : 0.98,
    }),
    center: {
      opacity: 1,
      x: 0,
      scale: 1,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: prefersReducedMotion ? 0 : dir > 0 ? -32 : 32,
      scale: prefersReducedMotion ? 1 : 0.98,
    }),
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={
        {
          '--spot-x': '50%',
          '--spot-y': '30%',
        } as React.CSSProperties
      }
      className="lg:col-span-5 w-full min-w-0 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/70 dark:border-slate-800/80 p-6 sm:p-8 shadow-sm hover:-translate-y-1 hover:shadow-[0_24px_60px_-15px_rgba(16,185,129,0.22)] hover:border-emerald-500/40 dark:hover:border-emerald-400/40 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between select-none"
    >
      {/* Interactive Cursor Spotlight Glow Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"
        style={{
          background:
            'radial-gradient(360px circle at var(--spot-x) var(--spot-y), rgba(16, 185, 129, 0.14), rgba(20, 184, 166, 0.05) 45%, transparent 75%)',
        }}
      />

      {/* Ambient Corner Accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-400/10 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:scale-125 group-hover:bg-emerald-500/10 transition-all duration-700 z-0"
      />

      {/* Top Bar: Label, Auto-Slide Status & Controls */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-700/50 text-[10px] font-black uppercase tracking-widest transition-colors group-hover:border-emerald-400/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{current?.sectionLabel || 'Perangkat Desa'}</span>
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60">
              {String(activeIndex + 1).padStart(2, '0')}/{String(slides.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() => setIsManualPaused((prev) => !prev)}
              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800/90 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-500 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title={isManualPaused ? 'Lanjutkan Auto-Slide' : 'Jeda Auto-Slide'}
              aria-label={isManualPaused ? 'Lanjutkan Auto-Slide' : 'Jeda Auto-Slide'}
            >
              {isManualPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>
          </div>
        )}
      </div>

      {/* Main Slide Content with Left/Right Buttons */}
      <div className="relative z-10 flex-1 flex flex-col justify-center">
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Perangkat Sebelumnya"
              title="Sebelumnya"
              className="absolute left-0 top-14 sm:top-16 z-20 w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-800/90 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-md backdrop-blur-sm flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 sm:opacity-75 sm:group-hover:opacity-100 sm:-translate-x-1 sm:group-hover:translate-x-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Perangkat Berikutnya"
              title="Berikutnya"
              className="absolute right-0 top-14 sm:top-16 z-20 w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-800/90 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-md backdrop-blur-sm flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 sm:opacity-75 sm:group-hover:opacity-100 sm:translate-x-1 sm:group-hover:translate-x-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            {/* Portrait & Identity */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200/60 dark:ring-white/10 group-hover:ring-emerald-400/60 group-hover:scale-105 group-hover:rotate-1 transition-all duration-500">
                  {hasPhoto ? (
                    <img
                      src={current.photo.trim()}
                      alt={current.name}
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, [current.id]: true }))
                      }
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                      <User className="w-16 h-16 opacity-80" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2 rounded-xl shadow-lg ring-2 ring-white dark:ring-slate-900 group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-300">
                  <BadgeCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-1 px-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-snug uppercase group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                  {current.name}
                </h3>
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">
                  {current.position}
                </p>
                {(current.nip || current.tenure) && (
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    {current.nip ? `NIP/NIAP: ${current.nip}` : current.tenure}
                  </p>
                )}
              </div>
            </div>

            {/* Quote / Bio */}
            <div className="relative">
              <span className="absolute -top-4 -left-1 text-6xl text-emerald-500/10 font-serif leading-none">
                “
              </span>
              <p className="text-sm sm:text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed italic relative z-10 text-center px-3 line-clamp-5 min-h-[5.5rem]">
                {current.quote}
              </p>
              <span className="absolute -bottom-6 -right-1 text-6xl text-emerald-500/10 font-serif leading-none">
                ”
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination Dots & Auto-Slide Indicator */}
      {slides.length > 1 && (
        <div className="relative z-10 mt-6 flex flex-col items-center gap-2.5">
          <div className="flex items-center justify-center flex-wrap gap-1.5">
            {slides.map((slide, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => goToSlide(idx)}
                  aria-label={`Lihat ${slide.name}`}
                  title={`${slide.name} — ${slide.position}`}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'w-7 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                      : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-emerald-400/70'
                  }`}
                />
              );
            })}
          </div>
          {!isHovered && !isManualPaused && !prefersReducedMotion && (
            <div className="w-32 h-0.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <motion.div
                key={`progress-${activeIndex}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 5.2, ease: 'linear' }}
                style={{ transformOrigin: '0% 50%' }}
                className="h-full w-full bg-gradient-to-r from-emerald-500 to-teal-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Footer Action Buttons */}
      <div className="relative z-10 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={onNavigateProfile}
          className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-900 dark:text-slate-200 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer active:scale-95"
        >
          Visi &amp; Misi Selengkapnya
        </button>
        <button
          type="button"
          onClick={onNavigateGovernment}
          className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-700/50 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>Semua Perangkat</span>
        </button>
      </div>
    </div>
  );
};
