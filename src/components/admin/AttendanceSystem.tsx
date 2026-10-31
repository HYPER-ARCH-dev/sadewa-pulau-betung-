import React, { useState, useEffect } from 'react';
import { VillageOfficial, AttendanceLog } from '../../types';
import { UserCheck, MapPin, Calendar, Clock, CheckCircle2, ChevronRight, User, Fingerprint, History, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';

interface AttendanceSystemProps {
  onSuccess?: (log: AttendanceLog) => void;
}

export const AttendanceSystem: React.FC<AttendanceSystemProps> = ({ onSuccess }) => {
  const { officials, addToast, villageProfile } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Input Code & Confirm, 2: Loading, 3: Success
  const [authCode, setAuthCode] = useState('');
  const [selectedOfficial, setSelectedOfficial] = useState<VillageOfficial | null>(null);
  const [type, setType] = useState<'masuk' | 'pulang'>('masuk');
  const [isLoading, setIsLoading] = useState(false);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastLog, setLastLog] = useState<AttendanceLog | null>(null);
  const [history, setHistory] = useState<AttendanceLog[]>([]);
  const [viewHistory, setViewHistory] = useState(false);

  // Filter only active officials
  const activeOfficials = officials.filter(o => o.isActive !== false);

  const getDeviceId = () => {
    let deviceId = localStorage.getItem('sadewa_attendance_device_id');
    if (!deviceId) {
      deviceId = 'dev-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('sadewa_attendance_device_id', deviceId);
    }
    return deviceId;
  };

  // --- OTENTIKASI & VALIDASI ABSENSI ---
  // Langkah 1: Mencari data perangkat desa secara otomatis berdasarkan Kode 6 Digit (Tanggal Lahir DDMMYY).
  useEffect(() => {
    if (authCode.length === 6) {
      const match = activeOfficials.find(off => {
        if (!off.birthDate) return false;
        // Konversi format YYYY-MM-DD menjadi DDMMYY untuk pengecekan kode
        const dateObj = new Date(off.birthDate);
        if (isNaN(dateObj.getTime())) return false;
        
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).substring(2);
        
        return `${dd}${mm}${yy}` === authCode;
      });

      if (match) {
        setSelectedOfficial(match);
      } else {
        setSelectedOfficial(null);
      }
    } else {
      setSelectedOfficial(null);
    }
  }, [authCode, activeOfficials]);

  // Langkah 2: Verifikasi GPS & Pengiriman Absensi ke Server.
  // Proteksi Anti-Fraud: Waktu absensi diambil dari jam server, bukan jam di HP user.
  const handleVerifyAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficial || authCode.length !== 6) return;
    
    if (!selfie) {
      addToast('warning', 'Foto Selfie Wajib', 'Silakan ambil foto selfie dunsanak terlebih dahulu.');
      return;
    }

    setIsLoading(true);

    try {
      // Ambil koordinat GPS perangkat untuk verifikasi Geofencing (Radius Kantor Desa)
      let location = undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      } catch (err) {
        console.warn('Geolocation failed or denied', err);
      }

      // Mengirim data absensi ke API Server-Side
      const response = await fetch('/api/public/attendance/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialId: selectedOfficial.id,
          birthDate: selectedOfficial.birthDate,
          type,
          location,
          deviceInfo: navigator.userAgent,
          deviceId: getDeviceId(), // Proteksi: Mencegah titip absen (1 perangkat untuk 1 orang per hari)
          selfieUrl: selfie
        })
      });

      const result = await response.json();

      if (result.success) {
        setLastLog(result.data);
        setStep(3);
        if (onSuccess) onSuccess(result.data);
        
        // Memuat riwayat absensi terbaru
        fetchHistory();
      } else {
        addToast('error', 'Verifikasi Gagal', result.error || 'Terjadi kesalahan');
      }
    } catch (err) {
      addToast('error', 'Kesalahan Sistem', 'Gagal menghubungi server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!selectedOfficial) return;
    try {
      const response = await fetch('/api/public/attendance/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officialId: selectedOfficial.id,
          birthDate: selectedOfficial.birthDate
        })
      });
      const result = await response.json();
      if (result.success) {
        setHistory(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfie(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedOfficial(null);
    setAuthCode('');
    setLastLog(null);
    setSelfie(null);
    setViewHistory(false);
  };

  if (step === 1) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* --- BAGIAN HEADER ABSENSI: Identitas Desa & SADEWA --- */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Desa (Dinamis dari Profile) */}
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-sm">
              {villageProfile?.villageLogoUrl ? (
                <img src={villageProfile.villageLogoUrl} alt="Logo Desa" className="w-full h-full object-contain" />
              ) : (
                <Fingerprint className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            
            {/* Logo Platform SADEWA (Platform Branding) */}
            {villageProfile?.sadewaIconUrl || villageProfile?.sadewaLogoUrl ? (
              <>
                <div className="h-6 w-px bg-slate-200"></div>
                <img 
                  src={villageProfile.sadewaIconUrl || villageProfile.sadewaLogoUrl} 
                  alt="SADEWA" 
                  className={villageProfile.sadewaIconUrl ? "h-8 w-8 object-contain" : "h-7 w-auto opacity-80"} 
                  referrerPolicy="no-referrer" 
                />
              </>
            ) : (
              <>
                <div className="h-6 w-px bg-slate-200"></div>
                <SadewaHouseLogo size={28} />
              </>
            )}
          </div>
          <div className="flex flex-col items-end">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">
              Portal Absensi
            </h4>
            <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
              {villageProfile?.villageName || 'SADEWA'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* --- INPUT KODE AKSES (DDMMYY) --- */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Masukkan Kode Absensi (TglBlnThn):
            </label>
            <input
              type="text"
              maxLength={6}
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 200199"
              className="w-full text-2xl tracking-[0.5em] font-mono text-center py-4 rounded-2xl border-2 border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none bg-slate-50"
            />
            <p className="text-[10px] text-slate-400 italic px-1">
              *Gunakan format 6 angka (Contoh: 20 Januari 1999 → 200199).
            </p>
          </div>

          {/* --- HASIL IDENTIFIKASI PERANGKAT DESA --- */}
          {selectedOfficial ? (
            <div className="animate-in zoom-in-95 duration-300 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-emerald-200 overflow-hidden shrink-0 shadow-sm">
                  {selectedOfficial.imageUrl ? (
                    <img src={selectedOfficial.imageUrl} alt={selectedOfficial.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-600 font-bold text-xl">
                      {selectedOfficial.name.substring(0, 1)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-0.5">Terdeteksi:</div>
                  <div className="text-base font-black text-slate-900 leading-tight">{selectedOfficial.name}</div>
                  <div className="text-[11px] font-medium text-emerald-700">{selectedOfficial.position}</div>
                </div>
                <div className="bg-emerald-500 text-white p-1 rounded-full shadow-md">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('masuk')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                    type === 'masuk' 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg scale-[1.02]' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                  }`}
                >
                  <Clock className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Masuk</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('pulang')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                    type === 'pulang' 
                      ? 'bg-rose-600 border-rose-600 text-white shadow-lg scale-[1.02]' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
                  }`}
                >
                  <Clock className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pulang</span>
                </button>
              </div>

              {/* --- BAGIAN SELFIE (VERIFIKASI WAJAH) --- */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Verifikasi Wajah (Selfie):
                  </label>
                  {selfie && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">Siap</span>
                  )}
                </div>
                
                <div className="relative group">
                  {selfie ? (
                    <div className="relative h-48 w-full rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md">
                      <img src={selfie} alt="Selfie Capture" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSelfie(null)}
                        className="absolute top-2 right-2 bg-rose-600 text-white p-2 rounded-full shadow-lg hover:bg-rose-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-48 w-full border-2 border-dashed border-slate-300 rounded-xl bg-white flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <Fingerprint className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-medium text-center px-4 italic">Foto wajib diambil langsung di lokasi kantor desa.</p>
                    </div>
                  )}
                  
                  {!selfie && (
                    <label className="absolute inset-0 cursor-pointer flex items-center justify-center">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="user" 
                        className="hidden" 
                        onChange={handleCapture}
                      />
                      <div className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        Ambil Foto Selfie
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <button
                onClick={handleVerifyAndSubmit}
                disabled={isLoading || !selfie}
                className="w-full py-4 px-6 bg-slate-900 hover:bg-black text-white font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>MEMPROSES...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span>KONFIRMASI ABSENSI SEKARANG</span>
                  </>
                )}
              </button>
              
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setViewHistory(!viewHistory);
                    if (!viewHistory) fetchHistory();
                  }}
                  className="w-full text-[11px] text-slate-400 hover:text-emerald-700 flex items-center justify-center gap-1.5 py-1"
                >
                  <History className="w-3.5 h-3.5" />
                  {viewHistory ? 'Sembunyikan Riwayat' : 'Lihat Riwayat Terakhir'}
                </button>
                
                {viewHistory && (
                  <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                    {history.length === 0 ? (
                      <p className="text-[10px] text-center text-slate-400 py-2 italic">Belum ada riwayat tercatat.</p>
                    ) : (
                      history.map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${log.type === 'masuk' ? 'bg-emerald-500' : 'bg-rose-500 shadow-sm shadow-rose-200'}`} />
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{log.type}</span>
                          </div>
                          <div className="text-[10px] font-medium text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </div>
                          <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black tracking-tighter ${
                            log.status === 'hadir' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : authCode.length === 6 ? (
            <div className="p-6 text-center space-y-2 bg-rose-50 rounded-2xl border border-rose-100 animate-in shake-1 duration-300">
              <div className="text-rose-600 font-black text-sm uppercase tracking-wider">Data Tidak Ditemukan</div>
              <p className="text-[10px] text-rose-500">Kode "<span className="font-bold">{authCode}</span>" tidak terdaftar di sistem perangkat desa. Periksa kembali tanggal lahir.</p>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-300 gap-3 border-2 border-dashed border-slate-100 rounded-2xl">
              <UserCheck className="w-12 h-12" />
              <p className="text-[11px] font-medium italic">Silakan masukkan kode 6 angka...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 3 && lastLog) {
    return (
      <div className="text-center py-6 space-y-4 animate-in zoom-in duration-300">
        <div className="relative mx-auto w-24 h-24">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl overflow-hidden">
            {villageProfile?.sadewaLogoUrl ? (
              <img src={villageProfile.sadewaLogoUrl} alt="Logo" className="w-14 h-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
        
        <div className="space-y-1">
          <h4 className="text-lg font-bold text-slate-900">Absensi Berhasil!</h4>
          <p className="text-xs text-slate-600">Terima kasih, <span className="font-bold text-emerald-700">{selectedOfficial?.name}</span>.</p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block w-full text-left space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Waktu:</span>
            <span className="font-bold text-slate-900 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {new Date(lastLog.timestamp).toLocaleTimeString('id-ID')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Tanggal:</span>
            <span className="font-bold text-slate-900 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(lastLog.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Jenis:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
              lastLog.type === 'masuk' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}>
              ABSEN {lastLog.type.toUpperCase()}
            </span>
          </div>
          {lastLog.location && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Lokasi:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                GPS Terverifikasi
              </span>
            </div>
          )}
        </div>

        <button
          onClick={reset}
          className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-all"
        >
          Selesai & Tutup
        </button>
      </div>
    );
  }

  return null;
};
