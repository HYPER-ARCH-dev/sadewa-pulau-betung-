import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { toasts, removeToast, villageProfile } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[110] flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let style = 'bg-white border-emerald-500 text-slate-800';
        let iconColor = 'text-emerald-600';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          style = 'bg-white border-rose-500 text-slate-800';
          iconColor = 'text-rose-600';
        } else if (toast.type === 'warning') {
          Icon = AlertTriangle;
          style = 'bg-white border-amber-500 text-slate-800';
          iconColor = 'text-amber-600';
        } else if (toast.type === 'info') {
          Icon = Info;
          style = 'bg-white border-sky-500 text-slate-800';
          iconColor = 'text-sky-600';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border-l-4 ${style} border flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-2 duration-200`}
          >
            {villageProfile?.sadewaLogoUrl && toast.type === 'success' ? (
              <div className="w-8 h-8 shrink-0 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-1">
                <img src={villageProfile.sadewaLogoUrl} alt="Sadewa" className="w-full h-full object-contain" />
              </div>
            ) : (
              <Icon className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
            )}
            <div className="flex-1">
              <h5 className="text-xs font-bold text-slate-900">{toast.title}</h5>
              <p className="text-xs text-slate-600 mt-0.5 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
