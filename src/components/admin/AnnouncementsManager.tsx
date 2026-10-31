import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Announcement, AgendaItem, PriorityLevel } from '../../types';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Search,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  AlertCircle,
  FileText,
  Pin,
  CalendarDays,
  ChevronRight
} from 'lucide-react';

export const AnnouncementsManager: React.FC = () => {
  const {
    announcements,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    agendas,
    addAgendaItem,
    updateAgendaItem,
    deleteAgendaItem,
    addToast
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'announcements' | 'agendas'>('announcements');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');

  // Announcement Modal States
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annPriority, setAnnPriority] = useState<PriorityLevel>('normal');
  const [annValidUntil, setAnnValidUntil] = useState('');
  const [annIsActive, setAnnIsActive] = useState(true);
  const [annAttachmentName, setAnnAttachmentName] = useState('');

  // Agenda Modal States
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaItem | null>(null);
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaDate, setAgendaDate] = useState('');
  const [agendaTime, setAgendaTime] = useState('');
  const [agendaLocation, setAgendaLocation] = useState('');
  const [agendaOrganizer, setAgendaOrganizer] = useState('');
  const [agendaDescription, setAgendaDescription] = useState('');
  const [agendaStatus, setAgendaStatus] = useState<AgendaItem['status']>('akan_datang');

  // Delete Confirm Dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'announcement' | 'agenda';
    id: string;
    title: string;
  } | null>(null);

  // --- ANNOUNCEMENT HANDLERS ---
  const openAddAnnouncement = () => {
    setEditingAnn(null);
    setAnnTitle('');
    setAnnContent('');
    setAnnPriority('normal');
    setAnnValidUntil('31 Desember 2026');
    setAnnIsActive(true);
    setAnnAttachmentName('');
    setIsAnnModalOpen(true);
  };

  const openEditAnnouncement = (item: Announcement) => {
    setEditingAnn(item);
    setAnnTitle(item.title);
    setAnnContent(item.content);
    setAnnPriority(item.priority || 'normal');
    setAnnValidUntil(item.validUntil || '');
    setAnnIsActive(item.isActive !== false);
    setAnnAttachmentName(item.attachmentName || '');
    setIsAnnModalOpen(true);
  };

  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim()) {
      addToast('error', 'Validasi Gagal', 'Judul pengumuman wajib diisi.');
      return;
    }
    if (!annContent.trim()) {
      addToast('error', 'Validasi Gagal', 'Isi pengumuman wajib diisi.');
      return;
    }

    const todayStr = new Date().toISOString().substring(0, 10);

    if (editingAnn) {
      updateAnnouncement(editingAnn.id, {
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        validUntil: annValidUntil.trim() || '31 Desember 2026',
        isActive: annIsActive,
        attachmentName: annAttachmentName.trim() || undefined
      });
      addToast('success', 'Pengumuman Diperbarui', 'Perubahan data pengumuman berhasil disimpan.');
    } else {
      addAnnouncement({
        title: annTitle.trim(),
        content: annContent.trim(),
        publishedAt: todayStr,
        validUntil: annValidUntil.trim() || '31 Desember 2026',
        priority: annPriority,
        isActive: annIsActive,
        attachmentName: annAttachmentName.trim() || undefined
      });
      addToast('success', 'Pengumuman Diterbitkan', 'Pengumuman resmi berhasil ditambahkan.');
    }

    setIsAnnModalOpen(false);
  };

  // --- AGENDA HANDLERS ---
  const openAddAgenda = () => {
    setEditingAgenda(null);
    setAgendaTitle('');
    setAgendaDate(new Date().toISOString().substring(0, 10));
    setAgendaTime('09:00 WIB - Selesai');
    setAgendaLocation('Balai Pertemuan Kantor Desa Pulau Betung');
    setAgendaOrganizer('Pemerintah Desa Pulau Betung');
    setAgendaDescription('');
    setAgendaStatus('akan_datang');
    setIsAgendaModalOpen(true);
  };

  const openEditAgenda = (item: AgendaItem) => {
    setEditingAgenda(item);
    setAgendaTitle(item.title);
    setAgendaDate(item.date);
    setAgendaTime(item.time);
    setAgendaLocation(item.location);
    setAgendaOrganizer(item.organizer);
    setAgendaDescription(item.description);
    setAgendaStatus(item.status);
    setIsAgendaModalOpen(true);
  };

  const handleSaveAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaTitle.trim()) {
      addToast('error', 'Validasi Gagal', 'Judul agenda kegiatan wajib diisi.');
      return;
    }

    if (editingAgenda) {
      updateAgendaItem(editingAgenda.id, {
        title: agendaTitle.trim(),
        date: agendaDate,
        time: agendaTime.trim() || 'Waktu Menyesuaikan',
        location: agendaLocation.trim() || 'Wilayah Desa',
        organizer: agendaOrganizer.trim() || 'Pemerintah Desa',
        description: agendaDescription.trim(),
        status: agendaStatus
      });
      addToast('success', 'Agenda Diperbarui', 'Jadwal agenda berhasil disesuaikan.');
    } else {
      addAgendaItem({
        title: agendaTitle.trim(),
        date: agendaDate,
        time: agendaTime.trim() || 'Waktu Menyesuaikan',
        location: agendaLocation.trim() || 'Wilayah Desa',
        organizer: agendaOrganizer.trim() || 'Pemerintah Desa',
        description: agendaDescription.trim(),
        status: agendaStatus
      });
      addToast('success', 'Agenda Dijadwalkan', 'Agenda baru berhasil ditambahkan ke kalender.');
    }

    setIsAgendaModalOpen(false);
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'announcement') {
      deleteAnnouncement(deleteConfirm.id);
    } else {
      deleteAgendaItem(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  // Filtered Lists
  const filteredAnnouncements = announcements.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const filteredAgendas = agendas.filter((item) => {
    return (
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.organizer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const countMendesak = announcements.filter((a) => a.priority === 'mendesak').length;
  const countPenting = announcements.filter((a) => a.priority === 'penting').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Bell className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Pengumuman Resmi & Agenda Desa
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Kelola maklumat penting, siaran edaran darurat, dan kalender kegiatan aparatur bersama warga.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeSubTab === 'announcements' ? (
              <button
                onClick={openAddAnnouncement}
                className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Pengumuman Baru</span>
              </button>
            ) : (
              <button
                onClick={openAddAgenda}
                className="px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Agenda Kegiatan</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-2 pt-4">
          <button
            onClick={() => setActiveSubTab('announcements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'announcements'
                ? 'bg-amber-500/15 text-amber-900 border border-amber-300 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-600" />
            <span>Pengumuman Resmi ({announcements.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('agendas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'agendas'
                ? 'bg-emerald-500/15 text-emerald-900 border border-emerald-300 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <span>Agenda Kegiatan ({agendas.length})</span>
          </button>
        </div>

        {/* Toolbar & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 mt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder={
                activeSubTab === 'announcements'
                  ? 'Cari judul atau isi maklumat pengumuman...'
                  : 'Cari agenda, lokasi, atau koordinator...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
          </div>

          {activeSubTab === 'announcements' && (
            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 font-medium"
              >
                <option value="all">Semua Prioritas</option>
                <option value="mendesak">Mendesak ({countMendesak})</option>
                <option value="penting">Penting ({countPenting})</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* SUBTAB 1: PENGUMUMAN RESMI */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Tidak ada pengumuman yang cocok</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Belum ada data pengumuman aktif atau hasil pencarian tidak ditemukan.
              </p>
              <button
                onClick={openAddAnnouncement}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Pengumuman Baru</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAnnouncements.map((item) => {
                const isUrgent = item.priority === 'mendesak';
                const isImportant = item.priority === 'penting';

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${
                      isUrgent
                        ? 'border-rose-300 hover:border-rose-500 bg-linear-to-br from-rose-50/40 to-white'
                        : isImportant
                        ? 'border-amber-300 hover:border-amber-500 bg-linear-to-br from-amber-50/40 to-white'
                        : 'border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Priority and Status Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg shadow-2xs ${
                              isUrgent
                                ? 'bg-rose-600 text-white'
                                : isImportant
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {item.priority}
                          </span>

                          {item.isActive ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Aktif
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              Non-aktif
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span>Masa Berlaku: {item.validUntil ? new Date(item.validUntil).toLocaleDateString('id-ID') : '-'}</span>
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-900 leading-snug">
                        {item.title}
                      </h3>

                      {/* Content */}
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-line">
                        {item.content}
                      </p>

                      {/* Attachment if present */}
                      {item.attachmentName && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] border border-slate-200">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate max-w-[220px]">{item.attachmentName}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Dipublikasi: {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('id-ID') : 'Terbaru'}
                      </span>

                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => openEditAnnouncement(item)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Edit Pengumuman"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              type: 'announcement',
                              id: item.id,
                              title: item.title
                            })
                          }
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                          title="Hapus Pengumuman"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: AGENDA KEGIATAN */}
      {activeSubTab === 'agendas' && (
        <div className="space-y-4">
          {filteredAgendas.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CalendarDays className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Tidak ada agenda kegiatan</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Jadwalkan rapat desa, gotong royong, atau posyandu dengan tombol di bawah.
              </p>
              <button
                onClick={openAddAgenda}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Agenda Kegiatan</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgendas.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:border-emerald-400 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {item.status.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{item.date}</span>
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.title}
                    </h3>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Koordinator: {item.organizer}</span>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 pt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end space-x-1.5">
                    <button
                      onClick={() => openEditAgenda(item)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Edit Agenda"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'agenda',
                          id: item.id,
                          title: item.title
                        })
                      }
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                      title="Hapus Agenda"
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

      {/* MODAL: FORM PENGUMUMAN */}
      {isAnnModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAnnModalOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Bell className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingAnn ? 'Edit Pengumuman Resmi' : 'Buat Pengumuman Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Maklumat resmi akan langsung tayang di beranda dan halaman pengumuman warga.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAnnModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Judul Pengumuman</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jadwal Pelayanan Posyandu Balita Serentak Bulan September 2026"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tingkat Prioritas</label>
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="normal">🟢 Normal (Informasi Rutin)</option>
                    <option value="penting">🟡 Penting (Perhatian Warga)</option>
                    <option value="mendesak">🔴 Mendesak (Siaran Darurat / Waspada)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Masa Berlaku Hingga</label>
                  <input
                    type="text"
                    placeholder="Contoh: 15 Oktober 2026"
                    value={annValidUntil}
                    onChange={(e) => setAnnValidUntil(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Isi Maklumat / Pesan Pengumuman</span>
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Tuliskan isi pengumuman secara jelas dan terperinci..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Nama Dokumen Lampiran (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Surat_Edaran_Bupati_No_12_2026.pdf"
                  value={annAttachmentName}
                  onChange={(e) => setAnnAttachmentName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">Status Aktif</div>
                  <div className="text-[11px] text-slate-500">
                    Aktifkan agar tampil di portal warga.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={annIsActive}
                  onChange={(e) => setAnnIsActive(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded-sm focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAnnModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingAnn ? 'Simpan Perubahan' : 'Terbitkan Pengumuman'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FORM AGENDA */}
      {isAgendaModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAgendaModalOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CalendarDays className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingAgenda ? 'Edit Agenda Kegiatan' : 'Tambah Agenda Kegiatan Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Jadwal kegiatan publik atau kedinasan desa.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAgendaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Nama Kegiatan / Agenda</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Musyawarah Dusun II Penetapan Usulan RKPDes 2027"
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tanggal Pelaksanaan</label>
                  <input
                    type="date"
                    required
                    value={agendaDate}
                    onChange={(e) => setAgendaDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Waktu / Pukul</label>
                  <input
                    type="text"
                    placeholder="Contoh: 09:00 WIB - Selesai"
                    value={agendaTime}
                    onChange={(e) => setAgendaTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Lokasi Acara</label>
                  <input
                    type="text"
                    placeholder="Contoh: Balai Pertemuan Kantor Desa"
                    value={agendaLocation}
                    onChange={(e) => setAgendaLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Penyelenggara / PJ</label>
                  <input
                    type="text"
                    placeholder="Contoh: BPD & Tim Penyusun RKPDes"
                    value={agendaOrganizer}
                    onChange={(e) => setAgendaOrganizer(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Status Agenda</label>
                <select
                  value={agendaStatus}
                  onChange={(e) => setAgendaStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="akan_datang">Akan Datang</option>
                  <option value="berlangsung">Sedang Berlangsung</option>
                  <option value="selesai">Selesai</option>
                  <option value="dibatalkan">Dibatalkan</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Deskripsi / Catatan Tambahan</label>
                <textarea
                  rows={3}
                  placeholder="Keterangan tambahan mengenai undangan, pakaian, atau agenda..."
                  value={agendaDescription}
                  onChange={(e) => setAgendaDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgendaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingAgenda ? 'Simpan Perubahan' : 'Jadwalkan Agenda'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setDeleteConfirm(null)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                {deleteConfirm.type === 'announcement'
                  ? 'Hapus Pengumuman Ini?'
                  : 'Hapus Agenda Ini?'}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2">
                "{deleteConfirm.title}"
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteAction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
