import { PrismaClient } from '@prisma/client';
import { sanitizeDiagnosticMessage } from './connection-diagnostic';
import {
  getCurrentTenantContext,
  isMultiTenantRoutingEnabled,
  TenantScopeViolationError
} from './tenantContext';
import { TenantConnectionRegistry } from './tenantConnectionRegistry';

interface DbAvailabilityEntry {
  reachable: boolean;
  checkedAt: number;
  errorCode: string | null;
  errorSummary: string | null;
}

/**
 * KONTROLER UTAMA PRISMA (HYBRID MULTI-TENANT + SINGLE-TENANT COMPATIBLE)
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  tenantRegistry?: TenantConnectionRegistry;
  lastSanitizedPrismaWarnAt?: number;
  lastOfflineNoticeAt?: number;
  isProbingDb?: boolean;
  dbAvailabilityCacheMap?: Map<string, DbAvailabilityEntry>;
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
 * Mengembalikan base Shared / Control Plane PrismaClient tanpa filter tenant.
 * Gunakan khusus untuk tabel Control Plane (`Tenant`, `TenantDomain`, `PlatformUser`, dll.)
 */
export function getControlPlanePrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl && !dbUrl.includes('pgbouncer=true') && dbUrl.includes(':6543')) {
      process.env.DATABASE_URL = dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    const client = new (PrismaClient as unknown as new (opts?: Record<string, unknown>) => PrismaClient)({
      log: [{ emit: 'event', level: 'error' }]
    });
    (client as any).$on?.('error', (event: any) => {
      if (globalForPrisma.isProbingDb) {
        return;
      }
      const rawMsg = String(event?.message || 'Prisma query failed');
      const now = Date.now();
      if (isConnectivityErrorMessage(rawMsg)) {
        if (!globalForPrisma.lastOfflineNoticeAt || now - globalForPrisma.lastOfflineNoticeAt > 60000) {
          globalForPrisma.lastOfflineNoticeAt = now;
          console.log('ℹ️ [PRISMA-DB] PostgreSQL belum tersedia, aplikasi menggunakan mode fallback.');
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
 * Mengembalikan singleton TenantConnectionRegistry (mendukung Shared $extends & Dedicated LRU Pool).
 */
export function getTenantConnectionRegistry(): TenantConnectionRegistry {
  if (!globalForPrisma.tenantRegistry) {
    globalForPrisma.tenantRegistry = new TenantConnectionRegistry({
      sharedPrismaProvider: () => getControlPlanePrisma()
    });
  }
  return globalForPrisma.tenantRegistry;
}

/**
 * Mengembalikan PrismaClient aktif berdasarkan `TenantContext` di `AsyncLocalStorage`:
 * - Jika `activeClient` sudah di-resolve middleware (Shared $extends / Dedicated LRU) -> kembalikan langsung.
 * - Jika `ctx.tenantId` aktif dengan mode SHARED -> kembalikan Shared scoped client.
 * - Jika mode single-tenant legacy (tanpa konteks tenant aktif) -> kembalikan Control Plane / Shared base client.
 */
export function getPrisma(): PrismaClient {
  const ctx = getCurrentTenantContext();
  if (ctx?.activeClient) {
    return ctx.activeClient as PrismaClient;
  }
  if (ctx?.tenantId && ctx.tenancyMode === 'SHARED') {
    return getTenantConnectionRegistry().getSharedScopedClient(ctx.tenantId);
  }
  return getControlPlanePrisma();
}

/**
 * Async resolver untuk skenario di mana middleware belum melakukan pre-warm Dedicated client.
 */
export async function getPrismaForActiveContext(): Promise<PrismaClient> {
  const ctx = getCurrentTenantContext();
  if (!ctx || !ctx.tenantId) {
    return getControlPlanePrisma();
  }
  if (ctx.activeClient) {
    return ctx.activeClient as PrismaClient;
  }

  const registry = getTenantConnectionRegistry();
  if (ctx.tenancyMode === 'SHARED') {
    return registry.getSharedScopedClient(ctx.tenantId);
  }

  const dbConfig = await getControlPlanePrisma().tenantDatabaseConfig.findUnique({
    where: { tenantId: ctx.tenantId },
    select: {
      encryptedDatabaseUrl: true,
      credentialVersion: true
    }
  });

  if (!dbConfig) {
    throw new TenantScopeViolationError(
      `Konfigurasi Dedicated database untuk tenant "${ctx.tenantId}" belum tersedia.`
    );
  }

  return registry.getClientForTenant({
    tenantId: ctx.tenantId,
    tenancyMode: 'DEDICATED',
    dbConfig
  });
}

/**
 * Menjalankan transaksi PostgreSQL dengan menginjeksi `app.current_tenant_id` (transaction-local)
 * agar kebijakan PostgreSQL Row-Level Security (RLS) bekerja sebagai pertahanan lapis kedua.
 */
export async function runWithTenantRlsTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  const prisma = await getPrismaForActiveContext();
  const ctx = getCurrentTenantContext();
  const parsedTimeout = Number.parseInt(process.env.TENANT_STATEMENT_TIMEOUT_MS || '10000', 10);
  const timeoutMs = Number.isFinite(parsedTimeout) ? Math.max(1000, Math.min(60000, parsedTimeout)) : 10000;

  if (ctx?.tenantId) {
    return (prisma as any).$transaction(async (tx: PrismaClient) => {
      await (tx as any).$executeRawUnsafe(`SET LOCAL statement_timeout = '${timeoutMs}'`);
      if (ctx.tenancyMode === 'SHARED') {
        await (tx as any).$executeRawUnsafe(
          `SELECT set_config('app.current_tenant_id', $1, true)`,
          ctx.tenantId
        );
      }
      return fn(tx);
    });
  }
  return fn(prisma);
}

/**
 * Mengembalikan ID record `VillageProfile` yang aman untuk tenant aktif.
 * Menjaga ID `'default'` untuk Pulau Betung / single-tenant dan `profile-<tenantId>` untuk tenant lain.
 */
export function getTenantVillageProfileId(): string {
  const ctx = getCurrentTenantContext();
  if (!ctx?.tenantId || ctx.tenantId === 'tenant_pulau_betung') {
    return 'default';
  }
  return `profile-${ctx.tenantId}`;
}

/**
 * Mematikan fallback JSON lokal saat multi-tenant routing aktif atau fase Supabase-only
 * agar data Pulau Betung di disk lokal tidak pernah bocor ke tenant lain.
 */
export function isJsonFallbackAllowed(): boolean {
  if (process.env.MIGRATION_PHASE === 'PHASE_3_SUPABASE_ONLY') {
    return false;
  }
  if (isMultiTenantRoutingEnabled()) {
    return false;
  }
  const ctx = getCurrentTenantContext();
  if (ctx?.tenantId && ctx.tenantId !== 'tenant_pulau_betung') {
    return false;
  }
  return true;
}

function getAvailabilityCacheKey(): string {
  const ctx = getCurrentTenantContext();
  if (ctx?.tenancyMode === 'DEDICATED' && ctx.tenantId) {
    return `dedicated:${ctx.tenantId}:v${ctx.credentialVersion}`;
  }
  return 'shared';
}

/**
 * Probe status koneksi database per-tenant (cache terisolasi antara Shared vs Dedicated).
 */
export async function probeDatabaseStatus(ttlMs: number = 30000): Promise<{
  reachable: boolean;
  errorCode: string | null;
  errorSummary: string | null;
}> {
  const ctx = getCurrentTenantContext();
  const isDedicated = ctx?.tenancyMode === 'DEDICATED' && Boolean(ctx.tenantId);
  const dbUrl = process.env.DATABASE_URL || '';

  if (!isDedicated && !dbUrl) {
    return {
      reachable: false,
      errorCode: 'MISSING_DATABASE_URL',
      errorSummary: 'DATABASE_URL environment variable is not defined.'
    };
  }

  if (!globalForPrisma.dbAvailabilityCacheMap) {
    globalForPrisma.dbAvailabilityCacheMap = new Map();
  }

  const cacheKey = getAvailabilityCacheKey();
  const cached = globalForPrisma.dbAvailabilityCacheMap.get(cacheKey);
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
    const client = isDedicated ? await getPrismaForActiveContext() : getControlPlanePrisma();
    await client.$queryRawUnsafe('SELECT 1');
    globalForPrisma.dbAvailabilityCacheMap.set(cacheKey, {
      reachable: true,
      checkedAt: now,
      errorCode: null,
      errorSummary: null
    });
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
    globalForPrisma.dbAvailabilityCacheMap.set(cacheKey, {
      reachable: false,
      checkedAt: now,
      errorCode,
      errorSummary
    });
    if (!globalForPrisma.lastOfflineNoticeAt || now - globalForPrisma.lastOfflineNoticeAt > 60000) {
      globalForPrisma.lastOfflineNoticeAt = now;
      console.log('ℹ️ [PRISMA-DB] PostgreSQL belum tersedia pada konteks ini.');
    }
    return { reachable: false, errorCode, errorSummary };
  } finally {
    globalForPrisma.isProbingDb = false;
  }
}

export async function isDatabaseAvailableCached(ttlMs: number = 30000): Promise<boolean> {
  const status = await probeDatabaseStatus(ttlMs);
  return status.reachable;
}

// ============================================================================
// 1. PENGAWAL DATA PUBLIK & PROFIL DESA (TENANT-SCOPED)
// ============================================================================

export async function getVillageProfile() {
  return getPrisma().villageProfile.findFirst({
    orderBy: { lastUpdated: 'desc' }
  });
}

export async function getServices(onlyActive = true) {
  return getPrisma().villageService.findMany({
    where: onlyActive ? { isActive: true } : undefined,
    orderBy: { category: 'asc' }
  });
}

export async function getLatestNews(limit = 5) {
  return getPrisma().newsItem.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: 'desc' },
    take: limit
  });
}

export async function getLatestBudget() {
  return getPrisma().budgetYearData.findFirst({
    orderBy: { year: 'desc' }
  });
}

// ============================================================================
// 2. KONTEKS PINTAR BUAT AI PANJUL (TENANT-SCOPED)
// ============================================================================

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
    if (await isDatabaseAvailableCached()) {
      const p = getPrisma();
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
          select: { title: true, category: true }
        }).catch(() => []),
        p.budgetYearData.findFirst({
          orderBy: { year: 'desc' }
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

      return {
        profile: profile || null,
        services: Array.isArray(services) ? services : [],
        servicesCount: Array.isArray(services) ? services.length : 0,
        latestNews: Array.isArray(latestNews) ? latestNews : [],
        budget: budget || null,
        officials: Array.isArray(officials) ? officials : [],
        umkm: Array.isArray(umkm) ? umkm : []
      };
    }
  } catch (error: any) {
    const safeMsg = sanitizeDiagnosticMessage(error?.message || 'AI context fallback', [
      process.env.DATABASE_URL,
      process.env.DIRECT_URL
    ]);
    console.log('ℹ️ [AI-CONTEXT] Prisma query gagal, mencoba fallback lokal:', safeMsg);
  }

  // Fallback ke JSON lokal jika diizinkan
  if (isJsonFallbackAllowed()) {
    try {
      const { getDb } = await import('./database');
      const db = getDb();
      const servicesList = (db.services || []).filter((s: any) => s.isActive !== false);
      const newsList = (db.news || []).filter((n: any) => n.isPublished !== false);
      const officialsList = (db.officials || []).filter((o: any) => o.isActive !== false);

      return {
        profile: db.villageProfile || null,
        services: servicesList.slice(0, 10).map((s: any) => ({
          name: s.name,
          category: s.category,
          requirements: s.requirements,
          estimatedDays: s.estimatedDays
        })),
        servicesCount: servicesList.length,
        latestNews: newsList.slice(0, 5).map((n: any) => ({
          title: n.title,
          category: n.category
        })),
        budget: db.budget || null,
        officials: officialsList.slice(0, 8).map((o: any) => ({
          name: o.name,
          position: o.position
        })),
        umkm: (db.umkm || []).slice(0, 5).map((u: any) => ({
          name: u.name,
          category: u.category,
          priceRange: u.priceRange,
          phone: u.phone
        }))
      };
    } catch (jsonErr: any) {
      console.warn('⚠️ [AI-CONTEXT] Gagal memuat fallback JSON:', jsonErr?.message || jsonErr);
    }
  }

  return emptyContext;
}

// ============================================================================
// 3. PENJAGA PINTU (USER & AUTH — TENANT-SCOPED)
// ============================================================================

export async function getUserByUsername(username: string) {
  if (!(await isDatabaseAvailableCached())) {
    if (!isJsonFallbackAllowed()) return null;
    const { getDb } = await import('./database');
    const clean = username.trim().toLowerCase();
    return (
      getDb().users.find(
        (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
      ) || null
    );
  }
  return getPrisma().user.findFirst({
    where: {
      username: { equals: username.trim(), mode: 'insensitive' }
    }
  });
}

export async function getUserById(id: string) {
  if (!(await isDatabaseAvailableCached())) {
    if (!isJsonFallbackAllowed()) return null;
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
  return getPrisma().user.findFirst({
    where: { id }
  });
}

export async function updateUserLastLogin(id: string) {
  try {
    if (!(await isDatabaseAvailableCached())) {
      if (!isJsonFallbackAllowed()) return;
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
      data: { lastLogin: new Date() }
    });
  } catch (err: any) {
    console.warn('⚠️ [LAST-LOGIN] Gagal update waktu login terakhir:', sanitizeDiagnosticMessage(err?.message || String(err)));
  }
}

// ============================================================================
// 4. PENCATAT JEJAK (AUDIT LOG — TENANT-SCOPED)
// ============================================================================

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
      if (!isJsonFallbackAllowed()) return;
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
        ipAddress
      }
    });
  } catch (err: any) {
    console.warn('⚠️ [AUDIT-LOG] Gagal masukin log audit:', sanitizeDiagnosticMessage(err?.message || String(err)));
  }
}
