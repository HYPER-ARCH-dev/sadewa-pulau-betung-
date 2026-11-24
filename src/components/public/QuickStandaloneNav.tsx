import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ViewType } from '../../types';

interface QuickStandaloneNavProps {
  onNavigate: (view: ViewType) => void;
}

interface NavItemConfig {
  id: ViewType;
  label: string;
  desc: string;
  glowColor: string;
  hoverLabelClass: string;
  renderIcon: () => React.ReactNode;
}

const Infrastructure3DIcon: React.FC = () => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full drop-shadow-[0_10px_16px_rgba(5,150,105,0.22)]"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sadewa-infra-tower-front" x1="16" y1="18" x2="48" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="sadewa-infra-tower-side" x1="44" y1="24" x2="66" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6EE7B7" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="sadewa-infra-roof" x1="18" y1="10" x2="46" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="sadewa-infra-crane" x1="46" y1="12" x2="70" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
    </defs>

    {/* Ambient Soft Floor Shadow */}
    <ellipse cx="40" cy="71" rx="26" ry="4.5" fill="#065F46" fillOpacity="0.14" />

    {/* Secondary Architectural Wing (Right 3D Extrusion) */}
    <path
      d="M44 27L62 33.5V66.5L44 68V27Z"
      fill="url(#sadewa-infra-tower-side)"
    />
    {/* Wing Window Louvers */}
    <rect x="49" y="39" width="8" height="3.5" rx="1.5" fill="#ECFDF5" fillOpacity="0.85" />
    <rect x="49" y="46.5" width="8" height="3.5" rx="1.5" fill="#ECFDF5" fillOpacity="0.72" />
    <rect x="49" y="54" width="8" height="3.5" rx="1.5" fill="#ECFDF5" fillOpacity="0.6" />

    {/* Primary Architectural Tower (Front) */}
    <path
      d="M17 22L44 14V68H17V22Z"
      fill="url(#sadewa-infra-tower-front)"
    />
    {/* Crisp 3D Bevel Edge Highlight */}
    <path
      d="M44 14V68"
      stroke="#A7F3D0"
      strokeOpacity="0.55"
      strokeWidth="1.5"
    />
    {/* Slanted Modern Roof Crown */}
    <path
      d="M15 22.5L44 12.5L47 14.5L17 24.5L15 22.5Z"
      fill="url(#sadewa-infra-roof)"
    />

    {/* Facade Glass Windows (2 Columns x 3 Rows) */}
    <rect x="22" y="27" width="6.5" height="6.5" rx="1.8" fill="#ECFDF5" fillOpacity="0.95" />
    <rect x="32.5" y="25" width="6.5" height="6.5" rx="1.8" fill="#D1FAE5" fillOpacity="0.88" />
    <rect x="22" y="37.5" width="6.5" height="6.5" rx="1.8" fill="#D1FAE5" fillOpacity="0.85" />
    <rect x="32.5" y="36" width="6.5" height="6.5" rx="1.8" fill="#ECFDF5" fillOpacity="0.95" />
    <rect x="22" y="48" width="6.5" height="6.5" rx="1.8" fill="#A7F3D0" fillOpacity="0.8" />
    <rect x="32.5" y="47" width="6.5" height="6.5" rx="1.8" fill="#D1FAE5" fillOpacity="0.9" />

    {/* Civic Entrance Portal */}
    <rect x="26" y="58.5" width="9" height="9.5" rx="2" fill="#064E3B" />
    <rect x="27.5" y="60" width="6" height="8" rx="1.2" fill="#34D399" fillOpacity="0.45" />

    {/* Modern Construction Jib / Beam Accent */}
    <path
      d="M52 30V15.5M52 15.5H67.5M52 15.5L46 19M59.5 15.5L52 21.5"
      stroke="url(#sadewa-infra-crane)"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="65.5" cy="21" r="2.6" fill="#FBBF24" />
    <path d="M65.5 16V18.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const Umkm3DIcon: React.FC = () => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full drop-shadow-[0_10px_16px_rgba(217,119,6,0.22)]"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sadewa-umkm-bag-front" x1="16" y1="24" x2="54" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="sadewa-umkm-bag-side" x1="50" y1="26" x2="66" y2="68" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
      <linearGradient id="sadewa-umkm-handle" x1="28" y1="10" x2="46" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#10B981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="sadewa-umkm-seal" x1="27" y1="39" x2="43" y2="55" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="100%" stopColor="#FDE68A" />
      </linearGradient>
    </defs>

    {/* Ambient Soft Floor Shadow */}
    <ellipse cx="41" cy="71" rx="25" ry="4.5" fill="#78350F" fillOpacity="0.14" />

    {/* Back Handle Loop */}
    <path
      d="M32 25V17.5C32 13.3579 35.3579 10 39.5 10C43.6421 10 47 13.3579 47 17.5V25"
      stroke="#065F46"
      strokeWidth="3.5"
      strokeLinecap="round"
    />

    {/* Bag Right Side Gusset (3D Depth) */}
    <path
      d="M52 25L63.5 29.5L65 62.5L52 68V25Z"
      fill="url(#sadewa-umkm-bag-side)"
    />
    {/* Gusset Fold Line */}
    <path d="M58 27.5L59 64.5" stroke="#FDE68A" strokeOpacity="0.28" strokeWidth="1.2" />

    {/* Bag Front Body */}
    <path
      d="M17 25H52V68H20C17.7909 68 16 66.2091 16 64L17 25Z"
      fill="url(#sadewa-umkm-bag-front)"
    />

    {/* Top Cuff Highlight */}
    <path
      d="M17 25H52L55 27.5H17V25Z"
      fill="#FDE68A"
      fillOpacity="0.55"
    />

    {/* Front Handle Loop (Vibrant Emerald Accent) */}
    <path
      d="M27 28V19.5C27 15.3579 30.3579 12 34.5 12C38.6421 12 42 15.3579 42 19.5V28"
      stroke="url(#sadewa-umkm-handle)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Handle Grommets */}
    <circle cx="27" cy="29.5" r="2.3" fill="#065F46" />
    <circle cx="42" cy="29.5" r="2.3" fill="#065F46" />

    {/* Storefront / UMKM Artisan Badge on Bag */}
    <circle cx="34.5" cy="48" r="10.5" fill="url(#sadewa-umkm-seal)" fillOpacity="0.95" />
    <path
      d="M29 45.5L30.5 42.5H38.5L40 45.5M29 45.5H40M29 45.5V46.5C29 47.6046 29.8954 48.5 31 48.5C32.1046 48.5 33 47.6046 33 46.5C33 47.6046 33.8954 48.5 35 48.5C36.1046 48.5 37 47.6046 37 46.5C37 47.6046 37.8954 48.5 39 48.5C39.5523 48.5 40 48.0523 40 47.5V45.5M30.5 48.5V53.5H38.5V48.5"
      stroke="#B45309"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MapFacilities3DIcon: React.FC = () => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full drop-shadow-[0_10px_16px_rgba(2,132,199,0.22)]"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sadewa-map-panel-a" x1="12" y1="30" x2="32" y2="66" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#BAE6FD" />
        <stop offset="100%" stopColor="#38BDF8" />
      </linearGradient>
      <linearGradient id="sadewa-map-panel-b" x1="30" y1="26" x2="50" y2="66" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#0284C7" />
      </linearGradient>
      <linearGradient id="sadewa-map-panel-c" x1="48" y1="28" x2="68" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7DD3FC" />
        <stop offset="100%" stopColor="#0369A1" />
      </linearGradient>
      <linearGradient id="sadewa-map-pin" x1="30" y1="10" x2="52" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#2563EB" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>

    {/* Ambient Soft Floor Shadow */}
    <ellipse cx="40" cy="71" rx="26" ry="4.5" fill="#0369A1" fillOpacity="0.14" />

    {/* Folded 3D Map Base (Left, Center, Right Panels) */}
    <path
      d="M12 34L30 28V63L12 68V34Z"
      fill="url(#sadewa-map-panel-a)"
    />
    <path
      d="M30 28L50 34V68L30 63V28Z"
      fill="url(#sadewa-map-panel-b)"
    />
    <path
      d="M50 34L68 28V62L50 68V34Z"
      fill="url(#sadewa-map-panel-c)"
    />

    {/* Map Route Dashed Trace */}
    <path
      d="M17 56C22 50 28 53 35 51C42 49 49 54 62 45"
      stroke="#FFFFFF"
      strokeOpacity="0.85"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeDasharray="3.5 3.5"
    />

    {/* Floating Pin Shadow on Map */}
    <ellipse cx="40" cy="49" rx="7" ry="2.6" fill="#075985" fillOpacity="0.4" />

    {/* Elevated 3D Map Pin / Compass Body */}
    <path
      d="M40 10C30.6112 10 23 17.6112 23 27C23 36.8 35.8 47.4 38.7 49.6C39.47 50.18 40.53 50.18 41.3 49.6C44.2 47.4 57 36.8 57 27C57 17.6112 49.3888 10 40 10Z"
      fill="url(#sadewa-map-pin)"
    />
    {/* Crisp Pin Inner Rim */}
    <circle cx="40" cy="26.5" r="10.5" fill="#FFFFFF" />
    {/* Compass Needle Inside Pin */}
    <path
      d="M43.8 22.7L41.4 28.4L36.2 30.3L38.6 24.6L43.8 22.7Z"
      fill="#10B981"
    />
    <circle cx="40" cy="26.5" r="1.6" fill="#0F172A" />
  </svg>
);

const WartaDesa3DIcon: React.FC = () => (
  <svg
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full drop-shadow-[0_10px_16px_rgba(79,70,229,0.22)]"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="sadewa-news-back" x1="46" y1="16" x2="66" y2="66" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#818CF8" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
      <linearGradient id="sadewa-news-front" x1="14" y1="14" x2="56" y2="66" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="100%" stopColor="#E0E7FF" />
      </linearGradient>
      <linearGradient id="sadewa-news-header" x1="20" y1="20" x2="50" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
      <linearGradient id="sadewa-news-media" x1="20" y1="34" x2="36" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
    </defs>

    {/* Ambient Soft Floor Shadow */}
    <ellipse cx="40" cy="71" rx="25" ry="4.5" fill="#312E81" fillOpacity="0.14" />

    {/* Secondary Back Sheet (3D Stacked Paper Depth) */}
    <path
      d="M52 22H61C63.7614 22 66 24.2386 66 27V59C66 63.4183 62.4183 67 58 67H48V22H52Z"
      fill="url(#sadewa-news-back)"
    />

    {/* Front Broadsheet Folio */}
    <rect
      x="14"
      y="14"
      width="43"
      height="53"
      rx="6"
      fill="url(#sadewa-news-front)"
      stroke="#C7D2FE"
      strokeWidth="1.5"
    />

    {/* Editorial Masthead Banner */}
    <rect x="20" y="20" width="31" height="8.5" rx="2.5" fill="url(#sadewa-news-header)" />
    <rect x="23" y="23" width="16" height="2.5" rx="1.25" fill="#FFFFFF" fillOpacity="0.92" />

    {/* Lead Visual Photo Thumbnail */}
    <rect x="20" y="33" width="15" height="15" rx="3" fill="url(#sadewa-news-media)" />
    <circle cx="25" cy="38" r="2" fill="#ECFDF5" />
    <path d="M22 46L26 42L29 44.5L33 40V46H22Z" fill="#064E3B" fillOpacity="0.35" />

    {/* Dual-Column Editorial Lines */}
    <rect x="38.5" y="34" width="12.5" height="3" rx="1.5" fill="#4F46E5" fillOpacity="0.85" />
    <rect x="38.5" y="39.5" width="12.5" height="2.6" rx="1.3" fill="#6366F1" fillOpacity="0.45" />
    <rect x="38.5" y="44.5" width="9.5" height="2.6" rx="1.3" fill="#6366F1" fillOpacity="0.45" />

    {/* Bottom Editorial Body Rows */}
    <rect x="20" y="52.5" width="31" height="2.8" rx="1.4" fill="#6366F1" fillOpacity="0.45" />
    <rect x="20" y="58" width="23" height="2.8" rx="1.4" fill="#6366F1" fillOpacity="0.35" />
  </svg>
);

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'pembangunan',
    label: 'Infrastruktur',
    desc: 'Progres Fisik',
    glowColor: 'bg-emerald-400/20 dark:bg-emerald-400/15',
    hoverLabelClass: 'group-hover:text-emerald-700 dark:group-hover:text-emerald-400',
    renderIcon: () => <Infrastructure3DIcon />
  },
  {
    id: 'umkm',
    label: 'Katalog UMKM',
    desc: 'Produk Lokal',
    glowColor: 'bg-amber-400/20 dark:bg-amber-400/15',
    hoverLabelClass: 'group-hover:text-amber-700 dark:group-hover:text-amber-400',
    renderIcon: () => <Umkm3DIcon />
  },
  {
    id: 'peta',
    label: 'Peta Fasilitas',
    desc: 'Sarana Umum',
    glowColor: 'bg-sky-400/20 dark:bg-sky-400/15',
    hoverLabelClass: 'group-hover:text-sky-700 dark:group-hover:text-sky-400',
    renderIcon: () => <MapFacilities3DIcon />
  },
  {
    id: 'berita',
    label: 'Warta Desa',
    desc: 'Kabar Terkini',
    glowColor: 'bg-indigo-400/20 dark:bg-indigo-400/15',
    hoverLabelClass: 'group-hover:text-indigo-700 dark:group-hover:text-indigo-400',
    renderIcon: () => <WartaDesa3DIcon />
  }
];

export const QuickStandaloneNav: React.FC<QuickStandaloneNavProps> = ({ onNavigate }) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Navigasi Cepat Layanan Publik Desa"
      className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8 sm:gap-8 pt-6 pb-2"
    >
      {NAV_ITEMS.map((item, idx) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 22, scale: 0.92 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-20px' }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.48, delay: idx * 0.08, ease: [0.22, 1, 0.36, 1] }
          }
          whileHover={
            shouldReduceMotion
              ? undefined
              : {
                  y: -6,
                  scale: 1.04,
                  transition: { type: 'spring', stiffness: 360, damping: 22 }
                }
          }
          whileTap={
            shouldReduceMotion
              ? undefined
              : {
                  scale: 0.94,
                  y: -1,
                  transition: { type: 'spring', stiffness: 500, damping: 24 }
                }
          }
          className="group relative flex flex-col items-center justify-start text-center bg-transparent border-0 shadow-none p-2 min-h-[44px] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-2xl"
        >
          {/* Standalone Floating Icon Wrapper (No Card, No Box, No Border) */}
          <div className="relative w-[56px] h-[56px] sm:w-[68px] sm:h-[68px] lg:w-[72px] lg:h-[72px] flex items-center justify-center mb-3 shrink-0">
            {/* Subtle Ambient Radial Hover Glow (Zero Box/Border) */}
            <div
              aria-hidden="true"
              className={`absolute inset-1 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${item.glowColor}`}
            />

            {/* Subtle Floating Motion Layer */}
            <motion.div
              className="relative w-full h-full flex items-center justify-center will-change-transform"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: [0, -4.5, 0]
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 3.6 + idx * 0.25,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: idx * 0.35
                    }
              }
            >
              {item.renderIcon()}
            </motion.div>
          </div>

          {/* Centered Title & Subtitle Below Icon */}
          <span
            className={`text-sm sm:text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug transition-colors duration-200 ${item.hoverLabelClass}`}
          >
            {item.label}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-[0.12em] mt-1">
            {item.desc}
          </span>
        </motion.button>
      ))}
    </nav>
  );
};
