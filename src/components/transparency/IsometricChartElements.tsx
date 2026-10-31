import React, { useState, useMemo, memo } from 'react';
import {
  Wallet,
  Coins,
  TrendingUp,
  Building2,
  Landmark,
  Receipt,
  PieChart,
  HandCoins,
  CircleDollarSign,
  Building,
  HardHat,
  Users,
  Lightbulb,
  ShieldAlert,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Layers,
  BadgeCheck,
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

/**
 * Global SVG Definitions for 3D Isometric Exploded Charts
 * High-DPI Vector Safe, 100% Print & Baliho Compatible
 */
export const IsometricSvgDefs: React.FC = () => (
  <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
    <defs>
      {/* 1. Filters */}
      <filter id="cuboidShadowBlur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
      </filter>
      <filter id="topCapGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feColorMatrix
          type="matrix"
          values="1.15 0 0 0 0  0 1.15 0 0 0  0 0 1.15 0 0  0 0 0 1 0"
        />
      </filter>
      <filter id="floorShadowBlur" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
      </filter>
      <filter id="activeSliceGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="-3" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.6" />
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.32" />
      </filter>
      <filter id="calloutLineGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#ffffff" floodOpacity="0.8" />
      </filter>
      <filter id="calloutPillShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.12" />
      </filter>

      {/* 2. Ambient Floor Shadow */}
      <radialGradient id="ambientFloorShadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#0f172a" stopOpacity="0.3" />
        <stop offset="65%" stopColor="#0f172a" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>

      {/* 3. Center Hub Gradients */}
      <linearGradient id="centerHubTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#f1f5f9" />
      </linearGradient>
      <linearGradient id="centerHubSide" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>

      {/* 4. Cuboid Bar Gradients - Emerald (Pendapatan) */}
      <linearGradient id="cuboidGreenPagu" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="60%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="cuboidGreenReal" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="50%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </linearGradient>

      {/* 5. Cuboid Bar Gradients - Amber (Belanja) */}
      <linearGradient id="cuboidAmberPagu" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="60%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id="cuboidAmberReal" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="50%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>

      {/* 6. Cuboid Bar Gradients - Blue (Pembiayaan) */}
      <linearGradient id="cuboidBluePagu" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#bfdbfe" />
        <stop offset="60%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
      <linearGradient id="cuboidBlueReal" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="50%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>

      {/* 7. Vibrant Exploded 3D Slice Gradients */}
      {/* Palette 0: Emerald / Jade */}
      <linearGradient id="expTopGrad_0" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="45%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id="expSideGrad_0" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#059669" />
        <stop offset="100%" stopColor="#022c22" />
      </linearGradient>

      {/* Palette 1: Amber / Honey */}
      <linearGradient id="expTopGrad_1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="expSideGrad_1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#451a03" />
      </linearGradient>

      {/* Palette 2: Blue / Cobalt */}
      <linearGradient id="expTopGrad_2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="45%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="expSideGrad_2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#172554" />
      </linearGradient>

      {/* Palette 3: Rose / Coral */}
      <linearGradient id="expTopGrad_3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fda4af" />
        <stop offset="45%" stopColor="#f43f5e" />
        <stop offset="100%" stopColor="#be123c" />
      </linearGradient>
      <linearGradient id="expSideGrad_3" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#4c0519" />
      </linearGradient>

      {/* Palette 4: Violet / Amethyst */}
      <linearGradient id="expTopGrad_4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c4b5fd" />
        <stop offset="45%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#5b21b6" />
      </linearGradient>
      <linearGradient id="expSideGrad_4" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#2e1065" />
      </linearGradient>

      {/* Palette 5: Teal / Ocean */}
      <linearGradient id="expTopGrad_5" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#5eead4" />
        <stop offset="45%" stopColor="#14b8a6" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
      <linearGradient id="expSideGrad_5" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#042f2e" />
      </linearGradient>

      {/* 8. Modern 3D Capsule Bar Defs & Glowing Knob Filters */}
      <filter id="knobGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.25" />
      </filter>
      <filter id="knobGlowActive" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#38bdf8" floodOpacity="0.85" />
        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.35" />
      </filter>
      <filter id="knobGlowEmerald" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#34d399" floodOpacity="0.85" />
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#064e3b" floodOpacity="0.35" />
      </filter>
      <filter id="knobGlowAmber" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#fbbf24" floodOpacity="0.85" />
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#78350f" floodOpacity="0.35" />
      </filter>
      <filter id="knobGlowBlue" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#60a5fa" floodOpacity="0.85" />
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1e3a8a" floodOpacity="0.35" />
      </filter>

      {/* 3D Sphere Radial Gradients for Knob */}
      <radialGradient id="knobRadialEmerald" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#a7f3d0" />
        <stop offset="35%" stopColor="#10b981" />
        <stop offset="85%" stopColor="#047857" />
        <stop offset="100%" stopColor="#064e3b" />
      </radialGradient>
      <radialGradient id="knobRadialAmber" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="35%" stopColor="#f59e0b" />
        <stop offset="85%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </radialGradient>
      <radialGradient id="knobRadialBlue" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#dbeafe" />
        <stop offset="35%" stopColor="#3b82f6" />
        <stop offset="85%" stopColor="#1d4ed8" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </radialGradient>
      <radialGradient id="knobRadialPurple" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ede9fe" />
        <stop offset="35%" stopColor="#8b5cf6" />
        <stop offset="85%" stopColor="#6d28d9" />
        <stop offset="100%" stopColor="#4c1d95" />
      </radialGradient>
      <radialGradient id="knobRadialRose" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffe4e6" />
        <stop offset="35%" stopColor="#f43f5e" />
        <stop offset="85%" stopColor="#be123c" />
        <stop offset="100%" stopColor="#881337" />
      </radialGradient>

      {/* 3D Base Podium Gradients */}
      <linearGradient id="podiumTopSlate" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <linearGradient id="podiumFrontSlate" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#94a3b8" />
      </linearGradient>

      {/* 9. Clean & Luxurious 3D Prism Bar Defs (Pastel Pagu & Luminous Realisasi) */}
      <filter id="luxSoftLift" x="-30%" y="-40%" width="160%" height="180%">
        <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.18" />
        <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.08" />
      </filter>
      <filter id="luxPillShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.15" />
      </filter>
      <filter id="luxBaseGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
      </filter>

      {/* Emerald (Pendapatan) */}
      <linearGradient id="luxEmeraldPaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#d1fae5" />
        <stop offset="60%" stopColor="#a7f3d0" />
        <stop offset="100%" stopColor="#6ee7b7" />
      </linearGradient>
      <linearGradient id="luxEmeraldRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="45%" stopColor="#059669" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>

      {/* Amber / Gold (Belanja) */}
      <linearGradient id="luxAmberPaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="60%" stopColor="#fde68a" />
        <stop offset="100%" stopColor="#fcd34d" />
      </linearGradient>
      <linearGradient id="luxAmberRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="45%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#9a3412" />
      </linearGradient>

      {/* Blue / Sapphire (Pembiayaan) */}
      <linearGradient id="luxBluePaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#dbeafe" />
        <stop offset="60%" stopColor="#bfdbfe" />
        <stop offset="100%" stopColor="#93c5fd" />
      </linearGradient>
      <linearGradient id="luxBlueRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="45%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>

      {/* Rose / Coral (Darurat / Bencana) */}
      <linearGradient id="luxRosePaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffe4e6" />
        <stop offset="60%" stopColor="#fecdd3" />
        <stop offset="100%" stopColor="#fda4af" />
      </linearGradient>
      <linearGradient id="luxRoseRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fb7185" />
        <stop offset="45%" stopColor="#e11d48" />
        <stop offset="100%" stopColor="#be123c" />
      </linearGradient>

      {/* Purple / Violet (Pemberdayaan) */}
      <linearGradient id="luxPurplePaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ede9fe" />
        <stop offset="60%" stopColor="#ddd6fe" />
        <stop offset="100%" stopColor="#c4b5fd" />
      </linearGradient>
      <linearGradient id="luxPurpleRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="45%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#5b21b6" />
      </linearGradient>

      {/* Teal / Ocean (Penyelenggaraan) */}
      <linearGradient id="luxTealPaguFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ccfbf1" />
        <stop offset="60%" stopColor="#99f6e4" />
        <stop offset="100%" stopColor="#5eead4" />
      </linearGradient>
      <linearGradient id="luxTealRealFront" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2dd4bf" />
        <stop offset="45%" stopColor="#0d9488" />
        <stop offset="100%" stopColor="#0f766e" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * Custom 3D Cuboid Bar Renderer for Recharts
 */
export const IsometricCuboidBar: React.FC<any> = (props) => {
  const { x, y, width, height, stroke } = props;

  if (height === undefined || height <= 0 || width === undefined || width <= 0) {
    return null;
  }

  // 3D Isometric Extrusion Vector
  const depthX = Math.round(Math.min(9, Math.max(4, width * 0.32)));
  const depthY = Math.round(Math.min(7, Math.max(3, width * 0.24)));

  const x0 = x;
  const y0 = y;
  const w = width;
  const h = height;

  const topCapPoints = `${x0},${y0} ${x0 + depthX},${y0 - depthY} ${x0 + w + depthX},${y0 - depthY} ${x0 + w},${y0}`;
  const sideWallPoints = `${x0 + w},${y0} ${x0 + w + depthX},${y0 - depthY} ${x0 + w + depthX},${y0 + h - depthY} ${x0 + w},${y0 + h}`;
  const shadowPoints = `${x0 - 1},${y0 + h} ${x0 + w + 1},${y0 + h} ${x0 + w + depthX * 1.3},${y0 + h + depthY * 0.6} ${x0 + depthX * 0.8},${y0 + h + depthY * 0.6}`;

  const dataKey = props.dataKey || '';
  const fill = props.fill || '';
  const isPagu = dataKey === 'pagu' || props.name?.toLowerCase().includes('pagu') || fill.includes('Target');
  const isAmber = fill.includes('Exp') || fill.includes('amber') || fill.includes('d97706') || fill.includes('Belanja') || props.color === '#d97706';
  const isBlue = fill.includes('Fin') || fill.includes('blue') || fill.includes('2563eb') || fill.includes('Pembiayaan') || props.color === '#2563eb';

  const frontFill = isPagu
    ? (isAmber ? 'url(#cuboidAmberPagu)' : isBlue ? 'url(#cuboidBluePagu)' : 'url(#cuboidGreenPagu)')
    : (isAmber ? 'url(#cuboidAmberReal)' : isBlue ? 'url(#cuboidBlueReal)' : 'url(#cuboidGreenReal)');

  const topFill = isPagu
    ? (isAmber ? '#fef3c7' : isBlue ? '#dbeafe' : '#d1fae5')
    : (isAmber ? '#fde68a' : isBlue ? '#bfdbfe' : '#a7f3d0');

  const sideFill = isPagu
    ? (isAmber ? '#d97706' : isBlue ? '#2563eb' : '#059669')
    : (isAmber ? '#9a3412' : isBlue ? '#1e3a8a' : '#064e3b');

  return (
    <g className="isometric-cuboid-bar">
      <polygon
        points={shadowPoints}
        fill="rgba(15, 23, 42, 0.16)"
        filter="url(#cuboidShadowBlur)"
      />
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill={frontFill}
        stroke={stroke || sideFill}
        strokeWidth={0.5}
        rx={1}
      />
      <polygon
        points={topCapPoints}
        fill={topFill}
        stroke={stroke || sideFill}
        strokeWidth={0.5}
        filter="url(#topCapGlow)"
      />
      <polygon
        points={sideWallPoints}
        fill={sideFill}
        stroke={stroke || '#0f172a'}
        strokeWidth={0.5}
      />
      <line
        x1={x0 + w}
        y1={y0}
        x2={x0 + w}
        y2={y0 + h}
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth={0.75}
      />
    </g>
  );
};

/**
 * Vibrant Color Theme Palettes for 3D Exploded Slices
 */
export const VIBRANT_PALETTES = [
  {
    name: 'emerald',
    accent: '#059669',
    light: '#34d399',
    dark: '#064e3b',
    deep: '#022c22',
    glow: 'rgba(52, 211, 153, 0.5)',
    bgLight: '#ecfdf5',
    border: '#a7f3d0',
    textColor: '#065f46',
    topGrad: 'url(#expTopGrad_0)',
    sideGrad: 'url(#expSideGrad_0)'
  },
  {
    name: 'amber',
    accent: '#d97706',
    light: '#fbbf24',
    dark: '#92400e',
    deep: '#451a03',
    glow: 'rgba(251, 191, 36, 0.5)',
    bgLight: '#fffbeb',
    border: '#fde68a',
    textColor: '#854d0e',
    topGrad: 'url(#expTopGrad_1)',
    sideGrad: 'url(#expSideGrad_1)'
  },
  {
    name: 'blue',
    accent: '#2563eb',
    light: '#60a5fa',
    dark: '#1e3a8a',
    deep: '#172554',
    glow: 'rgba(96, 165, 250, 0.5)',
    bgLight: '#eff6ff',
    border: '#bfdbfe',
    textColor: '#1e40af',
    topGrad: 'url(#expTopGrad_2)',
    sideGrad: 'url(#expSideGrad_2)'
  },
  {
    name: 'rose',
    accent: '#e11d48',
    light: '#fb7185',
    dark: '#881337',
    deep: '#4c0519',
    glow: 'rgba(251, 113, 133, 0.5)',
    bgLight: '#fff1f2',
    border: '#fecdd3',
    textColor: '#9f1239',
    topGrad: 'url(#expTopGrad_3)',
    sideGrad: 'url(#expSideGrad_3)'
  },
  {
    name: 'violet',
    accent: '#7c3aed',
    light: '#a78bfa',
    dark: '#4c1d95',
    deep: '#2e1065',
    glow: 'rgba(167, 139, 250, 0.5)',
    bgLight: '#f5f3ff',
    border: '#ddd6fe',
    textColor: '#5b21b6',
    topGrad: 'url(#expTopGrad_4)',
    sideGrad: 'url(#expSideGrad_4)'
  },
  {
    name: 'teal',
    accent: '#0d9488',
    light: '#2dd4bf',
    dark: '#134e4a',
    deep: '#042f2e',
    glow: 'rgba(45, 212, 191, 0.5)',
    bgLight: '#f0fdfa',
    border: '#99f6e4',
    textColor: '#115e59',
    topGrad: 'url(#expTopGrad_5)',
    sideGrad: 'url(#expSideGrad_5)'
  }
];

/**
 * Intelligent Category Icon Resolver for APBDes
 */
export const getApbdesCategoryIcon = (name: string): React.ComponentType<{ className?: string }> => {
  const n = (name || '').toLowerCase();
  if (n.includes('asli') || n.includes('pades') || n.includes('bumdes') || n.includes('pasar')) {
    return Wallet;
  }
  if (n.includes('dana desa') || n.includes('dds') || n.includes('apbn')) {
    return TrendingUp;
  }
  if (n.includes('pajak') || n.includes('retribusi') || n.includes('bagi hasil') || n.includes('pbh')) {
    return Receipt;
  }
  if (n.includes('bantuan') || n.includes('bkk') || n.includes('provinsi') || n.includes('kabupaten')) {
    return HandCoins;
  }
  if (n.includes('pemerintahan') || n.includes('aparatur') || n.includes('tata kelola')) {
    return Landmark;
  }
  if (n.includes('pembangunan') || n.includes('fisik') || n.includes('infrastruktur') || n.includes('jalan')) {
    return HardHat;
  }
  if (n.includes('pembinaan') || n.includes('kemasyarakatan') || n.includes('adat') || n.includes('pemuda')) {
    return Users;
  }
  if (n.includes('pemberdayaan') || n.includes('usaha') || n.includes('pelatihan') || n.includes('tani')) {
    return Lightbulb;
  }
  if (n.includes('bencana') || n.includes('darurat') || n.includes('mendesak') || n.includes('covid')) {
    return ShieldAlert;
  }
  if (n.includes('pendapatan')) {
    return ArrowDownLeft;
  }
  if (n.includes('belanja')) {
    return ArrowUpRight;
  }
  if (n.includes('pembiayaan')) {
    return Scale;
  }
  return Layers;
};

const formatRupiahShort = (amount?: number): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Rp 0';
  if (Math.abs(amount) >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Jt`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `Rp ${(amount / 1_000).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Rb`;
  }
  return `Rp ${amount.toLocaleString('id-ID')}`;
};

export interface Isometric3DDonutItem {
  name: string;
  fullName?: string;
  pagu?: number;
  value?: number;
  realisasi?: number;
  percent?: number;
  color?: string;
  fill?: string;
}

export interface Isometric3DDonutProps {
  data: Isometric3DDonutItem[];
  dataKey?: string;
  nameKey?: string;
  centerLabel?: string;
  centerValue?: string;
  tooltipComponent?: React.ReactElement;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showCalloutLines?: boolean;
  showInteractiveLegend?: boolean;
  activeSliceIndex?: number | null;
  onActiveSliceChange?: (index: number | null) => void;
}

/**
 * Hyper-Realistic 3D Isometric Exploded Donut/Pie Infographic Component
 *
 * Features:
 * - Pure High-DPI Vector SVG (100% Crisp for 3x2m Baliho & High-Res PDF Prints)
 * - Exploded 3D Isometric Projection with Floating Slice Elevating radial translation
 * - 3D Floor Shadow under whole diagram & each exploded slice
 * - Multi-surface 3D extrusion (Top Illuminated Face, Outer Cylinder Mantle, Radial Cut Walls)
 * - Interactive Callout Pointer Lines connecting slices to floating vector badges
 * - Micro-interactions: ultra-smooth spring cubic-bezier(0.34, 1.56, 0.64, 1) on hover/touch
 * - Synchronized interactive Lucide icon badges & detailed budget metric HUD
 */
export const Isometric3DDonut = memo<Isometric3DDonutProps>(({
  data,
  dataKey = 'pagu',
  nameKey = 'name',
  centerLabel = 'Realisasi',
  centerValue = '0%',
  tooltipComponent,
  height,
  showCalloutLines = true,
  showInteractiveLegend = true,
  activeSliceIndex: controlledActiveIndex,
  onActiveSliceChange
}) => {
  const [internalActiveIndex, setInternalActiveIndex] = useState<number | null>(null);

  const activeIndex = controlledActiveIndex !== undefined ? controlledActiveIndex : internalActiveIndex;

  const handleSliceClick = (index: number) => {
    const nextIndex = activeIndex === index ? null : index;
    if (onActiveSliceChange) {
      onActiveSliceChange(nextIndex);
    } else {
      setInternalActiveIndex(nextIndex);
    }
  };

  const handleMouseEnter = (index: number) => {
    if (onActiveSliceChange) {
      onActiveSliceChange(index);
    } else {
      setInternalActiveIndex(index);
    }
  };

  const handleMouseLeave = () => {
    if (onActiveSliceChange) {
      onActiveSliceChange(null);
    } else {
      setInternalActiveIndex(null);
    }
  };

  // Isometric Geometry Parameters
  const viewBoxWidth = 520;
  const viewBoxHeight = 270;
  const cx = 260;
  const cy = 125;
  const Rx = 110;
  const Ry = 58;
  const rx = 48;
  const ry = 25.5;
  const H = 18; // 3D Extrusion Depth

  // Total Value Calculation
  const totalValue = useMemo(() => {
    return data.reduce((acc, item) => {
      const val = item[dataKey as keyof Isometric3DDonutItem] ?? item.value ?? 0;
      return acc + (typeof val === 'number' ? val : 0);
    }, 0);
  }, [data, dataKey]);

  // Compute 3D Slices with Math Angles & Coordinates
  const computedSlices = useMemo(() => {
    if (!data || data.length === 0) return [];

    let currentAngle = -0.5 * Math.PI; // 12 o'clock start

    return data.map((item, index) => {
      const rawVal = item[dataKey as keyof Isometric3DDonutItem] ?? item.value ?? 0;
      const numVal = typeof rawVal === 'number' && rawVal > 0 ? rawVal : 0;
      const fraction = totalValue > 0 ? numVal / totalValue : 1 / data.length;
      const sweep = Math.max(0.015, fraction * 2 * Math.PI);

      const a0 = currentAngle;
      const a1 = a0 + sweep;
      const midAngle = (a0 + a1) / 2;
      currentAngle = a1;

      // Palette selection matching item color or cycle
      let palette = VIBRANT_PALETTES[index % VIBRANT_PALETTES.length];
      const colorLower = (item.color || item.fill || '').toLowerCase();
      if (colorLower.includes('059669') || colorLower.includes('emerald') || colorLower.includes('green')) {
        palette = VIBRANT_PALETTES[0];
      } else if (colorLower.includes('d97706') || colorLower.includes('amber') || colorLower.includes('orange')) {
        palette = VIBRANT_PALETTES[1];
      } else if (colorLower.includes('2563eb') || colorLower.includes('blue')) {
        palette = VIBRANT_PALETTES[2];
      }

      // 3D coordinates for the slice
      const P0 = { x: cx + Rx * Math.cos(a0), y: cy + Ry * Math.sin(a0) };
      const P1 = { x: cx + Rx * Math.cos(a1), y: cy + Ry * Math.sin(a1) };
      const p0 = { x: cx + rx * Math.cos(a0), y: cy + ry * Math.sin(a0) };
      const p1 = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) };

      const largeArc = sweep > Math.PI ? 1 : 0;

      // Top Face Path (Pristine Elliptical Annulus)
      const topFacePath = `M ${p0.x} ${p0.y} L ${P0.x} ${P0.y} A ${Rx} ${Ry} 0 ${largeArc} 1 ${P1.x} ${P1.y} L ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 0 ${p0.x} ${p0.y} Z`;

      // Outer Cylinder Wall Path
      const outerWallPath = `M ${P0.x} ${P0.y} A ${Rx} ${Ry} 0 ${largeArc} 1 ${P1.x} ${P1.y} L ${P1.x} ${P1.y + H} A ${Rx} ${Ry} 0 ${largeArc} 0 ${P0.x} ${P0.y + H} Z`;

      // Inner Cylinder Wall Path (Donut Core Hole)
      const innerWallPath = `M ${p0.x} ${p0.y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1.x} ${p1.y} L ${p1.x} ${p1.y + H} A ${rx} ${ry} 0 ${largeArc} 0 ${p0.x} ${p0.y + H} Z`;

      // Start Cut Face (Radial Cut at a0)
      const startCutPoints = `${P0.x},${P0.y} ${p0.x},${p0.y} ${p0.x},${p0.y + H} ${P0.x},${P0.y + H}`;

      // End Cut Face (Radial Cut at a1)
      const endCutPoints = `${p1.x},${p1.y} ${P1.x},${P1.y} ${P1.x},${P1.y + H} ${p1.x},${p1.y + H}`;

      // Floor Shadow Path (projected on ground at cy + H + 12)
      const floorShadowPath = `M ${p0.x} ${p0.y + H + 10} L ${P0.x} ${P0.y + H + 10} A ${Rx} ${Ry} 0 ${largeArc} 1 ${P1.x} ${P1.y + H + 10} L ${p1.x} ${p1.y + H + 10} A ${rx} ${ry} 0 ${largeArc} 0 ${p0.x} ${p0.y + H + 10} Z`;

      // Outer Midpoint for Callout Line Anchor
      const midCos = Math.cos(midAngle);
      const midSin = Math.sin(midAngle);
      const rawAnchorX = cx + (Rx + 2) * midCos;
      const rawAnchorY = cy + (Ry + 2) * midSin;

      // Painter's Algorithm Depth Sort Key (back slices render first, front slices render last)
      const depthOrder = midSin;

      // Icon for category
      const IconComp = getApbdesCategoryIcon(item.name || item.fullName || '');

      const calcPercent = item.percent !== undefined
        ? item.percent
        : Math.round(fraction * 100);

      return {
        item,
        index,
        numVal,
        calcPercent,
        palette,
        IconComp,
        midAngle,
        midCos,
        midSin,
        depthOrder,
        topFacePath,
        outerWallPath,
        innerWallPath,
        startCutPoints,
        endCutPoints,
        floorShadowPath,
        rawAnchorX,
        rawAnchorY
      };
    });
  }, [data, dataKey, totalValue]);

  // Compute Non-Overlapping Callout Anchors (Left & Right Column Relaxation)
  const calloutLayout = useMemo(() => {
    if (!computedSlices.length) return [];

    const rightIndices: number[] = [];
    const leftIndices: number[] = [];

    computedSlices.forEach((s, idx) => {
      if (s.midCos >= 0) {
        rightIndices.push(idx);
      } else {
        leftIndices.push(idx);
      }
    });

    rightIndices.sort((a, b) => computedSlices[a].rawAnchorY - computedSlices[b].rawAnchorY);
    leftIndices.sort((a, b) => computedSlices[a].rawAnchorY - computedSlices[b].rawAnchorY);

    const targetYMap = new Map<number, number>();

    const relaxSide = (indices: number[]) => {
      const count = indices.length;
      if (count === 0) return;
      const gap = Math.min(38, Math.max(28, 160 / Math.max(1, count)));
      const totalH = (count - 1) * gap;
      const startY = Math.max(34, Math.min(cy - totalH / 2, 230 - totalH));
      indices.forEach((sliceIdx, i) => {
        targetYMap.set(sliceIdx, Math.round(startY + i * gap));
      });
    };

    relaxSide(rightIndices);
    relaxSide(leftIndices);

    return computedSlices.map((slice) => {
      const isRight = slice.midCos >= 0;
      const targetY = targetYMap.get(slice.index) || slice.rawAnchorY;
      const targetX = isRight ? 435 : 85;
      return {
        sliceIndex: slice.index,
        isRight,
        targetX,
        targetY
      };
    });
  }, [computedSlices, cy]);

  // Active slice details for interactive HUD
  const activeSlice = activeIndex !== null && activeIndex >= 0 && activeIndex < computedSlices.length
    ? computedSlices[activeIndex]
    : null;

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 1. MAIN PURE-SVG 3D ISOMETRIC EXPLODED CANVAS */}
      <div
        className="relative w-full overflow-visible flex items-center justify-center"
        style={{ minHeight: height || 210 }}
      >
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto max-h-[290px] overflow-visible"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(15, 23, 42, 0.08))' }}
          role="img"
          aria-label="3D Isometric Exploded Donut Infographic"
        >
          {/* A. Global Soft Ambient Floor Drop Shadow */}
          <ellipse
            cx={cx}
            cy={cy + H + 20}
            rx={Rx + 24}
            ry={Ry * 0.76}
            fill="url(#ambientFloorShadow)"
            className="pointer-events-none"
          />

          {/* B. Center Hole 3D Elevated Podium */}
          <g className="center-podium pointer-events-none">
            {/* Podium Base Shadow */}
            <ellipse
              cx={cx}
              cy={cy + 10}
              rx={32}
              ry={17}
              fill="rgba(15, 23, 42, 0.16)"
              filter="url(#cuboidShadowBlur)"
            />
            {/* Podium Side Wall */}
            <path
              d={`M ${cx - 30} ${cy} A 30 16 0 0 0 ${cx + 30} ${cy} L ${cx + 30} ${cy + 8} A 30 16 0 0 1 ${cx - 30} ${cy + 8} Z`}
              fill="url(#centerHubSide)"
            />
            {/* Podium Top Disk */}
            <ellipse
              cx={cx}
              cy={cy}
              rx={30}
              ry={16}
              fill="url(#centerHubTop)"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
            {/* Center Podium Text (Reactive to Active Hover) */}
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              className="text-[8px] font-black uppercase tracking-widest fill-slate-400"
            >
              {activeSlice ? 'PORSI' : centerLabel}
            </text>
            <text
              x={cx}
              y={cy + 9}
              textAnchor="middle"
              className="text-[12px] font-black fill-slate-900"
            >
              {activeSlice ? `${activeSlice.calcPercent}%` : centerValue}
            </text>
          </g>

          {/* C. 3D Exploded Slices Layer (Sorted by Painter's Depth Algorithm) */}
          {[...computedSlices]
            .sort((a, b) => a.depthOrder - b.depthOrder)
            .map((slice) => {
              const isHovered = activeIndex === slice.index;
              // Base exploded gap (6px) + Active exploded displacement (22px)
              const baseDist = 6;
              const explodeDist = isHovered ? 22 : baseDist;
              const dx = slice.midCos * explodeDist;
              const dy = slice.midSin * explodeDist * (Ry / Rx) + (isHovered ? -6 : 0);

              return (
                <g
                  key={`slice-${slice.index}`}
                  className="cursor-pointer transition-transform duration-300 ease-out focus:outline-none"
                  style={{
                    transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`,
                    transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  onMouseEnter={() => handleMouseEnter(slice.index)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleSliceClick(slice.index)}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    handleSliceClick(slice.index);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.item.name}: ${slice.calcPercent}%`}
                >
                  {/* C1. Individual Exploded Slice Floor Shadow */}
                  <path
                    d={slice.floorShadowPath}
                    fill="rgba(15, 23, 42, 0.22)"
                    filter="url(#floorShadowBlur)"
                    className={isHovered ? 'opacity-90' : 'opacity-65'}
                    style={{
                      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: `${cx}px ${cy + H + 10}px`,
                      transition: 'all 0.35s ease'
                    }}
                  />

                  {/* C2. 3D Inner Hole Vertical Mantle */}
                  <path
                    d={slice.innerWallPath}
                    fill={slice.palette.dark}
                    opacity={0.85}
                  />

                  {/* C3. 3D Start Radial Cut Wall */}
                  <polygon
                    points={slice.startCutPoints}
                    fill={slice.palette.sideGrad}
                    stroke={slice.palette.deep}
                    strokeWidth={0.5}
                  />

                  {/* C4. 3D End Radial Cut Wall */}
                  <polygon
                    points={slice.endCutPoints}
                    fill={slice.palette.sideGrad}
                    stroke={slice.palette.deep}
                    strokeWidth={0.5}
                  />

                  {/* C5. 3D Outer Curved Cylinder Mantle */}
                  <path
                    d={slice.outerWallPath}
                    fill={slice.palette.sideGrad}
                    stroke={slice.palette.deep}
                    strokeWidth={0.5}
                  />

                  {/* C6. 3D Illuminated Top Annulus Face (Jewel Finish) */}
                  <path
                    d={slice.topFacePath}
                    fill={slice.palette.topGrad}
                    stroke="rgba(255, 255, 255, 0.85)"
                    strokeWidth={isHovered ? 2 : 1.2}
                    filter={isHovered ? 'url(#activeSliceGlow)' : undefined}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* C7. Specular Top Rim Highlight */}
                  <path
                    d={slice.topFacePath}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth={0.75}
                    className="pointer-events-none"
                  />
                </g>
              );
            })}

          {/* D. Interactive Callout Pointer Lines & Vector Badges */}
          {showCalloutLines &&
            computedSlices.map((slice) => {
              const layout = calloutLayout.find((c) => c.sliceIndex === slice.index);
              if (!layout) return null;

              const isHovered = activeIndex === slice.index;
              const isRight = layout.isRight;

              // Current slice displacement
              const baseDist = 6;
              const explodeDist = isHovered ? 22 : baseDist;
              const dx = slice.midCos * explodeDist;
              const dy = slice.midSin * explodeDist * (Ry / Rx) + (isHovered ? -6 : 0);

              const originX = slice.rawAnchorX + dx;
              const originY = slice.rawAnchorY + dy;

              // Knee point
              const kneeX = originX + (isRight ? 24 : -24);
              const kneeY = originY + (slice.midSin > 0 ? 8 : -8);
              const endX = layout.targetX;
              const endY = layout.targetY;

              const badgeWidth = 78;
              const badgeHeight = 22;
              const rectX = isRight ? endX : endX - badgeWidth;
              const rectY = endY - badgeHeight / 2;

              return (
                <g
                  key={`callout-${slice.index}`}
                  className="callout-group cursor-pointer transition-all duration-300"
                  onMouseEnter={() => handleMouseEnter(slice.index)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleSliceClick(slice.index)}
                >
                  {/* D1. Origin Anchor Dot on 3D Slice */}
                  <circle
                    cx={originX}
                    cy={originY}
                    r={isHovered ? 4.5 : 2.5}
                    fill="#ffffff"
                    stroke={slice.palette.accent}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    filter={isHovered ? 'url(#calloutLineGlow)' : undefined}
                    style={{ transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                  />

                  {/* D2. Callout Elbow Pointer Line */}
                  <path
                    d={`M ${originX} ${originY} L ${kneeX} ${kneeY} L ${endX} ${endY}`}
                    fill="none"
                    stroke={slice.palette.accent}
                    strokeWidth={isHovered ? 2.2 : 1.2}
                    strokeDasharray={isHovered ? 'none' : '3 3'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isHovered ? 1 : 0.75}
                    filter={isHovered ? 'url(#calloutLineGlow)' : undefined}
                    style={{ transition: 'all 0.3s ease' }}
                  />

                  {/* D3. Vector Callout Badge Pill */}
                  <g
                    transform={`translate(${rectX}, ${rectY})`}
                    filter="url(#calloutPillShadow)"
                    className={isHovered ? 'scale-105' : 'scale-100'}
                    style={{
                      transformOrigin: `${badgeWidth / 2}px ${badgeHeight / 2}px`,
                      transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                  >
                    {/* Pill Background */}
                    <rect
                      x={0}
                      y={0}
                      width={badgeWidth}
                      height={badgeHeight}
                      rx={11}
                      fill={isHovered ? slice.palette.bgLight : '#ffffff'}
                      stroke={isHovered ? slice.palette.accent : '#e2e8f0'}
                      strokeWidth={isHovered ? 1.8 : 1}
                    />
                    {/* Left Accent Dot / Badge */}
                    <circle
                      cx={11}
                      cy={badgeHeight / 2}
                      r={isHovered ? 5.5 : 4}
                      fill={slice.palette.accent}
                    />
                    {/* Percentage Text */}
                    <text
                      x={21}
                      y={badgeHeight / 2 + 3.5}
                      className="text-[10px] font-black"
                      fill={slice.palette.textColor}
                    >
                      {slice.calcPercent}%
                    </text>
                    {/* Name Pill Short */}
                    <text
                      x={badgeWidth - 7}
                      y={badgeHeight / 2 + 3.5}
                      textAnchor="end"
                      className="text-[8.5px] font-bold fill-slate-600"
                    >
                      {(slice.item.name || '').length > 7
                        ? (slice.item.name || '').slice(0, 6) + '…'
                        : slice.item.name}
                    </text>
                  </g>
                </g>
              );
            })}
        </svg>
      </div>

      {/* 2. DYNAMIC 3D HUD DETAIL CARD (Active Sector Popover) */}
      {activeSlice && (
        <div className="w-full mt-2 mb-1 p-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                style={{ backgroundColor: activeSlice.palette.accent }}
              >
                <activeSlice.IconComp className="w-4 h-4 text-white" />
              </div>
              <div className="truncate">
                <div className="text-[11px] font-black truncate text-slate-100">
                  {activeSlice.item.fullName || activeSlice.item.name}
                </div>
                <div className="text-[9px] text-slate-300 flex items-center gap-2">
                  <span>Porsi APBDes: <strong>{activeSlice.calcPercent}%</strong></span>
                  {activeSlice.item.pagu !== undefined && (
                    <span>• Target: <strong>{formatRupiahShort(activeSlice.item.pagu)}</strong></span>
                  )}
                </div>
              </div>
            </div>
            {activeSlice.item.realisasi !== undefined && (
              <div className="text-right shrink-0">
                <div className="text-[8.5px] uppercase tracking-wider text-slate-400 font-bold">Realisasi Kas</div>
                <div className="text-xs font-black text-emerald-400">
                  {formatRupiahShort(activeSlice.item.realisasi)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. INTERACTIVE EXPLODED 3D LEGEND CARDS (Synchronized Touch & Hover) */}
      {showInteractiveLegend && (
        <div className="w-full grid grid-cols-2 gap-1.5 mt-2 text-[10px]">
          {computedSlices.map((slice) => {
            const isHovered = activeIndex === slice.index;
            const Icon = slice.IconComp;

            return (
              <button
                key={`legend-${slice.index}`}
                type="button"
                onClick={() => handleSliceClick(slice.index)}
                onMouseEnter={() => handleMouseEnter(slice.index)}
                onMouseLeave={handleMouseLeave}
                className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between gap-1.5 ${
                  isHovered
                    ? 'bg-white shadow-md ring-2 scale-[1.02]'
                    : 'bg-white/80 hover:bg-white border-slate-200 shadow-2xs'
                }`}
                style={{
                  borderColor: isHovered ? slice.palette.accent : undefined,
                  outline: 'none'
                }}
              >
                <div className="flex items-center space-x-2 truncate">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: slice.palette.accent }}
                  >
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-bold text-slate-800 truncate text-[10px]">
                    {slice.item.name}
                  </span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-black"
                    style={{
                      backgroundColor: slice.palette.bgLight,
                      color: slice.palette.textColor
                    }}
                  >
                    {slice.calcPercent}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
/**
 * Designed for Village Transparency (Baliho & Public Portal)
 * 
 * Features:
 * 1. Side-by-Side 3D Cuboids: Contrasting Pastel Pagu (Target) vs Vibrant Luminous Realisasi (Kas Riil).
 * 2. Direct Readability: Rupiah values & % Capaian badges displayed boldly and directly above the bars without guesswork.
 * 3. Axonometric 3D Projection: Clean 28° elevation angle with top-light reflection & side-wall ambient shadow.
 * 4. Subtle & Tactile Touch Response: Gentle translateY(-4px) with soft elevation shadow.
 * 5. High-DPI Vector Sharpness: Pure SVG, 100% print-ready for 3x2m banners.
 */
export interface IsometricPrismBarItem {
  name: string;
  fullName?: string;
  pagu: number;
  realisasi: number;
  percent?: number;
  color?: string;
}

export interface Isometric3DPrismBarChartProps {
  data: IsometricPrismBarItem[];
  theme?: 'emerald' | 'amber' | 'blue' | 'auto';
  height?: number;
  showHudCard?: boolean;
}

export const Isometric3DPrismBarChart = memo<Isometric3DPrismBarChartProps>(({
  data,
  theme = 'auto',
  height = 245,
  showHudCard = true
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Fallback if data is empty
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400 text-xs">
        Data grafik tidak tersedia
      </div>
    );
  }

  // Maximum budget for proportional height scaling
  const maxBudget = useMemo(() => {
    return Math.max(...data.map((d) => Math.max(d.pagu || 0, d.realisasi || 0, 1)));
  }, [data]);

  // Coordinate setup for clean responsive SVG
  const svgWidth = 560;
  const svgHeight = 250;
  const yBase = 182; // Floor baseline
  const maxBarHeight = 114; // Max bar elevation, leaving safe room for top labels & badges

  const count = data.length;
  // Dynamic horizontal margins and column widths
  const padX = count <= 3 ? 38 : 18;
  const availW = svgWidth - 2 * padX;
  const colStep = availW / count;

  // Sizing of twin 3D bars based on item count
  const isCompact = count > 3;
  const barW = isCompact
    ? Math.min(20, Math.max(15, Math.round(colStep * 0.2)))
    : Math.min(32, Math.max(24, Math.round(colStep * 0.22)));
  const barGap = isCompact ? 4 : 7;
  const pairW = 2 * barW + barGap;

  // Gentle 3D Axonometric Angle (clean, luxurious, not too steep)
  const depthX = Math.round(barW * 0.32); // 5-10px right offset
  const depthY = Math.round(barW * 0.22); // 4-7px up offset

  // Active item resolution
  const activeItem = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="w-full flex flex-col items-center select-none">
      <IsometricSvgDefs />

      <div className="w-full overflow-visible relative" style={{ minHeight: height }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
          style={{ maxHeight: height }}
        >
          {/* Subtle Ground Horizon Grid */}
          <line
            x1={12}
            y1={yBase}
            x2={svgWidth - 12}
            y2={yBase}
            stroke="#cbd5e1"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Render 3D Prism Columns */}
          {data.map((item, i) => {
            const isHovered = activeIndex === i;
            const cx = Math.round(padX + (i + 0.5) * colStep);

            const targetVal = item.pagu || 0;
            const realVal = item.realisasi || 0;
            const calcPercent =
              targetVal > 0 ? Math.round((realVal / targetVal) * 100) : (item.percent || 0);

            // Proportional heights
            const paguRatio = maxBudget > 0 ? Math.max(0.12, targetVal / maxBudget) : 0.2;
            const paguH = Math.max(22, Math.round(paguRatio * maxBarHeight));
            const paguY = yBase - paguH;

            const realRatio = maxBudget > 0 ? Math.max(0.1, realVal / maxBudget) : 0.18;
            const realH = Math.max(20, Math.round(realRatio * maxBarHeight));
            const realY = yBase - realH;

            // Coordinates for twin bars
            const xPagu = Math.round(cx - (pairW + depthX) / 2);
            const xReal = xPagu + barW + barGap;

            // Theme palette configuration
            let palette = {
              accent: '#059669',
              paguFront: 'url(#luxEmeraldPaguFront)',
              paguTop: '#d1fae5',
              paguSide: '#34d399',
              paguStroke: '#059669',
              paguText: '#047857',
              realFront: 'url(#luxEmeraldRealFront)',
              realTop: '#6ee7b7',
              realSide: '#047857',
              realStroke: '#064e3b',
              realBadge: '#059669',
              realText: '#064e3b',
              bgLight: '#ecfdf5'
            };

            const effectiveTheme =
              theme === 'auto'
                ? item.color?.includes('#d97706') || item.color?.includes('amber') || (i === 1 && count === 3)
                  ? 'amber'
                  : item.color?.includes('#2563eb') || item.color?.includes('blue') || (i === 2 && count === 3)
                  ? 'blue'
                  : (i === 0 && count === 3)
                  ? 'emerald'
                  : VIBRANT_PALETTES[i % VIBRANT_PALETTES.length].name
                : theme;

            if (effectiveTheme === 'amber') {
              palette = {
                accent: '#d97706',
                paguFront: 'url(#luxAmberPaguFront)',
                paguTop: '#fef3c7',
                paguSide: '#fbbf24',
                paguStroke: '#d97706',
                paguText: '#b45309',
                realFront: 'url(#luxAmberRealFront)',
                realTop: '#fde68a',
                realSide: '#b45309',
                realStroke: '#78350f',
                realBadge: '#d97706',
                realText: '#78350f',
                bgLight: '#fffbeb'
              };
            } else if (effectiveTheme === 'blue') {
              palette = {
                accent: '#2563eb',
                paguFront: 'url(#luxBluePaguFront)',
                paguTop: '#dbeafe',
                paguSide: '#60a5fa',
                paguStroke: '#2563eb',
                paguText: '#1d4ed8',
                realFront: 'url(#luxBlueRealFront)',
                realTop: '#93c5fd',
                realSide: '#1d4ed8',
                realStroke: '#172554',
                realBadge: '#2563eb',
                realText: '#1e3a8a',
                bgLight: '#eff6ff'
              };
            } else if (effectiveTheme === 'rose' || effectiveTheme === 'coral') {
              palette = {
                accent: '#e11d48',
                paguFront: 'url(#luxRosePaguFront)',
                paguTop: '#ffe4e6',
                paguSide: '#fda4af',
                paguStroke: '#e11d48',
                paguText: '#be123c',
                realFront: 'url(#luxRoseRealFront)',
                realTop: '#fda4af',
                realSide: '#be123c',
                realStroke: '#4c0519',
                realBadge: '#e11d48',
                realText: '#4c0519',
                bgLight: '#fff1f2'
              };
            } else if (effectiveTheme === 'violet') {
              palette = {
                accent: '#7c3aed',
                paguFront: 'url(#luxPurplePaguFront)',
                paguTop: '#ede9fe',
                paguSide: '#c4b5fd',
                paguStroke: '#7c3aed',
                paguText: '#6d28d9',
                realFront: 'url(#luxPurpleRealFront)',
                realTop: '#c4b5fd',
                realSide: '#5b21b6',
                realStroke: '#2e1065',
                realBadge: '#7c3aed',
                realText: '#2e1065',
                bgLight: '#f5f3ff'
              };
            } else if (effectiveTheme === 'teal') {
              palette = {
                accent: '#0d9488',
                paguFront: 'url(#luxTealPaguFront)',
                paguTop: '#ccfbf1',
                paguSide: '#5eead4',
                paguStroke: '#0d9488',
                paguText: '#0f766e',
                realFront: 'url(#luxTealRealFront)',
                realTop: '#5eead4',
                realSide: '#0f766e',
                realStroke: '#134e4a',
                realBadge: '#0d9488',
                realText: '#134e4a',
                bgLight: '#f0fdfa'
              };
            }

            const IconComp = getApbdesCategoryIcon(item.name || item.fullName || '') as React.ComponentType<{
              size?: number;
              color?: string;
              strokeWidth?: number;
              className?: string;
            }>;

            return (
              <g
                key={`prism-group-${i}`}
                className="cursor-pointer group"
                style={{
                  transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: isHovered ? 'url(#luxSoftLift)' : undefined
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(activeIndex === i ? null : i)}
              >
                {/* 1. FLOOR BASE PEDESTAL & AMBIENT SHADOW */}
                <ellipse
                  cx={cx}
                  cy={yBase + 5}
                  rx={pairW / 2 + depthX + 5}
                  ry={3.5}
                  fill="rgba(15, 23, 42, 0.12)"
                  filter="url(#luxBaseGlow)"
                />
                <rect
                  x={xPagu - 2}
                  y={yBase}
                  width={pairW + depthX + 4}
                  height={4}
                  rx={1.5}
                  fill="#e2e8f0"
                  stroke="#cbd5e1"
                  strokeWidth={0.6}
                />

                {/* 2. LEFT 3D PRISM: PAGU ANGGARAN (TARGET) */}
                <g className="prism-pagu">
                  {/* Front Face */}
                  <rect
                    x={xPagu}
                    y={paguY}
                    width={barW}
                    height={paguH}
                    rx={1}
                    fill={palette.paguFront}
                    stroke={palette.paguStroke}
                    strokeWidth={0.7}
                  />
                  {/* Top Cap */}
                  <polygon
                    points={`${xPagu},${paguY} ${xPagu + depthX},${paguY - depthY} ${xPagu + barW + depthX},${paguY - depthY} ${xPagu + barW},${paguY}`}
                    fill={palette.paguTop}
                    stroke={palette.paguStroke}
                    strokeWidth={0.7}
                  />
                  {/* Right Side Wall */}
                  <polygon
                    points={`${xPagu + barW},${paguY} ${xPagu + barW + depthX},${paguY - depthY} ${xPagu + barW + depthX},${paguY + paguH - depthY} ${xPagu + barW},${paguY + paguH}`}
                    fill={palette.paguSide}
                    stroke={palette.paguStroke}
                    strokeWidth={0.7}
                  />
                  {/* Subtle "PAGU" Watermark on Bar Body */}
                  {paguH >= 34 && (
                    <text
                      x={xPagu + barW / 2}
                      y={paguY + 13}
                      textAnchor="middle"
                      className="text-[7.5px] font-black fill-slate-500/80 tracking-wider pointer-events-none select-none uppercase"
                    >
                      PAGU
                    </text>
                  )}
                  {/* Direct Rupiah Value Above Pagu Bar */}
                  <text
                    x={xPagu + barW / 2 + depthX / 2}
                    y={paguY - depthY - 5}
                    textAnchor="middle"
                    className="text-[8.5px] font-mono font-bold fill-slate-700 select-none pointer-events-none"
                  >
                    {formatRupiahShort(targetVal)}
                  </text>
                </g>

                {/* 3. RIGHT 3D PRISM: REALISASI KAS (UANG TERPAKAI) */}
                <g className="prism-realisasi">
                  {/* Front Face */}
                  <rect
                    x={xReal}
                    y={realY}
                    width={barW}
                    height={realH}
                    rx={1}
                    fill={palette.realFront}
                    stroke={palette.realStroke}
                    strokeWidth={0.8}
                  />
                  {/* Specular Ridge Line */}
                  <line
                    x1={xReal + 1.5}
                    y1={realY + 2}
                    x2={xReal + 1.5}
                    y2={yBase - 2}
                    stroke="rgba(255, 255, 255, 0.45)"
                    strokeWidth={0.9}
                    strokeLinecap="round"
                  />
                  {/* Top Cap */}
                  <polygon
                    points={`${xReal},${realY} ${xReal + depthX},${realY - depthY} ${xReal + barW + depthX},${realY - depthY} ${xReal + barW},${realY}`}
                    fill={palette.realTop}
                    stroke={palette.realStroke}
                    strokeWidth={0.8}
                  />
                  {/* Right Side Wall */}
                  <polygon
                    points={`${xReal + barW},${realY} ${xReal + barW + depthX},${realY - depthY} ${xReal + barW + depthX},${realY + realH - depthY} ${xReal + barW},${realY + realH}`}
                    fill={palette.realSide}
                    stroke={palette.realStroke}
                    strokeWidth={0.8}
                  />
                  {/* Corner Edge Line */}
                  <line
                    x1={xReal + barW}
                    y1={realY}
                    x2={xReal + barW}
                    y2={realY + realH}
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth={0.7}
                  />
                  {/* Subtle "REAL" Watermark on Bar Body */}
                  {realH >= 34 && (
                    <text
                      x={xReal + barW / 2}
                      y={realY + 13}
                      textAnchor="middle"
                      className="text-[7.5px] font-black fill-white/80 tracking-wider pointer-events-none select-none uppercase"
                    >
                      REAL
                    </text>
                  )}
                  {/* Direct Rupiah Value Above Realisasi Bar */}
                  <text
                    x={xReal + barW / 2 + depthX / 2}
                    y={realY - depthY - 5}
                    textAnchor="middle"
                    className="text-[9px] font-mono font-black fill-slate-900 select-none pointer-events-none"
                  >
                    {formatRupiahShort(realVal)}
                  </text>
                  {/* Direct % Capaian Badge Above Realisasi Bar */}
                  <g transform={`translate(${xReal + barW / 2 + depthX / 2 - 16}, ${realY - depthY - 23})`}>
                    <rect
                      width={32}
                      height={15}
                      rx={7.5}
                      fill={palette.realBadge}
                      stroke="#ffffff"
                      strokeWidth={1.2}
                      filter="url(#luxPillShadow)"
                    />
                    <text
                      x={16}
                      y={10.5}
                      textAnchor="middle"
                      className="text-[8.5px] font-black fill-white select-none pointer-events-none"
                    >
                      {calcPercent}%
                    </text>
                  </g>
                </g>

                {/* 4. CATEGORY ICON & LABELS UNDER BASELINE */}
                <circle
                  cx={cx}
                  cy={yBase + 16}
                  r={8.5}
                  fill={isHovered ? palette.accent : '#f1f5f9'}
                  stroke={isHovered ? palette.accent : '#cbd5e1'}
                  strokeWidth={1}
                  className="transition-colors duration-200"
                />
                <g transform={`translate(${cx - 5.5}, ${yBase + 10.5})`} className="pointer-events-none">
                  <IconComp size={11} color={isHovered ? '#ffffff' : palette.accent} strokeWidth={2.4} />
                </g>

                <text
                  x={cx}
                  y={yBase + 33}
                  textAnchor="middle"
                  className="text-[9.5px] font-black fill-slate-800 select-none"
                >
                  {item.name}
                </text>
                <text
                  x={cx}
                  y={yBase + 45}
                  textAnchor="middle"
                  className="text-[8px] font-mono font-bold select-none"
                  fill={palette.realText}
                >
                  Capaian: {calcPercent}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 5. GLASSMORPHISM HUD CARD (Rincian Target vs Realisasi) */}
      {showHudCard && (
        <div className="w-full mt-2.5 p-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg border border-slate-700 animate-in fade-in duration-200 no-print print:hidden">
          {activeItem ? (
            (() => {
              const activeTarget = activeItem.pagu || 0;
              const activeReal = activeItem.realisasi || 0;
              const activePercent =
                activeTarget > 0 ? Math.round((activeReal / activeTarget) * 100) : 0;
              const sisa = Math.max(0, activeTarget - activeReal);
              const ActiveIcon = getApbdesCategoryIcon(activeItem.name || activeItem.fullName || '');

              return (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                      <ActiveIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="truncate">
                      <div className="text-[11px] font-black text-slate-100 truncate">
                        {activeItem.fullName || activeItem.name}
                      </div>
                      <div className="text-[9px] text-slate-300 flex items-center gap-2">
                        <span>Pagu Target: <strong>{formatRupiahShort(activeTarget)}</strong></span>
                        <span>• Sisa: <strong>{formatRupiahShort(sisa)}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                      Realisasi Kas
                    </div>
                    <div className="text-xs font-black text-emerald-400 flex items-center justify-end gap-1.5">
                      <span>{formatRupiahShort(activeReal)}</span>
                      <span className="text-[9px] font-extrabold bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700">
                        {activePercent}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex items-center justify-between text-[10px] text-slate-300 px-1">
              <div className="flex items-center space-x-1.5">
                <BadgeCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Sentuh atau klik balok 3D untuk melihat detail perbandingan Pagu & Realisasi</span>
              </div>
              <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-400 shrink-0">
                <span>{data.length} Kategori</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. CLEAN & LUXURIOUS 3D PRISM LEGEND BAR */}
      <div className="w-full mt-2.5 py-1.5 px-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[10px] sm:text-[10.5px] font-bold text-slate-700 shadow-2xs no-print print:hidden">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-2.5 rounded-xs bg-[#a7f3d0] border border-[#059669] inline-block shadow-2xs" />
          <span>Balok Kiri: Pagu Anggaran (Target)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-2.5 rounded-xs bg-[#059669] inline-block shadow-2xs" />
          <span>Balok Kanan: Realisasi Kas (Terpakai)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[8px] font-black shadow-2xs">
            %
          </span>
          <span>Badge Capaian (%)</span>
        </div>
      </div>
    </div>
  );
});

// Seamless Alias for backwards-compatibility across components
export const Isometric3DCapsuleBarChart = Isometric3DPrismBarChart;
export type IsometricCapsuleBarItem = IsometricPrismBarItem;
export type Isometric3DCapsuleBarChartProps = Isometric3DPrismBarChartProps;

