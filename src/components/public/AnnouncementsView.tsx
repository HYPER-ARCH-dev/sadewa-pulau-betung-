import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Announcement } from '../../types';
import {
  Bell,
  Calendar,
  AlertTriangle,
  Download,
  Search,
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { PriorityBadge } from '../common/StatusBadge';

export const AnnouncementsView: React.FC = () => {
  const { announcements, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const filtered = announcements.filter((item) => {
    const itemPriority = (item.priority || 'normal').toLowerCase();
    const matchesPriority =
      priorityFilter === 'all' ||
      itemPriority === priorityFilter ||
      (priorityFilter === 'biasa' && itemPriority === 'normal') ||
      (priorityFilter === 'normal' && itemPriority === 'biasa');
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  const handleDownload = (filename: string) => {
    addToast('info', 'Mengunduh Lampiran', `Lampiran "${filename}" sedang diunduh.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Pemberitahuan Resmi
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Pengumuman Kantor Desa
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Edaran, himbauan kesiapsiagaan, jadwal pelayanan keliling, dan instruksi resmi Pemerintah {useApp().villageProfile.villageName || 'Desa'} untuk seluruh warga.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari pengumuman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Priority Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPriorityFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            priorityFilter === 'all'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Semua Pengumuman ({announcements.length})
        </button>
        <button
          onClick={() => setPriorityFilter('mendesak')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            priorityFilter === 'mendesak'
              ? 'bg-rose-700 text-white shadow-sm'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          Mendesak / Siaga
        </button>
        <button
          onClick={() => setPriorityFilter('penting')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            priorityFilter === 'penting'
              ? 'bg-amber-700 text-white shadow-sm'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          Penting
        </button>
        <button
          onClick={() => setPriorityFilter('biasa')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            priorityFilter === 'biasa'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Biasa / Rutin
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedAnnouncement(item)}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-emerald-400 transition-all cursor-pointer space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <PriorityBadge priority={item.priority} />
                <span className="text-xs text-slate-400 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Diterbitkan: {item.publishedAt}</span>
                </span>
              </div>
              {item.attachmentName && (
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1 self-start sm:self-auto">
                  <Download className="w-3 h-3" />
                  <span>Ada Dokumen Lampiran</span>
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 hover:text-emerald-800 transition-colors leading-snug">
              {item.title}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{item.content}</p>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
              <span>Instansi: Pemerintah {useApp().villageProfile.villageName || 'Desa'}</span>
              <span className="text-emerald-700 font-bold flex items-center space-x-1">
                <span>Rincian Himbauan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Announcement Detail Modal */}
      {selectedAnnouncement && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedAnnouncement(null)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <PriorityBadge priority={selectedAnnouncement.priority} />
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  {selectedAnnouncement.title}
                </h3>
                <span className="text-xs text-slate-400 block">
                  Tanggal Terbit: {selectedAnnouncement.publishedAt}
                </span>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedAnnouncement.content}
            </div>

            {selectedAnnouncement.attachmentName && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Berkas Lampiran Resmi:
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedAnnouncement.attachmentName}
                  </span>
                </div>
                <button
                  onClick={() => handleDownload(selectedAnnouncement.attachmentName!)}
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Surat Edaran</span>
                </button>
              </div>
            )}

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
