import React, { useState, useEffect, useMemo } from 'react';
import { AttendanceLog, VillageOfficial } from '../../types';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Search, 
  Filter, 
  Download, 
  UserCheck, 
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Info,
  Camera,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AttendanceLogManager: React.FC = () => {
  const { officials } = useApp();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOfficial, setSelectedOfficial] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | 'masuk' | 'pulang'>('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/attendance/all');
      const result = await response.json();
      if (result.success) {
        setLogs(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.officialName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchOfficial = selectedOfficial === 'all' || log.officialId === selectedOfficial;
      const matchType = selectedType === 'all' || log.type === selectedType;
      const matchDate = !selectedDate || log.date === selectedDate;
      return matchSearch && matchOfficial && matchType && matchDate;
    });
  }, [logs, searchQuery, selectedOfficial, selectedType, selectedDate]);

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    
    const headers = ['Nama', 'Tanggal', 'Waktu', 'Jenis', 'Status', 'Lokasi', 'Device ID'];
    const rows = filteredLogs.map(log => [
      `"${log.officialName}"`,
      `"${log.date}"`,
      `"${new Date(log.timestamp).toLocaleTimeString('id-ID')}"`,
      `"${log.type.toUpperCase()}"`,
      `"${log.status.toUpperCase()}"`,
      `"${log.location ? `${log.location.lat},${log.location.lng}` : 'N/A'}"`,
      `"${log.deviceId || ''}"`
    ]);
    
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_kehadiran_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-emerald-600" />
              Laporan Kehadiran Perangkat Desa
            </h2>
            <p className="text-xs text-slate-500 mt-1">Rekapitulasi absensi harian dan jejak digital kedisiplinan aparatur desa.</p>
          </div>
          
          <button
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all disabled:bg-slate-300 shadow-lg active:scale-95"
          >
            <Download className="w-4 h-4" />
            Ekspor Rekapitulasi (CSV)
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <select
            value={selectedOfficial}
            onChange={(e) => setSelectedOfficial(e.target.value)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Perangkat</option>
            {officials.map(off => (
              <option key={off.id} value={off.id}>{off.name}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">Semua Jenis (Masuk/Pulang)</option>
            <option value="masuk">Hanya Masuk</option>
            <option value="pulang">Hanya Pulang</option>
          </select>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 font-bold animate-pulse">Menghubungkan ke pusat data...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Info className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Data Tidak Ditemukan</h3>
            <p className="text-[11px] text-slate-500 mt-1">Tidak ada catatan kehadiran yang sesuai dengan filter Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="p-4">Tanggal & Waktu</th>
                  <th className="p-4">Nama Aparatur</th>
                  <th className="p-4">Foto Selfie</th>
                  <th className="p-4">Aksi</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Lokasi (GPS)</th>
                  <th className="p-4">Device ID / Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{new Date(log.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-black text-slate-800">{log.officialName}</div>
                      <div className="text-[10px] text-slate-400 italic">ID: {log.officialId}</div>
                    </td>
                    <td className="p-4">
                      {log.selfieUrl ? (
                        <div 
                          onClick={() => setPreviewImage(log.selfieUrl!)}
                          className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all shadow-sm"
                        >
                          <img src={log.selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${
                        log.type === 'masuk' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {log.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-lg font-bold text-[9px] ${
                        log.status === 'hadir' ? 'bg-emerald-600 text-white shadow-sm' : 
                        log.status === 'terlambat' ? 'bg-amber-500 text-white shadow-sm' :
                        'bg-slate-700 text-white shadow-sm'
                      }`}>
                        {log.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {log.location ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold group-hover:scale-105 transition-transform origin-left">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Terverifikasi</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No GPS Data</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-lg w-fit">
                        <Smartphone className="w-3 h-3" />
                        <span className="font-mono max-w-[120px] truncate" title={log.deviceId || log.notes}>
                          {log.deviceId || (log.notes?.includes('Mozilla') ? 'Mobile Device' : log.notes) || 'Unknown'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selfie Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                Bukti Foto Verifikasi
              </h3>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-[3/4] w-full bg-slate-900">
              <img src={previewImage} alt="Selfie Full" className="w-full h-full object-contain" />
            </div>
            <div className="p-6 text-center">
              <button
                onClick={() => setPreviewImage(null)}
                className="w-full py-3 bg-slate-900 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                TUTUP PRATINJAU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
