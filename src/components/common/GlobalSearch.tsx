import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, X, FileText, AlertCircle, Newspaper, Bell, Calendar, Building2, ChevronRight, Shield, QrCode, Coins } from 'lucide-react';

export const GlobalSearch: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    news,
    announcements,
    services,
    developmentProjects,
    budget,
    agendas,
    navigateTo,
    currentUser,
    villageProfile
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isSearchOpen]);

  if (!isSearchOpen) return null;

  const q = query.trim().toLowerCase();

  const filteredNews = q
    ? news.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      )
    : [];

  const filteredAnnouncements = q
    ? announcements.filter(
        (a) => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
      )
    : [];

  const filteredServices = q
    ? services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
    : [];

  const filteredProjects = q
    ? developmentProjects.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.fundingSource.toLowerCase().includes(q)
      )
    : [];

  const filteredDocs = q
    ? budget.publicDocuments.filter(
        (d) => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
      )
    : [];

  const filteredAgendas = q
    ? agendas.filter(
        (a) => a.title.toLowerCase().includes(q) || a.location.toLowerCase().includes(q)
      )
    : [];

  const isTrackingQuery = q.length > 0 && (q.includes('resi') || q.startsWith('req') || q.startsWith('sdw') || (q.length >= 6 && /^[a-z0-9-]+$/.test(q)));
  const trackingCodeCandidate = query.replace(/resi/i, '').trim().toUpperCase() || query.toUpperCase();

  const isBansosQuery = q.length > 0 && (
    q.includes('bansos') ||
    q.includes('bantuan') ||
    q.includes('kpm') ||
    q.includes('blt') ||
    q.includes('pkh') ||
    q.includes('bpnt') ||
    q.includes('beras') ||
    q.includes('pbi') ||
    q.includes('dtks') ||
    q.includes('penerima')
  );

  const totalResults =
    filteredNews.length +
    filteredAnnouncements.length +
    filteredServices.length +
    filteredProjects.length +
    filteredDocs.length +
    filteredAgendas.length +
    (isTrackingQuery ? 1 : 0) +
    (isBansosQuery ? 1 : 0) +
    (currentUser ? 1 : 0); // Include admin quick action if logged in

  return (
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-label="Pencarian Terpadu Portal Desa" 
      className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex justify-center items-start"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsSearchOpen(false)}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in fade-in duration-200">
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Kata kunci pencarian"
            className="w-full text-slate-800 placeholder-slate-400 text-sm sm:text-base bg-transparent border-none outline-none focus:ring-0"
            placeholder="Ketik kata kunci (contoh: SKU, Posyandu, Rabat Beton, APBDes)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus kata kunci pencarian"
              className="p-1 text-slate-400 hover:text-slate-600 mr-2 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            aria-label="Tutup pencarian"
            className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-100 rounded border border-slate-200 hover:bg-slate-200 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!q ? (
            <div className="py-8 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Pencarian Terpadu {villageProfile.villageName || 'Desa'}</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Temukan layanan administrasi desa, berita, pengumuman darurat, proyek pembangunan, dan dokumen publik.
              </p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Tidak ditemukan hasil untuk <span className="font-semibold text-slate-800">"{query}"</span>.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Admin Quick Action */}
              {currentUser && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-600" />
                    <span>Navigasi Cepat Admin</span>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigateTo('admin_dashboard');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 transition-colors flex items-center justify-between group border border-slate-100"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-rose-900">
                          Buka Dashboard Admin
                        </div>
                        <div className="text-xs text-slate-500">Kelola data desa, layanan, dan pengaduan</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600" />
                    </button>
                  </div>
                </div>
              )}

              {/* Modul Tracking Resi */}
              {isTrackingQuery && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <QrCode className="w-3.5 h-3.5 text-teal-600" />
                    <span>Pengecekan Resi / Surat</span>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigateTo('layanan', { trackingCode: trackingCodeCandidate });
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 transition-colors flex items-center justify-between group border border-teal-100"
                    >
                      <div>
                        <div className="text-sm font-semibold text-teal-900">
                          Cetak Status Resi: <span className="font-mono">{trackingCodeCandidate}</span>
                        </div>
                        <div className="text-xs text-teal-700/70 mt-0.5">Lacak status permohonan surat / layanan warga</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-teal-500 group-hover:text-teal-700" />
                    </button>
                  </div>
                </div>
              )}

              {/* Modul Cek Bansos */}
              {isBansosQuery && (
                <div>
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    <span>Portal Cek Bansos & KPM</span>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigateTo('bansos');
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between group border border-amber-200"
                    >
                      <div>
                        <div className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                          <span>Cek Daftar Penerima Bansos (BLT, PKH, BPNT, Beras)</span>
                          <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 text-[9px] font-black rounded uppercase">Cari NIK</span>
                        </div>
                        <div className="text-xs text-amber-800/80 mt-0.5">Pencarian data KPM per NIK / No KK & form sanggahan warga</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {/* Layanan */}
              {filteredServices.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Layanan Warga ({filteredServices.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredServices.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigateTo('layanan', { serviceId: item.id });
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 group-hover:text-emerald-900">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">{item.description}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pengumuman */}
              {filteredAnnouncements.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pengumuman ({filteredAnnouncements.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredAnnouncements.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigateTo('pengumuman');
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 group-hover:text-amber-900">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">{item.content}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Berita */}
              {filteredNews.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <Newspaper className="w-3.5 h-3.5 text-blue-600" />
                    <span>Berita Desa ({filteredNews.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredNews.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigateTo('berita', { newsId: item.id });
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-900">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">{item.summary}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pembangunan */}
              {filteredProjects.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pembangunan Desa ({filteredProjects.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredProjects.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigateTo('pembangunan');
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 group-hover:text-indigo-900">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            Lokasi: {item.location} • Progres: {item.progressPercent}%
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dokumen & Agenda */}
              {filteredDocs.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    <span>Dokumen Transparansi ({filteredDocs.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredDocs.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigateTo('transparansi');
                        }}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                          <div className="text-xs text-slate-500">
                            Kategori: {item.category} • Ukuran: {item.fileSize}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
