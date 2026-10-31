import React, { useState } from 'react';
import { 
  Trees, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  ChevronRight, 
  ExternalLink,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VillagePotential } from '../../types';
import { PotentialModal } from './PotentialModal';

export const PotentialManager: React.FC = () => {
  const { potentials, addPotential, updatePotential, deletePotential, addToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPotential, setEditingPotential] = useState<VillagePotential | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredPotentials = potentials.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = (data: Omit<VillagePotential, 'id'>) => {
    if (editingPotential) {
      updatePotential(editingPotential.id, data);
      addToast('success', 'Potensi Diperbarui', `Data ${data.name} berhasil disimpan.`);
    } else {
      addPotential(data);
      addToast('success', 'Potensi Ditambahkan', `${data.name} telah terdaftar dalam sistem.`);
    }
    setIsModalOpen(false);
    setEditingPotential(null);
  };

  const handleEdit = (pot: VillagePotential) => {
    setEditingPotential(pot);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    const pot = potentials.find(p => p.id === id);
    deletePotential(id);
    addToast('warning', 'Potensi Dihapus', `Data ${pot?.name || 'potensi'} telah dihapus.`);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-6 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Trees className="w-32 h-32" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-100 font-bold text-xs uppercase tracking-widest">
                <Info className="w-3.5 h-3.5" />
                <span>Pengelolaan Kekayaan Alam Desa</span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Manajemen Potensi Desa</h2>
            </div>
            <button
              onClick={() => {
                setEditingPotential(null);
                setIsModalOpen(true);
              }}
              className="bg-white text-emerald-800 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md hover:bg-emerald-50 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Potensi Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="text-[10px] font-bold text-emerald-200 uppercase">Total Komoditas</div>
              <div className="text-2xl font-bold">{potentials.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
              <div className="text-[10px] font-bold text-emerald-200 uppercase">Kategori Aktif</div>
              <div className="text-2xl font-bold">{new Set(potentials.map(p => p.category)).size}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama komoditas atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {filteredPotentials.length} Ditemukan
          </span>
        </div>
      </div>

      {/* Potentials List/Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPotentials.map((pot) => (
          <div 
            key={pot.id} 
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all flex flex-col group"
          >
            <div className="h-40 relative overflow-hidden bg-slate-100">
              <img 
                src={pot.imageUrl || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800'} 
                alt={pot.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-950/80 text-white backdrop-blur text-[10px] font-bold uppercase tracking-wider">
                {pot.category}
              </div>
            </div>

            <div className="p-5 flex-1 space-y-3">
              <div>
                <h4 className="font-bold text-slate-900 line-clamp-1">{pot.name}</h4>
                <p className="text-[10px] font-bold text-emerald-700 mt-0.5">{pot.highlightStat}</p>
              </div>
              
              <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                {pot.description}
              </p>

              <div className="flex flex-wrap gap-1 mt-2">
                {pot.keyCommodities.slice(0, 3).map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[9px] font-bold rounded border border-slate-100">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(pot)}
                  className="p-2 bg-white text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                  title="Edit Potensi"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirmId(pot.id)}
                  className="p-2 bg-white text-rose-600 rounded-xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                  title="Hapus Potensi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <button className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-700 transition-colors">
                <span>View Public</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredPotentials.length === 0 && (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trees className="w-8 h-8 text-slate-300" />
          </div>
          <h4 className="text-slate-900 font-bold">Potensi Tidak Ditemukan</h4>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            Tidak ada komoditas atau potensi desa yang sesuai dengan kriteria pencarian Anda.
          </p>
          <button 
            onClick={() => setSearchQuery('')}
            className="mt-4 text-emerald-700 font-bold text-xs hover:underline"
          >
            Bersihkan Pencarian
          </button>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Hapus Potensi Ini?</h3>
            <p className="text-sm text-slate-500 mt-2">
              Tindakan ini tidak dapat dibatalkan. Seluruh data komoditas dan statistik terkait akan hilang dari portal publik.
            </p>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 shadow-md shadow-rose-200 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Potential Form Modal */}
      <PotentialModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPotential(null);
        }}
        onSave={handleSave}
        initialData={editingPotential}
      />
    </div>
  );
};
