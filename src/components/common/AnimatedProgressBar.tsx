import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface AnimatedProgressBarProps {
  value: number;
  trackClassName?: string;
  barClassName?: string;
  barStyle?: React.CSSProperties;
  shimmer?: boolean;
  delay?: number;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  value,
  trackClassName = 'w-full h-2 bg-slate-100 rounded-full overflow-hidden',
  barClassName = 'h-full bg-emerald-600 rounded-full',
  barStyle,
  shimmer = true,
  delay = 0,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const ratio = clamped / 100;

  return (
    <div
      className={trackClassName}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: ratio }}
        viewport={{ once: true, amount: 0.15 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }
        }
        style={{
          transformOrigin: '0% 50%',
          ...barStyle,
        }}
        className={`relative overflow-hidden ${barClassName} ${
          shimmer && clamped > 0 ? 'sadewa-progress-sheen' : ''
        }`}
      />
    </div>
  );
};

interface AnimatedLoadingBarProps {
  className?: string;
  label?: string;
}

export const AnimatedLoadingBar: React.FC<AnimatedLoadingBarProps> = ({
  className = '',
  label,
}) => {
  return (
    <div className={`w-full space-y-1.5 ${className}`} role="status" aria-live="polite">
      {label && (
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <span>{label}</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Memproses</span>
          </span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 overflow-hidden relative">
        <div className="sadewa-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
      </div>
    </div>
  );
};
