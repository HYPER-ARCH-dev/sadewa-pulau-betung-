import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Complaint } from '../../types';
import { AlertCircle, Send, CheckCircle2, Clock, ShieldCheck, Search, MessageSquare, HelpCircle, EyeOff, MapPin, ChevronRight, Megaphone, Zap } from "lucide-react";
import { motion, AnimatePresence } from 'motion/react';
import { ComplaintStatusBadge } from '../common/StatusBadge';

export const ComplaintsView: React.FC = () => {
  const { complaints, submitComplaint, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'form' | 'track' | 'public_list'>('form');

  // Form states
  const [category, setCategory] = useState<Complaint['category']>('infrastruktur');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reporterContact, setReporterContact] = useState('');
  const [location, setLocation] = useState('Dusun Betung Indah');
  const [createdTicket, setCreatedTicket] = useState<string | null>(null);

  // Tracking state
  const [ticketSearch, setTicketSearch] = useState('');
  const [searchResult, setSearchResult] = useState<Complaint | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReporter = isAnonymous ? 'Warga Masyarakat (Anonim)' : reporterName.trim() || 'Warga Desa';

    const ticket = submitComplaint({
      category,
      title: title.trim(),
      content: content.trim(),
      reporterName: finalReporter,
      isAnonymous,
      reporterContact: isAnonymous ? undefined : reporterContact.trim(),
      location: location.trim()
    });

    setCreatedTicket(ticket);
    addToast('success', 'Laporan Berhasil Dikirim', `Pengaduan Anda telah terdaftar dengan Nomor Tiket: ${ticket}`);
    setTitle('');
    setContent('');
    setReporterName('');
    setReporterContact('');
    setIsAnonymous(false);
  };

  const handleSearchTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const q = ticketSearch.trim().toUpperCase();
    if (!q) return;

    const found = complaints.find((c) => c.ticketNumber.toUpperCase() === q);
    setSearchResult(found || null);
    setSearched(true);
    if (found) {
      addToast('info', 'Tiket Ditemukan', `Laporan "${found.ticketNumber}" berhasil dilacak.`);
    } else {
      addToast('error', 'Tiket Tidak Ditemukan', 'Nomor tiket tidak terdaftar pada basis data.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* LUXURY BANNER: Aspirasi & Pengaduan (The Amethyst Pulse) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950 border-2 border-fuchsia-500/30 shadow-2xl group mb-8"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(192,38,211,0.1),_transparent_70%)]"></div>
        <div className="absolute right-0 top-0 opacity-10 text-fuchsia-400 transform translate-x-10 -translate-y-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
          <Megaphone className="w-64 h-64" />
        </div>
        
        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-300 text-[10px] sm:text-xs font-semibold backdrop-blur-sm">
              <MessageSquare className="w-4 h-4 text-fuchsia-400" />
              <span>Kanal Aspirasi & Pengaduan Warga</span>
            </div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight font-serif">
              Sampaikan Aspirasi & Laporan Anda
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-300 max-w-2xl leading-relaxed">
              Punya ide untuk kemajuan desa atau ingin melaporkan fasilitas publik? Kirimkan laporan Anda secara langsung dan pantau status penanganannya secara transparan.
            </p>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              {['Laporan Anonim', 'Tracking Tiket', 'Respon Cepat'].map((tag) => (
                <div key={tag} className="flex items-center gap-1.5 text-xs text-fuchsia-200/70 font-semibold bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                  <CheckCircle2 className="w-3 h-3 text-fuchsia-500" />
                  {tag}
                </div>
              ))}
            </div>
          </div>

          {/* Tab Controls Overlay */}
          <div className="shrink-0">
            <div className="flex p-1.5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
              {[
                { id: 'form', label: 'Lapor', icon: Send },
                { id: 'track', label: 'Lacak', icon: Zap },
                { id: 'public_list', label: 'Publik', icon: MessageSquare }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* TAB 1: FORM PENGADUAN */}
      <AnimatePresence mode="wait">
        {activeTab === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto space-y-6"
          >
          {createdTicket ? (
            <div className="bg-white rounded-3xl p-8 border border-amber-300 shadow-xl text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Laporan Berhasil Terkirim!</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Terima kasih atas kepedulian Anda. Laporan pengaduan telah masuk ke tim penanganan desa. Simpan nomor tiket berikut:
              </p>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 inline-block font-mono text-xl sm:text-2xl font-black text-amber-900 tracking-wider">
                {createdTicket}
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setTicketSearch(createdTicket);
                    setActiveTab('track');
                    setCreatedTicket(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 text-white font-bold text-xs hover:bg-amber-800"
                >
                  Pantau Tiket Sekarang
                </button>
                <button
                  onClick={() => setCreatedTicket(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Tulis Laporan Lain
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/90 dark:bg-slate-950/90 rounded-[2.5rem] p-6 sm:p-10 border border-fuchsia-500/30 shadow-2xl space-y-6 text-white backdrop-blur-md">
              <div className="flex items-center space-x-3 border-b border-fuchsia-500/20 pb-4">
                <AlertCircle className="w-6 h-6 text-fuchsia-400 animate-pulse" />
                <div>
                  <h2 className="text-xl font-extrabold text-white">Formulir Aspirasi & Pengaduan Warga</h2>
                  <p className="text-xs text-fuchsia-200/70">
                    Semua laporan diperiksa oleh Pemerintah Desa secara objektif, aman, dan berkala.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Laporan *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Complaint['category'])}
                    className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="infrastruktur">Infrastruktur (Jalan, Jembatan, Gorong-gorong, Air Bersih)</option>
                    <option value="pelayanan_desa">Pelayanan Kantor Desa / Administrasi</option>
                    <option value="sosial_bantuan">Bansos, PKH, BLT-DD, atau Kesejahteraan</option>
                    <option value="lingkungan">Kebersihan Lingkungan, Sampah & Aliran Sungai</option>
                    <option value="ketertiban">Ketentraman, Ketertiban & Kamtibmas</option>
                    <option value="lainnya">Aspirasi Umum / Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Pokok Pengaduan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Lampu jalan tenaga surya di Dusun Teluk Melintang padam"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Isi Laporan / Rincian Masalah *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Ceritakan kejadian, waktu, atau kondisi permasalahan selengkap mungkin..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lokasi Terjadinya Kejadian (RT / Dusun / Patokan) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RT 03 Dusun Betung Indah dekat Poskesdes"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Privacy & Anonymous Option */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <EyeOff className="w-4 h-4 text-slate-600" />
                      <span className="text-xs font-bold text-slate-800">Opsi Pengaduan Anonim:</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {!isAnonymous ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nama Pelapor (Opsional)
                        </label>
                        <input
                          type="text"
                          placeholder="Nama Anda"
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nomor Kontak / WhatsApp (Untuk konfirmasi petugas)
                        </label>
                        <input
                          type="tel"
                          placeholder="08xxxxxxxxxx"
                          value={reporterContact}
                          onChange={(e) => setReporterContact(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-800">
                      Identitas Anda akan disembunyikan sepenuhnya sebagai <em>"Warga Masyarakat (Anonim)"</em> di seluruh catatan publik.
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm shadow transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Kirim Laporan Pengaduan</span>
                  </button>
                </div>
              </form>
            </div>
          )}
          </motion.div>
        )}

        {/* TAB 2: LACAK TIKET */}
        {activeTab === 'track' && (
          <motion.div
            key="track"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto space-y-6"
          >
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pelacakan Tiket Laporan</h2>
              <p className="text-xs text-slate-500 mt-1">
                Ketik nomor tiket pengaduan yang Anda terima (contoh: ADU-PB-2026-001).
              </p>
            </div>

            <form onSubmit={handleSearchTicket} className="flex gap-2">
              <input
                type="text"
                placeholder="ADU-PB-2026-XXX"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
              >
                Cari Tiket
              </button>
            </form>

            {searched && (
              <div className="pt-4 border-t border-slate-100">
                {!searchResult ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 text-center">
                    Nomor tiket <strong className="font-mono">{ticketSearch}</strong> tidak ditemukan.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <span className="font-mono text-xs text-amber-800 font-bold block">
                          {searchResult.ticketNumber}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{searchResult.title}</h3>
                        <span className="text-[11px] text-slate-500">
                          Kategori: {searchResult.category} • Tanggal: {searchResult.createdAt}
                        </span>
                      </div>
                      <ComplaintStatusBadge status={searchResult.status} />
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 text-xs">
                      <span className="font-bold text-slate-700 block">Uraian Laporan:</span>
                      <p className="text-slate-600 leading-relaxed">{searchResult.content}</p>
                      <div className="pt-2 text-slate-400 text-[11px] flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>Lokasi: {searchResult.location}</span>
                      </div>
                    </div>

                    {/* Respon Tindak Lanjut Petugas */}
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
                      <div className="flex items-center space-x-2 font-bold">
                        <MessageSquare className="w-4 h-4 text-amber-700" />
                        <span>Tanggapan Pemerintah Desa:</span>
                      </div>
                      {searchResult.adminResponse ? (
                        <p className="text-slate-700 leading-relaxed">{searchResult.adminResponse}</p>
                      ) : (
                        <p className="text-slate-500 italic">
                          Laporan telah tercatat dan sedang dalam antrean verifikasi lapangan oleh aparat desa.
                        </p>
                      )}
                      
                      {/* Proof of Work Display */}
                      {searchResult.status === 'selesai' && searchResult.fotoBuktiPenyelesaian && (
                        <div className="mt-3 space-y-2 pt-2 border-t border-amber-200/50">
                           <div className="h-32 w-full rounded-xl overflow-hidden border border-amber-200">
                             <img src={searchResult.fotoBuktiPenyelesaian} alt="Bukti Selesai" className="w-full h-full object-cover" />
                           </div>
                           <div className="text-[11px] font-medium text-amber-900 bg-white p-2 rounded-lg border border-amber-200">
                             <strong>Catatan Kerja:</strong> {searchResult.catatanTindakLanjut || '-'}
                           </div>
                        </div>
                      )}

                      {searchResult.respondedBy && (
                        <div className="text-[11px] text-amber-800 pt-1 border-t border-amber-200/50">
                          Ditindaklanjuti oleh: {searchResult.respondedBy} ({searchResult.updatedAt})
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </motion.div>
        )}

        {/* TAB 3: DAFTAR ASPIRASI PUBLIK */}
        {activeTab === 'public_list' && (
          <motion.div
            key="public_list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
          <div className="text-xs text-slate-500 mb-2">
            Menampilkan rekapitulasi aspirasi masyarakat yang telah diverifikasi dan tindak lanjut penanganannya.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complaints.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-amber-800 font-bold">
                      {item.ticketNumber}
                    </span>
                    <ComplaintStatusBadge status={item.status} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 leading-snug">{item.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{item.content}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span>Pelapor: {item.reporterName}</span>
                    <span>{item.createdAt}</span>
                  </div>
                  {item.adminResponse && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-100 mt-1">
                      <span className="font-bold block text-[10px] uppercase text-emerald-800">
                        Tindak Lanjut:
                      </span>
                      <span className="line-clamp-2">{item.adminResponse}</span>
                      
                      {/* Proof of Work Display */}
                      {item.status === 'selesai' && item.fotoBuktiPenyelesaian && (
                        <div className="mt-3 space-y-2">
                           <div className="h-24 w-full rounded-xl overflow-hidden border border-emerald-200">
                             <img src={item.fotoBuktiPenyelesaian} alt="Bukti Selesai" className="w-full h-full object-cover" />
                           </div>
                           <div className="text-[10px] font-medium text-emerald-800 bg-white p-2 rounded-lg border border-emerald-200">
                             <strong>Catatan Kerja:</strong> {item.catatanTindakLanjut || '-'}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};
