import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { NewsArticle, NewsComment } from '../../types';
import {
  Newspaper,
  Calendar,
  User,
  Search,
  Share2,
  ChevronRight,
  Eye,
  Tag,
  ArrowLeft,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Send,
  MessageCircle
} from 'lucide-react';

interface CategoryOption {
  id: string;
  label: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'Semua Kategori' },
  { id: 'pemerintahan', label: 'Pemerintahan' },
  { id: 'pembangunan', label: 'Pembangunan' },
  { id: 'kemasyarakatan', label: 'Kegiatan Warga' },
  { id: 'pertanian', label: 'Pertanian & Perkebunan' },
  { id: 'kesehatan', label: 'Kesehatan' },
  { id: 'budaya', label: 'Adat & Budaya' }
];

export const NewsView: React.FC = () => {
  const { news, likeNewsArticle, addNewsComment, likeNewsComment, addToast, villageProfile, selectedNewsId, setSelectedNewsId } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [readingArticle, setReadingArticle] = useState<NewsArticle | null>(null);

  // Comment Form state
  const [authorName, setAuthorName] = useState('');
  const [authorNik, setAuthorNik] = useState('');
  const [commentContent, setCommentContent] = useState('');

  // Handle auto-opening article from context (e.g., navigated from Home/Search)
  React.useEffect(() => {
    if (selectedNewsId && news) {
      const found = news.find(n => n.id === selectedNewsId);
      if (found) {
        setReadingArticle(found);
        // Clear it so it doesn't reopen if user closes modal
        setSelectedNewsId(null);
      }
    }
  }, [selectedNewsId, news, setSelectedNewsId]);

  // Sync current reading article with latest context state
  const currentReadingArticle = readingArticle
    ? (news || []).find((n) => n.id === readingArticle.id) || readingArticle
    : null;

  const filteredNews = (news || []).filter((item) => {
    if (!item) return false;
    const itemCat = (item.category || '').toLowerCase();
    const targetCat = selectedCat.toLowerCase();
    const matchesCat =
      selectedCat === 'all' ||
      itemCat === targetCat ||
      itemCat.includes(targetCat) ||
      (selectedCat === 'kemasyarakatan' && (itemCat.includes('sosial') || itemCat.includes('warga')));

    const searchLower = (search || '').toLowerCase();
    const matchesSearch =
      (item.title || '').toLowerCase().includes(searchLower) ||
      (item.summary || '').toLowerCase().includes(searchLower) ||
      (item.content || '').toLowerCase().includes(searchLower);

    return matchesCat && matchesSearch;
  });

  const handleShare = (article: NewsArticle) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      addToast('info', 'Tautan Disalin', `Tautan berita "${article.title}" berhasil disalin ke papan klip.`);
    }
  };

  const handleLikeArticle = (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    const isNowLiked = likeNewsArticle(articleId);
    if (isNowLiked) {
      addToast('success', 'Disukai', 'Terima kasih atas apresiasi Anda terhadap warta berita desa.');
    } else {
      addToast('info', 'Batal Suka', 'Suka pada warta berita desa telah dibatalkan.');
    }
  };

  const handleLikeComment = (articleId: string, commentId: string) => {
    const isNowLiked = likeNewsComment(articleId, commentId);
    if (isNowLiked) {
      addToast('info', 'Suka Komentar', 'Anda menyukai komentar pembaca ini.');
    } else {
      addToast('info', 'Batal Suka Komentar', 'Suka pada komentar dibatalkan.');
    }
  };

  const handleAutofillSampleNik = () => {
    setAuthorName('Samsul Bahri (Warga RT 03)');
    setAuthorNik('1504011205880001');
    addToast('info', 'NIK Sampel Terisi', 'Identitas NIK sampel warga terdaftar berhasil diisikan.');
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentReadingArticle || !commentContent.trim()) return;

    let maskedNik: string | undefined = undefined;
    let isVerified = false;

    // Check optional NIK
    const cleanNik = authorNik.replace(/\D/g, '');
    if (cleanNik.length === 16) {
      maskedNik = `${cleanNik.slice(0, 6)}******${cleanNik.slice(12)}`;
      isVerified = true;
    } else if (cleanNik.length > 0 && cleanNik.length !== 16) {
      addToast(
        'warning',
        'Format NIK Tidak Sesuai',
        'NIK yang Anda masukkan bukan 16 digit. Komentar akan dikirim sebagai Pembaca Umum tanpa lencana terverifikasi.'
      );
    }

    addNewsComment(currentReadingArticle.id, {
      authorName: authorName.trim() || (isVerified ? 'Warga Terdaftar' : 'Pembaca Umum'),
      authorNikMasked: maskedNik,
      isVerifiedResident: isVerified,
      content: commentContent.trim()
    });

    addToast(
      'success',
      isVerified ? 'Komentar Terverifikasi NIK Terkirim' : 'Komentar Terkirim',
      isVerified
        ? 'Komentar Anda terkirim dengan lencana Warga Terdaftar Desa.'
        : 'Terima kasih atas partisipasi dan masukan Anda pada warta berita ini.'
    );

    setCommentContent('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Warta & Informasi Terkini
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Kabar Berita {villageProfile.villageName || 'Desa'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
            Liputan resmi kegiatan kemasyarakatan, kebijakan pemerintah desa, penyaluran program bantuan, serta capaian pembangunan.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari judul berita..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              selectedCat === cat.id
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((article) => {
          const articleCommentsCount = article.comments?.length || 0;
          const likesCount = article.likesCount || 0;

          return (
            <article
              key={article.id}
              onClick={() => setReadingArticle(article)}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                  <img
                    src={article.coverImage?.trim() ? article.coverImage : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'}
                    alt={article.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg bg-emerald-950/80 text-white backdrop-blur">
                    {article.category}
                  </span>
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{article.publishedAt}</span>
                    <span>•</span>
                    <span>{article.author}</span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug line-clamp-2">
                    {article.title}
                  </h3>

                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>
              </div>

              {/* Card Footer with Likes and Comments Counters */}
              <div className="p-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 mt-2">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={(e) => handleLikeArticle(e, article.id)}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Suka ({likesCount})</span>
                  </button>
                  <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                    <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>{articleCommentsCount}</span>
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(article);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Bagikan Tautan"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <span className="text-emerald-700 font-bold flex items-center space-x-0.5">
                    <span>Baca</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {filteredNews.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-bold text-sm">Tidak ada berita yang sesuai</p>
          <p className="text-slate-400 text-xs mt-1">Coba kata kunci lain atau pilih kategori Semua Kategori.</p>
        </div>
      )}

      {/* Reader Modal */}
      {currentReadingArticle && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setReadingArticle(null)}
          />

          <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header Bar */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                onClick={() => setReadingArticle(null)}
                className="flex items-center space-x-1 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Daftar Berita</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => handleLikeArticle(e, currentReadingArticle.id)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Suka ({currentReadingArticle.likesCount || 0})</span>
                </button>
                <button
                  onClick={() => handleShare(currentReadingArticle)}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-emerald-800 text-xs font-semibold flex items-center space-x-1 shadow-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bagikan</span>
                </button>
              </div>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="p-6 sm:p-10 overflow-y-auto space-y-6">
              <div className="space-y-3">
                <span className="px-2.5 py-1 text-[11px] font-bold uppercase rounded-lg bg-emerald-100 text-emerald-800">
                  {currentReadingArticle.category}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                  {currentReadingArticle.title}
                </h1>
                <div className="flex items-center space-x-3 text-xs text-slate-500">
                  <span>Oleh: <strong>{currentReadingArticle.author}</strong></span>
                  <span>•</span>
                  <span>Diterbitkan: {currentReadingArticle.publishedAt}</span>
                </div>
              </div>

              {/* Cover Image */}
              <div className="rounded-2xl overflow-hidden bg-slate-100 max-h-96">
                <img
                  src={currentReadingArticle.coverImage?.trim() ? currentReadingArticle.coverImage : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'}
                  alt={currentReadingArticle.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Article Text Content */}
              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 leading-relaxed space-y-4 font-normal">
                {(currentReadingArticle.content || currentReadingArticle.summary || 'Isi teks warta berita ini belum tersedia atau sedang disinkronisasikan oleh pengelola admin desa.')
                  .split('\n\n')
                  .map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
              </div>

              {/* Tags */}
              {Array.isArray(currentReadingArticle.tags) && currentReadingArticle.tags.length > 0 && (
                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
                  {currentReadingArticle.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Tanggapan & Komentar Pembaca */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-700" />
                    <span>Diskusi & Komentar Pembaca ({currentReadingArticle.comments?.length || 0})</span>
                  </h3>
                </div>

                {/* List of Comments */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {(!currentReadingArticle.comments || currentReadingArticle.comments.length === 0) ? (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                      Belum ada komentar pada warta ini. Berikan masukan atau tanggapan Anda pertama kali.
                    </div>
                  ) : (
                    currentReadingArticle.comments.map((cm) => (
                      <div
                        key={cm.id}
                        className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{cm.authorName}</span>
                            {cm.authorNikMasked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>NIK Terverifikasi ({cm.authorNikMasked})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                                💬 Pembaca Umum
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{cm.createdAt}</span>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{cm.content}</p>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleLikeComment(currentReadingArticle.id, cm.id)}
                            className="inline-flex items-center space-x-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200 cursor-pointer"
                          >
                            <ThumbsUp className="w-3 h-3 text-blue-600" />
                            <span>Suka ({cm.likesCount || 0})</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Form Komentar Warta Berita (NIK Opsional) */}
                <form onSubmit={handleSubmitComment} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-700" />
                        <span>Formulir Tanggapan Berita</span>
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tuliskan komentar Anda. NIK bersifat opsional (isi NIK 16 digit jika ingin ditandai sebagai Warga Terdaftar).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutofillSampleNik}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      💡 NIK Sampel Warga
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nama Lengkap Anda / Pembaca"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      maxLength={16}
                      placeholder="NIK KTP (Opsional - 16 Digit)"
                      value={authorNik}
                      onChange={(e) => setAuthorNik(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <textarea
                    required
                    rows={2}
                    placeholder="Tulis tanggapan atau masukan Anda terkait warta berita ini..."
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-emerald-800 shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Tanggapan</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
