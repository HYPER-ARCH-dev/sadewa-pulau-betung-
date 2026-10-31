import React, { useState, useEffect } from 'react';
import { X, Save, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { VillagePotential } from '../../types';

interface PotentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<VillagePotential, 'id'>) => void;
  initialData?: VillagePotential | null;
}

export const PotentialModal: React.FC<PotentialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [formData, setFormData] = useState<Omit<VillagePotential, 'id'>>({
    name: '',
    category: 'pertanian',
    description: '',
    highlightStat: '',
    imageUrl: '',
    keyCommodities: [],
    keyOpportunities: []
  });

  const [newCommodity, setNewCommodity] = useState('');
  const [newOpportunity, setNewOpportunity] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        category: initialData.category,
        description: initialData.description,
        highlightStat: initialData.highlightStat,
        imageUrl: initialData.imageUrl,
        keyCommodities: initialData.keyCommodities || [],
        keyOpportunities: initialData.keyOpportunities || []
      });
    } else {
      setFormData({
        name: '',
        category: 'pertanian',
        description: '',
        highlightStat: '',
        imageUrl: '',
        keyCommodities: [],
        keyOpportunities: []
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const addCommodity = () => {
    if (newCommodity.trim()) {
      setFormData({
        ...formData,
        keyCommodities: [...formData.keyCommodities, newCommodity.trim()]
      });
      setNewCommodity('');
    }
  };

  const removeCommodity = (index: number) => {
    const next = [...formData.keyCommodities];
    next.splice(index, 1);
    setFormData({ ...formData, keyCommodities: next });
  };

  const addOpportunity = () => {
    if (newOpportunity.trim()) {
      setFormData({
        ...formData,
        keyOpportunities: [...(formData.keyOpportunities || []), newOpportunity.trim()]
      });
      setNewOpportunity('');
    }
  };

  const removeOpportunity = (index: number) => {
    const next = [...(formData.keyOpportunities || [])];
    next.splice(index, 1);
    setFormData({ ...formData, keyOpportunities: next });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-800">
            {initialData ? 'Edit Potensi Desa' : 'Tambah Potensi Baru'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nama Potensi / Komoditas</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Perkebunan Karet Rakyat"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kategori</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
              >
                <option value="pertanian">Pertanian</option>
                <option value="perkebunan">Perkebunan</option>
                <option value="perikanan">Perikanan</option>
                <option value="pariwisata">Pariwisata</option>
                <option value="kerajinan">Kerajinan</option>
                <option value="energi">Energi</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Angka / Statistik Unggulan (Subtitle)</label>
            <input
              required
              type="text"
              value={formData.highlightStat}
              onChange={(e) => setFormData({ ...formData, highlightStat: e.target.value })}
              placeholder="Contoh: Luas 1.200 Ha / Produksi 50 Ton/Bulan"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Deskripsi Singkat</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan secara singkat mengenai potensi ini..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">URL Gambar Sampul</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Key Commodities */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Komoditas Terkait</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCommodity}
                  onChange={(e) => setNewCommodity(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCommodity())}
                  placeholder="Karet Sir 20..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={addCommodity}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {formData.keyCommodities.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                    {item}
                    <button type="button" onClick={() => removeCommodity(idx)} className="text-slate-400 hover:text-rose-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Key Opportunities */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Keunggulan & Prospek</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newOpportunity}
                  onChange={(e) => setNewOpportunity(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addOpportunity())}
                  placeholder="Pasar Ekspor..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={addOpportunity}
                  className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(formData.keyOpportunities || []).map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-100">
                    {item}
                    <button type="button" onClick={() => removeOpportunity(idx)} className="text-emerald-400 hover:text-rose-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {initialData ? 'Simpan Perubahan' : 'Tambah Potensi'}
          </button>
        </div>
      </div>
    </div>
  );
};
