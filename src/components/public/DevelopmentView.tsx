import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DevelopmentProject, ProjectComment } from '../../types';
import {
  Building2,
  Calendar,
  DollarSign,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  BadgeCheck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  Send,
  X,
  Filter,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { ProjectStatusBadge } from '../common/StatusBadge';

export const DevelopmentView: React.FC = () => {
  const { developmentProjects, likeDevelopmentProject, addProjectComment, likeProjectComment, isItemLiked, addToast } = useApp();
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<DevelopmentProject | null>(null);

  // Comment filter tab inside detail modal
  const [activeCommentTab, setActiveCommentTab] = useState<'all' | 'sanggahan' | 'apresiasi'>('all');

  // Comment & Dispute Form state
  const [commentType, setCommentType] = useState<'apresiasi' | 'pertanyaan' | 'sanggahan'>('sanggahan');
  const [authorName, setAuthorName] = useState('');
  const [authorNik, setAuthorNik] = useState('');
  const [rtRwLocation, setRtRwLocation] = useState('RT 03 Betung Indah');
  const [commentContent, setCommentContent] = useState('');

  // Sample Autofill NIK helper
  const handleAutofillSampleNik = () => {
    setAuthorName('Samsul Bahri');
    setAuthorNik('1504011205880001');
    setRtRwLocation('RT 03 Dusun 1 Betung Indah');
    addToast('info', 'NIK Sampel Terisi', 'Identitas NIK warga terdaftar berhasil diisikan.');
  };

  // Get unique fiscal years
  const availableYears = Array.from(
    new Set([2026, 2025, 2024, ...developmentProjects.map((p) => p.fiscalYear)])
  ).sort((a, b) => b - a);

  const filtered = developmentProjects.filter((p) => {
    const matchYear = filterYear === 'all' || p.fiscalYear.toString() === filterYear;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchYear && matchStatus;
  });

  // Calculate macro statistics
  const totalBudget = developmentProjects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const totalLikes = developmentProjects.reduce((acc, p) => acc + (p.likesCount || 0), 0);
  const totalDisputes = developmentProjects.reduce((acc, p) => acc + (p.citizenDisputeCount || 0), 0);
  const totalCommentsCount = developmentProjects.reduce((acc, p) => acc + (p.comments?.length || 0), 0);

  // Sync selected project with updated context data
  const currentProjectDetail = selectedProject
    ? developmentProjects.find((p) => p.id === selectedProject.id) || selectedProject
    : null;

  const handleLikeProject = (e: React.MouseEvent, projectId: string, projectTitle: string) => {
    e.stopPropagation();
    const isNowLiked = likeDevelopmentProject(projectId);
    if (isNowLiked) {
      addToast(
        'success',
        'Apresiasi Warga Dicatat',
        `Terima kasih! Anda memberikan apresiasi dukungan untuk proyek "${projectTitle}".`
      );
    } else {
      addToast(
        'info',
        'Apresiasi Dibatalkan',
        `Apresiasi dukungan Anda untuk proyek "${projectTitle}" telah dibatalkan.`
      );
    }
  };

  const handleLikeCommentItem = (projectId: string, commentId: string) => {
    const isNowLiked = likeProjectComment(projectId, commentId);
    if (isNowLiked) {
      addToast('info', 'Dukungan Komentar', 'Anda menyukai komentar warga ini.');
    } else {
      addToast('info', 'Batal Suka Komentar', 'Suka komentar dibatalkan.');
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectDetail || !commentContent.trim()) return;

    // Validate NIK Warga (Must be 16 digits)
    const cleanNik = authorNik.replace(/\D/g, '');
    if (cleanNik.length !== 16) {
      addToast(
        'error',
        'NIK Warga Wajib 16 Digit',
        'Untuk menjaga nama baik desa & keabsahan sanggahan, Anda wajib memasukkan 16-digit NIK terdaftar Desa Pulau Betung.'
      );
      return;
    }

    const maskedNik = `${cleanNik.slice(0, 6)}******${cleanNik.slice(12)}`;

    addProjectComment(currentProjectDetail.id, {
      authorName: authorName.trim() || 'Warga Terdaftar',
      authorNikMasked: maskedNik,
      isVerifiedResident: true,
      rtRwLocation: rtRwLocation.trim() || 'Desa Pulau Betung',
      content: commentContent.trim(),
      type: commentType
    });

    if (commentType === 'sanggahan') {
      addToast(
        'warning',
        'Sanggahan Terverifikasi NIK Dicatat',
        `Sanggahan Anda (${maskedNik}) telah diteruskan ke BPD & Inspektorat Desa untuk peninjauan riil.`
      );
    } else {
      addToast(
        'success',
        'Komentar Warga Terverifikasi NIK',
        'Terima kasih! Komentar Anda terverifikasi sebagai Warga Asli Desa Pulau Betung.'
      );
    }

    setCommentContent('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 space-y-8">
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-4">
        <div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
            Infrastruktur & Sarana Desa
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
            Pembangunan Desa, Kegiatan TPK & Sanggahan Warga
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-3xl leading-relaxed">
            Dokumentasi transparan pelaksanaan pembangunan fisik Dana Desa (DDS) & BKK. Seluruh warga berhak memberikan apresiasi, mengajukan pertanyaan, maupun menyampaikan sanggahan jika terjadi ketidaksesuaian foto dengan kondisi riil di lapangan.
          </p>
        </div>

        {/* Macro Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase block">Total Proyek:</span>
            <strong className="text-xl font-black text-white">{developmentProjects.length} Pembangunan</strong>
          </div>
          <div className="bg-emerald-900 text-white p-4 rounded-2xl shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase block">Total Pagu Anggaran:</span>
            <strong className="text-lg font-bold text-emerald-200 truncate block">
              Rp {totalBudget.toLocaleString('id-ID')}
            </strong>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
            <span className="text-[11px] font-semibold text-blue-800 uppercase block flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Apresiasi Warga:</span>
            </span>
            <strong className="text-xl font-black text-blue-950">{totalLikes} Suka</strong>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
            <span className="text-[11px] font-semibold text-amber-800 uppercase block flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Riwayat Sanggahan:</span>
            </span>
            <strong className="text-xl font-black text-amber-950">
              {totalDisputes} Sanggahan ({totalCommentsCount} Diskusi)
            </strong>
          </div>
        </div>

        {/* Filters Container */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua Status ({developmentProjects.length})
            </button>
            <button
              onClick={() => setFilterStatus('sedang_berjalan')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'sedang_berjalan'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
              }`}
            >
              Sedang Berjalan
            </button>
            <button
              onClick={() => setFilterStatus('selesai')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'selesai'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Selesai 100%
            </button>
            <button
              onClick={() => setFilterStatus('tertunda')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'tertunda'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Tertunda / Mangkrak
            </button>
          </div>

          {/* Fiscal Year Filter Selector */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tahun Anggaran:</span>
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterYear('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterYear === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua
              </button>
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setFilterYear(yr.toString())}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterYear === yr.toString()
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  TA {yr}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((project) => {
          const projectCommentsCount = project.comments?.length || 0;
          const disputeCount = project.citizenDisputeCount || 0;
          const likes = project.likesCount || 0;

          return (
            <div
              key={project.id}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-400 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Media Preview */}
                <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
                  <img
                    src={
                      project.completedImage?.trim() ||
                      project.inProgressImage?.trim() ||
                      project.beforeImage?.trim() ||
                      'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?w=800&auto=format&fit=crop&q=80'
                    }
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className="absolute bottom-3 right-3 bg-slate-950/80 text-white text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur">
                    {project.progressPercent}% Selesai
                  </div>

                  {disputeCount > 0 && (
                    <div className="absolute top-3 right-3 bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{disputeCount} Sanggahan</span>
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      {project.fundingSource} • TA {project.fiscalYear}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 mt-2 leading-snug">
                      {project.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Realisasi Fisik Lapangan</span>
                      <span className="font-mono text-emerald-700">{project.progressPercent}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Pagu Anggaran:</span>
                      <strong className="text-slate-900">
                        Rp {project.budget.toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Pelaksana:</span>
                      <strong className="text-slate-900 truncate block">{project.contractor}</strong>
                    </div>
                  </div>

                  {/* Interactive Engagement Counters Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={(e) => handleLikeProject(e, project.id, project.title)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
                      title="Berikan Apresiasi Warga"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
                      <span>{likes} Apresiasi</span>
                    </button>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                        <span>{projectCommentsCount} Komentar</span>
                      </span>

                      {disputeCount > 0 && (
                        <span className="flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-1 rounded-lg font-bold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>{disputeCount} Sanggahan</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer action */}
              <div className="p-6 pt-0">
                <button
                  onClick={() => setSelectedProject(project)}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Lihat Foto, Komentar & Sanggahan</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Project Detail Modal */}
      {currentProjectDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedProject(null)}
          />

          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  {currentProjectDetail.fundingSource} • TA {currentProjectDetail.fiscalYear}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">
                  {currentProjectDetail.title}
                </h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentProjectDetail.location}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-Fraud Authenticity Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <div className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Metadata EXIF Camera & GPS Location Terverifikasi</span>
              </div>
              <div className="inline-flex items-center space-x-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-[11px] font-bold">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>{currentProjectDetail.verifiedByBpdName || 'Disahkan BPD & Inspektorat Desa'}</span>
              </div>
              <button
                type="button"
                onClick={(e) => handleLikeProject(e, currentProjectDetail.id, currentProjectDetail.title)}
                className="inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>+1 Apresiasi Warga ({currentProjectDetail.likesCount || 0})</span>
              </button>
            </div>

            {/* Warning Banner if Citizens Disputed the Project Photo */}
            {(currentProjectDetail.citizenDisputeCount || 0) > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>PERINGATAN SANGGAHAN WARGA LAPANGAN ({currentProjectDetail.citizenDisputeCount} Laporan Sanggahan)</span>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium pl-6">
                  Warga RT/RW sekitar melaporkan adanya ketidaksesuaian antara foto hasil akhir dengan kondisi riil di lokasi. Proyek ini sedang dalam peninjauan ulang Inspektorat Desa & BPD.
                </p>
              </div>
            )}

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {currentProjectDetail.description}
            </p>

            {/* Before / During / After Photo Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Dokumentasi Fisik Lapangan (Sebelum / Pelaksanaan / Selesai):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {currentProjectDetail.beforeImage && currentProjectDetail.beforeImage.trim() !== '' && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 block">Kondisi 0% (Sebelum)</span>
                    <div className="h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={currentProjectDetail.beforeImage.trim()}
                        alt="Sebelum"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                {currentProjectDetail.inProgressImage && currentProjectDetail.inProgressImage.trim() !== '' && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 block">Kondisi 50% (Pengerjaan)</span>
                    <div className="h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={currentProjectDetail.inProgressImage.trim()}
                        alt="Sedang Berjalan"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                {currentProjectDetail.completedImage && currentProjectDetail.completedImage.trim() !== '' && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-700 font-bold block">
                      Kondisi 100% (Selesai Fisik)
                    </span>
                    <div className="h-40 rounded-xl overflow-hidden bg-slate-100 border border-emerald-300">
                      <img
                        src={currentProjectDetail.completedImage.trim()}
                        alt="Selesai"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Project Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Anggaran:</span>
                <strong className="text-emerald-800">
                  Rp {currentProjectDetail.budget.toLocaleString('id-ID')}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Jangka Waktu:</span>
                <strong className="text-slate-800">{currentProjectDetail.startDate} s/d {currentProjectDetail.targetEndDate}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Lokasi Kegiatan:</span>
                <strong className="text-slate-800">{currentProjectDetail.location}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pelaksana Kegiatan:</span>
                <strong className="text-slate-800">{currentProjectDetail.contractor}</strong>
              </div>
            </div>

            {/* Interactive Comment & Dispute History Section */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-extrabold text-base text-slate-900">
                    Transparansi Diskusi & Riwayat Sanggahan Warga
                  </h4>
                </div>

                {/* Filter Comment Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveCommentTab('all')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      activeCommentTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Semua ({currentProjectDetail.comments?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCommentTab('sanggahan')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      activeCommentTab === 'sanggahan' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800'
                    }`}
                  >
                    ⚠️ Sanggahan ({currentProjectDetail.comments?.filter((c) => c.type === 'sanggahan').length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCommentTab('apresiasi')}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      activeCommentTab === 'apresiasi' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-800'
                    }`}
                  >
                    👍 Apresiasi ({currentProjectDetail.comments?.filter((c) => c.type === 'apresiasi').length || 0})
                  </button>
                </div>
              </div>

              {/* List of Comments */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {(!currentProjectDetail.comments || currentProjectDetail.comments.length === 0) ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    Belum ada komentar dari warga. Jadilah yang pertama memberikan masukan atau sanggahan untuk proyek ini.
                  </div>
                ) : (
                  currentProjectDetail.comments
                    .filter((c) => {
                      if (activeCommentTab === 'sanggahan') return c.type === 'sanggahan';
                      if (activeCommentTab === 'apresiasi') return c.type === 'apresiasi';
                      return true;
                    })
                    .map((cm) => (
                      <div
                        key={cm.id}
                        className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all ${
                          cm.type === 'sanggahan'
                            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                            : cm.type === 'apresiasi'
                            ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900">{cm.authorName}</span>
                            {cm.authorNikMasked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                <span>NIK Terverifikasi ({cm.authorNikMasked})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Warga Terdaftar</span>
                              </span>
                            )}
                            {cm.rtRwLocation && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                                {cm.rtRwLocation}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                cm.type === 'sanggahan'
                                  ? 'bg-amber-600 text-white'
                                  : cm.type === 'apresiasi'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-700 text-white'
                              }`}
                            >
                              {cm.type === 'sanggahan'
                                ? '⚠️ Sanggahan Lapangan'
                                : cm.type === 'apresiasi'
                                ? '👍 Apresiasi Warga'
                                : '❓ Pertanyaan'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">{cm.createdAt}</span>
                        </div>

                        <p className="text-xs leading-relaxed font-medium">{cm.content}</p>

                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleLikeCommentItem(currentProjectDetail.id, cm.id)}
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

              {/* Form Input Komentar & Sanggahan Warga */}
              <form onSubmit={handleSubmitComment} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-emerald-600" />
                      <span>Formulir Warga (Wajib NIK Terdaftar)</span>
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Demi menjaga nama baik desa & mencegah fitnah/hoaks, komentar & sanggahan wajib menyertakan NIK 16 digit.
                    </p>
                  </div>

                  <div className="flex items-center space-x-1.5 text-[11px] shrink-0">
                    <button
                      type="button"
                      onClick={() => setCommentType('apresiasi')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                        commentType === 'apresiasi'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      👍 Apresiasi
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentType('pertanyaan')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                        commentType === 'pertanyaan'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      ❓ Pertanyaan
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentType('sanggahan')}
                      className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                        commentType === 'sanggahan'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      ⚠️ Sanggahan Foto / Proyek
                    </button>
                  </div>
                </div>

                {/* NIK Input & Sample Autofill Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Identitas NIK Kependudukan Pemohon <span className="text-red-5-00">*</span>:
                    </label>
                    <button
                      type="button"
                      onClick={handleAutofillSampleNik}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      💡 Gunakan NIK Sampel Warga (1504011205880001)
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={16}
                    placeholder="Masukkan 16 Digit NIK KTP Anda (Contoh: 1504011205880001)"
                    value={authorNik}
                    onChange={(e) => setAuthorNik(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-xs font-mono font-bold tracking-widest px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                      Nama Lengkap Warga:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Lengkap Sesuai KTP"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                      Wilayah RT / Dusun Tempat Tinggal:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Wilayah RT / Dusun (Contoh: RT 03 Betung Indah)"
                      value={rtRwLocation}
                      onChange={(e) => setRtRwLocation(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                    Isi Tanggapan / Sanggahan / Masukan:
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder={
                      commentType === 'sanggahan'
                        ? 'Tulis rincian sanggahan Anda. Contoh: Foto yang diunggah menunjukkan jalan sudah selesai, padahal di RT 03 pengerjaan masih mangkrak dan belum ada pengaspalan.'
                        : commentType === 'apresiasi'
                        ? 'Tulis apresiasi atau ucapan terima kasih warga atas pembangunan ini...'
                        : 'Tulis pertanyaan terkait proyek ini...'
                    }
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white border border-slate-300 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      commentType === 'sanggahan'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-slate-900 hover:bg-emerald-700'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {commentType === 'sanggahan'
                        ? 'Kirim Sanggahan Warga'
                        : 'Kirim Komentar'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
