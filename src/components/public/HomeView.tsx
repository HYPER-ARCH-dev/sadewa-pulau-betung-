import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  Zap,
  AlertCircle,
  BarChart3,
  Building2,
  Newspaper,
  Bell,
  Calendar,
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Download,
  Users,
  Compass,
  ShoppingBag,
  LayoutDashboard,
  Lock,
  Heart,
  User,
  BadgeCheck,
  Send,
  Coins,
  Megaphone,
  ThumbsUp,
  MessageCircle,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SadewaHouseLogo, SadewaFullLogo } from '../common/SadewaHouseLogo';
import { PriorityBadge, ProjectStatusBadge } from '../common/StatusBadge';
import { useResidents } from '../../hooks/useResidents';
import { HomeApbdesSection } from '../transparency/HomeApbdesSection';
import { DashboardStats } from './DashboardStats';

export const HomeView: React.FC = () => {
  const { residents } = useResidents();
  const {
    navigateTo,
    news,
    announcements,
    services,
    developmentProjects,
    agendas,
    potentials,
    umkm,
    serviceRequests,
    villageProfile,
    officials,
    apbdesData,
    findRequestByCode,
    likeNewsArticle,
    likeDevelopmentProject,
    addToast
  } = useApp();

  const [quickTrackingCode, setQuickTrackingCode] = useState('');
  const [trackingResult, setTrackingResult] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);

  // Auto-Slide Hero Banner Carousel State:
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // High quality default fallback images & slide content generator
  const defaultHeroImg = villageProfile.heroBackgroundUrl || '/src/assets/images/modern_village_portal_hero_1790274565982.jpg';
  const latestNewsItem = news && news.length > 0 ? news[0] : null;
  const latestProject = developmentProjects && developmentProjects.length > 0 ? developmentProjects[0] : null;
  const latestPotential = potentials && potentials.length > 0 ? potentials[0] : null;

  const heroSlides = useMemo(() => {
    const formatPublishedDate = (rawDate?: string) => {
      if (!rawDate) return 'Baru-baru ini';
      try {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) {
          return parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }
      } catch (e) {}
      return rawDate;
    };

    interface HeroSlide {
      id: string;
      bgUrl: string;
      badge: string;
      badgeColor: string;
      title: string;
      subtitle: string;
      description: string;
      type: string;
      itemId?: string;
      likesCount?: number;
      commentsCount?: number;
      disputeCount?: number;
    }

    const slides: HeroSlide[] = [
      {
        id: 'main_portal',
        bgUrl: defaultHeroImg,
        badge: villageProfile.heroBadgeText || 'Portal Resmi Pemerintah Desa Digital',
        badgeColor: 'bg-emerald-950/90 text-emerald-300 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        title: villageProfile.heroTitle || villageProfile.villageName,
        subtitle: 'Pusat Layanan & Governance Digital',
        description: villageProfile.heroSubtitle || 'Pelayanan administrasi kependudukan mandiri, keterbukaan informasi publik, dan pemantauan bantuan sosial terpadu untuk kesejahteraan seluruh warga.',
        type: 'portal'
      }
    ];

    if (latestNewsItem) {
      const formattedDate = formatPublishedDate(latestNewsItem.publishedAt);
      slides.push({
        id: 'news_slide',
        bgUrl: latestNewsItem.coverImage || defaultHeroImg,
        badge: 'Kabar & Berita Desa Terkini',
        badgeColor: 'bg-blue-950/90 text-blue-300 border-blue-400/60 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        title: latestNewsItem.title,
        subtitle: `Diterbitkan ${formattedDate} • Kategori: ${latestNewsItem.category || 'Pemerintahan'}`,
        description: latestNewsItem.summary || (latestNewsItem.content ? latestNewsItem.content.substring(0, 160) + '...' : 'Ikuti informasi perkembangan dan program pelayanan desa terbaru.'),
        type: 'news',
        itemId: latestNewsItem.id,
        likesCount: latestNewsItem.likesCount || 0,
        commentsCount: latestNewsItem.comments?.length || 0
      });
    }

    if (latestProject) {
      slides.push({
        id: 'project_slide',
        bgUrl: latestProject.completedImage || latestProject.inProgressImage || latestProject.beforeImage || defaultHeroImg,
        badge: 'Transparansi Pembangunan Desa',
        badgeColor: 'bg-amber-950/90 text-amber-300 border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
        title: latestProject.title,
        subtitle: `Progress: ${latestProject.progressPercent || 0}% • Anggaran: Rp ${(latestProject.budget || 0).toLocaleString('id-ID')}`,
        description: latestProject.description || 'Pembangunan infrastruktur dan fasilitas publik desa untuk kenyamanan bersama.',
        type: 'project',
        itemId: latestProject.id,
        likesCount: latestProject.likesCount || 0,
        disputeCount: latestProject.citizenDisputeCount || 0,
        commentsCount: latestProject.comments?.length || 0
      });
    } else if (latestPotential) {
      slides.push({
        id: 'potential_slide',
        bgUrl: (latestPotential as any).imageUrl || defaultHeroImg,
        badge: 'Potensi & Komoditas Unggulan Desa',
        badgeColor: 'bg-teal-950/90 text-teal-300 border-teal-400/60 shadow-[0_0_20px_rgba(20,184,166,0.3)]',
        title: latestPotential.name || 'Ekonomi & Wisata Desa',
        subtitle: 'Pemberdayaan Ekonomi & Kreativitas Warga',
        description: latestPotential.description || 'Mendukung pertumbuhan ekonomi mandiri melalui ekspos UMKM, hasil tani, dan potensi lokal.',
        type: 'potential'
      });
    }

    return slides;
  }, [villageProfile, latestNewsItem, latestProject, latestPotential, defaultHeroImg]);

  // Handle slide rotation with dynamic delay (longer for first slide)
  React.useEffect(() => {
    if (isPaused || heroSlides.length <= 1) return;
    
    const delay = activeSlide === 0 ? 8000 : 6000;
    
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, delay);
    return () => clearInterval(timer);
  }, [isPaused, heroSlides.length, activeSlide]);

  const currentSlide = heroSlides[activeSlide] || heroSlides[0];

  // Sinkronisasi Demografi Beranda:
  // Jika database kependudukan sudah terisi penuh (>50 jiwa), hitung langsung dari master data.
  // Jika masih tahap inisialisasi sample, tampilkan data demografi makro resmi desa (1.842 Jiwa / 524 KK) secara proporsional.
  const aliveResidents = useMemo(() => residents.filter(r => (r.status || '').toUpperCase() === 'HIDUP'), [residents]);
  const hasFullMasterData = aliveResidents.length >= 50;

  const realTotal = hasFullMasterData ? aliveResidents.length : (villageProfile.totalPopulation || 1842);
  const realFamilies = hasFullMasterData 
    ? new Set(aliveResidents.map(r => r.kk).filter(Boolean)).size 
    : (villageProfile.totalFamilies || 524);

  const realMale = hasFullMasterData 
    ? aliveResidents.filter(r => r.gender === 'Laki-laki').length 
    : Math.round(realTotal * 0.512);

  const realFemale = hasFullMasterData 
    ? aliveResidents.filter(r => r.gender === 'Perempuan').length 
    : (realTotal - realMale);

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    if (birth > today) return null; // Tanggal lahir di masa depan tidak valid
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { age--; }
    if (age < 0 || age > 130) return null;
    return age;
  };

  const realAgeData = useMemo(() => {
    if (hasFullMasterData) {
      const groups = [
        { name: '0-5', min: 0, max: 5, value: 0 },
        { name: '6-12', min: 6, max: 12, value: 0 },
        { name: '13-17', min: 13, max: 17, value: 0 },
        { name: '18-25', min: 18, max: 25, value: 0 },
        { name: '26-45', min: 26, max: 45, value: 0 },
        { name: '46-60', min: 46, max: 60, value: 0 },
        { name: '60+', min: 61, max: 200, value: 0 },
        { name: 'Tidak Diketahui', min: -999, max: -1, value: 0 }
      ];

      aliveResidents.forEach(r => {
        const age = calculateAge(r.birthDate);
        if (age === null) {
          const unkGroup = groups.find(g => g.name === 'Tidak Diketahui');
          if (unkGroup) unkGroup.value++;
        } else {
          const group = groups.find(g => age >= g.min && age <= g.max);
          if (group) group.value++;
        }
      });

      return groups.map(({ name, value }) => ({ name, value }));
    }

    // Proporsi piramida penduduk standar BPS untuk desa 1.842 jiwa
    const ageDist = [
      { name: '0-5', ratio: 0.082 },   // Balita
      { name: '6-12', ratio: 0.128 },  // Anak Usia SD
      { name: '13-17', ratio: 0.095 }, // Remaja SMP/SMA
      { name: '18-25', ratio: 0.145 }, // Pemuda Produktif
      { name: '26-45', ratio: 0.315 }, // Usia Kerja Utama
      { name: '46-60', ratio: 0.155 }, // Pra-Lansia
      { name: '60+', ratio: 0.080 }    // Lansia
    ];

    let allocated = 0;
    const result = ageDist.map((g, idx) => {
      if (idx === ageDist.length - 1) {
        return { name: g.name, value: Math.max(0, realTotal - allocated) };
      }
      const val = Math.round(realTotal * g.ratio);
      allocated += val;
      return { name: g.name, value: val };
    });

    return result;
  }, [hasFullMasterData, aliveResidents, realTotal]);

  // Budget Realization Metrics
  const totalIncome = apbdesData?.totalIncome || 1420000000;
  const totalIncomeRealized = apbdesData?.totalIncomeRealized ?? Math.round(totalIncome * 0.684);
  const realizationPercent = totalIncome > 0 ? ((totalIncomeRealized / totalIncome) * 100).toFixed(1) : '68.4';

  // Active Kepala Desa for greeting
  const kadesOfficial = officials.find(
    (o) => (o.section === 'kepala_desa' || o.position.toLowerCase().includes('kepala desa')) && o.isActive !== false
  );
  const kadesName = villageProfile.kadesName || kadesOfficial?.name || 'Kepala Desa';
  const kadesNip = villageProfile.kadesNip || kadesOfficial?.nip || '';
  const kadesPhoto = villageProfile.kadesPhotoUrl || kadesOfficial?.imageUrl || '';
  const kadesGreetingTitle = villageProfile.kadesGreetingTitle || `Membangun ${villageProfile.villageName || 'Desa'} dengan Kebersamaan dan Pelayanan Digital`;
  const kadesGreeting = villageProfile.kadesGreeting || `Assalamu’alaikum Warahmatullahi Wabarakatuh. Selamat datang di portal resmi Pemerintah ${villageProfile.villageName || 'Desa'}, ${villageProfile.district || 'Kecamatan'}. Kehadiran portal ini merupakan ikhtiar nyata kami menghadirkan tata kelola desa yang transparan, bersih dari pungli, serta memudahkan warga mengurus surat-menyurat secara online dari mana saja.`;

  // Filter urgent announcements
  const urgentAnnouncement = announcements.find((a) => a.isActive && (a.priority === 'mendesak' || a.priority === 'penting'));

  // Handle Quick Tracking
  const handleQuickTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = quickTrackingCode.trim().toUpperCase();
    if (!code) return;

    setSearched(true);
    const found = await findRequestByCode(code);
    setTrackingResult(found || 'NOT_FOUND');
  };

  return (
    <div className="space-y-10 sm:space-y-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-4 sm:pt-6">
      {/* Urgent Announcement Banner if present */}
      {urgentAnnouncement && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="font-medium">
              <span className="font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] mr-2">
                {urgentAnnouncement.priority === 'mendesak' ? 'PERINGATAN RESMI' : 'PENGUMUMAN PENTING'}
              </span>
              {urgentAnnouncement.title}
            </div>
          </div>
          <button
            onClick={() => navigateTo('pengumuman')}
            className="whitespace-nowrap px-3 py-1 rounded bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors uppercase tracking-wider"
          >
            Baca Rincian
          </button>
        </div>
      )}

      {/* Welcome / Hero Banner - High-Tech Cyber-Civic Auto-Slide Carousel */}
      {villageProfile.heroIsActive !== false && (
        <section 
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative w-full h-[520px] sm:h-[600px] lg:h-[720px] rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] group transition-all duration-700 ease-out border border-emerald-500/20"
        >
          {/* Animated Background Image Carousel with Smooth Crossfade */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id + activeSlide}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${currentSlide.bgUrl})`,
              }}
            />
          </AnimatePresence>
          
          {/* Soft Gradient Overlay - Keeps Banner Image Bright & Crisp */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent hidden lg:block" />
          
          {/* Subtle Cyber Grid Overlay Accent */}
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-10 pointer-events-none" />

          {/* Left / Right Carousel Manual Controls (Visible on Hover / Mobile) */}
          {heroSlides.length > 1 && (
            <div className="absolute z-30 inset-x-4 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none">
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                className="pointer-events-auto p-3 sm:p-4 rounded-2xl bg-slate-950/40 hover:bg-emerald-600/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl opacity-80 group-hover:opacity-100"
                title="Slide Sebelumnya"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlide((prev) => (prev + 1) % heroSlides.length)}
                className="pointer-events-auto p-3 sm:p-4 rounded-2xl bg-slate-950/40 hover:bg-emerald-600/90 text-white border border-white/20 backdrop-blur-md transition-all active:scale-90 cursor-pointer shadow-xl opacity-80 group-hover:opacity-100"
                title="Slide Berikutnya"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          )}

          {/* Content Layer */}
          <div className="relative z-20 h-full flex flex-col justify-end p-6 sm:p-10 lg:p-16 max-w-5xl">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentSlide.id + activeSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-5 lg:space-y-6"
              >
                {/* Official Portal Pill */}
                <div className={`inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full backdrop-blur-xl border text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] ${currentSlide.badgeColor}`}>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
                  <span>{currentSlide.badge}</span>
                </div>

                {/* Main Headline */}
                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                    {currentSlide.title}
                    <span className="block mt-2 text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {currentSlide.subtitle}
                    </span>
                  </h1>
                  
                  {/* Description Text Clean & Direct - No Dark Container Box */}
                  <p className="text-sm sm:text-base lg:text-lg text-slate-100 font-bold leading-relaxed max-w-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] line-clamp-3 sm:line-clamp-none">
                    {currentSlide.description}
                  </p>
                </div>
                
                {/* Primary CTA Buttons & Sleek Glass Quick Search Bar */}
                <div className="space-y-4 pt-2">
                  {currentSlide.type === 'portal' ? (
                    <>
                      {/* Floating Real Tracking Bar inside Hero - Translucent Glass */}
                      <form onSubmit={handleQuickTrack} className="bg-slate-950/40 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 max-w-xl hover:border-emerald-400/70 transition-colors">
                        <div className="pl-3 text-emerald-300 shrink-0">
                          <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <input 
                          type="text" 
                          value={quickTrackingCode} 
                          onChange={(e) => setQuickTrackingCode(e.target.value)} 
                          placeholder="Lacak Surat: Ketik Kode Resi / NIK..." 
                          className="w-full bg-transparent text-white placeholder:text-slate-300 text-xs sm:text-sm font-medium focus:outline-none px-1 font-mono"
                        />
                        <button 
                          type="submit" 
                          className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl shrink-0 transition-all shadow-[0_10px_20px_rgba(16,185,129,0.3)] active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>LACAK</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <button
                          onClick={() => navigateTo('layanan')}
                          className="px-6 py-3.5 rounded-xl sm:rounded-2xl bg-white text-slate-950 font-black text-xs shadow-[0_10px_30px_rgba(255,255,255,0.25)] hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95 group/btn cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-emerald-700 transition-transform group-hover/btn:-rotate-12" />
                          <span>SURAT MANDIRI</span>
                        </button>
                        <button
                          onClick={() => navigateTo('bansos')}
                          className="px-6 py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs shadow-[0_10px_30px_rgba(5,150,105,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95 group/btn-secondary border border-emerald-400/40 cursor-pointer"
                        >
                          <Coins className="w-4 h-4 text-amber-300" />
                          <span>CEK BANSOS WARGA</span>
                        </button>
                      </div>
                    </>
                  ) : currentSlide.type === 'news' ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          if (currentSlide.itemId) {
                            const isLiked = likeNewsArticle(currentSlide.itemId);
                            if (isLiked) {
                              addToast('success', 'Disukai', 'Terima kasih atas dukungan Anda pada warta berita desa!');
                            } else {
                              addToast('info', 'Batal Suka', 'Suka berita telah dibatalkan.');
                            }
                          }
                        }}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <ThumbsUp className="w-4 h-4 text-white" />
                        <span>SUKA BERITA ({currentSlide.likesCount || 0})</span>
                      </button>

                      <button
                        onClick={() => navigateTo('berita')}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-slate-950/60 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider border border-white/20 backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 text-blue-300" />
                        <span>KOMENTAR ({currentSlide.commentsCount || 0})</span>
                      </button>

                      <button
                        onClick={() => navigateTo('berita')}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 backdrop-blur-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>BACA LENGKAP</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          if (currentSlide.itemId) {
                            const isLiked = likeDevelopmentProject(currentSlide.itemId);
                            if (isLiked) {
                              addToast('success', 'Apresiasi Proyek Dicatat', 'Terima kasih! Dukungan apresiasi Anda telah dicatat.');
                            } else {
                              addToast('info', 'Apresiasi Dibatalkan', 'Apresiasi dukungan Anda telah dibatalkan.');
                            }
                          }
                        }}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-[0_10px_30px_rgba(217,119,6,0.4)] transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <ThumbsUp className="w-4 h-4 text-white" />
                        <span>APRESIASI PROYEK ({currentSlide.likesCount || 0})</span>
                      </button>

                      <button
                        onClick={() => navigateTo('pembangunan')}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-slate-950/60 hover:bg-slate-900 text-white font-bold text-xs uppercase tracking-wider border border-white/20 backdrop-blur-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>SANGGAHAN WARGA ({currentSlide.disputeCount || 0})</span>
                      </button>

                      <button
                        onClick={() => navigateTo('pembangunan')}
                        className="px-5 py-3.5 rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 backdrop-blur-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>DETAIL PROYEK</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Slide Indicator Dots & Progress Bar */}
                {heroSlides.length > 1 && (
                  <div className="pt-4 flex items-center justify-between border-t border-white/10">
                    <div className="flex items-center space-x-3">
                      {heroSlides.map((slide, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSlide(idx)}
                          className={`h-2.5 rounded-full transition-all duration-500 cursor-pointer flex items-center justify-center group/dot ${
                            idx === activeSlide
                              ? 'w-12 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,1)]'
                              : 'w-2.5 bg-white/30 hover:bg-white/60'
                          }`}
                          title={slide.badge}
                        >
                          {idx === activeSlide && (
                            <span className="text-[7px] font-black text-emerald-950 uppercase tracking-tighter opacity-0 group-hover/dot:opacity-100 transition-opacity">
                              {slide.type === 'portal' ? 'Beranda' : slide.type === 'news' ? 'Berita' : 'Proyek'}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center space-x-3 text-white/70 text-[10px] sm:text-xs font-mono font-bold">
                      <span className="bg-white/10 px-2 py-0.5 rounded border border-white/10">0{activeSlide + 1} / 0{heroSlides.length}</span>
                      <span className="hidden sm:inline-block text-white/20">|</span>
                      <span className="hidden sm:inline-block text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {isPaused ? '⏸ PAUSED' : '▶ AUTO-SLIDE'}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Tracking Result View if active */}
      {searched && (
        <div className="p-4 rounded-xl border transition-all duration-300 ease-in-out text-xs bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg">
          {trackingResult === 'NOT_FOUND' ? (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
              Kode pengajuan <span className="font-mono font-bold">{quickTrackingCode}</span> tidak ditemukan dalam pangkalan data. Harap periksa kembali nomor resi permohonan Anda.
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 text-sm">{trackingResult.serviceName}</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-emerald-200 text-emerald-900">
                  {trackingResult.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-slate-700 text-xs">
                <div>Pemohon: <span className="font-semibold text-slate-900">{trackingResult.citizenName}</span></div>
                <div>Wilayah: <span className="font-semibold text-slate-900">{trackingResult.addressDusun}</span></div>
                <div>Tanggal: <span className="font-semibold text-slate-900">{trackingResult.requestDate}</span></div>
                <div>Resi: <span className="font-mono font-bold text-emerald-800">{trackingResult.trackingCode}</span></div>
              </div>
              {trackingResult.staffNotes && (
                <div className="pt-2 border-t border-emerald-200 text-emerald-900 text-xs">
                  <span className="font-semibold">Catatan Petugas:</span> {trackingResult.staffNotes}
                </div>
              )}
              <button
                onClick={() => navigateTo('layanan', { trackingCode: trackingResult.trackingCode })}
                className="text-emerald-800 font-bold underline flex items-center space-x-1 pt-1"
              >
                <span>Buka Rincian Lengkap Permohonan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 1: PUSAT LAYANAN & PERLINDUNGAN WARGA (BENTO GRID REVAMP)           */}
      {/* ========================================================================= */}
      <motion.section 
        initial={{ opacity: 0, y: 70, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-8 pt-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              Layanan Warga Terpadu
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              Pusat Layanan <span className="text-emerald-600">Digital</span>
            </h2>
            <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
              Akses cepat layanan administrasi surat, pengecekan bantuan sosial, dan kesehatan balita dalam satu portal resmi.
            </p>
          </div>
          
          <button 
            onClick={() => navigateTo('layanan')}
            className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-emerald-600 transition-colors group cursor-pointer"
          >
            <span>Lihat Semua Layanan</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>

        {/* 4 Pilar Utama Layanan Publik - Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto lg:h-[600px]">
          {/* Card 1: Layanan Surat Mandiri (Featured Large Card) */}
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -10, scale: 1.015 }}
            onClick={() => navigateTo('layanan')}
            className="md:col-span-8 lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_50px_rgba(52,211,153,0.2)] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.1] group-hover:rotate-6 transition-all duration-700">
              <FileText className="w-64 h-64 -rotate-12 translate-x-12 -translate-y-12" />
            </div>
            
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-6 shadow-xl shadow-emerald-600/30 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                <FileText className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                15+ Naskah Dinas Digital
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white mt-4 tracking-tighter">
                E-Administrasi & <br/>Surat Mandiri
              </h3>
              <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-4 leading-relaxed max-w-md">
                Ajukan surat keterangan usaha, domisili, atau kelahiran secara mandiri. Unduh naskah digital ber-QR Code resmi yang terverifikasi.
              </p>
            </div>
            
            <div className="relative z-10 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                Buka Layanan Surat <ChevronRight className="w-4 h-4" />
              </span>
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shadow-sm">
                    {i}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 2: Cek Bansos & KPM (Tall Card - Refined Emerald Slate Gradient) */}
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -10, scale: 1.015 }}
            className="md:col-span-4 lg:col-span-5 bg-gradient-to-br from-slate-900 via-emerald-950/90 to-slate-950 p-8 rounded-[2.5rem] shadow-2xl hover:shadow-emerald-500/30 transition-all group relative overflow-hidden flex flex-col justify-between border border-emerald-500/30"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="relative z-10 cursor-pointer" onClick={() => navigateTo('bansos')}>
              <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20 group-hover:rotate-12 transition-transform duration-500">
                <Coins className="w-7 h-7" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">
                Transparansi <br/>Bantuan Sosial
              </h3>
              <p className="text-sm text-slate-300 mt-4 leading-relaxed">
                Periksa status Keluarga Penerima Manfaat (KPM) untuk program BLT-DD, PKH, BPNT, dan Beras CPP secara akuntabel.
              </p>
            </div>
            
            <div className="relative z-10 mt-8">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  navigateTo('bansos');
                }} 
                className="bg-slate-950/80 border border-emerald-500/40 rounded-2xl p-4 space-y-3 backdrop-blur-md shadow-2xl"
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <span>Pencarian Bansos Berbasis NIK</span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Ketik NIK atau Nomor KK..."
                    className="w-full bg-slate-900/90 rounded-xl border border-slate-700/80 focus:border-emerald-400 pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none transition-colors"
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>CEK STATUS BANSOS</span>
                </button>
              </form>
            </div>
          </motion.div>

          {/* Card 3: ePosyandu (Small Card) */}
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -10 }}
            onClick={() => navigateTo('posyandu')}
            className="md:col-span-6 lg:col-span-6 bg-rose-50 dark:bg-rose-950/20 p-8 rounded-[2.5rem] border border-rose-100 dark:border-rose-900/30 shadow-sm hover:shadow-rose-500/20 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-700">
              <Heart className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-rose-500 text-white flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
                <Heart className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                ePosyandu & KIA Digital
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-xs">
                Pantau grafik pertumbuhan anak (KMS Digital), jadwal imunisasi, dan nutrisi balita.
              </p>
            </div>
            <div className="relative z-10 mt-6 flex items-center justify-between">
              <div className="flex -space-x-1.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-7 h-7 rounded-full border-2 border-rose-50 dark:border-slate-900 bg-rose-200 dark:bg-rose-800" />
                ))}
              </div>
              <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1">
                KMS Digital <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </motion.div>

          {/* Card 4: Aspirasi & Pengaduan (Small Card) */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
            whileHover={{ y: -8 }}
            onClick={() => navigateTo('pengaduan')}
            className="md:col-span-6 lg:col-span-6 bg-indigo-50 dark:bg-indigo-950/20 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/30 shadow-sm hover:shadow-indigo-500/10 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
          >
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-700">
              <Megaphone className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-6 shadow-lg shadow-indigo-600/20">
                <Megaphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                Aspirasi & Lapor Warga
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-xs">
                Saluran resmi penyampaian usulan, keluhan sarana publik, dan apresiasi kinerja desa.
              </p>
            </div>
            <div className="relative z-10 mt-6">
               <div className="h-1.5 w-full bg-indigo-100 dark:bg-indigo-900/40 rounded-full overflow-hidden">
                 <div className="h-full w-2/3 bg-indigo-500 rounded-full animate-pulse"></div>
               </div>
               <div className="flex justify-between items-center mt-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                 <span>Respons Penanganan Cepat</span>
                 <span className="flex items-center gap-1">Kirim Laporan <ArrowRight className="w-3 h-3" /></span>
               </div>
            </div>
          </motion.div>
        </div>

        {/* Quick Icon Links (Modern Rounded Squares) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 pt-4">
          {[
            { id: 'pembangunan', label: 'Infrastruktur', icon: Building2, desc: 'Progres Fisik' },
            { id: 'umkm', label: 'Katalog UMKM', icon: ShoppingBag, desc: 'Produk Lokal' },
            { id: 'peta', label: 'Peta Fasilitas', icon: Compass, desc: 'Sarana Umum' },
            { id: 'berita', label: 'Warta Desa', icon: Newspaper, desc: 'Kabar Terkini' }
          ].map((item, idx) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateTo(item.id as any)}
              className="flex items-center p-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all text-left space-x-4 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <item.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs lg:text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">{item.label}</div>
                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest truncate">{item.desc}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* TIER 2: TATA KELOLA PEMERINTAHAN & TRANSPARANSI ANGGARAN (PREMIUM)        */}
      {/* ========================================================================= */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8"
      >
        {/* Sambutan Resmi Kepala Desa (Featured Side Card) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-slate-800/60 p-8 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-slate-100 group-hover:rotate-2 transition-transform duration-500">
                  {kadesPhoto && kadesPhoto.trim() !== '' ? (
                    <img
                      src={kadesPhoto.trim()}
                      alt={kadesName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300 h-full">
                      <User className="w-16 h-16" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-2 rounded-xl shadow-lg">
                  <BadgeCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">{kadesName}</h3>
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">Kepala Desa Pulau Betung</p>
                {kadesNip && <p className="text-[10px] text-slate-400 font-medium italic">NIP/NIAP: {kadesNip}</p>}
              </div>
            </div>

            <div className="relative">
              <span className="absolute -top-4 -left-2 text-6xl text-emerald-500/10 font-serif leading-none">“</span>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed italic relative z-10 text-center px-4">
                {kadesGreeting}
              </p>
              <span className="absolute -bottom-8 -right-2 text-6xl text-emerald-500/10 font-serif leading-none">”</span>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <button
                onClick={() => navigateTo('profil')}
                className="px-6 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-900 dark:text-slate-200 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
              >
                Visi & Misi Selengkapnya
              </button>
            </div>
          </div>
        </div>

        {/* APBDes Transparansi (Main Center Card) */}
        <div className="lg:col-span-7 space-y-6">
           <HomeApbdesSection />
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* TIER 3: DINAMIKA & AKTIVITAS DESA (MODERN WARTA GRID)                    */}
      {/* ========================================================================= */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8 pt-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
              <Newspaper className="w-3.5 h-3.5" />
              Warta Terkini
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              Dinamika <span className="text-blue-600">&</span> Kabar Desa
            </h2>
          </div>
          
          <button 
            onClick={() => navigateTo('berita')}
            className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors group cursor-pointer"
          >
            <span>Lihat Semua Berita</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Kolom Kiri: Berita Terkini (2 per baris) */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {news.slice(0, 4).map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                whileHover={{ y: -8 }}
                onClick={() => navigateTo('berita', { newsId: item.id })}
                className="group cursor-pointer bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col"
              >
                <div className="h-56 relative overflow-hidden">
                   <img
                    src={item.coverImage?.trim() ? item.coverImage : 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=800&auto=format&fit=crop&q=80'}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[9px] font-black uppercase tracking-widest shadow-xl">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      <span>{item.publishedAt}</span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <User className="w-3 h-3 text-slate-400" />
                      </div>
                      <span className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase tracking-widest">{item.author}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Kolom Kanan: Pengumuman & Agenda (Stacked) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Project Progress (Mini Highlight) */}
            <div className="bg-slate-950 rounded-[2rem] p-6 text-white border border-white/5 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:rotate-12 transition-transform duration-700">
                <Building2 className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-lg font-black tracking-tight uppercase">Infrastruktur</h3>
                   <span className="px-2 py-0.5 rounded-md bg-white/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest border border-emerald-400/20">PROGRES FISIK</span>
                </div>
                {developmentProjects.slice(0, 1).map(p => (
                  <div key={p.id} className="space-y-3">
                    <p className="text-xs text-slate-400 font-medium line-clamp-2">{p.title}</p>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.progressPercent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-500">
                      <span>{p.progressPercent}% Selesai</span>
                      <button onClick={() => navigateTo('pembangunan')} className="hover:underline cursor-pointer">Rincian Proyek →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Announcements Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 p-6 space-y-6">
              <div className="flex justify-between items-center">
                 <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Pengumuman</span>
                 </div>
                 <button onClick={() => navigateTo('pengumuman')} className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase cursor-pointer">Arsip</button>
              </div>
              <div className="space-y-4">
                {announcements.slice(0, 3).map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => navigateTo('pengumuman')}
                    className="flex gap-4 group/item cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-slate-400 group-hover/item:bg-amber-500 group-hover/item:text-slate-950 transition-colors">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-xs font-black text-slate-900 dark:text-white group-hover/item:text-amber-600 transition-colors line-clamp-2">{item.title}</h5>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.publishedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Hotline (Sticky Feel) */}
            <div 
              onClick={() => navigateTo('kontak')}
              className="bg-emerald-600 p-6 rounded-[2rem] cursor-pointer shadow-xl shadow-emerald-600/20 group overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-1">
                   <div className="flex items-center space-x-2 text-emerald-200">
                     <Phone className="w-4 h-4" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Kontak Siaga 24 Jam</span>
                   </div>
                   <div className="text-lg font-black text-white">{villageProfile.whatsappCenter || '0822-8199-0112'}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-md">
                   <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* TIER 4: POTENSI EKONOMI & UMKM (EXPLORATION GRID)                        */}
      {/* ========================================================================= */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8 pt-8 border-t border-slate-200/60 dark:border-slate-800/60"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
              <ShoppingBag className="w-3.5 h-3.5" />
              Ekonomi Desa
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              Potensi <span className="text-amber-600">&</span> Ekonomi Lokal
            </h2>
          </div>
          
          <button 
            onClick={() => navigateTo('umkm')}
            className="flex items-center space-x-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-amber-600 transition-colors group cursor-pointer"
          >
            <span>Buka Katalog UMKM</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {potentials.slice(0, 4).map((pot, idx) => (
            <motion.div
              key={pot.id}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1, ease: "easeOut" }}
              whileHover={{ y: -8 }}
              onClick={() => navigateTo('potensi')}
              className="group cursor-pointer bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col"
            >
              <div className="h-48 relative overflow-hidden">
                <img
                  src={pot.imageUrl?.trim() || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80'}
                  alt={pot.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                   <span className="text-[10px] font-black text-white/80 uppercase tracking-widest bg-white/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/20">{pot.category || 'Potensi'}</span>
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{pot.highlightStat}</span>
                </div>
              </div>
              <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                   <h4 className="font-black text-slate-900 dark:text-white text-lg tracking-tight group-hover:text-amber-600 transition-colors line-clamp-1">{pot.name}</h4>
                   <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">{pot.description}</p>
                </div>
                <div className="pt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-amber-600">
                   <span>Lihat Potensi</span>
                   <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Statistik Demografi Section */}
        <motion.div 
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] p-8 sm:p-12 border border-slate-200/60 dark:border-slate-800/60"
        >
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
              <div className="space-y-1">
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Statistik Kependudukan</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data Penduduk Terkini</p>
              </div>
              <button 
                onClick={() => navigateTo('profil')}
                className="px-6 py-3 bg-white dark:bg-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                Profil Selengkapnya →
              </button>
           </div>
           <DashboardStats 
              totalPopulation={realTotal}
              maleCount={realMale}
              femaleCount={realFemale}
              totalFamilies={realFamilies}
              ageData={realAgeData}
           />
        </motion.div>
      </motion.section>
    </div>
  );
};

export default HomeView;
