import React, { useState } from 'react';
import { ShieldAlert, Trash2, Loader2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useMasterReset } from '../../hooks/useMasterReset';
import { useApp } from '../../context/AppContext';

export const MasterResetTool: React.FC = () => {
  const { performMasterReset, isResetting, resetProgress } = useMasterReset();
  const { addToast } = useApp();
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleReset = async () => {
    if (confirmText !== 'HAPUS SEMUA DATA') {
      addToast('error', 'Konfirmasi Gagal', 'Harap ketik kalimat konfirmasi dengan benar.');
      return;
    }

    const result = await performMasterReset();
    if (result.success) {
      addToast('success', 'Reset Berhasil', 'Seluruh data dummy telah dibersihkan. Sistem siap untuk uji coba real.');
      // Reload page to refresh all contexts
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      addToast('error', 'Reset Gagal', result.error || 'Terjadi kesalahan saat membersihkan database.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-rose-50 border-b border-rose-100 p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-rose-900">ZONA BAHAYA: Pembersihan Data Master</h2>
            <p className="text-xs text-rose-700 font-medium">Fitur ini digunakan untuk menghapus SELURUH data dummy sebelum implementasi riil.</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Dampak Tindakan Ini:
            </h3>
            <ul className="space-y-2">
              {[
                'Seluruh Database Penduduk (Master) akan dikosongkan.',
                'Seluruh Data KPM Bansos & Aduan Bansos dihapus permanen.',
                'Seluruh Data Posyandu & Stunting akan dibersihkan.',
                'Semua Arsip Surat & Permohonan Online akan dihapus.',
                'Berita, Pengumuman, Agenda, & Proyek Desa akan direset.',
                'Log Audit Keamanan akan dikosongkan.',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
              <RefreshCcw className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-[11px] text-amber-800 leading-relaxed">
                <span className="font-bold">Informasi:</span> Kami akan tetap mempertahankan akun Administrator (Login) dan Profil Identitas Desa agar Anda tetap dapat mengelola sistem tanpa perlu setup ulang.
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-6">
            {!showConfirm ? (
              <div className="space-y-4 text-center">
                <p className="text-xs text-slate-500 italic">Klik tombol di bawah jika Anda benar-benar yakin ingin memulai uji coba real dengan database kosong.</p>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-100 active:scale-95"
                >
                  <Trash2 className="w-5 h-5" />
                  MULAI PEMBERSIHAN TOTAL
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ketik Konfirmasi</label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="HAPUS SEMUA DATA"
                    className="w-full px-4 py-3 rounded-xl border-2 border-rose-200 focus:border-rose-500 outline-none transition-all font-bold text-center uppercase"
                  />
                  <p className="text-[10px] text-rose-600 text-center font-bold">Tindakan ini tidak dapat dibatalkan!</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-white border border-slate-300 text-slate-600 font-bold text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={isResetting || confirmText !== 'HAPUS SEMUA DATA'}
                    className={`flex-[2] py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                      isResetting || confirmText !== 'HAPUS SEMUA DATA'
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-rose-600 text-white hover:bg-rose-700 shadow-md'
                    }`}
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>MEMBERSIHKAN... {Math.round(resetProgress)}%</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>KONFIRMASI HAPUS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
