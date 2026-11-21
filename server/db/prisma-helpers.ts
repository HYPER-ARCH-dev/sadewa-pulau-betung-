import { PrismaClient } from '@prisma/client';
import { sanitizeDiagnosticMessage } from './connection-diagnostic';

/**
 * 🏛️ KONTROLER UTAMA PRISMA (SINGLETON)
 * Kita pakai globalThis supaya Prisma Client cuma ada satu (biar gak menumpuk koneksi ke Supabase).
 * Ini penting banget buat performa server dan jatah koneksi gratisan Supabase!
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  lastSanitizedPrismaWarnAt?: number;
  lastOfflineNoticeAt?: number;
  isProbingDb?: boolean;
  dbAvailabilityCache?: {
    reachable: boolean;
    checkedAt: number;
    errorCode: string | null;
    errorSummary: string | null;
  };
};

function isConnectivityErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('tenant/user') ||
    lower.includes("can't reach database server") ||
    lower.includes('connection terminated') ||
    lower.includes('p1000') ||
    lower.includes('p1001') ||
    lower.includes('p1002')
  );
}

/**
 * 🔌 Ambil Koneksi Prisma
 * Fungsi ini bakal balikin client Prisma yang siap pakai.
 * Kalau koneksi belum ada, kita bikin baru.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // 🛡️ Optimasi koneksi buat Supabase (PgBouncer)
    // Kalau pakai port 6543 (pooler), kita wajib tambahin pgbouncer=true di URL
    // biar Prisma gak error pas lagi "reuse" koneksi lama.
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl && !dbUrl.includes('pgbouncer=true') && dbUrl.includes(':6543')) {
      process.env.DATABASE_URL = dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    // Gunakan event logging agar Prisma tidak mencetak tenant/user/URL mentah ke stderr
    const client = new (PrismaClient as unknown as new (opts?: Record<string, unknown>) => PrismaClient)({
      log: [{ emit: 'event', level: 'error' }]
    });
    (client as any).$on?.('error', (event: any) => {
      // Selama health/availability probe aktif, error ditangani secara senyap oleh try/catch pemanggil
      if (globalForPrisma.isProbingDb) {
        return;
      }
      const rawMsg = String(event?.message || 'Prisma query failed');
      const now = Date.now();
      if (isConnectivityErrorMessage(rawMsg)) {
        if (!globalForPrisma.lastOfflineNoticeAt || now - globalForPrisma.lastOfflineNoticeAt > 60000) {
          globalForPrisma.lastOfflineNoticeAt = now;
          console.log('ℹ️ [PRISMA-DB] PostgreSQL belum tersedia, aplikasi menggunakan fallback JSON lokal.');
        }
        return;
      }
      if (!globalForPrisma.lastSanitizedPrismaWarnAt || now - globalForPrisma.lastSanitizedPrismaWarnAt > 15000) {
        globalForPrisma.lastSanitizedPrismaWarnAt = now;
        const cleanMsg = sanitizeDiagnosticMessage(rawMsg, [
          process.env.DATABASE_URL,
          process.env.DIRECT_URL
        ]);
        console.warn(`⚠️ [PRISMA-DB]: ${cleanMsg}`);
      }
    });
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

/**
 * 🩺 Probe status koneksi database secara aman (tanpa membanjiri stderr saat offline)
 */
export async function probeDatabaseStatus(ttlMs: number = 30000): Promise<{
  reachable: boolean;
  errorCode: string | null;
  errorSummary: string | null;
}> {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    return {
      reachable: false,
      errorCode: 'MISSING_DATABASE_URL',
      errorSummary: 'DATABASE_URL environment variable is not defined.'
    };
  }

  const cached = globalForPrisma.dbAvailabilityCache;
  const now = Date.now();
  const effectiveTtl = cached && !cached.reachable ? Math.max(ttlMs, 60000) : ttlMs;
  if (cached && now - cached.checkedAt < effectiveTtl) {
    return {
      reachable: cached.reachable,
      errorCode: cached.errorCode,
      errorSummary: cached.errorSummary
    };
  }

  globalForPrisma.isProbingDb = true;
  try {
    await getPrisma().$queryRawUnsafe('SELECT 1');
    globalForPrisma.dbAvailabilityCache = {
      reachable: true,
      checkedAt: now,
      errorCode: null,
      errorSummary: null
    };
    return { reachable: true, errorCode: null, errorSummary: null };
  } catch (err: any) {
    const errorCode =
      typeof err?.code === 'string'
        ? err.code
        : typeof err?.errorCode === 'string'
        ? err.errorCode
        : 'DB_UNREACHABLE';
    const errorSummary = sanitizeDiagnosticMessage(
      String(err?.message || 'Database connection failed'),
      [dbUrl, process.env.DIRECT_URL, process.env.SESSION_SECRET]
    );
    globalForPrisma.dbAvailabilityCache = {
      reachable: false,
      checkedAt: now,
      errorCode,
      errorSummary
    };
    if (!globalForPrisma.lastOfflineNoticeAt || now - globalForPrisma.lastOfflineNoticeAt > 60000) {
      globalForPrisma.lastOfflineNoticeAt = now;
      console.log('ℹ️ [PRISMA-DB] PostgreSQL belum tersedia, layanan berjalan dengan mode fallback JSON.');
    }
    return { reachable: false, errorCode, errorSummary };
  } finally {
    globalForPrisma.isProbingDb = false;
  }
}

/**
 * 🩺 Pengecekan ketersediaan database dengan cache singkat
 * Mencegah endpoint publik membanjiri pooler dengan puluhan query gagal saat DB offline.
 */
export async function isDatabaseAvailableCached(ttlMs: number = 30000): Promise<boolean> {
  const status = await probeDatabaseStatus(ttlMs);
  return status.reachable;
}

// ============================================================================
// 📁 1. PENGAWAL DATA PUBLIK & PROFIL DESA
// ============================================================================

/**
 * 🏠 Ambil Profil Desa
 * Ngambil data identitas desa (Logo, Nama, Visi Misi) dari Supabase.
 * Kita pakai ID 'default' karena profil desa cuma ada satu buat satu portal.
 */
export async function getVillageProfile() {
  return getPrisma().villageProfile.findUnique({
    where: { id: 'default' }
  });
}

/**
 * 📜 Daftar Layanan Surat
 * Ngambil semua jenis surat yang dilayani desa (misal: KTP, Domisili, Sporadik).
 * 'onlyActive' buat mastiin kita cuma nampilin surat yang emang lagi dilayani.
 */
export async function getServices(onlyActive = true) {
  return getPrisma().villageService.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: { category: 'asc' },
  });
}

/**
 * 📰 Berita Terkini
 * Ambil berita-berita terbaru biar warga gak ketinggalan info.
 * Kita urutin dari yang paling baru ('desc') dan batasi jumlahnya biar gak berat.
 */
export async function getLatestNews(limit = 5) {
  return getPrisma().newsItem.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}

/**
 * 💰 Info Anggaran (APBDes)
 * Ngambil data anggaran terbaru buat transparansi ke warga.
 */
export async function getLatestBudget() {
  return getPrisma().budgetYearData.findFirst({
    orderBy: { year: 'desc' },
  });
}

// ============================================================================
// 🤖 2. KONTEKS PINTAR BUAT AI PANJUL
// ============================================================================

/**
 * 🧠 Otak AI Panjul (Konteks Desa)
 * Fungsi ini ngumpulin SEMUA info penting desa biar Panjul bisa jawab pertanyaan warga
 * dengan akurat (gak ngaco/halusinasi).
 * Ada 'try-catch' biar kalau DB lagi down, Panjul tetep bisa nyapa warga pakai data aman (fallback).
 */
export async function getAiContext() {
  const emptyContext = {
    profile: null,
    services: [],
    servicesCount: 0,
    latestNews: [],
    budget: null,
    officials: [],
    umkm: []
  };

  try {
    if (!(await isDatabaseAvailableCached())) {
      return emptyContext;
    }

    const p = getPrisma();
    // Tarik data secara barengan (paralel) biar kilat!
    const [profile, services, latestNews, budget, officials, umkm] = await Promise.all([
      p.villageProfile.findFirst().catch(() => null),
      p.villageService.findMany({ 
        where: { isActive: true },
        select: { name: true, category: true, requirements: true, estimatedDays: true },
        take: 10
      }).catch(() => []),
      p.newsItem.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { title: true, category: true },
      }).catch(() => []),
      p.budgetYearData.findFirst({
        orderBy: { year: 'desc' },
      }).catch(() => null),
      p.villageOfficial.findMany({
        select: { name: true, position: true },
        take: 8
      }).catch(() => []),
      p.umkmItem.findMany({
        select: { name: true, category: true, priceRange: true, phone: true },
        take: 5
      }).catch(() => [])
    ]);

    // Balikin bungkusan data buat dikirim ke AI
    return {
      profile: profile || null,
      services: Array.isArray(services) ? services : [],
      servicesCount: Array.isArray(services) ? services.length : 0,
      latestNews: Array.isArray(latestNews) ? latestNews : [],
      budget: budget || null,
      officials: Array.isArray(officials) ? officials : [],
      umkm: Array.isArray(umkm) ? umkm : []
    };
  } catch (error: any) {
    // Kalau Supabase lagi ngadat, kasih info kosong aja biar gak crash satu portal
    const safeMsg = sanitizeDiagnosticMessage(error?.message || 'AI context fallback', [
      process.env.DATABASE_URL,
      process.env.DIRECT_URL
    ]);
    console.log('ℹ️ [AI-CONTEXT] Pakai konteks lokal aman:', safeMsg);
    return emptyContext;
  }
}

// ============================================================================
// 👤 3. PENJAGA PINTU (USER & AUTH)
// ============================================================================

/**
 * 🔍 Cari User via Username
 * Dipakai pas login buat ngecek apakah akunnya beneran ada.
 */
export async function getUserByUsername(username: string) {
  if (!(await isDatabaseAvailableCached())) {
    const { getDb } = await import('./database');
    const clean = username.trim().toLowerCase();
    return getDb().users.find(
      (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    ) || null;
  }
  return getPrisma().user.findUnique({
    where: { username },
  });
}

/**
 * 🆔 Cari User via ID
 * Dipakai buat validasi session token yang dibawa browser.
 */
export async function getUserById(id: string) {
  if (!(await isDatabaseAvailableCached())) {
    const { getDb } = await import('./database');
    const u = getDb().users.find((user) => user.id === id);
    if (!u) return null;
    return {
      ...u,
      tokenVersion: 1,
      mustChangePassword: false,
      lastLogin: u.lastLogin ? new Date(u.lastLogin) : null
    } as any;
  }
  return getPrisma().user.findUnique({
    where: { id },
  });
}

/**
 * ⏰ Update Waktu Login Terakhir
 * Biar kita tahu kapan terakhir kali admin/operator masuk ke sistem.
 */
export async function updateUserLastLogin(id: string) {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const { getDb, saveDb } = await import('./database');
      const db = getDb();
      const idx = (db.users || []).findIndex((u: any) => u.id === id);
      if (idx >= 0) {
        db.users[idx].lastLogin = new Date().toISOString();
        saveDb(db);
      }
      return;
    }
    await getPrisma().user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  } catch (err: any) {
    console.warn('⚠️ [LAST-LOGIN] Gagal update waktu login terakhir:', sanitizeDiagnosticMessage(err?.message || String(err)));
  }
}

// ============================================================================
// 📝 4. PENCATAT JEJAK (AUDIT LOG)
// ============================================================================

/**
 * 🕵️ Rekam Jejak Admin (Audit Log)
 * Setiap admin ngapus atau nambah data, kita catat di sini.
 * Penting banget buat keamanan dan transparansi kerja perangkat desa.
 * Kita pakai 'try-catch' biar kalau gagal nyatet, proses utamanya (misal hapus data) gak keganggu.
 */
export async function recordAuditLogDb(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  module: string,
  details: string,
  ipAddress = '127.0.0.1'
) {
  try {
    if (!(await isDatabaseAvailableCached())) {
      const { getDb, saveDb } = await import('./database');
      const db = getDb();
      db.auditLogs = [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId,
          userName,
          userRole,
          action,
          module,
          details,
          ipAddress,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
        },
        ...(db.auditLogs || [])
      ].slice(0, 1000);
      saveDb(db);
      return;
    }

    await getPrisma().auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        module,
        details,
        ipAddress,
      },
    });
  } catch (err: any) {
    console.warn('⚠️ [AUDIT-LOG] Gagal masukin log audit ke Supabase:', sanitizeDiagnosticMessage(err?.message || String(err)));
  }
}


