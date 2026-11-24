import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 850,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState<number>(
    prefersReducedMotion ? safeTarget : 0
  );
  const previousValueRef = useRef<number>(prefersReducedMotion ? safeTarget : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      previousValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return;
    }

    const startValue = previousValueRef.current;
    if (startValue === safeTarget) {
      setDisplayValue(safeTarget);
      return;
    }

    let animationFrameId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out for crisp deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (safeTarget - startValue) * eased;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(tick);
      } else {
        previousValueRef.current = safeTarget;
        setDisplayValue(safeTarget);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      previousValueRef.current = safeTarget;
    };
  }, [safeTarget, duration, prefersReducedMotion]);

  const formatted =
    decimals > 0
      ? displayValue.toLocaleString('id-ID', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(displayValue).toLocaleString('id-ID');

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
