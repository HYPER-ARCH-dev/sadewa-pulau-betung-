import React from 'react';
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from 'motion/react';

interface ScrollProgressIndicatorProps {
  className?: string;
}

export const ScrollProgressIndicator: React.FC<ScrollProgressIndicatorProps> = ({
  className = '',
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 32,
    restDelta: 0.001,
  });

  // Stay unobtrusive when at the very top of the page; fade in smoothly on scroll
  const opacity = useTransform(scrollY, [0, 24], [0, 1]);

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity }}
      className={`fixed top-0 left-0 right-0 z-[75] h-[3px] pointer-events-none print-hidden bg-slate-900/5 dark:bg-white/5 ${className}`}
    >
      <motion.div
        style={{
          scaleX: prefersReducedMotion ? scrollYProgress : smoothProgress,
          transformOrigin: '0% 50%',
        }}
        className="h-full w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(16,185,129,0.45)]"
      />
    </motion.div>
  );
};
