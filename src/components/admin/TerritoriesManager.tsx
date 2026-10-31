import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DusunRecord, RWRecord, RTRecord } from '../../types';
import { formatDusunLabel, parseDusunDetails } from '../../utils/territory';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Building,
  Home,
  UserCheck
} from 'lucide-react';

export const TerritoriesManager: React.FC = () => {
  const { territories, updateTerritories, addToast } = useApp();

  // Local state copy for drafting changes
  const [data, setData] = useState<DusunRecord[]>(() => JSON.parse(JSON.stringify(territories)));
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDusuns, setExpandedDusuns] = useState<Record<string, boolean>>({
    'dus-1': true,
    'dus-2': true
  });
  const [expandedRws, setExpandedRws] = useState<Record<string, boolean>>({
    'rw-1': true,
    'rw-2': true
  });

  // Modal / form states for creating & editing
  const [editingTarget, setEditingTarget] = useState<{
    type: 'dusun' | 'rw' | 'rt';
    dusunId?: string;
    rwId?: string;
    id?: string;
    number?: number;
    customName?: string;
    name: string;
    leaderName: string;
    isActive: boolean;
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'dusun' | 'rw' | 'rt';
    dusunId?: string;
    rwId?: string;
    id: string;
    name: string;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Toggle accordions
  const toggleDusun = (dusunId: string) => {
    setExpandedDusuns((prev) => ({ ...prev, [dusunId]: !prev[dusunId] }));
  };

  const toggleRw = (rwId: string) => {
    setExpandedRws((prev) => ({ ...prev, [rwId]: !prev[rwId] }));
  };

  // Quick statistics calculation
  const totalDusuns = data.length;
  let totalRws = 0;
  let totalRts = 0;
  let activeRts = 0;

  data.forEach((d) => {
    if (Array.isArray(d.rws)) {
      totalRws += d.rws.length;
      d.rws.forEach((r) => {
        if (Array.isArray(r.rts)) {
          totalRts += r.rts.length;
          activeRts += r.rts.filter((rt) => rt.isActive !== false).length;
        }
      });
    }
  });

  // Handle Save to Server
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateTerritories(data);
      setIsSaving(false);
      addToast('success', 'Wilayah Tersimpan', 'Struktur Master Wilayah RT/RW/Dusun berhasil disimpan secara permanen.');
    } catch (err) {
      setIsSaving(false);
      addToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan data wilayah.');
    }
  };

  const handleReset = () => {
    setData(JSON.parse(JSON.stringify(territories)));
    addToast('info', 'Dibatalkan', 'Data wilayah dikembalikan ke konfigurasi tersimpan.');
  };

  // Open Edit or Create Modals
  const openAddDusun = () => {
    const nextNum = data.length + 1;
    setEditingTarget({
      type: 'dusun',
      number: nextNum,
      customName: '',
      name: `Dusun ${nextNum}`,
      leaderName: '',
      isActive: true
    });
  };

  const openEditDusun = (dusun: DusunRecord) => {
    const { number, customName, label } = parseDusunDetails(dusun);
    setEditingTarget({
      type: 'dusun',
      id: dusun.id,
      number,
      customName,
      name: label,
      leaderName: dusun.leaderName || '',
      isActive: dusun.isActive !== false
    });
  };

  const openAddRw = (dusunId: string) => {
    setEditingTarget({
      type: 'rw',
      dusunId,
      name: '',
      leaderName: '',
      isActive: true
    });
  };

  const openEditRw = (dusunId: string, rw: RWRecord) => {
    setEditingTarget({
      type: 'rw',
      dusunId,
      id: rw.id,
      name: rw.name,
      leaderName: rw.leaderName || '',
      isActive: rw.isActive !== false
    });
  };

  const openAddRt = (dusunId: string, rwId: string) => {
    setEditingTarget({
      type: 'rt',
      dusunId,
      rwId,
      name: '',
      leaderName: '',
      isActive: true
    });
  };

  const openEditRt = (dusunId: string, rwId: string, rt: RTRecord) => {
    setEditingTarget({
      type: 'rt',
      dusunId,
      rwId,
      id: rt.id,
      name: rt.name,
      leaderName: rt.leaderName || '',
      isActive: rt.isActive !== false
    });
  };

  // Submit modal form
  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;

    const trimmedName = editingTarget.name.trim();
    const trimmedLeader = editingTarget.leaderName.trim();

    if (!trimmedName) {
      addToast('error', 'Nama Wajib Diisi', 'Silakan masukkan nama wilayah yang valid.');
      return;
    }

    const next = JSON.parse(JSON.stringify(data)) as DusunRecord[];

    if (editingTarget.type === 'dusun') {
      const num = editingTarget.number || 1;
      const cleanCustom = (editingTarget.customName || '').trim();
      const dynamicLabel = formatDusunLabel({ number: num, customName: cleanCustom });

      if (editingTarget.id) {
        // Edit Dusun
        const dusun = next.find((d) => d.id === editingTarget.id);
        if (dusun) {
          dusun.number = num;
          dusun.customName = cleanCustom;
          dusun.name = dynamicLabel;
          dusun.leaderName = trimmedLeader;
          dusun.isActive = editingTarget.isActive;
        }
      } else {
        // Add Dusun
        const newDusunId = `dus-${Date.now()}`;
        next.push({
          id: newDusunId,
          number: num,
          customName: cleanCustom,
          name: dynamicLabel,
          leaderName: trimmedLeader || 'Kepala Dusun',
          isActive: editingTarget.isActive,
          rws: []
        });
        setExpandedDusuns((prev) => ({ ...prev, [newDusunId]: true }));
      }
    } else if (editingTarget.type === 'rw') {
      const dusun = next.find((d) => d.id === editingTarget.dusunId);
      if (dusun) {
        if (!Array.isArray(dusun.rws)) dusun.rws = [];

        if (editingTarget.id) {
          // Edit RW
          const rw = dusun.rws.find((r) => r.id === editingTarget.id);
          if (rw) {
            rw.name = trimmedName;
            rw.leaderName = trimmedLeader;
            rw.isActive = editingTarget.isActive;
          }
        } else {
          // Add RW
          const newRwId = `rw-${Date.now()}`;
          dusun.rws.push({
            id: newRwId,
            dusunId: dusun.id,
            name: trimmedName,
            leaderName: trimmedLeader || 'Ketua RW',
            isActive: editingTarget.isActive,
            rts: []
          });
          setExpandedRws((prev) => ({ ...prev, [newRwId]: true }));
        }
      }
    } else if (editingTarget.type === 'rt') {
      const dusun = next.find((d) => d.id === editingTarget.dusunId);
      if (dusun) {
        const rw = dusun.rws?.find((r) => r.id === editingTarget.rwId);
        if (rw) {
          if (!Array.isArray(rw.rts)) rw.rts = [];

          if (editingTarget.id) {
            // Edit RT
            const rt = rw.rts.find((t) => t.id === editingTarget.id);
            if (rt) {
              rt.name = trimmedName;
              rt.leaderName = trimmedLeader;
              rt.isActive = editingTarget.isActive;
            }
          } else {
            // Add RT
            rw.rts.push({
              id: `rt-${Date.now()}`,
              dusunId: dusun.id,
              rwId: rw.id,
              name: trimmedName,
              leaderName: trimmedLeader || 'Ketua RT',
              isActive: editingTarget.isActive
            });
          }
        }
      }
    }

    setData(next);
    setEditingTarget(null);
    addToast('success', 'Perubahan Diterapkan', `Data ${editingTarget.type.toUpperCase()} telah diperbarui dalam daftar draf.`);
  };

  // Perform Delete
  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    const next = JSON.parse(JSON.stringify(data)) as DusunRecord[];

    if (deleteConfirm.type === 'dusun') {
      const index = next.findIndex((d) => d.id === deleteConfirm.id);
      if (index !== -1) next.splice(index, 1);
    } else if (deleteConfirm.type === 'rw') {
      const dusun = next.find((d) => d.id === deleteConfirm.dusunId);
      if (dusun && Array.isArray(dusun.rws)) {
        const index = dusun.rws.findIndex((r) => r.id === deleteConfirm.id);
        if (index !== -1) dusun.rws.splice(index, 1);
      }
    } else if (deleteConfirm.type === 'rt') {
      const dusun = next.find((d) => d.id === deleteConfirm.dusunId);
      if (dusun) {
        const rw = dusun.rws?.find((r) => r.id === deleteConfirm.rwId);
        if (rw && Array.isArray(rw.rts)) {
          const index = rw.rts.findIndex((t) => t.id === deleteConfirm.id);
          if (index !== -1) rw.rts.splice(index, 1);
        }
      }
    }

    setData(next);
    setDeleteConfirm(null);
    addToast('warning', 'Data Dihapus', `${deleteConfirm.type.toUpperCase()} "${deleteConfirm.name}" telah dihapus.`);
  };

  // Filtered view based on search
  const filteredDusuns = data.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const dusunMatch = d.name.toLowerCase().includes(q) || (d.leaderName && d.leaderName.toLowerCase().includes(q));
    const rwMatch = d.rws?.some(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.leaderName && r.leaderName.toLowerCase().includes(q)) ||
        r.rts?.some((t) => t.name.toLowerCase().includes(q) || (t.leaderName && t.leaderName.toLowerCase().includes(q)))
    );
    return dusunMatch || rwMatch;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-900">
              Master Wilayah Desa (Dusun / RW / RT)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Hirarki Relasional
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kelola struktur pembagian wilayah desa secara bertingkat. Data ini otomatis digunakan dalam formulir permohonan surat warga.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={openAddDusun}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Dusun</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
          </button>
        </div>
      </div>

      {/* Quick Territory Metric Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Total Dusun</span>
            <span className="text-xl font-black text-slate-900">{totalDusuns} Wilayah</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Total Rukun Warga (RW)</span>
            <span className="text-xl font-black text-slate-900">{totalRws} RW</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">Total Rukun Tetangga (RT)</span>
            <span className="text-xl font-black text-slate-900">{totalRts} RT</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-medium block">RT Aktif Pelayanan</span>
            <span className="text-xl font-black text-emerald-700">{activeRts} / {totalRts} RT</span>
          </div>
        </div>
      </div>

      {/* Search Filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama Dusun, RW, RT, atau nama ketua..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2">
          <span>Struktur: Dusun ➔ RW ➔ RT</span>
          <span className="text-slate-300">•</span>
          <span>Klik tanda panah untuk memperluas atau menutup hirarki</span>
        </div>
      </div>

      {/* Hierarchical Tree List */}
      <div className="space-y-4">
        {filteredDusuns.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">Wilayah Tidak Ditemukan</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tidak ada data Dusun, RW, atau RT yang sesuai dengan pencarian Anda.
            </p>
          </div>
        ) : (
          filteredDusuns.map((dusun) => {
            const isDusunExpanded = Boolean(expandedDusuns[dusun.id]);
            const rws = dusun.rws || [];
            const countRw = rws.length;
            const countRt = rws.reduce((sum, r) => sum + (r.rts?.length || 0), 0);

            return (
              <div
                key={dusun.id}
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all"
              >
                {/* Dusun Header Bar */}
                <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDusun(dusun.id)}
                      className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                      title={isDusunExpanded ? 'Tutup Dusun' : 'Buka Dusun'}
                    >
                      {isDusunExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-700" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-700" />
                      )}
                    </button>

                    <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0">
                      <Building className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">{dusun.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dusun.isActive !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {dusun.isActive !== false ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>Kepala Dusun: <strong className="text-slate-700">{dusun.leaderName || 'Belum diisi'}</strong></span>
                        </span>
                        <span>•</span>
                        <span>{countRw} RW, {countRt} RT</span>
                      </div>
                    </div>
                  </div>

                  {/* Dusun Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => openAddRw(dusun.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah RW</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditDusun(dusun)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Ubah Dusun"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'dusun',
                          id: dusun.id,
                          name: dusun.name
                        })
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Hapus Dusun"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dusun Children: RW list */}
                {isDusunExpanded && (
                  <div className="p-4 sm:p-6 space-y-4">
                    {rws.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        Belum ada Rukun Warga (RW) di dusun ini. Klik tombol <strong>+ Tambah RW</strong> di atas.
                      </div>
                    ) : (
                      rws.map((rw) => {
                        const isRwExpanded = Boolean(expandedRws[rw.id]);
                        const rts = rw.rts || [];

                        return (
                          <div
                            key={rw.id}
                            className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs"
                          >
                            {/* RW Header Row */}
                            <div className="p-3 sm:p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => toggleRw(rw.id)}
                                  className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                                  title={isRwExpanded ? 'Tutup RW' : 'Buka RW'}
                                >
                                  {isRwExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>

                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                                  RW
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">{rw.name}</h4>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        rw.isActive !== false
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {rw.isActive !== false ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Ketua RW: <strong className="text-slate-700">{rw.leaderName || 'Belum diisi'}</strong> • {rts.length} Rukun Tetangga (RT)
                                  </div>
                                </div>
                              </div>

                              {/* RW Action Buttons */}
                              <div className="flex items-center gap-1 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => openAddRt(dusun.id, rw.id)}
                                  className="px-2 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-bold hover:bg-teal-100 flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tambah RT</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditRw(dusun.id, rw)}
                                  className="p-1 text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
                                  title="Ubah RW"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: 'rw',
                                      dusunId: dusun.id,
                                      id: rw.id,
                                      name: rw.name
                                    })
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus RW"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* RT Grid under this RW */}
                            {isRwExpanded && (
                              <div className="p-3 sm:p-4 bg-slate-50/20">
                                {rts.length === 0 ? (
                                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                                    Belum ada RT di dalam {rw.name}. Klik tombol <strong>+ Tambah RT</strong>.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    {rts.map((rt) => (
                                      <div
                                        key={rt.id}
                                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-all flex items-center justify-between group shadow-2xs"
                                      >
                                        <div className="flex items-center gap-2.5 truncate">
                                          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                                            RT
                                          </div>
                                          <div className="truncate">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-xs font-bold text-slate-900">{rt.name}</span>
                                              {rt.isActive === false && (
                                                <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-slate-100 text-slate-500">
                                                  Nonaktif
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-slate-500 block truncate">
                                              Ketua: <strong className="text-slate-700">{rt.leaderName || '-'}</strong>
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                          <button
                                            type="button"
                                            onClick={() => openEditRt(dusun.id, rw.id, rt)}
                                            className="p-1 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                                            title="Ubah RT"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setDeleteConfirm({
                                                type: 'rt',
                                                dusunId: dusun.id,
                                                rwId: rw.id,
                                                id: rt.id,
                                                name: rt.name
                                              })
                                            }
                                            className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                                            title="Hapus RT"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT DUSUN, RW, RT */}
      {editingTarget && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setEditingTarget(null)}
          />

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {editingTarget.id ? 'Perbarui Data' : 'Tambah Baru'}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {editingTarget.type === 'dusun'
                    ? `${editingTarget.id ? 'Ubah' : 'Tambah'} Dusun`
                    : editingTarget.type === 'rw'
                    ? `${editingTarget.id ? 'Ubah' : 'Tambah'} Rukun Warga (RW)`
                    : `${editingTarget.id ? 'Ubah' : 'Tambah'} Rukun Tetangga (RT)`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-3.5">
              {editingTarget.type === 'dusun' ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nomor Dusun: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={editingTarget.number || 1}
                        onChange={(e) => {
                          const num = parseInt(e.target.value, 10) || 1;
                          setEditingTarget({
                            ...editingTarget,
                            number: num,
                            name: formatDusunLabel({ number: num, customName: editingTarget.customName })
                          });
                        }}
                        className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold text-slate-900"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nama Dusun (Opsional):
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: Betung Indah"
                        value={editingTarget.customName || ''}
                        onChange={(e) => {
                          const custom = e.target.value;
                          setEditingTarget({
                            ...editingTarget,
                            customName: custom,
                            name: formatDusunLabel({ number: editingTarget.number, customName: custom })
                          });
                        }}
                        className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                        Format Label Dinamis:
                      </span>
                      <span className="text-[11px] text-slate-600">
                        {editingTarget.customName?.trim()
                          ? 'Menggunakan nomor dan nama tambahan'
                          : 'Bawaan murni penomoran standar'}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-800 text-white font-black text-xs shadow-2xs">
                      {formatDusunLabel({ number: editingTarget.number, customName: editingTarget.customName })}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    KOSONGKAN kolom nama jika hanya ingin menampilkan label standar (misal: "Dusun 1").
                  </p>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama {editingTarget.type.toUpperCase()}: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      editingTarget.type === 'rw'
                        ? 'Contoh: RW 01'
                        : 'Contoh: RT 01'
                    }
                    value={editingTarget.name}
                    onChange={(e) => setEditingTarget({ ...editingTarget, name: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pejabat / Ketua {editingTarget.type.toUpperCase()}:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: M. Yusuf"
                  value={editingTarget.leaderName}
                  onChange={(e) => setEditingTarget({ ...editingTarget, leaderName: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Akan ditampilkan sebagai penanggung jawab kewilayahan di sistem informasi desa.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Status Pelayanan Aktif</span>
                  <span className="text-[10px] text-slate-500">
                    Wilayah aktif dapat dipilih warga pada permohonan persuratan online.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editingTarget.isActive}
                  onChange={(e) => setEditingTarget({ ...editingTarget, isActive: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Terapkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setDeleteConfirm(null)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Hapus Wilayah?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apakah Anda yakin ingin menghapus {deleteConfirm.type.toUpperCase()}{' '}
                <strong className="text-slate-900">"{deleteConfirm.name}"</strong>?
                {deleteConfirm.type === 'dusun' && (
                  <span className="text-rose-600 block mt-1 font-semibold">
                    Semua RW dan RT di dalam dusun ini juga akan terhapus.
                  </span>
                )}
                {deleteConfirm.type === 'rw' && (
                  <span className="text-rose-600 block mt-1 font-semibold">
                    Semua RT di dalam RW ini juga akan terhapus.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
