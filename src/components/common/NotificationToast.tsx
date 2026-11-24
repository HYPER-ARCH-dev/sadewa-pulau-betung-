import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { toasts, removeToast, villageProfile } = useApp();

  return (
    <div
      className="toast-container fixed bottom-5 right-5 z-[110] flex flex-col space-y-2.5 max-w-sm w-[calc(100vw-2.5rem)] sm:w-full pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          let Icon = CheckCircle2;
          let style =
            'bg-white/95 dark:bg-slate-900/95 border-emerald-500 text-slate-800 dark:text-slate-100';
          let iconColor = 'text-emerald-600 dark:text-emerald-400';
          let iconBg = 'bg-emerald-50 dark:bg-emerald-950/60';

          if (toast.type === 'error') {
            Icon = AlertCircle;
            style =
              'bg-white/95 dark:bg-slate-900/95 border-rose-500 text-slate-800 dark:text-slate-100';
            iconColor = 'text-rose-600 dark:text-rose-400';
            iconBg = 'bg-rose-50 dark:bg-rose-950/60';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            style =
              'bg-white/95 dark:bg-slate-900/95 border-amber-500 text-slate-800 dark:text-slate-100';
            iconColor = 'text-amber-600 dark:text-amber-400';
            iconBg = 'bg-amber-50 dark:bg-amber-950/60';
          } else if (toast.type === 'info') {
            Icon = Info;
            style =
              'bg-white/95 dark:bg-slate-900/95 border-sky-500 text-slate-800 dark:text-slate-100';
            iconColor = 'text-sky-600 dark:text-sky-400';
            iconBg = 'bg-sky-50 dark:bg-sky-950/60';
          }

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.94 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-xl backdrop-blur-md border border-slate-200/80 dark:border-slate-800 border-l-4 ${style} flex items-start space-x-3`}
            >
              {villageProfile?.sadewaLogoUrl && toast.type === 'success' ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="w-8 h-8 shrink-0 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-center p-1"
                >
                  <img
                    src={villageProfile.sadewaLogoUrl}
                    alt="Sadewa"
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.75, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
                </motion.div>
              )}
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  {toast.title}
                </h5>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  {toast.message}
                </p>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => removeToast(toast.id)}
                aria-label="Tutup notifikasi"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
