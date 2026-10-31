import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar as CalendarIcon, Clock, MapPin, Users, CheckCircle2 } from 'lucide-react';

export const AgendaView: React.FC = () => {
  const { agendas } = useApp();
  const [filterType, setFilterType] = useState('all');

  const filtered =
    filterType === 'all'
      ? agendas
      : agendas.filter((item) => (item.category || '').toLowerCase().includes(filterType.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
          Jadwal & Agenda
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
          Kalender Kegiatan {useApp().villageProfile.villageName || 'Desa'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
          Informasi waktu dan tempat pelaksanaan musyawarah desa, posyandu terpadu, gotong royong, dan kegiatan kemasyarakatan lainnya.
        </p>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mt-6">
          {['all', 'Musyawarah', 'Kesehatan', 'Gotong Royong', 'Keagamaan'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterType === f
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Semua Agenda' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                  {item.category}
                </span>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {item.date}
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900 leading-snug">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Waktu: {item.time}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Lokasi: {item.location}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Sasaran: {item.organizer}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
