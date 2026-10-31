import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UmkmItem } from '../../types';
import {
  ShoppingBag,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Check,
  Phone,
  Store,
  MapPin,
  X
} from 'lucide-react';

export const UmkmManager: React.FC = () => {
  const { umkm, addUmkmItem, deleteUmkmItem, toggleUmkmVerification } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [category, setCategory] = useState<UmkmItem['category']>('kuliner');
  const [phone, setPhone] = useState('');
  const [priceRange, setPriceRange] = useState('Rp 15.000 - Rp 50.000');
  const [description, setDescription] = useState('');
  const [productsInput, setProductsInput] = useState('');
  const [imageUrl, setImageUrl] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80');

  const openAddModal = () => {
    setName('');
    setOwnerName('');
    setCategory('kuliner');
    setPhone('');
    setPriceRange('Rp 10.000 - Rp 50.000');
    setDescription('');
    setProductsInput('Ikan Asap Khas Betung, Kerupuk Ikan, Terasi');
    setImageUrl('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ownerName.trim() || !phone.trim()) return;

    const products = productsInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    addUmkmItem({
      name: name.trim(),
      ownerName: ownerName.trim(),
      category,
      phone: phone.trim(),
      whatsappContact: phone.trim(),
      location: 'Desa Pulau Betung',
      priceRange: priceRange.trim(),
      description: description.trim() || `Produk unggulan warga Desa Pulau Betung: ${name.trim()}`,
      products: products.length > 0 ? products : [name.trim()],
      imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      isVerified: true
    });

    setModalOpen(false);
  };

  const handleDelete = (id: string, umkmName: string) => {
    if (window.confirm(`Hapus UMKM "${umkmName}" dari direktori pasar desa?`)) {
      deleteUmkmItem(id);
    }
  };

  const filtered = umkm.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900">
              Direktori & Verifikasi UMKM Warga Desa
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
              {umkm.length} Usaha
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftarkan produk lokal warga binaan desa dan beri lencana verifikasi resmi agar dipercaya calon pembeli.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-teal-700 text-white font-bold text-xs hover:bg-teal-800 flex items-center justify-center space-x-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Daftarkan UMKM Baru</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama toko, nama pemilik, atau produk..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/60"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white hover:border-teal-300 transition-all shadow-sm overflow-hidden flex flex-col justify-between"
          >
            <div className="relative h-32 w-full bg-slate-100">
              <img
                src={item.imageUrl?.trim() ? item.imageUrl : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80'}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80';
                }}
              />
              <span className="absolute top-2.5 left-2.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm bg-white/95 text-slate-800">
                {item.category}
              </span>
              {item.isVerified && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm bg-blue-600 text-white flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Terverifikasi</span>
                </span>
              )}
            </div>

            <div className="p-4 space-y-2 flex-1">
              <h3 className="font-bold text-xs text-slate-900 leading-snug">{item.name}</h3>
              <p className="text-[11px] text-slate-500">Pemilik: <strong className="text-slate-800">{item.ownerName}</strong></p>
              <div className="flex items-center text-[11px] text-slate-500 space-x-1">
                <Phone className="w-3 h-3 text-teal-600 shrink-0" />
                <span className="font-mono">{item.phone}</span>
              </div>
              <p className="text-[11px] text-emerald-800 font-bold">{item.priceRange}</p>
              <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                {item.description}
              </p>
            </div>

            <div className="p-3 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
              <button
                onClick={() => toggleUmkmVerification(item.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors ${
                  item.isVerified
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                    : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{item.isVerified ? 'Cabut Verifikasi' : 'Verifikasi'}</span>
              </button>

              <button
                onClick={() => handleDelete(item.id, item.name)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center space-x-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                  Pendaftaran Usaha Warga
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Formulir UMKM Baru</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Toko / Usaha:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Keripik Ikan Khas Betung Bu Aminah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pemilik:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Aminah"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori:</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
                  >
                    <option value="kuliner">Kuliner & Makanan</option>
                    <option value="kerajinan">Kerajinan Tangan</option>
                    <option value="pertanian">Pertanian & Perkebunan</option>
                    <option value="perikanan">Hasil Perikanan</option>
                    <option value="jasa">Jasa & Pelayanan</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp:</label>
                  <input
                    type="text"
                    required
                    placeholder="0812-xxxx-xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kisaran Harga:</label>
                  <input
                    type="text"
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Daftar Produk (Pisahkan Koma):</label>
                <input
                  type="text"
                  placeholder="Contoh: Keripik Ikan, Terasi Betung, Sambal Asap"
                  value={productsInput}
                  onChange={(e) => setProductsInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deskripsi Usaha:</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat usaha..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-sm flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Daftarkan UMKM</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
