import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { NewsItem } from '../../types';
import { api } from '../../services/api';
import { uploadImageService } from '../../services/uploadService';
import {
  Newspaper,
  Plus,
  Edit,
  Trash2,
  Search,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Calendar,
  User,
  Eye,
  X,
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  BadgeCheck,
  Layers,
  Filter
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { value: 'pemerintahan', label: 'Pemerintahan Desa' },
  { value: 'pembangunan', label: 'Pembangunan & Sarana' },
  { value: 'kemasyarakatan', label: 'Kemasyarakatan & Sosial' },
  { value: 'pertanian', label: 'Pertanian & Perkebunan' },
  { value: 'kesehatan', label: 'Kesehatan & Posyandu' },
  { value: 'budaya', label: 'Adat & Budaya Lokal' }
];

const PHOTO_PRESETS = [
  {
    label: 'Pertanian & Karet',
    url: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Rapat / Musyawarah',
    url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Pembangunan Fisik',
    url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Kesehatan & Posyandu',
    url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'UMKM & Kerajinan',
    url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&auto=format&fit=crop&q=80'
  }
];

export const NewsManager: React.FC = () => {
  const { news, addNewsItem, updateNewsItem, deleteNewsItem, currentUser, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsItem | null>(null);
  const [previewArticle, setPreviewArticle] = useState<NewsItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Field States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('pemerintahan');
  const [author, setAuthor] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [useManualUrl, setUseManualUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAddModal = () => {
    setEditingArticle(null);
    setTitle('');
    setCategory('pemerintahan');
    setAuthor(currentUser?.name || 'Pemerintah Desa Pulau Betung');
    setPublishedAt(new Date().toISOString().substring(0, 10));
    setSummary('');
    setContent('');
    setCoverImage('https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80');
    setIsPublished(true);
    setUploadError('');
    setUseManualUrl(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: NewsItem) => {
    setEditingArticle(item);
    setTitle(item.title);
    setCategory(item.category || 'pemerintahan');
    setAuthor(item.author || currentUser?.name || 'Admin Desa');
    setPublishedAt(item.publishedAt || new Date().toISOString().substring(0, 10));
    setSummary(item.summary || '');
    setContent(item.content || '');
    setCoverImage(item.coverImage || '');
    setIsPublished(item.isPublished !== false);
    setUploadError('');
    setUseManualUrl(false);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Berkas harus berupa gambar (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran gambar maksimal 5 MB.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const result = await uploadImageService(file);
      if (result.success && result.url) {
        setCoverImage(result.url);
        if (result.isLocalFallback) {
          addToast('success', 'Foto Berhasil Dimuat', 'Gambar cover berita dimuat ke formulir (Mode Lokal).');
        } else {
          addToast('success', 'Foto Berhasil Diunggah', 'Gambar cover berita berhasil diunggah ke server.');
        }
      } else {
        setUploadError(result.error || 'Gagal memproses berkas gambar.');
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err) || 'Gagal mengunggah foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast('error', 'Validasi Gagal', 'Judul berita wajib diisi.');
      return;
    }

    if (!summary.trim()) {
      addToast('error', 'Validasi Gagal', 'Ringkasan berita wajib diisi.');
      return;
    }

    if (!content.trim()) {
      addToast('error', 'Validasi Gagal', 'Isi berita lengkap wajib diisi.');
      return;
    }

    const finalImage = coverImage.trim() || 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80';
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

    if (editingArticle) {
      updateNewsItem(editingArticle.id, {
        title: title.trim(),
        slug: `${slug}-${editingArticle.id.slice(-4)}`,
        category,
        author: author.trim() || 'Admin Desa',
        publishedAt: publishedAt || new Date().toISOString().substring(0, 10),
        summary: summary.trim(),
        content: content.trim(),
        coverImage: finalImage,
        isPublished
      });
      addToast('success', 'Berita Diperbarui', `Artikel "${title.trim()}" berhasil disimpan.`);
    } else {
      addNewsItem({
        title: title.trim(),
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        category,
        author: author.trim() || 'Admin Desa',
        publishedAt: publishedAt || new Date().toISOString().substring(0, 10),
        summary: summary.trim(),
        content: content.trim(),
        coverImage: finalImage,
        isPublished
      });
      addToast('success', 'Berita Diterbitkan', `Artikel "${title.trim()}" berhasil ditambahkan ke portal.`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteNewsItem(id);
    setDeleteConfirmId(null);
    addToast('info', 'Berita Dihapus', 'Artikel berita telah dihapus dari sistem.');
  };

  // Filtered List
  const filteredNews = news.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      selectedCategoryFilter === 'all' ||
      item.category?.toLowerCase() === selectedCategoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'published' && item.isPublished !== false) ||
      (statusFilter === 'draft' && item.isPublished === false);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPublished = news.filter((n) => n.isPublished !== false).length;
  const totalDraft = news.filter((n) => n.isPublished === false).length;
  const totalViews = news.reduce((acc, n) => acc + (n.views || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <Newspaper className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Manajemen Berita & Warta Desa
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Kelola publikasi berita resmi, liputan pembangunan, dan kegiatan kemasyarakatan Desa Pulau Betung.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="px-5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Berita Baru</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500">Total Artikel</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{news.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60">
            <div className="text-[11px] font-semibold text-emerald-700">Sudah Terbit</div>
            <div className="text-xl font-extrabold text-emerald-900 mt-0.5">{totalPublished}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60">
            <div className="text-[11px] font-semibold text-amber-700">Draf / Simpanan</div>
            <div className="text-xl font-extrabold text-amber-900 mt-0.5">{totalDraft}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/60">
            <div className="text-[11px] font-semibold text-blue-700">Total Pembaca</div>
            <div className="text-xl font-extrabold text-blue-900 mt-0.5">{totalViews}</div>
          </div>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-5 mt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari judul berita, ringkasan, atau penulis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700 font-medium"
            >
              <option value="all">Semua Kategori</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 text-slate-700 font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="published">Hanya Terbit</option>
              <option value="draft">Hanya Draf</option>
            </select>
          </div>
        </div>
      </div>

      {/* News Cards Grid */}
      {filteredNews.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Newspaper className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Tidak ada berita yang sesuai</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Coba sesuaikan kata kunci pencarian atau buat berita baru dengan tombol di atas.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Berita Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNews.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
            >
              <div>
                {/* Cover Image Container */}
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={
                      item.coverImage?.trim()
                        ? item.coverImage
                        : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'
                    }
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-950/80 text-white backdrop-blur shadow-sm">
                      {item.category || 'Berita'}
                    </span>
                    {item.isPublished === false && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-500 text-white shadow-sm">
                        Draf
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur text-white text-[10px] flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>{item.views || 0}</span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('id-ID') : '-'}</span>
                    <span>•</span>
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[120px]">{item.author}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-800 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  onClick={() => setPreviewArticle(item)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Pratinjau</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors"
                    title="Edit Berita"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(item.id)}
                    className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors"
                    title="Hapus Berita"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: TAMBAH / EDIT BERITA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Newspaper className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingArticle ? 'Edit Berita & Warta Desa' : 'Tambah Berita Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Lengkapi judul, ringkasan, foto cover, dan naskah lengkap artikel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Judul Berita */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Judul Berita</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Penyaluran Bantuan Bibit Karet Unggul PB-260 Untuk Kelompok Tani"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
                />
              </div>

              {/* Kategori, Penulis, Tanggal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Kategori Berita</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nama Penulis / Editor</label>
                  <input
                    type="text"
                    placeholder="Nama Aparat / Editor"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tanggal Terbit</label>
                  <input
                    type="date"
                    value={publishedAt}
                    onChange={(e) => setPublishedAt(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* UPLOAD FOTO COVER BERITA (REQUESTED FEATURE) */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>Foto Cover / Thumbnail Berita</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseManualUrl(!useManualUrl)}
                    className="text-[11px] text-emerald-700 font-semibold hover:underline"
                  >
                    {useManualUrl ? '← Gunakan Unggah Berkas' : 'Gunakan Tautan URL / Preset →'}
                  </button>
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Upload File Box */}
                {!useManualUrl ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />

                    {coverImage ? (
                      <div className="relative rounded-2xl overflow-hidden border border-slate-300 bg-white p-2">
                        <div className="relative h-44 w-full rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center">
                          <img
                            src={coverImage}
                            alt="Pratinjau Cover"
                            className="w-full h-full object-cover"
                          />
                          {isUploading && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-2">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                              <span>Sedang mengunggah gambar ke server...</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 px-1">
                          <span className="text-[11px] text-slate-500 truncate max-w-[280px]">
                            {coverImage.startsWith('data:')
                              ? 'Gambar Berkas Tersimpan'
                              : coverImage}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                            >
                              Ganti Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => setCoverImage('')}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center bg-white cursor-pointer transition-colors"
                      >
                        {isUploading ? (
                          <div className="py-4 space-y-2 flex flex-col items-center">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                            <p className="text-xs font-bold text-slate-700">
                              Mengunggah foto ke server...
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 flex flex-col items-center">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                              <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                              Klik untuk pilih foto atau seret foto ke sini
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Format: JPG, PNG, WEBP (Maksimal 5 MB)
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual URL Input + Presets */
                  <div className="space-y-3">
                    <input
                      type="url"
                      placeholder="https://example.com/foto-berita.jpg"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />

                    {/* Quick Preset Selector */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3 text-amber-500" />
                        <span>Atau pilih preset foto desa berkualitas tinggi:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PHOTO_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setCoverImage(p.url)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              coverImage === p.url
                                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Ringkasan Berita */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Ringkasan Singkat (Lead Paragraph)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {summary.length} karakter
                  </span>
                </div>
                <textarea
                  required
                  rows={2}
                  placeholder="Kutipan ringkas 1-2 kalimat pengantar yang akan tampil pada kartu beranda warga..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                />
              </div>

              {/* Isi Berita Lengkap */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Isi Berita Lengkap</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {content.trim() ? content.trim().split(/\s+/).length : 0} kata
                  </span>
                </div>
                <textarea
                  required
                  rows={7}
                  placeholder="Tuliskan berita lengkap di sini (latar belakang, kutipan narasumber, kronologi kegiatan, dan penutup)..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed font-sans"
                />
              </div>

              {/* Status Publikasi */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900">Status Publikasi</div>
                  <div className="text-[11px] text-slate-500">
                    {isPublished
                      ? 'Artikel akan langsung dapat dibaca oleh seluruh masyarakat.'
                      : 'Artikel disimpan sebagai draf rahasia (hanya tampak di panel admin).'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingArticle ? 'Simpan Perubahan' : 'Terbitkan Berita'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRATINJAU ARTIKEL */}
      {previewArticle && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setPreviewArticle(null)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">Pratinjau Tampilan Berita</span>
              </div>
              <button
                onClick={() => setPreviewArticle(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="relative h-60 w-full rounded-2xl overflow-hidden bg-slate-100">
                <img
                  src={
                    previewArticle.coverImage?.trim()
                      ? previewArticle.coverImage
                      : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'
                  }
                  alt={previewArticle.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-950/80 text-white backdrop-blur">
                  {previewArticle.category}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{previewArticle.publishedAt ? new Date(previewArticle.publishedAt).toLocaleDateString('id-ID') : '-'}</span>
                <span>•</span>
                <User className="w-3.5 h-3.5" />
                <span>{previewArticle.author}</span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
                {previewArticle.title}
              </h2>

              <p className="text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed italic">
                "{previewArticle.summary}"
              </p>

              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pt-2">
                {previewArticle.content}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setPreviewArticle(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setDeleteConfirmId(null)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Hapus Artikel Berita?</h3>
              <p className="text-xs text-slate-500">
                Tindakan ini tidak dapat dibatalkan. Berita yang dihapus tidak akan tampil lagi di portal publik.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                Ya, Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
