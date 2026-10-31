import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { Lock, ShieldCheck, UserCheck, KeyRound, X, AlertCircle, Eye, EyeOff, BadgeCheck, Clock, ChevronDown, User as UserIcon, Building2, Globe } from 'lucide-react';
import { AttendanceSystem } from './AttendanceSystem';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithCredentials, villageProfile } = useApp();
  const [activeTab, setActiveTab] = useState<'login' | 'attendance'>('login');
  
  // Input fields state
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setErrorMsg('Harap masukkan Username atau Email Dinas Anda.');
      return;
    }
    if (!password) {
      setErrorMsg('Harap masukkan kata sandi dinas.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await loginWithCredentials(usernameOrEmail.trim(), password);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Autentikasi gagal. Periksa kembali username/email dan kata sandi Anda.');
      }
    } catch (err: any) {
      setErrorMsg('Koneksi ke server gagal. Harap coba beberapa saat lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* LUXURY SLIDING MODAL CONTAINER */}
      <div 
        className="relative w-full max-w-[750px] md:h-[600px] bg-white rounded-[30px] shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col md:flex-row"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-[60] text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-slate-100 transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT PANEL: LOGIN FORM */}
        <div className={`w-full md:w-1/2 h-full bg-white flex items-center justify-center p-8 transition-all duration-[1s] ease-in-out order-2 md:order-1 ${
          activeTab === 'attendance' ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
        }`}>
          <div className="w-full max-h-full overflow-y-auto no-scrollbar space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-4 mb-4 animate-in fade-in zoom-in duration-700">
                {villageProfile?.villageLogoUrl && (
                  <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="h-16 w-auto object-contain drop-shadow-md" />
                )}
                <div className="h-10 w-px bg-slate-200"></div>
                {villageProfile?.sadewaIconUrl || villageProfile?.sadewaLogoUrl ? (
                  <img 
                    src={villageProfile.sadewaIconUrl || villageProfile.sadewaLogoUrl} 
                    alt="SADEWA" 
                    className="h-16 w-auto object-contain drop-shadow-md" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="text-emerald-700 drop-shadow-sm">
                    <SadewaHouseLogo size={48} />
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Login Portal Admin</h2>
              <p className="text-xs text-slate-500 font-medium">Akses dashboard pengelolaan data desa terpadu.</p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-[11px] flex items-center space-x-2 animate-in shake-1">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleManualLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Username / Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={usernameOrEmail}
                    onChange={(e) => {
                      setUsernameOrEmail(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Masukkan Username / Email"
                    className="w-full text-xs pl-10 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold text-slate-900 bg-slate-50/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Kata Sandi</label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs pl-10 pr-10 py-3 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono text-slate-900 bg-slate-50/50"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    <span>MASUK KE DASHBOARD ADMIN</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT PANEL: ATTENDANCE SYSTEM */}
        <div className={`w-full md:w-1/2 h-full bg-white flex items-center justify-center p-8 transition-all duration-[1s] ease-in-out order-1 md:order-2 ${
          activeTab === 'login' ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
        }`}>
          <div className="w-full max-h-full overflow-y-auto no-scrollbar py-6">
            <div className="text-center mb-8 space-y-4">
              <div className="flex items-center justify-center gap-4 mb-4 animate-in fade-in zoom-in duration-700">
                {villageProfile?.villageLogoUrl && (
                  <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="h-16 w-auto object-contain drop-shadow-md" />
                )}
                <div className="h-10 w-px bg-slate-200"></div>
                {villageProfile?.sadewaIconUrl || villageProfile?.sadewaLogoUrl ? (
                  <img 
                    src={villageProfile.sadewaIconUrl || villageProfile.sadewaLogoUrl} 
                    alt="SADEWA" 
                    className="h-16 w-auto object-contain drop-shadow-md" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="text-emerald-700 drop-shadow-sm">
                    <SadewaHouseLogo size={48} />
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Absensi Perangkat</h2>
              <p className="text-xs text-slate-500 font-medium">Pencatatan kehadiran dinas perangkat desa.</p>
            </div>
            <AttendanceSystem onSuccess={() => {}} />
          </div>
        </div>

        {/* SLIDING ANIMATION OVERLAY (Green Panel) */}
        <div 
          className={`absolute top-0 w-full md:w-1/2 h-full bg-[#0f5933] z-50 transition-all duration-[0.8s] ease-in-out flex items-center justify-center text-white p-12 overflow-hidden hidden md:flex ${
            activeTab === 'attendance' ? 'left-0 rounded-r-[70px] md:rounded-r-[100px]' : 'left-1/2 rounded-l-[70px] md:rounded-l-[100px]'
          }`}
          style={{
            clipPath: activeTab === 'attendance' 
              ? 'polygon(0 0, 100% 0, 85% 100%, 0 100%)' 
              : 'polygon(15% 0, 100% 0, 100% 100%, 0 100%)'
          }}
        >
          {/* Animated Background Icons */}
          <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
            <div className="absolute -top-10 -right-10 rotate-12"><Building2 className="w-64 h-64" /></div>
            <div className="absolute -bottom-20 -left-20 -rotate-12"><ShieldCheck className="w-80 h-80" /></div>
          </div>

          <div className="relative z-10 text-center space-y-8 w-full max-w-sm px-4">
            {/* Main Logo Branding on Sliding Panel - Enhanced Spacing to avoid clip-path cropping */}
            <div className="flex flex-col items-center gap-6 mb-8 animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                {villageProfile?.villageLogoUrl && villageProfile.villageLogoUrl.length > 10 ? (
                  <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="h-20 md:h-24 w-auto object-contain drop-shadow-2xl" />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                    <Building2 className="w-10 h-10 text-amber-300" />
                  </div>
                )}
                <div className="h-12 md:h-16 w-px bg-white/20"></div>
                {villageProfile?.sadewaIconUrl || villageProfile?.sadewaLogoUrl ? (
                  <img 
                    src={villageProfile.sadewaIconUrl || villageProfile.sadewaLogoUrl} 
                    alt="SADEWA" 
                    className="h-16 md:h-20 w-auto object-contain drop-shadow-2xl brightness-0 invert" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <SadewaHouseLogo size={64} color="white" className="brightness-0 invert drop-shadow-lg" />
                )}
              </div>
              <div className="text-[10px] md:text-sm font-black uppercase tracking-[0.3em] text-emerald-100 drop-shadow-md text-center">
                PEMERINTAH {villageProfile?.villageName || 'DESA'}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'login' ? (
                <motion.div
                  key="to-attendance"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-4"
                >
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto border border-white/20 shadow-2xl">
                    <Clock className="w-10 h-10 text-amber-300" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Menu Absensi</h2>
                  <p className="text-sm text-emerald-100/80 leading-relaxed font-medium">Pindah ke halaman pencatatan kehadiran perangkat desa.</p>
                  <button 
                    onClick={() => setActiveTab('attendance')}
                    className="px-8 py-3 rounded-xl border-2 border-white text-white font-black text-sm hover:bg-white hover:text-[#0f5933] transition-all active:scale-95 shadow-xl"
                  >
                    Ke Menu Absensi
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="to-login"
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ duration: 0.6 }}
                  className="space-y-4"
                >
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto border border-white/20 shadow-2xl">
                    <ShieldCheck className="w-10 h-10 text-amber-300" />
                  </div>
                  <h2 className="text-3xl font-black tracking-tight">Portal Admin</h2>
                  <p className="text-sm text-emerald-100/80 leading-relaxed font-medium">Kembali ke halaman login utama untuk pengurus desa.</p>
                  <button 
                    onClick={() => setActiveTab('login')}
                    className="px-8 py-3 rounded-xl border-2 border-white text-white font-black text-sm hover:bg-white hover:text-[#0f5933] transition-all active:scale-95 shadow-xl"
                  >
                    Ke Halaman Login
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* MOBILE TOGGLE (Footer style for small screens) */}
        <div className="md:hidden bg-[#0f5933] p-8 text-white text-center rounded-t-[40px] mt-auto">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {villageProfile?.villageLogoUrl && (
              <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="h-12 w-auto object-contain brightness-0 invert" />
            )}
            <div className="h-6 w-px bg-white/20"></div>
            <SadewaHouseLogo size={32} color="white" className="brightness-0 invert opacity-90" />
          </div>

          {activeTab === 'login' ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-emerald-100">Ingin absen kehadiran?</p>
              <button 
                onClick={() => setActiveTab('attendance')}
                className="w-full py-3 rounded-xl bg-white text-[#0f5933] font-black text-xs shadow-lg"
              >
                KE MENU ABSENSI
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-emerald-100">Kembali ke login admin?</p>
              <button 
                onClick={() => setActiveTab('login')}
                className="w-full py-3 rounded-xl bg-white text-[#0f5933] font-black text-xs shadow-lg"
              >
                KE HALAMAN LOGIN
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

