import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createBackup, restoreBackup } from '../../utils/backupEngine';
import { generateReportPDF, exportBannerImageToPDF } from '../../utils/pdfEngine';
import { useApp } from '../../context/AppContext';
import { ServiceRequest, Complaint, RoleType, VillageProfile } from '../../types';
import { uploadImageService } from '../../services/uploadService';
import {
  LayoutDashboard,
  FileText,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Info,
  Newspaper,
  Calendar,
  BarChart3,
  ShieldCheck,
  Users,
  Image as ImageIcon,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Edit,
  Trash2,
  Plus,
  Eye,
  Key,
  Lock,
  ArrowRight,
  Filter,
  Check,
  ChevronDown,
  MapPin,
  HardHat,
  ShoppingBag,
  Download,
  Upload,
  MessageSquare,
  Building2,
  Layers,
  Send,
  Radio,
  Copy,
  Compass,
  Heart,
  Baby,
  Menu,
  TrendingUp,
  Home
} from 'lucide-react';
import { ServiceStatusBadge, ComplaintStatusBadge } from '../common/StatusBadge';
import { OfficialsManager } from './OfficialsManager';
import { VillageProfileManager } from './VillageProfileManager';
import { TerritoriesManager } from './TerritoriesManager';
import { FacilitiesManager } from './FacilitiesManager';
import { ProjectsManager } from './ProjectsManager';
import { UmkmManager } from './UmkmManager';
import { WebGisManager } from './WebGisManager';
import { ApbdesManager } from './ApbdesManager';
import { PosyanduManager } from './PosyanduManager';
import { BansosManager } from './BansosManager';
import { OfficialLetterPrintModal } from '../letters/OfficialLetterPrintModal';
import { LetterArchivesManager } from './LetterArchivesManager';
import { NewsManager } from './NewsManager';
import { AnnouncementsManager } from './AnnouncementsManager';
import { PotentialManager } from './PotentialManager';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AttendanceLogManager } from './AttendanceLogManager';
import { PopulationManager } from './PopulationManager';
import { BackupManager } from './BackupManager';
import { OccupationStatsChart } from './OccupationStatsChart';
import { MasterResetTool } from './MasterResetTool';
import { AdminSidebar, AdminTabType } from './AdminSidebar';
import { UserManager } from './UserManager';
import { SadewaHouseLogo } from '../common/SadewaHouseLogo';
import { WhatsAppService, generateWAMessage, buildWhatsAppShareUrl } from '../../services/whatsappService';
import { getLetterVerificationUrl } from '../../utils/qrHelper';
import { Skeleton, TableSkeleton, CardSkeleton } from '../common/Skeleton';
import { useResidents } from '../../hooks/useResidents';

export const AdminDashboard: React.FC = () => {
  const {
    currentUser,
    logout,
    services,
    serviceRequests,
    complaints,
    news,
    announcements,
    budget,
    developmentProjects,
    officials,
    facilities,
    umkm,
    auditLogs,
    territories,
    villageProfile,
    updateServiceRequestStatus,
    deleteServiceRequest,
    bulkDeleteServiceRequests,
    updateComplaintStatus,
    addNews,
    addAnnouncement,
    updateVillageProfile,
    addToast,
    bansosRecipients,
    navigateTo
  } = useApp();

  const { residents } = useResidents();

  const calculateAge = (birthDate: string | Date | undefined) => {
    if (!birthDate) return 999;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const sensusStats = useMemo(() => {
    const living = residents.filter(r => (r.status || '').toUpperCase() === 'HIDUP');
    const totalPenduduk = living.length;
    
    // Total KK
    const uniqueKks = new Set(living.map(r => (r.kkNumber || r.kk || '').trim()).filter(Boolean));
    const totalKK = uniqueKks.size;
    
    // Total Bansos
    const activeBansos = bansosRecipients?.length || 0;
    
    // Total Balita (age <= 5)
    const totalBalita = living.filter(r => calculateAge(r.birthDate) <= 5).length;

    return { totalPenduduk, totalKK, activeBansos, totalBalita };
  }, [residents, bansosRecipients]);



  const [activeTab, setActiveTab] = useState<AdminTabType>(() => {
    // Default tab logic based on role for better UX
    if (!currentUser) return 'overview';
    if (currentUser.role === 'editor') return 'news';
    if (currentUser.role === 'admin_posyandu') return 'posyandu';
    return 'overview';
  });
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Modal & Edit states
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [newReqStatus, setNewReqStatus] = useState<ServiceRequest['status']>('diproses');
  const [staffNote, setStaffNote] = useState('');
  const [showPrintDraft, setShowPrintDraft] = useState(false);

  // Complaint Action modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newComplaintStatus, setNewComplaintStatus] = useState<Complaint['status']>('diproses');
  const [complaintResponse, setComplaintResponse] = useState('');
  const [proofImage, setProofImage] = useState<string>('');
  const [followUpNote, setFollowUpNote] = useState('');
  const proofFileInputRef = useRef<HTMLInputElement>(null);

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isWaGatewayActive, setIsWaGatewayActive] = useState(true);
  const [notifyViaWA, setNotifyViaWA] = useState(false);
  const [printModalRequest, setPrintModalRequest] = useState<ServiceRequest | null>(null);
  const [adminPreviewImage, setAdminPreviewImage] = useState<string | null>(null);
  const [adminIsLoading, setAdminIsLoading] = useState(false);

  // Branding & Logo Management States (Restricted to Super Admin)
  const [isExportingHeroPdf, setIsExportingHeroPdf] = useState(false);
  const [uploadingBrandingTarget, setUploadingBrandingTarget] = useState<'sadewa' | 'sadewa_icon' | 'hero' | null>(null);
  const sadewaLogoInputRef = useRef<HTMLInputElement>(null);
  const sadewaIconInputRef = useRef<HTMLInputElement>(null);
  const heroBackgroundInputRef = useRef<HTMLInputElement>(null);

  // Audit Log Filter states
  const [logTimeRange, setLogTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [logSelectedUser, setLogSelectedUser] = useState<string>('all');
  const [logSelectedModule, setLogSelectedModule] = useState<string>('all');
  const [logSelectedLevel, setLogSelectedLevel] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  const handleBrandingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'sadewa' | 'sadewa_icon' | 'hero') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Guard Hak Akses (RBAC) Client-side
    const userRole = currentUser?.role;
    if (target === 'sadewa' || target === 'sadewa_icon') {
      if (userRole !== 'super_admin') {
        addToast('error', 'Akses Ditolak', 'Hanya peran Super Admin yang diperbolehkan mengubah logo induk atau ikon simbol.');
        if (e.target) e.target.value = '';
        return;
      }
    } else if (target === 'hero') {
      if (userRole !== 'super_admin' && userRole !== 'admin_desa') {
        addToast('error', 'Akses Ditolak', 'Hanya peran Super Admin atau Admin Desa/Kades yang diperbolehkan mengubah banner.');
        if (e.target) e.target.value = '';
        return;
      }
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('error', 'Ukuran Terlalu Besar', 'Maksimal ukuran berkas adalah 10MB.');
      return;
    }

    setUploadingBrandingTarget(target);
    try {
      const result = await uploadImageService(file);
      if (result.success && result.url) {
        const resolvedUrl = result.url;
        const updatedProfile = { ...villageProfile };
        
        if (target === 'sadewa') updatedProfile.sadewaLogoUrl = resolvedUrl;
        else if (target === 'sadewa_icon') updatedProfile.sadewaIconUrl = resolvedUrl;
        else if (target === 'hero') updatedProfile.heroBackgroundUrl = resolvedUrl;

        await updateVillageProfile(updatedProfile);
        
        const targetLabel = target === 'sadewa' ? 'Logo Induk SADEWA' : target === 'sadewa_icon' ? 'Ikon SADEWA' : 'Banner Hero Utama';
        addToast('success', `${targetLabel} Diperbarui`, 'Gambar berhasil diunggah dan disinkronkan ke seluruh sistem.');
      } else {
        addToast('error', 'Gagal Unggah', result.error || 'Terjadi kesalahan saat mengunggah gambar.');
      }
    } catch (err) {
      addToast('error', 'Kesalahan Sistem', 'Gagal memproses unggahan gambar branding.');
    } finally {
      setUploadingBrandingTarget(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleExportHeroBannerPdf = async () => {
    if (!villageProfile.heroBackgroundUrl) {
      addToast('warning', 'Banner Kosong', 'Tidak ada gambar banner hero yang dapat diekspor.');
      return;
    }
    setIsExportingHeroPdf(true);
    try {
      await exportBannerImageToPDF(villageProfile.heroBackgroundUrl, {
        fileName: `Banner_Hero_${villageProfile.villageName || 'Desa'}_${new Date().toISOString().slice(0, 10)}.pdf`,
        marginMm: 10,
        title: `HERO BANNER RESMI - PEMERINTAH ${villageProfile.villageName?.toUpperCase() || 'DESA'}`
      });
      addToast('success', 'PDF Berhasil Dibuat', 'Gambar banner hero berhasil dikonversi ke PDF.');
    } catch (err) {
      addToast('error', 'Gagal Cetak PDF', 'Terjadi kesalahan saat memproses PDF banner.');
    } finally {
      setIsExportingHeroPdf(false);
    }
  };

  // Helper function to resolve log criticality metadata
  const getLogLevelDetails = (log: { level?: string; action: string }) => {
    const act = (log.action || '').toUpperCase();
    const resolvedLevel = log.level || (
      act.includes('RESET') || act.includes('PURGE') || act.includes('CRITICAL') || act.includes('AUTH_FAILED') ? 'critical' :
      act.includes('DELETE') || act.includes('REMOVE') || act.includes('FAIL') || act.includes('CLEAR') ? 'error' :
      act.includes('UPDATE') || act.includes('EDIT') || act.includes('STATUS') || act.includes('CHANGE') || act.includes('RESTORE') ? 'warning' : 'info'
    );

    if (resolvedLevel === 'critical') {
      return {
        level: 'critical',
        label: 'Critical / Kritis',
        badgeClass: 'bg-red-100 text-red-900 border border-red-300 font-extrabold',
        rowClass: 'bg-red-50/60 hover:bg-red-50/90 border-l-4 border-l-red-600',
        Icon: ShieldAlert,
        iconColor: 'text-red-600',
        dotColor: 'bg-red-600'
      };
    }
    if (resolvedLevel === 'error') {
      return {
        level: 'error',
        label: 'Error / Sensitif',
        badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200 font-bold',
        rowClass: 'bg-rose-50/40 hover:bg-rose-50/80 border-l-4 border-l-rose-500',
        Icon: AlertTriangle,
        iconColor: 'text-rose-500',
        dotColor: 'bg-rose-500'
      };
    }
    if (resolvedLevel === 'warning') {
      return {
        level: 'warning',
        label: 'Warning',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200 font-bold',
        rowClass: 'bg-amber-50/25 hover:bg-amber-50/60 border-l-4 border-l-amber-500',
        Icon: AlertCircle,
        iconColor: 'text-amber-500',
        dotColor: 'bg-amber-500'
      };
    }
    return {
      level: 'info',
      label: 'Info',
      badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200 font-medium',
      rowClass: 'hover:bg-slate-50/80 border-l-4 border-l-transparent',
      Icon: Info,
      iconColor: 'text-sky-500',
      dotColor: 'bg-sky-500'
    };
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return auditLogs.filter((log) => {
      // Time Filter
      if (logTimeRange !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        if (!isNaN(logTime)) {
          const diffMs = now - logTime;
          if (logTimeRange === '24h' && diffMs > oneDayMs) return false;
          if (logTimeRange === '7d' && diffMs > 7 * oneDayMs) return false;
          if (logTimeRange === '30d' && diffMs > 30 * oneDayMs) return false;
        }
      }

      // User Filter
      if (logSelectedUser !== 'all' && log.userName !== logSelectedUser) {
        return false;
      }

      // Module Filter
      if (logSelectedModule !== 'all' && log.module && log.module !== logSelectedModule) {
        return false;
      }

      // Criticality Level Filter
      if (logSelectedLevel !== 'all') {
        const details = getLogLevelDetails(log);
        if (details.level !== logSelectedLevel) return false;
      }

      // Search Query
      if (logSearchQuery.trim() !== '') {
        const q = logSearchQuery.toLowerCase();
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchUser = (log.userName || '').toLowerCase().includes(q);
        const matchIp = (log.ipAddress || '').toLowerCase().includes(q);
        const matchModule = (log.module || '').toLowerCase().includes(q);
        if (!matchAction && !matchDetails && !matchUser && !matchIp && !matchModule) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, logTimeRange, logSelectedUser, logSelectedModule, logSelectedLevel, logSearchQuery]);

  // Unique users & modules for filter dropdowns
  const uniqueLogUsers = useMemo<string[]>(() => {
    return Array.from(new Set(auditLogs.map((l) => l.userName).filter((u): u is string => Boolean(u))));
  }, [auditLogs]);

  const uniqueLogModules = useMemo<string[]>(() => {
    return Array.from(new Set(auditLogs.map((l) => l.module).filter((m): m is string => Boolean(m))));
  }, [auditLogs]);

  const handleExportComplaintsCsv = () => {
    if (!complaints || complaints.length === 0) {
      addToast('info', 'Data Kosong', 'Tidak ada riwayat pengaduan masyarakat untuk diekspor.');
      return;
    }
    const headers = ['Nomor Tiket', 'Nama Pelapor', 'Kategori', 'Status', 'Tanggal Masuk', 'Tindak Lanjut'];
    const rows = complaints.map(c => [
      `"${c.ticketNumber || ''}"`,
      `"${c.reporterName || (c as any).citizenName || ''}"`,
      `"${c.category || ''}"`,
      `"${c.status || ''}"`,
      `"${c.createdAt || ''}"`,
      `"${(c.catatanTindakLanjut || c.adminResponse || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_pengaduan_sadewa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Ekspor CSV Berhasil', 'Rekapitulasi pengaduan masyarakat telah berhasil diunduh.');
  };

  const handleSaveServiceStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    updateServiceRequestStatus(selectedRequest.id, newReqStatus, staffNote);
    if (notifyViaWA) {
      sendCitizenWhatsApp(selectedRequest, newReqStatus, staffNote);
    }
    addToast('success', 'Status Berhasil Diperbarui', `Permohonan ${selectedRequest.trackingCode} kini berstatus ${newReqStatus.toUpperCase()}.`);
    setSelectedRequest(null);
  };

  const getServiceRequirements = (serviceNameOrId: string) => {
    const s = services?.find(
      (item) => item.id === serviceNameOrId || item.name.toLowerCase() === serviceNameOrId.toLowerCase()
    );
    return s?.requirements;
  };

  const copyWaMessageToClipboard = (request: ServiceRequest, status: string, notes: string) => {
    const msg = generateWAMessage({
      citizenName: request.citizenName,
      serviceName: request.serviceName,
      trackingCode: request.trackingCode,
      status: status ,
      adminNotes: notes,
      officialLetterNumber: request.officialLetterNumber,
      villageName: villageProfile?.villageName,
      district: villageProfile?.district,
      regency: villageProfile?.regency,
      documentUrl: getLetterVerificationUrl(request.trackingCode),
      requirements: getServiceRequirements(request.serviceName),
      isGatewayActive: true
    });
    navigator.clipboard.writeText(msg);
    addToast('success', 'Pesan Disalin', 'Teks telah disalin ke clipboard.');
  };

  const sendCitizenWhatsApp = (request: ServiceRequest, status: string, notes: string) => {
    const msg = generateWAMessage({
      citizenName: request.citizenName,
      serviceName: request.serviceName,
      trackingCode: request.trackingCode,
      status: status ,
      adminNotes: notes,
      officialLetterNumber: request.officialLetterNumber,
      villageName: villageProfile?.villageName,
      district: villageProfile?.district,
      regency: villageProfile?.regency,
      documentUrl: getLetterVerificationUrl(request.trackingCode),
      requirements: getServiceRequirements(request.serviceName),
      isGatewayActive: true
    });
    window.open(buildWhatsAppShareUrl(request.phone || '', msg), '_blank');
  };

  const handleSaveComplaintStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    
    if (newComplaintStatus === 'selesai' && (!proofImage || !followUpNote)) {
      addToast('error', 'Bukti Kerja Diperlukan', 'Untuk menandai pengaduan sebagai Selesai, Anda wajib mengunggah Foto Bukti dan menuliskan Catatan Tindak Lanjut.');
      return;
    }

    updateComplaintStatus(selectedComplaint.id, newComplaintStatus, complaintResponse, proofImage, followUpNote);
    addToast('success', 'Tanggapan Resmi Terkirim', 'Status tindak lanjut pengaduan berhasil diperbarui dan dipublikasikan.');
    setSelectedComplaint(null);
    setComplaintResponse('');
    setProofImage('');
    setFollowUpNote('');
  };


  // State for Dynamic Sticky Admin Navbar
  const [isCompactSticky, setIsCompactSticky] = useState(false);
  const [villageImgError, setVillageImgError] = useState(false);
  const [sadewaImgError, setSadewaImgError] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Trigger sticky compact mode when scrolled past 120px
          const shouldBeCompact = window.scrollY > 120;
          setIsCompactSticky(shouldBeCompact);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const villageLogo = villageProfile?.villageLogoUrl?.trim() || '';
  const sadewaLogo = villageProfile?.sadewaLogoUrl?.trim() || '';
  const sadewaIcon = villageProfile?.sadewaIconUrl?.trim() || '';


  return (
    <div className="min-h-screen bg-slate-100/70 pb-16 relative">
      {/* 1. Main Admin Header (Sticky for better usability) */}
      <div className="sticky top-0 z-[50] bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-8 py-3.5 shadow-lg w-full">
        <div className="w-full flex items-center justify-between flex-col sm:flex-row gap-3">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAdminSidebarOpen(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-colors cursor-pointer flex items-center gap-2 lg:hidden"
              title="Buka Menu Navigasi Admin"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-7 w-px bg-slate-700 hidden lg:block" />
              
              {/* Dual Logo Branding for Admin Topbar - SEPARATED PATHS */}
              <div className="flex items-center gap-3">
                {/* Path 1: Village Identity */}
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center p-1.5 border border-white/5 shadow-inner">
                  {villageLogo && villageLogo.length > 10 && !villageImgError ? (
                    <img 
                      src={villageLogo} 
                      alt="Logo Desa" 
                      className="w-full h-full object-contain" 
                      onError={() => setVillageImgError(true)}
                    />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
                
                {/* Path 2: Platform Branding (SADEWA) - Dynamic with Fallback */}
                <div className="flex items-center gap-3">
                  {sadewaLogo && sadewaLogo.length > 10 && !sadewaImgError ? (
                    <>
                      <div className="h-5 w-px bg-slate-700"></div>
                      <img 
                        src={sadewaLogo} 
                        alt="SADEWA" 
                        className="h-6 w-auto brightness-0 invert opacity-70" 
                        onError={() => setSadewaImgError(true)}
                      />
                    </>
                  ) : sadewaIcon && sadewaIcon.length > 10 && !sadewaImgError ? (
                    <>
                      <div className="h-5 w-px bg-slate-700"></div>
                      <div className="flex items-center gap-2">
                        <img 
                          src={sadewaIcon} 
                          alt="SADEWA" 
                          className="h-6 w-6 object-contain brightness-0 invert opacity-70" 
                          onError={() => setSadewaImgError(true)}
                        />
                        <span className="text-[10px] font-black tracking-widest text-emerald-400">SADEWA</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-5 w-px bg-slate-700"></div>
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-950/40 rounded p-1 border border-emerald-900/50 shadow-sm">
                          <SadewaHouseLogo size={18} className="text-emerald-400" />
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-emerald-400">SADEWA</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold text-white">
                  Dashboard Administrasi & Pelayanan Desa
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-800 text-emerald-200">
                  {currentUser?.roleTitle}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Petugas Aktif: <strong>{currentUser?.name}</strong> ({currentUser?.email})
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateTo('beranda')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold border border-emerald-500/30 transition-all cursor-pointer inline-flex items-center space-x-1.5 shadow-sm active:scale-95"
              title="Buka Beranda Publik (Sesi Admin tetap tersimpan)"
            >
              <Home className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>Buka Beranda</span>
            </button>
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Ganti Password</span>
            </button>
            <button
              onClick={() => {
                logout();
                addToast('info', 'Keluar Dari Sesi Admin', 'Sesi administrasi Anda telah ditutup.');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Keluar Sesi</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Floating Action Button for Admin Menu (Visible only when scrolled past header on MOBILE) */}
      <div 
        className={`fixed top-[90px] sm:top-[115px] left-4 z-40 lg:hidden transition-all duration-300 ease-in-out ${
          isCompactSticky 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <button
          onClick={() => setIsAdminSidebarOpen(true)}
          className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-slate-700/50 text-white flex items-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
          title="Buka Menu Navigasi Admin"
        >
          <Menu className="w-5 h-5" />
          <div className="flex items-center gap-2 pl-1">
            {/* Strict Platform Path for FAB - Prioritize Icon Only */}
            {((sadewaIcon && sadewaIcon.length > 10) || (sadewaLogo && sadewaLogo.length > 10)) && !sadewaImgError ? (
              <img 
                 src={sadewaIcon || sadewaLogo} 
                 alt="SADEWA Branding" 
                 className={`h-8 w-auto object-contain brightness-0 invert opacity-90 ${sadewaIcon ? 'scale-110' : ''}`}
                 onError={() => setSadewaImgError(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div className="bg-emerald-950/40 rounded p-1 border border-emerald-900/50 shadow-sm">
                   <SadewaHouseLogo size={18} className="text-emerald-400" />
                </div>
                <div className="flex flex-col leading-none items-start">
                  <span className="text-[10px] font-black tracking-tighter text-emerald-400">SADEWA</span>
                  <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Digital</span>
                </div>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Main Admin Content Container */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 min-h-[500px] w-full">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Sidebar Component */}
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOpen={isAdminSidebarOpen}
            onClose={() => setIsAdminSidebarOpen(false)}
            pendingRequests={serviceRequests.filter(r => r.status === 'diajukan').length}
            activeComplaints={complaints.filter(c => c.status !== 'selesai' && c.status !== 'ditolak').length}
            developmentProjectsCount={developmentProjects.length}
            territoriesCount={territories.length}
            officialsCount={officials.length}
            facilitiesCount={facilities.length}
            umkmCount={umkm.length}
            newsCount={news.length}
            villageProfile={villageProfile}
          />

          {/* Main Tab Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {adminIsLoading ? (
          <div className="space-y-6">
            {activeTab === 'overview' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
                <TableSkeleton rows={6} />
              </>
            ) : ['services', 'complaints', 'audit', 'users', 'news', 'announcements'].includes(activeTab) ? (
              <TableSkeleton rows={10} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            )}
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats Kependudukan & Bansos (SSOT) */}
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Sensus Kependudukan & Bantuan Sosial (SSOT)
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Metrik riil bersumber langsung dari Database Kependudukan tunggal</p>
                </div>
                <div className="self-start sm:self-auto px-2.5 py-0.5 rounded-lg text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  SSOT SINKRON
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-1 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setActiveTab('residents')}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Penduduk</span>
                  <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                    {sensusStats.totalPenduduk.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-400">Jiwa</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Warga berstatus Hidup</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-1 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setActiveTab('residents')}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total KK</span>
                  <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                    {sensusStats.totalKK.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-400">Kepala</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Keluarga terdaftar</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-1 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setActiveTab('bansos')}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Penerima Bansos Aktif</span>
                  <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                    {sensusStats.activeBansos.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-400">KPM</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">Tersinkronisasi NIK</div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-1 hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => setActiveTab('posyandu')}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jumlah Balita</span>
                  <div className="text-xl font-black text-slate-900 font-mono flex items-baseline gap-1">
                    {sensusStats.totalBalita.toLocaleString('id-ID')} <span className="text-[10px] font-bold text-slate-400">Anak</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Rentang usia ≤ 5 tahun</div>
                </div>
              </div>
            </div>

            {/* Top Stat Cards (Administratif) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setActiveTab('services')}>
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Permohonan Menunggu</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{serviceRequests.filter(r => r.status === 'diajukan').length} Surat Pending</div>
                <div className="text-[11px] text-amber-700 font-semibold">
                  Perlu verifikasi & tandatangan
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setActiveTab('complaints')}>
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Aspirasi & Laporan Aktif</span>
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{complaints.filter(c => c.status !== 'selesai' && c.status !== 'ditolak').length} Pengaduan Baru</div>
                <div className="text-[11px] text-slate-500">Infrastruktur & Pelayanan</div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setActiveTab('apbdes')}>
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Realisasi APBDes</span>
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{budget.realizationPercentage}%</div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Dari Rp {budget.totalExpenditure.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setActiveTab('audit')}>
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Audit Trail Terdata</span>
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{auditLogs.length} Aksi</div>
                <div className="text-[11px] text-blue-700 font-semibold">Terekam di sistem keamanan</div>
              </div>
            </div>

            {/* Real-Time Sensus Pekerjaan Widget */}
            <OccupationStatsChart 
              onSelectOccupationFilter={() => setActiveTab('residents')} 
            />

            {/* Quick Workflow Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Service Requests Waiting */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Permohonan Surat Terbaru Masuk</h2>
                    <p className="text-[11px] text-slate-500">Menunggu tindakan dari operator / sekretariat</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('services')}
                    className="text-xs text-emerald-700 font-bold hover:underline"
                  >
                    Buka Semua ({serviceRequests.length})
                  </button>
                </div>

                <div className="space-y-3">
                  {serviceRequests.slice(0, 3).map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-emerald-800">
                            {req.trackingCode}
                          </span>
                          <ServiceStatusBadge status={req.status} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1">{req.serviceName}</h4>
                        <div className="text-[11px] text-slate-500">
                          {req.citizenName} • {req.addressDusun}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setNewReqStatus(req.status);
                          setStaffNote(req.staffNotes || '');
                          setActiveTab('services');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-emerald-800 hover:border-emerald-400 shadow-sm"
                      >
                        Proses
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Complaints */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Aspirasi & Laporan Masyarakat</h2>
                    <p className="text-[11px] text-slate-500">Perlu tindak lanjut atau tanggapan resmi</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('complaints')}
                    className="text-xs text-amber-700 font-bold hover:underline"
                  >
                    Buka Semua ({complaints.length})
                  </button>
                </div>

                <div className="space-y-3">
                  {complaints.slice(0, 3).map((cmp) => (
                    <div
                      key={cmp.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:bg-slate-100 transition-colors"
                    >
                      <div className="max-w-[70%]">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[11px] font-bold text-amber-800">
                            {cmp.ticketNumber}
                          </span>
                          <ComplaintStatusBadge status={cmp.status} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">{cmp.title}</h4>
                        <div className="text-[11px] text-slate-500 truncate">
                          {cmp.reporterName} • {cmp.location}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedComplaint(cmp);
                          setNewComplaintStatus(cmp.status);
                          setComplaintResponse(cmp.adminResponse || '');
                          setActiveTab('complaints');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-amber-800 hover:border-amber-400 shadow-sm"
                      >
                        Tanggapi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS (SENSUS DIGITAL) */}
        {activeTab === 'analytics' && <AnalyticsDashboard />}

        {/* TAB: MASTER DATA PENDUDUK (DATABASE DESA) */}
        {activeTab === 'residents' && <PopulationManager />}

        {/* TAB 2: MANAJEMEN BUKU KENDALI & ARSIP SURAT RESMI */}
        {activeTab === 'services' && (
          <LetterArchivesManager
            requests={serviceRequests}
            onSelectRequest={(req) => {
              setSelectedRequest(req);
              setNewReqStatus(req.status);
              setStaffNote(req.staffNotes || '');
            }}
            onPreviewLetter={(req) => setPrintModalRequest(req)}
            onSendWhatsApp={(req) => sendCitizenWhatsApp(req, req.status, req.staffNotes || '')}
            onDeleteRequest={(reqId, reason) => deleteServiceRequest(reqId, reason)}
            onBulkDeleteRequest={(reqIds, reason) => bulkDeleteServiceRequests(reqIds, reason)}
          />
        )}

        {/* TAB 3: MANAJEMEN PENGADUAN */}
        {activeTab === 'complaints' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Pusat Penanganan Aspirasi & Pengaduan Warga
                </h2>
                <p className="text-xs text-slate-500">
                  Laporan masyarakat yang masuk ditindaklanjuti secara berjenjang oleh tim pelaksana desa.
                </p>
              </div>

              <button
                onClick={handleExportComplaintsCsv}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center space-x-1.5 transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer border border-slate-200 self-start sm:self-auto"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Ekspor CSV Aduan</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3">No. Tiket</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Judul Pengaduan</th>
                    <th className="p-3">Pelapor & Lokasi</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-800">{c.ticketNumber}</td>
                      <td className="p-3 font-semibold uppercase text-[10px] text-slate-500">
                        {c.category}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 max-w-xs truncate">{c.title}</div>
                        <div className="text-slate-500 text-[11px] line-clamp-1">{c.content}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{c.reporterName}</div>
                        <div className="text-slate-400 text-[10px]">{c.location}</div>
                      </td>
                      <td className="p-3">
                        <ComplaintStatusBadge status={c.status} />
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedComplaint(c);
                            setNewComplaintStatus(c.status);
                            setComplaintResponse(c.adminResponse || '');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors"
                        >
                          Tindak Lanjut
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: MANAJEMEN BERITA */}
        {activeTab === 'news' && <NewsManager />}

        {/* TAB 5: PENGUMUMAN & AGENDA */}
        {activeTab === 'announcements' && <AnnouncementsManager />}

        {/* TAB 6: AUDIT TRAIL / LOG KEAMANAN SISTEM */}
        {activeTab === 'audit' && (
          <div className="space-y-12">
            {/* MASTER RESET TOOL (DANGER ZONE) */}
            {currentUser?.role === 'super_admin' && (
              <MasterResetTool />
            )}

            {/* PANEL PENGATURAN BRANDING & LOGO SISTEM (RESTRICTED TO SUPER_ADMIN & ADMIN_DESA) */}
            {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin_desa') && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm ring-1 ring-emerald-500/10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">Visual Branding Sistem SADEWA</h2>
                          {currentUser?.role === 'super_admin' ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">Akses Super Admin</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Akses Admin Desa (Banner)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">Kelola identitas visual platform, logo induk, dan banner promosi utama.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Logo Induk SADEWA */}
                    <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/30 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Logo Induk SADEWA</h4>
                          <p className="text-[10px] text-slate-500">Sidebar, Login, & Footer</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-emerald-200/50 shadow-inner">
                        <div className="h-24 w-full rounded-xl bg-slate-900 flex items-center justify-center p-4">
                          {villageProfile.sadewaLogoUrl ? (
                            <img
                              src={villageProfile.sadewaLogoUrl}
                              alt="Logo Induk"
                              className="max-w-full max-h-full object-contain brightness-0 invert"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-600 font-bold">LOGO BELUM DIUNGGAH</span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <input
                            type="file"
                            ref={sadewaLogoInputRef}
                            onChange={(e) => handleBrandingFileUpload(e, 'sadewa')}
                            accept="image/*"
                            className="hidden"
                          />
                          {currentUser?.role === 'super_admin' ? (
                            <button
                              type="button"
                              onClick={() => sadewaLogoInputRef.current?.click()}
                              disabled={uploadingBrandingTarget === 'sadewa'}
                              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>{uploadingBrandingTarget === 'sadewa' ? 'Mengunggah...' : 'Ganti Logo Induk'}</span>
                            </button>
                          ) : (
                            <div className="w-full text-center py-2 px-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold">
                              🔒 Terkunci: Hanya Super Admin yang dapat mengubah logo induk
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ikon Simbol SADEWA */}
                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shadow-sm">
                          <Home className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ikon Simbol (Compact)</h4>
                          <p className="text-[10px] text-slate-500">Favicon & Mini Sidebar</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                        <div className="w-24 h-24 rounded-xl bg-slate-900 flex items-center justify-center p-4 shrink-0">
                          {villageProfile.sadewaIconUrl ? (
                            <img src={villageProfile.sadewaIconUrl} alt="Ikon" className="max-w-full max-h-full object-contain brightness-0 invert" />
                          ) : (
                            <Home className="w-8 h-8 text-slate-700" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            type="file"
                            ref={sadewaIconInputRef}
                            onChange={(e) => handleBrandingFileUpload(e, 'sadewa_icon')}
                            accept="image/*"
                            className="hidden"
                          />
                          {currentUser?.role === 'super_admin' ? (
                            <button
                              type="button"
                              onClick={() => sadewaIconInputRef.current?.click()}
                              disabled={uploadingBrandingTarget === 'sadewa_icon'}
                              className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Unggah Ikon</span>
                            </button>
                          ) : (
                            <div className="w-full text-center py-2 px-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold">
                              🔒 Terkunci: Hanya Super Admin yang dapat mengubah favicon
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 italic font-medium leading-tight">
                            Gunakan rasio 1:1 (kotak) untuk tampilan terbaik pada mobile favicon.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Hero Banner Visual */}
                    <div className="lg:col-span-2 p-5 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <ImageIcon className="w-32 h-32" />
                      </div>
                      
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-emerald-600" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Banner Utama Beranda (Hero Section)</h4>
                            <p className="text-[10px] text-slate-500">Gambar latar belakang utama portal publik desa.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={heroBackgroundInputRef}
                            onChange={(e) => handleBrandingFileUpload(e, 'hero')}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => heroBackgroundInputRef.current?.click()}
                            disabled={uploadingBrandingTarget === 'hero'}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                            <span>{uploadingBrandingTarget === 'hero' ? 'Mengunggah...' : 'Unggah Banner'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleExportHeroBannerPdf}
                            disabled={isExportingHeroPdf || !villageProfile.heroBackgroundUrl}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>{isExportingHeroPdf ? 'Mencetak...' : 'Cetak Banner (PDF)'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="h-48 w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden relative group">
                        {villageProfile.heroBackgroundUrl ? (
                          <img src={villageProfile.heroBackgroundUrl} alt="Hero Preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <ImageIcon className="w-12 h-12 mb-2 opacity-10" />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Belum Ada Banner</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest">
                            Pratinjau Banner
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-900 leading-relaxed">
                          <strong>Tips Visual:</strong> Gunakan foto berkualitas tinggi dengan resolusi minimal 1920x1080px. Foto lanskap desa, persawahan, atau ikon wilayah sangat disarankan untuk membangun kesan pertama yang kuat bagi pengunjung.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm ring-1 ring-emerald-500/10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">Keamanan & Integritas Sistem</h2>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">Akses Super Admin</span>
                        </div>
                        <p className="text-xs text-slate-500">Master integritas data dan rekam jejak aktivitas administrator desa.</p>
                      </div>
                    </div>
                  </div>

                <div className="space-y-4 pt-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Penting: Backup Data Rutin
                    </h3>
                    <p className="text-[11px] text-amber-800 mt-1 mb-3">
                      Administrator sangat disarankan untuk melakukan pengunduhan cadangan (JSON) basis data desa secara berkala guna menjamin keamanan data lokal jika terjadi kendala pada server awan.
                    </p>
                  </div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Integritas Data Sistem</h3>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => createBackup(() => addToast('success', 'Cadangkan Selesai', 'Snapshot data sistem SADEWA berhasil diunduh ke file JSON.'))}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Cadangkan Data (JSON)
                    </button>
                    <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer shadow-emerald-200 flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" />
                      Pulihkan Data (JSON)
                      <input
                        type="file"
                        className="hidden"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            restoreBackup(
                              file,
                              () => {
                                addToast('success', 'Data Dipulihkan', 'Basis data berhasil dipulihkan dari snapshot JSON. Halaman akan dimuat ulang.');
                                setTimeout(() => window.location.reload(), 1200);
                              },
                              (errMsg) => addToast('error', 'Gagal Pulihkan', errMsg)
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-3 gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Log Audit & Rekam Jejak Keamanan Sistem
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap aktivitas pembaruan data, manipulasi anggaran, dan perubahan status surat tercatat secara kekal dengan indikator tingkat sensitivitas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-xl">
                  Ditampilkan: <strong className="text-emerald-700">{filteredAuditLogs.length}</strong> / {auditLogs.length}
                </span>
              </div>
            </div>

            {/* Filter Toolbar Audit Logs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs">
              {/* Search Bar */}
              <div className="relative lg:col-span-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari rincian / aksi / IP..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Rentang Waktu Filter */}
              <div className="lg:col-span-1">
                <div className="flex items-center space-x-0.5 bg-white border border-slate-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setLogTimeRange('all')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      logTimeRange === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTimeRange('24h')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      logTimeRange === '24h'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    24 Jam
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTimeRange('7d')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      logTimeRange === '7d'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    7 Hari
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTimeRange('30d')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      logTimeRange === '30d'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    30 Hari
                  </button>
                </div>
              </div>

              {/* Criticality Level Filter */}
              <div>
                <select
                  value={logSelectedLevel}
                  onChange={(e) => setLogSelectedLevel(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Level</option>
                  <option value="critical">Kritis (Critical)</option>
                  <option value="error">Error / Sensitif</option>
                  <option value="warning">Peringatan (Warning)</option>
                  <option value="info">Informasi (Info)</option>
                </select>
              </div>

              {/* Admin / Petugas Filter */}
              <div>
                <select
                  value={logSelectedUser}
                  onChange={(e) => setLogSelectedUser(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Admin / Petugas</option>
                  {uniqueLogUsers.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modul Filter */}
              <div>
                <select
                  value={logSelectedModule}
                  onChange={(e) => setLogSelectedModule(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">Semua Modul Sistem</option>
                  {uniqueLogModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table with Visual Criticality Indicators */}
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3 w-28">Tingkat / Level</th>
                    <th className="p-3">Waktu Log</th>
                    <th className="p-3">Pengguna / Peran</th>
                    <th className="p-3">Modul</th>
                    <th className="p-3">Jenis Aksi</th>
                    <th className="p-3">Rincian Tindakan</th>
                    <th className="p-3">IP Pengakses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-sans text-xs">
                        Tidak ada catatan log audit yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const levelMeta = getLogLevelDetails(log);
                      const LevelIcon = levelMeta.Icon;
                      return (
                        <tr key={log.id} className={`transition-colors ${levelMeta.rowClass}`}>
                          {/* Visual Indicator Badge Column */}
                          <td className="p-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-wide ${levelMeta.badgeClass}`}>
                              <LevelIcon className={`w-3.5 h-3.5 shrink-0 ${levelMeta.iconColor}`} />
                              <span>{levelMeta.label}</span>
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{log.timestamp}</td>
                          <td className="p-3 font-sans font-bold text-slate-900 whitespace-nowrap">
                            {log.userName}
                            <div className="text-[10px] font-normal text-slate-400 font-mono capitalize">
                              {log.userRole || 'Admin'}
                            </div>
                          </td>
                          <td className="p-3 font-sans text-slate-600 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-medium text-[10px]">
                              {log.module || 'Sistem'}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              levelMeta.level === 'critical'
                                ? 'bg-red-200 text-red-900 border border-red-300'
                                : levelMeta.level === 'error'
                                ? 'bg-rose-200 text-rose-900'
                                : levelMeta.level === 'warning'
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-slate-800 leading-relaxed font-medium">
                            {log.details}
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{log.ipAddress || '127.0.0.1'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

        {/* TAB: BANTUAN SOSIAL & KPM DESA */}
        {activeTab === 'bansos' && <BansosManager />}

        {/* TAB: WEBGIS & PEMETAAN SPASIAL (PBB-P2 & SPORADIK) */}
        {activeTab === 'webgis' && <WebGisManager />}

        {/* TAB: e-POSYANDU & MONITORING STUNTING SPASIAL */}
        {activeTab === 'posyandu' && <PosyanduManager />}

        {/* TAB: TRANSPARANSI APBDES & GENERATOR BALIHO */}
        {activeTab === 'apbdes' && <ApbdesManager />}

        {/* TAB: POTENSI DESA & KOMODITAS */}
        {activeTab === 'potential' && <PotentialManager />}

        {/* TAB: IDENTITAS DESA & KOP SURAT */}
        {activeTab === 'profile' && <VillageProfileManager />}

        {/* TAB: MASTER WILAYAH (DUSUN / RW / RT) */}
        {activeTab === 'territories' && <TerritoriesManager />}

        {/* TAB: APARATUR, RT & LEMBAGA DESA */}
        {activeTab === 'officials' && <OfficialsManager />}

        {/* TAB: FASILITAS, TEMPAT & PETA DESA */}
        {activeTab === 'facilities' && <FacilitiesManager />}

        {/* TAB: KATALOG UMKM DESA */}
        {activeTab === 'umkm' && <UmkmManager />}

        {/* TAB: LAPORAN KEHADIRAN PERANGKAT DESA */}
        {activeTab === 'attendance' && <AttendanceLogManager />}

        {/* TAB: MANAJEMEN PENGGUNA (AKSES SISTEM) */}
        {activeTab === 'users' && <UserManager />}

        {/* TAB: PEMELIHARAAN & BACKUP SISTEM (SUPER ADMIN) */}
        {activeTab === 'backup' && <BackupManager />}
      </>
    )}
  </div>
</div>
</div>

      {/* SERVICE ACTION MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedRequest(null)}
          />

          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-800">
                  {selectedRequest.trackingCode}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  Proses Permohonan: {selectedRequest.serviceName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Applicant Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Nama Pemohon:</span>
                <strong className="text-slate-900">{selectedRequest.citizenName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">NIK Terproteksi:</span>
                <strong className="font-mono text-slate-900">{selectedRequest.citizenNikMasked}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nomor Kontak:</span>
                <strong className="font-mono text-slate-900">{selectedRequest.phone}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Wilayah:</span>
                <strong className="text-slate-900">{selectedRequest.addressDusun}</strong>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200/50">
                <span className="text-slate-400 block text-[11px]">Tujuan & Keperluan Surat:</span>
                <p className="text-slate-700">{selectedRequest.notes}</p>
              </div>
              {selectedRequest.officialLetterNumber && (
                <div className="col-span-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-emerald-700 block text-[10px] uppercase font-bold tracking-wider">Nomor Agenda Surat Resmi (Arsip Digital):</span>
                    <span className="font-mono font-black text-xs text-emerald-950">{selectedRequest.officialLetterNumber}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase">
                    Terdaftar & Valid
                  </span>
                </div>
              )}
            </div>

            {/* Berkas KTP & Lampiran Pemohon */}
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Berkas Verifikasi Identitas (KTP & Dokumen)</span>
                </span>
                {selectedRequest.ktpAttachmentUrl ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    KTP Terlampir
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
                    KTP Fisik Saat Pengambilan
                  </span>
                )}
              </div>

              {selectedRequest.ktpAttachmentUrl ? (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  {selectedRequest.ktpAttachmentUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i) ? (
                    <div
                      onClick={() => setAdminPreviewImage(selectedRequest.ktpAttachmentUrl!)}
                      className="w-20 h-14 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 cursor-pointer relative group shrink-0"
                    >
                      <img
                        src={selectedRequest.ktpAttachmentUrl}
                        alt="KTP Pemohon"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">Scan / Foto KTP Asli</p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">
                      {selectedRequest.ktpAttachmentUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setAdminPreviewImage(selectedRequest.ktpAttachmentUrl!)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>Buka Jelas</span>
                    </button>
                    <a
                      href={selectedRequest.ktpAttachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]"
                      title="Buka Berkas di Tab Baru"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Pemohon mengajukan secara langsung tanpa upload berkas digital. Petugas wajib memverifikasi KTP fisik di kantor desa.</span>
                </div>
              )}

              {selectedRequest.fileAttachmentUrl && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                  <span className="text-slate-700 font-medium truncate max-w-[240px]">
                    Lampiran Pendukung: {selectedRequest.fileAttachmentUrl}
                  </span>
                  <a
                    href={selectedRequest.fileAttachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 font-bold hover:underline ml-2"
                  >
                    Buka Dokumen
                  </a>
                </div>
              )}
            </div>

            {/* Status Update Form */}
            <form onSubmit={handleSaveServiceStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Tahapan Status Baru:
                </label>
                <select
                  value={newReqStatus}
                  onChange={(e) => setNewReqStatus(e.target.value as any)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="diajukan">1. Diajukan (Menunggu Antrean)</option>
                  <option value="diverifikasi">2. Berkas Diverifikasi Operator</option>
                  <option value="diproses">3. Sedang Diproses Pengetikan</option>
                  <option value="disetujui">4. Disetujui & TTD Elektronik Kepala Desa</option>
                  <option value="selesai">5. Selesai (Siap Diambil di Kantor Desa)</option>
                  <option value="ditolak">6. Ditolak / Berkas Tidak Lengkap</option>
                  <option value="dibatalkan">7. Dibatalkan / Dicabut (Dokumen Tidak Sah)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan / Instruksi untuk Pemohon (Dilihat oleh Warga saat Lacak Resi):
                </label>
                <textarea
                  rows={3}
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Contoh: Berkas Anda telah selesai dicetak. Silakan membawa KTP asli ke loket pelayanan kantor desa."
                  className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Panel Kontrol WhatsApp Gateway (Toggle ON/OFF & Pratinjau Real-Time) */}
              {selectedRequest && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                  {/* Header & Toggle Switch */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isWaGatewayActive ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                        {isWaGatewayActive ? <Radio className="w-4 h-4 animate-pulse" /> : <MessageSquare className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-bold text-xs">WhatsApp Gateway Engine</strong>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${isWaGatewayActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                            {isWaGatewayActive ? 'STATUS: AKTIF (AUTO)' : 'STATUS: NONAKTIF (MANUAL)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {isWaGatewayActive
                            ? 'Otomatisasi pengiriman pesan sesuai klasifikasi surat (Kelas A/B) & salam Nusantara.'
                            : 'Mode cadangan: Menyalin templat birokrasi digital resmi untuk SOP manual kantor desa.'}
                        </p>
                      </div>
                    </div>

                    {/* Ergonomic Switch Toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0 self-end sm:self-center">
                      <span className="text-[11px] font-bold text-slate-700">Auto Gateway</span>
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={isWaGatewayActive}
                          onChange={(e) => setIsWaGatewayActive(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </div>
                    </label>
                  </div>

                  {/* Pratinjau Teks Pesan */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        {isWaGatewayActive ? 'Pratinjau Redaksi Pesan Otomatis (Inklusif Nusantara):' : 'Pratinjau Format Pesan Manual / Cadangan:'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyWaMessageToClipboard(selectedRequest, newReqStatus, staffNote)}
                          className="text-[11px] font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-100 transition-colors"
                          title="Salin Pesan ke Clipboard"
                        >
                          <Copy className="w-3 h-3 text-slate-600" />
                          <span>Salin Teks</span>
                        </button>
                        {selectedRequest.phone && (
                          <button
                            type="button"
                            onClick={() => sendCitizenWhatsApp(selectedRequest, newReqStatus, staffNote)}
                            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Send className="w-3 h-3 text-emerald-700" />
                            <span>Kirim WA</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-800 bg-white p-3 rounded-xl border border-slate-200 font-sans leading-relaxed whitespace-pre-line shadow-2xs max-h-48 overflow-y-auto">
                      {generateWAMessage({
                        citizenName: selectedRequest.citizenName,
                        serviceName: selectedRequest.serviceName,
                        trackingCode: selectedRequest.trackingCode,
                        status: newReqStatus,
                        adminNotes: staffNote,
                        officialLetterNumber: selectedRequest.officialLetterNumber,
                        villageName: villageProfile?.villageName,
                        district: villageProfile?.district,
                        regency: villageProfile?.regency,
                        documentUrl: getLetterVerificationUrl(selectedRequest.trackingCode),
                        requirements: getServiceRequirements(selectedRequest.serviceName),
                        isGatewayActive: isWaGatewayActive
                      })}
                    </div>
                  </div>

                  {/* Checkbox Trigger Saat Simpan */}
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyViaWA}
                      onChange={(e) => setNotifyViaWA(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] font-medium text-slate-700">
                      Buka aplikasi WhatsApp ke pemohon ({selectedRequest.phone || 'Nomor HP tidak ada'}) otomatis saat tombol Simpan ditekan
                    </span>
                  </label>
                </div>
              )}

              {/* Direct Official Letter Full Print & Authentic QR Modal Trigger */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-emerald-950">Lembar Format Surat Resmi (A4 & QR Asli)</strong>
                    <span className="text-[11px] text-emerald-700">Dilengkapi kop garuda, nomor registrasi otomatis & QR verifikasi keabsahan.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPrintModalRequest(selectedRequest);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 shrink-0 self-stretch sm:self-auto justify-center"
                  id="btn-preview-official-modal-from-update"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Buka Lembar A4 & Cetak</span>
                </button>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Yakin ingin menghapus berkas pengajuan / uji coba ${selectedRequest.trackingCode} (${selectedRequest.citizenName}) secara permanen?`)) {
                      deleteServiceRequest(selectedRequest.id);
                      setSelectedRequest(null);
                      addToast('info', 'Data Dihapus', `Berkas permohonan ${selectedRequest.trackingCode} berhasil dihapus.`);
                    }
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer self-start sm:self-auto"
                  title="Hapus berkas ini (berguna untuk membersihkan data uji coba)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Permohonan (Uji Coba)</span>
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
                  >
                    Simpan Perubahan Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLAINT ACTION MODAL */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedComplaint(null)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-amber-800">
                  {selectedComplaint.ticketNumber}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Tindak Lanjut Pengaduan</h3>
              </div>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900">{selectedComplaint.title}</h4>
              <p className="text-slate-600">{selectedComplaint.content}</p>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200/50 flex justify-between">
                <span>Pelapor: {selectedComplaint.reporterName}</span>
                <span>Lokasi: {selectedComplaint.location}</span>
              </div>
            </div>

            <form onSubmit={handleSaveComplaintStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Penanganan Aduan:</label>
                <select
                  value={newComplaintStatus}
                  onChange={(e) => setNewComplaintStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value="diterima">Diterima & Terdaftar</option>
                  <option value="diverifikasi">Diverifikasi ke Lokasi / RT</option>
                  <option value="diproses">Dalam Proses Penanganan Tim Desa</option>
                  <option value="selesai">Selesai / Permasalahan Dituntaskan</option>
                  <option value="ditolak">Ditolak / Di Luar Kewenangan Desa</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tanggapan Resmi Pemerintah Desa (Dipublikasikan ke pelapor):
                </label>
                <textarea
                  rows={3}
                  required
                  value={complaintResponse}
                  onChange={(e) => setComplaintResponse(e.target.value)}
                  placeholder="Jelaskan langkah konkret yang telah atau akan diambil oleh pemerintah desa..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Proof of Work */}
              {newComplaintStatus === 'selesai' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Wajib Proof of Work (Selesai)
                    </span>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Foto Bukti Penyelesaian
                    </label>
                    <div className="flex flex-col gap-3">
                      <input
                        type="file"
                        ref={proofFileInputRef}
                        onChange={handleProofFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => proofFileInputRef.current?.click()}
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-all text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        {proofImage ? 'Ganti Foto Bukti' : 'Unggah Foto Bukti'}
                      </button>
                      {proofImage && (
                        <div className="h-24 w-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                          <img src={proofImage} alt="Bukti" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Catatan Tindak Lanjut
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      placeholder="Ringkasan hasil pengerjaan di lapangan..."
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
                >
                  Kirim Tanggapan Resmi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* OFFICIAL LETTER PRINT MODAL */}
      {printModalRequest && (
        <OfficialLetterPrintModal
          isOpen={Boolean(printModalRequest)}
          onClose={() => setPrintModalRequest(null)}
          request={printModalRequest}
          isAdminView={true}
        />
      )}

      {/* ADMIN KTP & ATTACHMENT FULL RESOLUTION MODAL */}
      {adminPreviewImage && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setAdminPreviewImage(null)}
          />
          <div className="relative max-w-3xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl z-10 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">Verifikasi Berkas KTP Pemohon (Resolusi Penuh)</span>
              </div>
              <button
                onClick={() => setAdminPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xs text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-100">
              <img
                src={adminPreviewImage}
                alt="KTP Pemohon"
                className="max-w-full max-h-[65vh] object-contain rounded-xl shadow border border-slate-300"
              />
            </div>
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
              <a
                href={adminPreviewImage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas Asli</span>
              </a>
              <button
                onClick={() => setAdminPreviewImage(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto p-4 flex items-center justify-center">
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" 
            onClick={() => setIsPasswordModalOpen(false)} 
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Ganti Password Dashboard</h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Password ini digunakan untuk masuk ke dashboard admin <strong>(Bukan Secrets AI Studio)</strong>. Gunakan minimal 6 karakter kombinasi huruf dan angka.</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username Anda:</label>
                <input 
                  type="text" 
                  disabled 
                  value={currentUser?.username || ''} 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password Baru:</label>
                <input 
                  type="password" 
                  placeholder="Masukkan password baru..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs" 
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  disabled={isChangingPassword || newPassword.length < 6}
                  onClick={async () => {
                    if (!currentUser) return;
                    setIsChangingPassword(true);
                    try {
                      const { api } = await import('../../services/api');
                      const targetId = currentUser.userId || currentUser.id;
                      if (!targetId) return;
                      const res = await api.changePassword(targetId, newPassword);
                      if (res.success) {
                        addToast('success', 'Password Diperbarui', 'Password Anda berhasil diubah. Sesi tetap aktif.');
                        setIsPasswordModalOpen(false);
                        setNewPassword('');
                      } else {
                        addToast('error', 'Gagal', res.error || 'Terjadi kesalahan saat menyimpan password.');
                      }
                    } catch (err) {
                      addToast('error', 'Error', 'Gagal terhubung ke server.');
                    } finally {
                      setIsChangingPassword(false);
                    }
                  }}
                  className="flex-[2] py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-lg shadow-emerald-700/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isChangingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

