import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UmkmProduct } from '../../types';
import {
  ShoppingBag,
  Phone,
  Search,
  CheckCircle2,
  Tag,
  Store,
  ArrowUpRight,
  Send,
  BadgeCheck
} from 'lucide-react';

export const UmkmView: React.FC = () => {
  const { umkm, addToast } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Register UMKM form states
  const [regName, setRegName] = useState('');
  const [regOwner, setRegOwner] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDesc, setRegDesc] = useState('');

  const filtered = umkm.filter((item) => {
    const matchesCat = selectedCat === 'all' || item.category === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.ownerName.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleBuyWhatsapp = (product: UmkmProduct) => {
    const cleanPhone = (product.phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const message = encodeURIComponent(
      `Halo ${product.ownerName}, saya melihat produk "${product.name}" di Website Resmi Desa Pulau Betung. Apakah stok produk masih tersedia? Terima kasih.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowRegisterModal(false);
    addToast(
      'success',
      'Pendaftaran UMKM Diterima',
      `Terima kasih Ibu/Bapak ${regOwner}. Tim BUMDes/Operator Desa akan memverifikasi usaha "${regName}" untuk ditampilkan di website.`
    );
    setRegName('');
    setRegOwner('');
    setRegPhone('');
    setRegDesc('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Etalase Produk Warga
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Katalog UMKM Desa Pulau Betung
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Dukung perekonomian keluarga desa dengan berbelanja langsung dari petani, perajin, dan pelaku usaha mikro terverifikasi Desa Pulau Betung tanpa perantara.
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm flex items-center space-x-2 self-start md:self-auto"
        >
          <Store className="w-4 h-4" />
          <span>Daftarkan Usaha Saya</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {['all', 'Kuliner & Makanan Olahan', 'Kriya & Anyaman Tradisional', 'Pertanian & Perkebunan'].map(
            (cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedCat === cat
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'Semua Produk' : cat}
              </button>
            )
          )}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari produk atau pengrajin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* UMKM Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                <img
                  src={item.imageUrl?.trim() ? item.imageUrl : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80'}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-900/80 text-white backdrop-blur">
                  {item.category ? item.category.split(' ')[0] : ''}
                </span>
                {item.verified && (
                  <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500 text-slate-950 flex items-center space-x-1 shadow">
                    <CheckCircle2 className="w-3 h-3 text-slate-950" />
                    <span>Warga Terverifikasi</span>
                  </span>
                )}
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug line-clamp-1">
                    {item.name}
                  </h3>
                  <div className="font-bold text-emerald-800 text-sm mt-1">{item.price}</div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                  <div>Pelaku Usaha: <strong className="text-slate-900">{item.ownerName}</strong></div>
                  <div className="text-slate-400">Wilayah: {item.addressDusun}</div>
                </div>
              </div>
            </div>

            <div className="p-5 pt-0">
              <button
                onClick={() => handleBuyWhatsapp(item)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center space-x-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Pesan via WhatsApp</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Pendaftaran UMKM */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowRegisterModal(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Form Pendaftaran UMKM Warga</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Promosikan produk kerajinan atau olahan kuliner Anda secara gratis di website desa.
                </p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Usaha / Produk *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kemplang Ikan Gabus Ibu Salma"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Pemilik Usaha (Warga) *</label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap sesuai KTP"
                  value={regOwner}
                  onChange={(e) => setRegOwner(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp Aktif *</label>
                <input
                  type="tel"
                  required
                  placeholder="08xxxxxxxxxx"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rincian Singkat Produk *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Bahan dasar, keunggulan, kisaran harga produk..."
                  value={regDesc}
                  onChange={(e) => setRegDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  Kirim Usulan Usaha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
