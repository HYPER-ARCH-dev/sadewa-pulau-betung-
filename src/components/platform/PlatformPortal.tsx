import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Database,
  Globe,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  Trash2,
  Copy,
  Check,
  Server,
  ScrollText,
  X,
  Menu,
  ArrowLeft,
  Ban,
  PlayCircle
} from 'lucide-react';
import {
  addPlatformCustomDomain,
  claimPlatformBootstrapAdmin,
  clearPlatformAccessToken,
  createPlatformTenant,
  deletePlatformCustomDomain,
  fetchPlatformAuditLogs,
  fetchPlatformBootstrapStatus,
  fetchPlatformOverview,
  fetchPlatformTenants,
  loginPlatformAdmin,
  logoutPlatformAdmin,
  onPlatformUnauthorized,
  PlatformAuditLogItem,
  PlatformDomainRecord,
  PlatformOverviewStats,
  PlatformTenantRecord,
  PlatformUserProfile,
  revokePlatformDedicatedDb,
  rotatePlatformDedicatedDb,
  savePlatformDedicatedDb,
  testPlatformDedicatedDb,
  triggerPlatformTenantBackup,
  updatePlatformTenantStatus,
  verifyPlatformDomainDns
} from '../../services/platformApi';

type PlatformSection = 'overview' | 'tenants' | 'domains' | 'databases' | 'audit';

function formatTimestampId(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function StatusDotText({
  tone,
  label
}: {
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  label: string;
}) {
  const dotClass =
    tone === 'emerald'
      ? 'bg-emerald-600'
      : tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'rose'
      ? 'bg-rose-600'
      : 'bg-slate-400';

  const textClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'amber'
      ? 'text-amber-700'
      : tone === 'rose'
      ? 'text-rose-700'
      : 'text-slate-600';

  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${textClass}`}>
      <span className={`w-2 h-2 rounded-full ${dotClass} shrink-0`} />
      <span>{label}</span>
    </span>
  );
}

export const PlatformPortal: React.FC = () => {
  const [user, setUser] = useState<PlatformUserProfile | null>(null);
  const [bootstrapChecked, setBootstrapChecked] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [databaseOffline, setDatabaseOffline] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [platformDomain, setPlatformDomain] = useState('sadewa.id');
  const [cnameTarget, setCnameTarget] = useState('cname.sadewa.id');

  // Auth form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [bootName, setBootName] = useState('');
  const [bootUsername, setBootUsername] = useState('');
  const [bootEmail, setBootEmail] = useState('');
  const [bootPassword, setBootPassword] = useState('');
  const [bootPasscode, setBootPasscode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Dashboard states
  const [activeSection, setActiveSection] = useState<PlatformSection>('overview');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [overviewStats, setOverviewStats] = useState<PlatformOverviewStats | null>(null);
  const [tenants, setTenants] = useState<PlatformTenantRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLogItem[]>([]);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'SHARED' | 'DEDICATED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  // Create Tenant Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newMode, setNewMode] = useState<'SHARED' | 'DEDICATED'>('SHARED');
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [newDistrict, setNewDistrict] = useState('');
  const [newRegency, setNewRegency] = useState('');
  const [newProvince, setNewProvince] = useState('');
  const [newDedicatedUrl, setNewDedicatedUrl] = useState('');
  const [newDirectUrl, setNewDirectUrl] = useState('');
  const [seedInitialAdmin, setSeedInitialAdmin] = useState(true);
  const [initAdminName, setInitAdminName] = useState('');
  const [initAdminUser, setInitAdminUser] = useState('');
  const [initAdminEmail, setInitAdminEmail] = useState('');
  const [initAdminPassword, setInitAdminPassword] = useState('');
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // Domain Management Drawer
  const [domainTargetTenant, setDomainTargetTenant] = useState<PlatformTenantRecord | null>(null);
  const [customDomainInput, setCustomDomainInput] = useState('');
  const [customDomainPrimary, setCustomDomainPrimary] = useState(false);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Dedicated DB Management Drawer
  const [dbTargetTenant, setDbTargetTenant] = useState<PlatformTenantRecord | null>(null);
  const [dbUrlInput, setDbUrlInput] = useState('');
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [supabaseUrlInput, setSupabaseUrlInput] = useState('');
  const [serviceKeyInput, setServiceKeyInput] = useState('');
  const [storageBucketInput, setStorageBucketInput] = useState('');
  const [dbProbeResult, setDbProbeResult] = useState<{
    reachable: boolean;
    maskedTarget: string;
    errorSummary: string | null;
  } | null>(null);
  const [isProbingDb, setIsProbingDb] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [isRotatingDb, setIsRotatingDb] = useState(false);
  const [isRevokingDb, setIsRevokingDb] = useState(false);
  const [isBackingUpTenant, setIsBackingUpTenant] = useState(false);

  useEffect(() => {
    document.title = 'SADEWA Control Plane | Manajemen Multi-Tenant SaaS';
    onPlatformUnauthorized(() => {
      setUser(null);
      setAuthError('Sesi pengelola platform berakhir atau telah dicabut. Silakan masuk kembali.');
    });
    return () => {
      onPlatformUnauthorized(null);
      clearPlatformAccessToken();
    };
  }, []);

  const loadBootstrapStatus = useCallback(async () => {
    try {
      const res = await fetchPlatformBootstrapStatus();
      if (res.success) {
        setNeedsBootstrap(Boolean(res.needsBootstrap));
        setDatabaseOffline(Boolean(res.databaseOffline));
        setDatabaseError(res.databaseError || null);
        setRequiresPasscode(Boolean(res.requiresPasscode));
        if (res.platformDomain) setPlatformDomain(res.platformDomain);
        if (res.cnameTarget) setCnameTarget(res.cnameTarget);
      }
    } finally {
      setBootstrapChecked(true);
    }
  }, []);

  useEffect(() => {
    loadBootstrapStatus();
  }, [loadBootstrapStatus]);

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoadingData(true);
    try {
      const [overviewRes, tenantsRes, logsRes] = await Promise.all([
        fetchPlatformOverview(),
        fetchPlatformTenants(),
        fetchPlatformAuditLogs(undefined, 80)
      ]);
      if (overviewRes.success) {
        setOverviewStats(overviewRes.stats);
      }
      if (tenantsRes.success && Array.isArray(tenantsRes.tenants)) {
        setTenants(tenantsRes.tenants);
        if (domainTargetTenant) {
          const refreshed = tenantsRes.tenants.find((t) => t.id === domainTargetTenant.id) || null;
          setDomainTargetTenant(refreshed);
        }
        if (dbTargetTenant) {
          const refreshed = tenantsRes.tenants.find((t) => t.id === dbTargetTenant.id) || null;
          setDbTargetTenant(refreshed);
        }
      }
      if (logsRes.success && Array.isArray(logsRes.logs)) {
        setAuditLogs(logsRes.logs);
      }
    } finally {
      setIsLoadingData(false);
    }
  }, [user, domainTargetTenant?.id, dbTargetTenant?.id]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (modeFilter !== 'ALL' && t.tenancyMode !== modeFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = t.name.toLowerCase().includes(q);
        const matchSlug = t.slug.toLowerCase().includes(q);
        const matchDomain = t.domains.some((d) => d.domain.toLowerCase().includes(q));
        if (!matchName && !matchSlug && !matchDomain) return false;
      }
      return true;
    });
  }, [tenants, modeFilter, statusFilter, searchQuery]);

  const allDomains = useMemo(() => {
    const items: Array<PlatformDomainRecord & { tenantName: string; tenantSlug: string }> = [];
    for (const t of tenants) {
      for (const d of t.domains) {
        items.push({ ...d, tenantName: t.name, tenantSlug: t.slug });
      }
    }
    return items;
  }, [tenants]);

  const handleCopy = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedText(val);
    setTimeout(() => setCopiedText(null), 1800);
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await claimPlatformBootstrapAdmin({
        name: bootName,
        username: bootUsername,
        email: bootEmail,
        password: bootPassword,
        bootstrapPasscode: bootPasscode || undefined
      });
      if (!res.success || !res.user) {
        setAuthError(res.error || 'Gagal mengaktivasi akun pengelola platform.');
        return;
      }
      setNeedsBootstrap(false);
      setUser(res.user);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await loginPlatformAdmin(loginUsername, loginPassword);
      if (!res.success || !res.user) {
        setAuthError(res.error || 'Gagal masuk ke Platform Control Plane.');
        return;
      }
      setLoginPassword('');
      setUser(res.user);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutPlatformAdmin();
    setUser(null);
    setOverviewStats(null);
    setTenants([]);
    setAuditLogs([]);
  };

  const handleCreateTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackBanner(null);
    setIsCreatingTenant(true);
    try {
      const res = await createPlatformTenant({
        slug: newSlug,
        name: newName,
        letterCodePrefix: newPrefix || undefined,
        tenancyMode: newMode,
        customDomain: newCustomDomain.trim() || undefined,
        databaseUrl: newMode === 'DEDICATED' ? newDedicatedUrl.trim() : undefined,
        directUrl: newMode === 'DEDICATED' ? newDirectUrl.trim() || undefined : undefined,
        district: newDistrict.trim() || undefined,
        regency: newRegency.trim() || undefined,
        province: newProvince.trim() || undefined,
        initialAdmin: seedInitialAdmin
          ? {
              name: initAdminName,
              username: initAdminUser,
              email: initAdminEmail,
              password: initAdminPassword
            }
          : undefined
      });

      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal mendaftarkan tenant desa.' });
        return;
      }

      setFeedbackBanner({
        type: 'success',
        message: res.seedingNotice
          ? `${res.tenant.name} terdaftar. ${res.seedingNotice}`
          : `Portal desa ${res.tenant.name} (${res.tenant.slug}.${platformDomain}) aktif dan siap digunakan.`
      });
      setIsCreateModalOpen(false);
      setNewSlug('');
      setNewName('');
      setNewPrefix('');
      setNewCustomDomain('');
      setNewDedicatedUrl('');
      setNewDirectUrl('');
      setInitAdminName('');
      setInitAdminUser('');
      setInitAdminEmail('');
      setInitAdminPassword('');
      await loadDashboardData();
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const handleToggleStatus = async (tenant: PlatformTenantRecord) => {
    const nextStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await updatePlatformTenantStatus(tenant.id, nextStatus);
    if (!res.success) {
      setFeedbackBanner({ type: 'error', message: res.error || 'Gagal mengubah status tenant.' });
      return;
    }
    setFeedbackBanner({
      type: 'success',
      message: `Status portal ${tenant.name} diperbarui menjadi ${nextStatus}.`
    });
    await loadDashboardData();
  };

  const handleAddCustomDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainTargetTenant) return;
    setIsAddingDomain(true);
    setFeedbackBanner(null);
    try {
      const res = await addPlatformCustomDomain(domainTargetTenant.id, customDomainInput, customDomainPrimary);
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal menambahkan custom domain.' });
        return;
      }
      setCustomDomainInput('');
      setCustomDomainPrimary(false);
      setFeedbackBanner({
        type: 'success',
        message: `Domain ${res.domain.domain} ditambahkan. Pasang TXT record pada DNS lalu klik Verifikasi.`
      });
      await loadDashboardData();
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleVerifyDomain = async (tenantId: string, domainId: string) => {
    setVerifyingDomainId(domainId);
    setFeedbackBanner(null);
    try {
      const res = await verifyPlatformDomainDns(tenantId, domainId);
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal memeriksa DNS.' });
        return;
      }
      setFeedbackBanner({
        type: res.verified ? 'success' : 'error',
        message: res.message || (res.verified ? 'DNS terverifikasi.' : 'DNS belum cocok.')
      });
      await loadDashboardData();
    } finally {
      setVerifyingDomainId(null);
    }
  };

  const handleDeleteDomain = async (tenantId: string, domainId: string) => {
    const res = await deletePlatformCustomDomain(tenantId, domainId);
    if (!res.success) {
      setFeedbackBanner({ type: 'error', message: res.error || 'Gagal menghapus domain.' });
      return;
    }
    setFeedbackBanner({ type: 'success', message: `Domain ${res.deletedDomain} dihapus dari routing.` });
    await loadDashboardData();
  };

  const handleProbeDb = async () => {
    if (!dbTargetTenant || !dbUrlInput.trim()) return;
    setIsProbingDb(true);
    setDbProbeResult(null);
    try {
      const res = await testPlatformDedicatedDb(dbTargetTenant.id, dbUrlInput.trim());
      if (!res.success) {
        setDbProbeResult({ reachable: false, maskedTarget: '-', errorSummary: res.error || 'Probe gagal.' });
        return;
      }
      setDbProbeResult({
        reachable: Boolean(res.reachable),
        maskedTarget: res.maskedTarget || '-',
        errorSummary: res.errorSummary || null
      });
    } finally {
      setIsProbingDb(false);
    }
  };

  const handleSaveDedicatedDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbTargetTenant) return;
    setIsSavingDb(true);
    setFeedbackBanner(null);
    try {
      const res = await savePlatformDedicatedDb(dbTargetTenant.id, {
        databaseUrl: dbUrlInput.trim(),
        directUrl: directUrlInput.trim() || undefined,
        supabaseUrl: supabaseUrlInput.trim() || undefined,
        serviceRoleKey: serviceKeyInput.trim() || undefined,
        storageBucket: storageBucketInput.trim() || undefined
      });
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal menyimpan kredensial Dedicated DB.' });
        return;
      }
      setDbUrlInput('');
      setDirectUrlInput('');
      setServiceKeyInput('');
      setDbProbeResult(null);
      setFeedbackBanner({
        type: 'success',
        message: `Dedicated DB terenkripsi diaktifkan untuk ${dbTargetTenant.name} (v${res.tenant.dbConfig?.credentialVersion || 1}).`
      });
      await loadDashboardData();
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleRotateDb = async () => {
    if (!dbTargetTenant) return;
    setIsRotatingDb(true);
    setFeedbackBanner(null);
    try {
      const res = await rotatePlatformDedicatedDb(dbTargetTenant.id, {
        newDatabaseUrl: dbUrlInput.trim() || undefined,
        newDirectUrl: directUrlInput.trim() || undefined
      });
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal merotasi kredensial.' });
        return;
      }
      setDbUrlInput('');
      setDirectUrlInput('');
      setFeedbackBanner({
        type: 'success',
        message: `Kredensial Dedicated DB dirotasi ke credentialVersion v${res.tenant.dbConfig?.credentialVersion || 1} dan pool lama diputus.`
      });
      await loadDashboardData();
    } finally {
      setIsRotatingDb(false);
    }
  };

  const handleRevokeDb = async () => {
    if (!dbTargetTenant) return;
    setIsRevokingDb(true);
    setFeedbackBanner(null);
    try {
      const res = await revokePlatformDedicatedDb(dbTargetTenant.id, false);
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal mencabut Dedicated DB.' });
        return;
      }
      setFeedbackBanner({
        type: 'success',
        message: `Kredensial Dedicated DB ${dbTargetTenant.name} dicabut. Routing dikembalikan ke mode SHARED.`
      });
      await loadDashboardData();
    } finally {
      setIsRevokingDb(false);
    }
  };

  const handleTriggerTenantBackup = async (tenant: PlatformTenantRecord) => {
    setIsBackingUpTenant(true);
    setFeedbackBanner(null);
    try {
      const res = await triggerPlatformTenantBackup(tenant.id);
      if (!res.success) {
        setFeedbackBanner({ type: 'error', message: res.error || 'Gagal menjalankan backup terisolasi.' });
        return;
      }
      setFeedbackBanner({
        type: 'success',
        message: `Snapshot terisolasi untuk ${tenant.name} disimpan (${res.backup.fileName}, ${(res.backup.sizeBytes / 1024).toFixed(1)} KB).`
      });
      await loadDashboardData();
    } finally {
      setIsBackingUpTenant(false);
    }
  };

  // ============================================================================
  // 🔐 RENDER AUTH / FIRST-RUN BOOTSTRAP GATE
  // ============================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
        <div className="max-w-md w-full mx-auto my-auto">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-emerald-400">SADEWA SaaS Core</p>
                <h1 className="text-lg font-semibold text-white">Platform Control Plane</h1>
              </div>
            </div>
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 border border-slate-800 rounded-lg px-2.5 py-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Portal Publik</span>
            </a>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            {!bootstrapChecked ? (
              <div className="py-10 text-center space-y-3">
                <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Memeriksa status aktivasi Control Plane...</p>
              </div>
            ) : needsBootstrap ? (
              <form onSubmit={handleBootstrapSubmit} className="space-y-4">
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-semibold text-white">Aktivasi Platform Super Admin Perdana</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Belum ada pengelola platform terdaftar. Daftarkan akun Platform Super Admin pertama untuk mengelola tenant desa dan infrastruktur.
                  </p>
                </div>

                {databaseOffline && (
                  <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800/80 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-300">Pangkalan Data PostgreSQL Belum Terhubung</p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                        Koneksi ke DATABASE_URL sedang offline atau tabel belum disinkronkan. Pastikan database Supabase aktif sebelum menyimpan data baru.
                      </p>
                    </div>
                  </div>
                )}

                {authError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={bootName}
                      onChange={(e) => setBootName(e.target.value)}
                      placeholder="Pengelola Nasional SADEWA"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={bootUsername}
                        onChange={(e) => setBootUsername(e.target.value)}
                        placeholder="platform_root"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Email Dinas/Resmi</label>
                      <input
                        type="email"
                        required
                        value={bootEmail}
                        onChange={(e) => setBootEmail(e.target.value)}
                        placeholder="ops@sadewa.id"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi (min. 10 karakter)</label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      value={bootPassword}
                      onChange={(e) => setBootPassword(e.target.value)}
                      placeholder="Minimal 10 karakter acak kuat"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {requiresPasscode && (
                    <div>
                      <label className="block text-xs font-medium text-amber-300 mb-1">
                        Bootstrap Passcode (PLATFORM_BOOTSTRAP_PASSCODE)
                      </label>
                      <input
                        type="password"
                        required
                        value={bootPasscode}
                        onChange={(e) => setBootPasscode(e.target.value)}
                        placeholder="Masukkan passcode aktivasi server"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-amber-500/50 text-amber-200 placeholder:text-amber-500/40 font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {authSubmitting ? 'Mengaktivasi...' : 'Aktivasi Platform Super Admin'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-semibold text-white">Masuk Pengelola Platform</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Autentikasi terpisah dari portal desa. Token sesi hanya disimpan di memori aktif.
                  </p>
                </div>

                {authError && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username atau Email Platform</label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="platform_root"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kata Sandi</label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{authSubmitting ? 'Memverifikasi...' : 'Masuk ke Control Plane'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 font-mono">
          Domain Pusat: {platformDomain} · Target CNAME: {cnameTarget}
        </p>
      </div>
    );
  }

  // ============================================================================
  // 🧭 AUTHENTICATED PLATFORM CONTROL PLANE SHELL (3-ZONE SAAS LAYOUT)
  // ============================================================================
  const sectionTitles: Record<PlatformSection, string> = {
    overview: 'Ringkasan Fleet & Infrastruktur',
    tenants: 'Direktori Tenant Desa',
    domains: 'Custom Domain & Verifikasi DNS',
    databases: 'Dedicated Database & Rotasi Kredensial',
    audit: 'Log Audit Control Plane'
  };

  const navItems: Array<{ id: PlatformSection; label: string; icon: React.ComponentType<any> }> = [
    { id: 'overview', label: 'Ringkasan Fleet', icon: Server },
    { id: 'tenants', label: 'Direktori Desa', icon: Building2 },
    { id: 'domains', label: 'Custom Domain & DNS', icon: Globe },
    { id: 'databases', label: 'Dedicated Database', icon: Database },
    { id: 'audit', label: 'Log Audit Platform', icon: ScrollText }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar Desktop + Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide text-white">SADEWA</p>
              <p className="text-[11px] text-slate-400">Control Plane</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
          <div className="text-xs">
            <p className="font-semibold text-white truncate">{user.name}</p>
            <p className="text-slate-400 font-mono text-[11px] truncate">{user.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-xs text-slate-300 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
            <a
              href="/"
              className="px-3 py-2 rounded-lg border border-slate-800 hover:bg-slate-900 text-xs text-slate-400 hover:text-white"
              title="Buka portal publik"
            >
              Portal
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on Left, max 2 primary action buttons on Right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600"
              aria-label="Buka menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
              <span className="font-medium text-slate-700">SADEWA Platform</span>
              <span>/</span>
              <span className="font-semibold text-slate-900 truncate">{sectionTitles[activeSection]}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadDashboardData}
              disabled={isLoadingData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
            {user.role === 'platform_super_admin' && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Daftarkan Desa</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {feedbackBanner && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                feedbackBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedbackBanner.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedbackBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Total Portal Desa</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
                    {overviewStats ? overviewStats.totalTenants : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {overviewStats ? `${overviewStats.activeTenants} aktif · ${overviewStats.suspendedTenants} nonaktif` : 'Memuat...'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Topologi Database</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
                    {overviewStats ? `${overviewStats.sharedModeCount} / ${overviewStats.dedicatedModeCount}` : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Shared Default / Dedicated DB</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">Domain Terverifikasi</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
                    {overviewStats ? overviewStats.verifiedCustomDomains : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {overviewStats ? `dari ${overviewStats.totalDomains} host terdaftar` : 'Memuat...'}
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-500">LRU Pool Dedicated Aktif</p>
                  <p className="text-2xl font-semibold text-slate-900 mt-2 font-mono tabular-nums">
                    {overviewStats
                      ? `${overviewStats.poolStats.dedicatedActiveCount}/${overviewStats.poolStats.maxDedicatedClients}`
                      : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Routing Multi-Tenant:{' '}
                    <span className="font-mono font-semibold">
                      {overviewStats?.config.multiTenantRouting ? 'ENABLED' : 'SAFE_LEGACY'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Fleet Table Preview */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Status Operasional Desa Terdaftar</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pemantauan routing subdomain, custom domain, dan mode isolasi database.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('tenants')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-950 underline cursor-pointer"
                  >
                    Kelola Semua Desa
                  </button>
                </div>

                <TenantTable
                  tenants={tenants}
                  isLoading={isLoadingData}
                  onOpenDomains={(t) => setDomainTargetTenant(t)}
                  onOpenDatabase={(t) => {
                    setDbTargetTenant(t);
                    setDbProbeResult(null);
                  }}
                  onToggleStatus={handleToggleStatus}
                  canMutate={user.role === 'platform_super_admin'}
                  onCreateFirst={() => setIsCreateModalOpen(true)}
                />
              </div>
            </div>
          )}

          {/* SECTION 2: TENANT DIRECTORY */}
          {activeSection === 'tenants' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama desa, slug, atau domain..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value as any)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ALL">Semua Mode DB</option>
                    <option value="SHARED">Shared DB</option>
                    <option value="DEDICATED">Dedicated DB</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif</option>
                    <option value="SUSPENDED">Disuspend</option>
                  </select>
                </div>
              </div>

              <TenantTable
                tenants={filteredTenants}
                isLoading={isLoadingData}
                onOpenDomains={(t) => setDomainTargetTenant(t)}
                onOpenDatabase={(t) => {
                  setDbTargetTenant(t);
                  setDbProbeResult(null);
                }}
                onToggleStatus={handleToggleStatus}
                canMutate={user.role === 'platform_super_admin'}
                onCreateFirst={() => setIsCreateModalOpen(true)}
              />
            </div>
          )}

          {/* SECTION 3: CUSTOM DOMAINS */}
          {activeSection === 'domains' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Peta Host & Verifikasi DNS Custom Domain</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    CNAME target standar platform: <span className="font-mono font-semibold text-slate-800">{cnameTarget}</span>
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Hostname</th>
                      <th className="py-2.5 px-4">Tenant Desa</th>
                      <th className="py-2.5 px-4">Tipe</th>
                      <th className="py-2.5 px-4">Status Verifikasi</th>
                      <th className="py-2.5 px-4">SSL Edge</th>
                      <th className="py-2.5 px-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {allDomains.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-500">
                          Belum ada domain terdaftar. Daftarkan desa pertama untuk memulai.
                        </td>
                      </tr>
                    ) : (
                      allDomains.map((dom) => (
                        <tr key={dom.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{dom.domain}</td>
                          <td className="py-2.5 px-4 text-slate-700">{dom.tenantName}</td>
                          <td className="py-2.5 px-4 text-slate-600">{dom.isCustom ? 'Custom Domain' : 'Subdomain Bawaan'}</td>
                          <td className="py-2.5 px-4">
                            <StatusDotText
                              tone={
                                dom.verificationStatus === 'VERIFIED'
                                  ? 'emerald'
                                  : dom.verificationStatus === 'FAILED'
                                  ? 'rose'
                                  : 'amber'
                              }
                              label={dom.verificationStatus}
                            />
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600">{dom.sslStatus}</td>
                          <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                            {dom.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleVerifyDomain(dom.tenantId, dom.id)}
                                disabled={verifyingDomainId === dom.id}
                                className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                              >
                                {verifyingDomainId === dom.id ? 'Memeriksa...' : 'Verifikasi DNS'}
                              </button>
                            )}
                            {dom.isCustom && user.role === 'platform_super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDomain(dom.tenantId, dom.id)}
                                className="px-2 py-1 rounded border border-rose-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                                title="Hapus custom domain"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: DEDICATED DATABASES */}
          {activeSection === 'databases' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Vault Kredensial Database Hibrid</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connection string Dedicated dienkripsi server-side (AES-256-GCM terikat AAD tenantId). Kredensial mentah tidak pernah dikirim ke browser.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Desa</th>
                      <th className="py-2.5 px-4">Mode Aktif</th>
                      <th className="py-2.5 px-4">Host DB (Tersamar)</th>
                      <th className="py-2.5 px-4 text-right">Versi Kredensial</th>
                      <th className="py-2.5 px-4">Rotasi Terakhir</th>
                      <th className="py-2.5 px-4 text-right">Kelola</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-medium text-slate-900">{t.name}</td>
                        <td className="py-2.5 px-4">
                          <StatusDotText
                            tone={t.tenancyMode === 'DEDICATED' ? 'amber' : 'emerald'}
                            label={t.tenancyMode}
                          />
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {t.dbConfig?.maskedTarget || 'Shared Cluster Default'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {t.dbConfig ? `v${t.dbConfig.credentialVersion}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500">
                          {t.dbConfig?.rotatedAt ? formatTimestampId(t.dbConfig.rotatedAt) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setDbTargetTenant(t);
                              setDbProbeResult(null);
                            }}
                            className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
                          >
                            Kelola DB
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: AUDIT LOGS */}
          {activeSection === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-900">Jejak Audit Platform Control Plane</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap aktivasi desa, verifikasi DNS, rotasi kredensial, dan perubahan status tercatat permanen.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Waktu</th>
                      <th className="py-2.5 px-4">Aktor</th>
                      <th className="py-2.5 px-4">Aksi</th>
                      <th className="py-2.5 px-4">Rincian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-500">
                          Belum ada aktivitas Control Plane tercatat.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {formatTimestampId(log.timestamp)}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                            {log.platformUserName}
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">{log.action}</td>
                          <td className="py-2.5 px-4 text-slate-600">{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================
          MODAL: CREATE TENANT VILLAGE
         ======================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Daftarkan Portal Desa Baru</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Otomatis membuat subdomain <span className="font-mono">*.{platformDomain}</span> & isolasi data desa.
                </p>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenantSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Nama Desa *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Desa Suka Maju"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Slug Subdomain *</label>
                  <input
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="suka-maju"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Prefix Nomor Surat</label>
                  <input
                    type="text"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                    placeholder="SKM"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mode Database</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as 'SHARED' | 'DEDICATED')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="SHARED">Shared DB (Default)</option>
                    <option value="DEDICATED">Dedicated DB (Supabase Mandiri)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Custom Domain (Opsional)</label>
                  <input
                    type="text"
                    value={newCustomDomain}
                    onChange={(e) => setNewCustomDomain(e.target.value)}
                    placeholder="desasukamaju.desa.id"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kecamatan</label>
                  <input
                    type="text"
                    value={newDistrict}
                    onChange={(e) => setNewDistrict(e.target.value)}
                    placeholder="Kecamatan..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kabupaten/Kota</label>
                  <input
                    type="text"
                    value={newRegency}
                    onChange={(e) => setNewRegency(e.target.value)}
                    placeholder="Kabupaten..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Provinsi</label>
                  <input
                    type="text"
                    value={newProvince}
                    onChange={(e) => setNewProvince(e.target.value)}
                    placeholder="Provinsi..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {newMode === 'DEDICATED' && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <p className="font-semibold text-amber-900">Konfigurasi Dedicated PostgreSQL / Supabase</p>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">DATABASE_URL (Pooler Port 6543) *</label>
                    <input
                      type="password"
                      required
                      value={newDedicatedUrl}
                      onChange={(e) => setNewDedicatedUrl(e.target.value)}
                      placeholder="postgresql://postgres.xxx:pass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">DIRECT_URL (Opsional)</label>
                    <input
                      type="password"
                      value={newDirectUrl}
                      onChange={(e) => setNewDirectUrl(e.target.value)}
                      placeholder="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <label className="inline-flex items-center gap-2 font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={seedInitialAdmin}
                    onChange={(e) => setSeedInitialAdmin(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Sekaligus buat akun Super Admin Desa awal</span>
                </label>

                {seedInitialAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Nama Super Admin Desa *</label>
                      <input
                        type="text"
                        required
                        value={initAdminName}
                        onChange={(e) => setInitAdminName(e.target.value)}
                        placeholder="Sekretaris Desa"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Username Admin *</label>
                      <input
                        type="text"
                        required
                        value={initAdminUser}
                        onChange={(e) => setInitAdminUser(e.target.value)}
                        placeholder="admin_sukamaju"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Email Admin *</label>
                      <input
                        type="email"
                        required
                        value={initAdminEmail}
                        onChange={(e) => setInitAdminEmail(e.target.value)}
                        placeholder="admin@sukamaju.desa.id"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Kata Sandi Awal (min. 10 karakter) *</label>
                      <input
                        type="password"
                        required
                        minLength={10}
                        value={initAdminPassword}
                        onChange={(e) => setInitAdminPassword(e.target.value)}
                        placeholder="Wajib diganti saat login pertama"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTenant}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold cursor-pointer"
                >
                  {isCreatingTenant ? 'Mendaftarkan...' : 'Simpan & Aktifkan Portal Desa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          DRAWER: DOMAIN & DNS VERIFICATION
         ======================================================================== */}
      {domainTargetTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto border-l border-slate-200 p-6 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] font-mono text-slate-500">{domainTargetTenant.slug}</p>
                  <h3 className="text-base font-semibold text-slate-900">
                    Domain & Verifikasi DNS — {domainTargetTenant.name}
                  </h3>
                </div>
                <button type="button" onClick={() => setDomainTargetTenant(null)} className="text-slate-400 hover:text-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {domainTargetTenant.domains.map((dom) => (
                  <div key={dom.id} className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-slate-900 break-all">{dom.domain}</span>
                      <StatusDotText
                        tone={
                          dom.verificationStatus === 'VERIFIED'
                            ? 'emerald'
                            : dom.verificationStatus === 'FAILED'
                            ? 'rose'
                            : 'amber'
                        }
                        label={dom.verificationStatus}
                      />
                    </div>

                    {dom.isCustom && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">TXT Host:</span>
                          <span className="text-slate-800 select-all">_sadewa-verify.{dom.domain}</span>
                        </div>
                        {dom.verificationToken && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500">TXT Value:</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(dom.verificationToken || '')}
                              className="inline-flex items-center gap-1 text-slate-800 hover:text-slate-950 cursor-pointer"
                            >
                              <span className="truncate max-w-[200px]">{dom.verificationToken}</span>
                              {copiedText === dom.verificationToken ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500">CNAME Target:</span>
                          <span className="text-slate-800">{cnameTarget}</span>
                        </div>
                      </div>
                    )}

                    {dom.isCustom && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleVerifyDomain(domainTargetTenant.id, dom.id)}
                          disabled={verifyingDomainId === dom.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
                        >
                          {verifyingDomainId === dom.id ? 'Mengecek DNS...' : 'Verifikasi DNS Sekarang'}
                        </button>
                        {user.role === 'platform_super_admin' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDomain(domainTargetTenant.id, dom.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddCustomDomain} className="border-t border-slate-200 pt-4 space-y-3 text-xs">
                <p className="font-semibold text-slate-900">Tambah Custom Domain Desa</p>
                <input
                  type="text"
                  required
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  placeholder="portal.desa-contoh.desa.id"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                />
                <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customDomainPrimary}
                    onChange={(e) => setCustomDomainPrimary(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Jadikan domain utama setelah verifikasi berhasil</span>
                </label>
                <button
                  type="submit"
                  disabled={isAddingDomain}
                  className="w-full py-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer"
                >
                  {isAddingDomain ? 'Menambahkan...' : 'Daftarkan Custom Domain'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          DRAWER: DEDICATED DB CONFIG & CREDENTIAL ROTATION
         ======================================================================== */}
      {dbTargetTenant && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto border-l border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-[11px] font-mono text-slate-500">Mode Saat Ini: {dbTargetTenant.tenancyMode}</p>
                <h3 className="text-base font-semibold text-slate-900">
                  Dedicated Database Vault — {dbTargetTenant.name}
                </h3>
              </div>
              <button type="button" onClick={() => setDbTargetTenant(null)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Masked current state */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Status Vault</span>
                <StatusDotText
                  tone={dbTargetTenant.dbConfig ? 'emerald' : 'slate'}
                  label={dbTargetTenant.dbConfig ? `Terenkripsi v${dbTargetTenant.dbConfig.credentialVersion}` : 'Shared Default'}
                />
              </div>
              {dbTargetTenant.dbConfig && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Target Tersamar</span>
                    <span className="font-mono text-slate-800 truncate">{dbTargetTenant.dbConfig.maskedTarget}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">PgBouncer / SSL</span>
                    <span className="font-mono text-slate-800">
                      {dbTargetTenant.dbConfig.isPooler ? 'pooler=true' : 'direct'} · {dbTargetTenant.dbConfig.sslMode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Rotasi Terakhir</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {formatTimestampId(dbTargetTenant.dbConfig.rotatedAt)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Probe & Upsert Form */}
            {user.role === 'platform_super_admin' && (
              <form onSubmit={handleSaveDedicatedDb} className="space-y-3 text-xs">
                <p className="font-semibold text-slate-900">
                  {dbTargetTenant.dbConfig ? 'Perbarui atau Rotasi URL Database Dedicated' : 'Upgrade ke Dedicated Supabase / PostgreSQL'}
                </p>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">DATABASE_URL (Pooler Port 6543)</label>
                  <input
                    type="password"
                    value={dbUrlInput}
                    onChange={(e) => setDbUrlInput(e.target.value)}
                    placeholder="postgresql://postgres.ref:password@aws-0-region.pooler.supabase.com:6543/postgres"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">DIRECT_URL (Opsional, Port 5432)</label>
                  <input
                    type="password"
                    value={directUrlInput}
                    onChange={(e) => setDirectUrlInput(e.target.value)}
                    placeholder="postgresql://postgres:password@db.ref.supabase.co:5432/postgres"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Supabase URL (Opsional)</label>
                    <input
                      type="text"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxx.supabase.co"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Bucket Storage (Opsional)</label>
                    <input
                      type="text"
                      value={storageBucketInput}
                      onChange={(e) => setStorageBucketInput(e.target.value)}
                      placeholder="sadewa-uploads"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Supabase Service Role Key (Opsional)</label>
                  <input
                    type="password"
                    value={serviceKeyInput}
                    onChange={(e) => setServiceKeyInput(e.target.value)}
                    placeholder="Disimpan terenkripsi di server saja"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                </div>

                {dbProbeResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs ${
                      dbProbeResult.reachable
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <p className="font-semibold">
                      {dbProbeResult.reachable
                        ? `Koneksi Berhasil (${dbProbeResult.maskedTarget})`
                        : `Koneksi Gagal: ${dbProbeResult.errorSummary}`}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleProbeDb}
                    disabled={isProbingDb || !dbUrlInput.trim()}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {isProbingDb ? 'Menguji...' : 'Test Koneksi'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDb || !dbUrlInput.trim()}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingDb ? 'Mengenkripsi...' : 'Simpan & Aktifkan Dedicated'}
                  </button>
                </div>
              </form>
            )}

            {/* Backup & Rotation Controls */}
            <div className="border-t border-slate-200 pt-4 space-y-3 text-xs">
              <p className="font-semibold text-slate-900">Cadangan Data & Pemeliharaan Terisolasi</p>
              <button
                type="button"
                onClick={() => handleTriggerTenantBackup(dbTargetTenant)}
                disabled={isBackingUpTenant}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isBackingUpTenant ? 'Mencadangkan...' : 'Ekspor Backup Terisolasi Desa Ini'}</span>
              </button>
            </div>

            {dbTargetTenant.dbConfig && user.role === 'platform_super_admin' && (
              <div className="border-t border-slate-200 pt-4 space-y-3 text-xs">
                <p className="font-semibold text-slate-900">Rotasi & Pencabutan Darurat</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRotateDb}
                    disabled={isRotatingDb}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-medium cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{isRotatingDb ? 'Merotasi...' : 'Rotasi Versi Kredensial & Evict Pool'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRevokeDb}
                    disabled={isRevokingDb}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-medium cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isRevokingDb ? 'Mencabut...' : 'Cabut Dedicated & Kembali ke Shared'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface TenantTableProps {
  tenants: PlatformTenantRecord[];
  isLoading: boolean;
  onOpenDomains: (tenant: PlatformTenantRecord) => void;
  onOpenDatabase: (tenant: PlatformTenantRecord) => void;
  onToggleStatus: (tenant: PlatformTenantRecord) => void;
  canMutate: boolean;
  onCreateFirst: () => void;
}

const TenantTable: React.FC<TenantTableProps> = ({
  tenants,
  isLoading,
  onOpenDomains,
  onOpenDatabase,
  onToggleStatus,
  canMutate,
  onCreateFirst
}) => {
  if (isLoading && tenants.length === 0) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((row) => (
          <div key={row} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="py-14 px-6 text-center space-y-3">
        <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm font-medium text-slate-700">Belum ada portal desa yang cocok</p>
        <p className="text-xs text-slate-500">
          Mulai dengan mendaftarkan desa baru ke cluster Shared DB atau menyambungkan Dedicated Supabase.
        </p>
        {canMutate && (
          <button
            type="button"
            onClick={onCreateFirst}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Daftarkan Desa Pertama</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-2.5 px-4">Desa & Slug</th>
            <th className="py-2.5 px-4">Domain Utama</th>
            <th className="py-2.5 px-4">Topologi DB</th>
            <th className="py-2.5 px-4">Status</th>
            <th className="py-2.5 px-4 text-right">Aksi Pengelola</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs">
          {tenants.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50">
              <td className="py-3 px-4">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="font-mono text-[11px] text-slate-500">
                  {t.slug} · prefix {t.letterCodePrefix}
                </p>
              </td>
              <td className="py-3 px-4 font-mono text-slate-700">
                <p>{t.primaryDomain || '—'}</p>
                <p className="text-[11px] text-slate-400 tabular-nums">{t.domains.length} domain terhubung</p>
              </td>
              <td className="py-3 px-4">
                <StatusDotText
                  tone={t.tenancyMode === 'DEDICATED' ? 'amber' : 'emerald'}
                  label={
                    t.tenancyMode === 'DEDICATED'
                      ? `DEDICATED (v${t.dbConfig?.credentialVersion || 1})`
                      : 'SHARED DEFAULT'
                  }
                />
              </td>
              <td className="py-3 px-4">
                <StatusDotText
                  tone={t.status === 'ACTIVE' ? 'emerald' : t.status === 'SUSPENDED' ? 'rose' : 'slate'}
                  label={t.status}
                />
              </td>
              <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onOpenDomains(t)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                >
                  Domain
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDatabase(t)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                >
                  Database
                </button>
                {canMutate && (
                  <button
                    type="button"
                    onClick={() => onToggleStatus(t)}
                    className={`px-2.5 py-1.5 rounded-lg border font-medium cursor-pointer inline-flex items-center gap-1 ${
                      t.status === 'ACTIVE'
                        ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {t.status === 'ACTIVE' ? (
                      <>
                        <Ban className="w-3 h-3" />
                        <span>Suspend</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3 h-3" />
                        <span>Aktifkan</span>
                      </>
                    )}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
