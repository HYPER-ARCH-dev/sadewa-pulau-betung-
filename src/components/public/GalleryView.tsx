import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GalleryItem } from '../../types';
import { Image, Video, Calendar, Eye, X } from 'lucide-react';

export const GalleryView: React.FC = () => {
  const { gallery } = useApp();
  const [selectedType, setSelectedType] = useState<'all' | 'image' | 'video'>('all');
  const [activeMedia, setActiveMedia] = useState<GalleryItem | null>(null);

  const filtered =
    selectedType === 'all' ? gallery : gallery.filter((item) => item.type === selectedType);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Arsip Visual Desa
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Galeri Dokumentasi Kegiatan
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Rekam jejak kebersamaan masyarakat, pembangunan infrastruktur, tradisi budaya, serta dinamika kehidupan warga Desa Pulau Betung.
          </p>
        </div>

        {/* Filter Type */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedType === 'all'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({gallery.length})
          </button>
          <button
            onClick={() => setSelectedType('image')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedType === 'image'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Foto
          </button>
          <button
            onClick={() => setSelectedType('video')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              selectedType === 'video'
                ? 'bg-emerald-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Video
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveMedia(item)}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="h-56 w-full bg-slate-100 relative overflow-hidden">
              <img
                src={item.url?.trim() ? item.url : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80'}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-slate-950/80 text-white backdrop-blur flex items-center space-x-1">
                {item.type === 'video' ? <Video className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                <span>{item.category}</span>
              </span>
            </div>

            <div className="p-5 space-y-2">
              <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{item.date}</span>
              </span>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
                {item.title}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Media Lightbox Modal */}
      {activeMedia && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveMedia(null)}
          />

          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setActiveMedia(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-h-[65vh] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
              <img
                src={activeMedia.url?.trim() ? activeMedia.url : 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80'}
                alt={activeMedia.title}
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>

            <div className="p-6 sm:p-8 space-y-2 bg-white">
              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                  {activeMedia.category}
                </span>
                <span>•</span>
                <span>{activeMedia.date}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{activeMedia.title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {activeMedia.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
