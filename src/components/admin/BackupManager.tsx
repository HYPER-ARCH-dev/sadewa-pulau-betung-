import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Download, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileJson,
  Zap,
  HardDrive,
  Upload,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { uploadImageService } from '../../services/uploadService';

interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
}

export const BackupManager: React.FC = () => {
  const { addToast, currentUser } = useApp();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await api.getBackups();
      if (res.success && res.data) {
        setBackups(res.data);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleRunBackup = async () => {
    setIsRunning(true);
    try {
      const res = await api.runBackup();
      if (res.success) {
        addToast('success', 'Backup Berhasil', typeof res.message === 'string' ? res.message : 'Berhasil');
        fetchBackups();
      } else {
        addToast('error', 'Gagal', res.error || 'Gagal membuat backup.');
      }
    } catch (err: any) {
      addToast('error', 'Kesalahan Sistem', err?.message || 'Gagal menghubungi server backup.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Hapus file backup ${filename}? Tindakan ini tidak dapat dibatalkan.`)) return;
    
    try {
      const res = await api.deleteBackup(filename);
      if (res.success) {
        addToast('success', 'Dihapus', 'File backup telah dihapus.');
        fetchBackups();
      }
    } catch (err) {
      addToast('error', 'Gagal', 'Terjadi kesalahan saat menghapus file.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isSuperAdmin = currentUser?.role?.toLowerCase().includes('super');

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Akses Ditolak</h2>
        <p className="text-slate-500 max-w-md">Modul pemeliharaan dan backup database tingkat tinggi hanya dapat diakses oleh akun Super Admin SADEWA.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold text-purple-700 tracking-wider uppercase">Maintenance & Disaster Recovery</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Pemeliharaan & Backup Database</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola cadangan data SADEWA 360 secara manual maupun otomatis untuk menjamin keamanan informasi desa.</p>
        </div>

        <button
          onClick={handleRunBackup}
          disabled={isRunning}
          className="px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          <span>Jalankan Backup Instan (Snapshot)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backup Status Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Riwayat Cadangan Data (JSON Repository)</span>
              </h3>
              <button 
                onClick={fetchBackups} 
                disabled={loading}
                className="p-2 text-slate-400 hover:text-purple-600 rounded-xl transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nama File Backup</th>
                    <th className="px-6 py-4">Ukuran</th>
                    <th className="px-6 py-4">Waktu Pembuatan</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {backups.length > 0 ? (
                      backups.map((file) => (
                        <motion.tr 
                          key={file.filename}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FileJson className="w-5 h-5" />
                              </div>
                              <span className="font-bold text-slate-800">{file.filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">{formatSize(file.size)}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">
                            {new Date(file.createdAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <a 
                              href={`${import.meta.env.VITE_API_URL || '/api'}/admin/maintenance/backups/download/${file.filename}`}
                              className="inline-flex p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Download Backup"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button 
                              onClick={() => handleDeleteBackup(file.filename)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Backup"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          Belum ada file cadangan yang tersedia. Klik tombol di atas untuk membuat backup pertama.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-700 to-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-purple-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Zap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h4 className="font-black text-lg">Konfigurasi Backup Harian Otomatis</h4>
              <p className="text-xs text-purple-100/80 mt-1 leading-relaxed">Sistem SADEWA telah dikonfigurasi untuk menjalankan backup harian setiap pukul 02:00 AM WIB ke penyimpanan server internal.</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold bg-white/10 p-2 rounded-xl border border-white/10">
              <Clock className="w-4 h-4 text-amber-300" />
              <span>Status: AKTIF (Daily @ 02:00)</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>Saran Pemeliharaan</span>
            </h4>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="mt-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></div>
                <p className="text-[11px] text-slate-600 font-medium">Selalu unduh file backup JSON secara berkala ke komputer lokal/hardisk fisik.</p>
              </div>
              <div className="flex gap-3">
                <div className="mt-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></div>
                <p className="text-[11px] text-slate-600 font-medium">Gunakan file JSON ini untuk pemulihan data jika server PostgreSQL utama mengalami kegagalan.</p>
              </div>
              <div className="flex gap-3">
                <div className="mt-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></div>
                <p className="text-[11px] text-slate-600 font-medium">Sistem secara otomatis akan menghapus file backup yang lebih tua dari 7 hari untuk menghemat ruang disk.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
