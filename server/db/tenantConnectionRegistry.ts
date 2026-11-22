import { PrismaClient } from '@prisma/client';
import { decryptTenantSecret } from '../security/credentialVault';
import { sanitizeDiagnosticMessage } from './connection-diagnostic';
import { TenancyModeType } from './tenantContext';

/**
 * ============================================================================
 * SADEWA TENANT CONNECTION REGISTRY & SHARED SCOPING EXTENSION
 * ============================================================================
 * Menyediakan resolver koneksi database hibrid untuk arsitektur Multi-Tenant:
 * 1. SHARED mode:
 *    Menggunakan Shared PrismaClient tunggal yang dibungkus `$extends` query
 *    extension untuk menginjeksi filter & stamp `villageId` pada 27 model
 *    operasional desa. Control Plane models dikecualikan agar resolusi tenant
 *    dan platform audit tidak tersaring oleh `villageId`.
 * 2. DEDICATED mode:
 *    Mendekripsi URL PostgreSQL Dedicated tenant secara in-memory menggunakan
 *    AES-256-GCM vault, menegakkan `pgbouncer=true` dan `connection_limit`
 *    terbatas, serta mengelola pool klien dalam bounded LRU cache lengkap
 *    dengan idle TTL, rotasi `credentialVersion`, dan `$disconnect()` otomatis.
 * ============================================================================
 */

export const TENANT_OWNED_MODELS = new Set<string>([
  'User',
  'VillageProfile',
  'Dusun',
  'RW',
  'RT',
  'VillageService',
  'ServiceRequest',
  'DeletedServiceRequest',
  'Complaint',
  'Resident',
  'BansosRecipient',
  'NewsItem',
  'Announcement',
  'AgendaItem',
  'GalleryItem',
  'BudgetYearData',
  'DevelopmentProject',
  'VillagePotential',
  'UmkmItem',
  'VillageOfficial',
  'MapFacility',
  'LandParcel',
  'ToddlerRecord',
  'ToddlerMeasurement',
  'PosyanduSchedule',
  'AuditLog',
  'AttendanceLog'
]);

const READ_AND_FILTER_OPS = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany'
]);

export interface TenantDatabaseDescriptor {
  encryptedDatabaseUrl: string;
  credentialVersion: number;
}

export interface TenantResolutionTarget {
  tenantId: string;
  tenancyMode: TenancyModeType;
  dbConfig?: TenantDatabaseDescriptor | null;
}

export interface DedicatedPoolEntry {
  tenantId: string;
  client: PrismaClient;
  credentialVersion: number;
  createdAt: number;
  lastUsedAt: number;
}

export interface DedicatedConnectionProbeResult {
  reachable: boolean;
  errorCode: string | null;
  errorSummary: string | null;
}

export interface TenantConnectionRegistryOptions {
  maxDedicatedClients?: number;
  idleTtlMs?: number;
  maxConnectionsPerDedicatedTenant?: number;
  sharedPrismaProvider: () => PrismaClient;
  dedicatedClientFactory?: (connectionUrl: string, tenantId: string) => PrismaClient;
}

function mergeWhereWithVillageId(existingWhere: any, tenantId: string): Record<string, unknown> {
  if (!existingWhere || (typeof existingWhere === 'object' && Object.keys(existingWhere).length === 0)) {
    return { villageId: tenantId };
  }
  // Untuk query `findUnique`/`update`/`delete` yang mensyaratkan unique key di top-level `where`,
  // tempelkan langsung `villageId` di level teratas selain menjaga field unik yang sudah ada.
  return {
    ...existingWhere,
    villageId: tenantId
  };
}

function mergeFilterWithAndVillageId(existingWhere: any, tenantId: string): Record<string, unknown> {
  if (!existingWhere || (typeof existingWhere === 'object' && Object.keys(existingWhere).length === 0)) {
    return { villageId: tenantId };
  }
  return {
    AND: [existingWhere, { villageId: tenantId }]
  };
}

function stampDataWithVillageId(data: any, tenantId: string): any {
  if (Array.isArray(data)) {
    return data.map((row) => ({ ...(row || {}), villageId: tenantId }));
  }
  if (data && typeof data === 'object') {
    return { ...data, villageId: tenantId };
  }
  return data;
}

/**
 * Membungkus base Shared `PrismaClient` agar setiap operasi pada model milik tenant
 * otomatis dibatasi dan distempel ke `villageId = tenantId`.
 */
export function createTenantScopedPrisma<TClient extends PrismaClient>(basePrisma: TClient, tenantId: string): TClient {
  const cleanTenantId = tenantId.trim();
  if (!cleanTenantId) {
    throw new Error('tenantId tidak boleh kosong saat membuat scoped Prisma client.');
  }

  return (basePrisma as any).$extends({
    name: `sadewa-tenant-scope:${cleanTenantId}`,
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query
        }: {
          model?: string;
          operation: string;
          args: any;
          query: (nextArgs: any) => Promise<any>;
        }) {
          if (!model || !TENANT_OWNED_MODELS.has(model)) {
            return query(args);
          }

          const nextArgs: any = args ? { ...args } : {};

          if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
            nextArgs.data = stampDataWithVillageId(nextArgs.data, cleanTenantId);
            return query(nextArgs);
          }

          if (operation === 'upsert') {
            nextArgs.where = mergeWhereWithVillageId(nextArgs.where, cleanTenantId);
            nextArgs.create = stampDataWithVillageId(nextArgs.create, cleanTenantId);
            nextArgs.update = stampDataWithVillageId(nextArgs.update, cleanTenantId);
            return query(nextArgs);
          }

          if (READ_AND_FILTER_OPS.has(operation)) {
            const isUniqueWhereOp =
              operation === 'findUnique' ||
              operation === 'findUniqueOrThrow' ||
              operation === 'update' ||
              operation === 'delete';

            nextArgs.where = isUniqueWhereOp
              ? mergeWhereWithVillageId(nextArgs.where, cleanTenantId)
              : mergeFilterWithAndVillageId(nextArgs.where, cleanTenantId);
            return query(nextArgs);
          }

          return query(nextArgs);
        }
      }
    }
  }) as TClient;
}

/**
 * Menormalkan connection string Dedicated PostgreSQL / Supabase:
 * - Memastikan protokol `postgres:` / `postgresql:`
 * - Memastikan `pgbouncer=true` untuk port 6543 / host pooler Supabase
 * - Memastikan `connection_limit` terbatas agar multi-tenant tidak menghabiskan slot koneksi
 */
export function normalizeDedicatedPostgresUrl(rawUrl: string, maxConnections: number = 5): string {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('Protokol URL Dedicated database harus postgresql:// atau postgres://');
  }

  const host = parsed.hostname.toLowerCase();
  const isPooler = parsed.port === '6543' || host.includes('.pooler.supabase.com');
  if (isPooler && parsed.searchParams.get('pgbouncer') !== 'true') {
    parsed.searchParams.set('pgbouncer', 'true');
  }

  const boundedLimit = Math.max(1, Math.min(20, maxConnections));
  const currentLimit = Number.parseInt(parsed.searchParams.get('connection_limit') || '', 10);
  if (!Number.isFinite(currentLimit) || currentLimit > boundedLimit) {
    parsed.searchParams.set('connection_limit', String(boundedLimit));
  }

  return parsed.toString();
}

function defaultDedicatedClientFactory(connectionUrl: string): PrismaClient {
  const client = new (PrismaClient as unknown as new (opts: Record<string, unknown>) => PrismaClient)({
    datasources: { db: { url: connectionUrl } },
    log: [{ emit: 'event', level: 'error' }]
  });

  (client as any).$on?.('error', (event: any) => {
    const cleanMsg = sanitizeDiagnosticMessage(String(event?.message || 'Dedicated Prisma error'), [connectionUrl]);
    console.warn(`⚠️ [DEDICATED-PRISMA]: ${cleanMsg}`);
  });

  return client;
}

export class TenantConnectionRegistry {
  private readonly maxDedicatedClients: number;
  private readonly idleTtlMs: number;
  private readonly maxConnectionsPerDedicatedTenant: number;
  private readonly sharedPrismaProvider: () => PrismaClient;
  private readonly dedicatedClientFactory: (connectionUrl: string, tenantId: string) => PrismaClient;

  // Map menjaga urutan penyisipan -> entry pertama adalah Least Recently Used (LRU)
  private readonly dedicatedPool = new Map<string, DedicatedPoolEntry>();
  private readonly sharedScopedCache = new Map<string, { baseClient: PrismaClient; scopedClient: PrismaClient }>();

  constructor(options: TenantConnectionRegistryOptions) {
    const envMax = Number.parseInt(process.env.TENANT_POOL_MAX_CLIENTS || '', 10);
    const resolvedMax = options.maxDedicatedClients ?? (Number.isFinite(envMax) ? envMax : 25);
    this.maxDedicatedClients = Math.max(1, Math.min(200, resolvedMax));
    this.idleTtlMs = Math.max(1000, options.idleTtlMs ?? 10 * 60 * 1000);
    this.maxConnectionsPerDedicatedTenant = Math.max(1, Math.min(20, options.maxConnectionsPerDedicatedTenant ?? 5));
    this.sharedPrismaProvider = options.sharedPrismaProvider;
    this.dedicatedClientFactory =
      options.dedicatedClientFactory ?? ((url) => defaultDedicatedClientFactory(url));
  }

  public getSharedScopedClient(tenantId: string): PrismaClient {
    const baseClient = this.sharedPrismaProvider();
    const cached = this.sharedScopedCache.get(tenantId);
    if (cached && cached.baseClient === baseClient) {
      return cached.scopedClient;
    }

    const scopedClient = createTenantScopedPrisma(baseClient, tenantId);
    this.sharedScopedCache.set(tenantId, { baseClient, scopedClient });
    return scopedClient;
  }

  public async getClientForTenant(target: TenantResolutionTarget): Promise<PrismaClient> {
    if (target.tenancyMode === 'SHARED' || !target.dbConfig) {
      return this.getSharedScopedClient(target.tenantId);
    }

    const { tenantId, dbConfig } = target;
    const now = Date.now();
    const existing = this.dedicatedPool.get(tenantId);

    if (existing) {
      if (existing.credentialVersion === dbConfig.credentialVersion) {
        // Refresh posisi LRU
        this.dedicatedPool.delete(tenantId);
        existing.lastUsedAt = now;
        this.dedicatedPool.set(tenantId, existing);
        return existing.client;
      }

      // Rotasi kredensial terdeteksi: disconnect pool lama sebelum membangun ulang
      this.dedicatedPool.delete(tenantId);
      await existing.client.$disconnect().catch(() => undefined);
    }

    // Evict LRU jika kapasitas maksimum tercapai
    while (this.dedicatedPool.size >= this.maxDedicatedClients) {
      const oldestKey = this.dedicatedPool.keys().next().value as string | undefined;
      if (!oldestKey) break;
      const oldestEntry = this.dedicatedPool.get(oldestKey);
      this.dedicatedPool.delete(oldestKey);
      if (oldestEntry) {
        await oldestEntry.client.$disconnect().catch(() => undefined);
      }
    }

    const decryptedUrl = decryptTenantSecret(dbConfig.encryptedDatabaseUrl, { tenantId });
    const normalizedUrl = normalizeDedicatedPostgresUrl(decryptedUrl, this.maxConnectionsPerDedicatedTenant);
    const client = this.dedicatedClientFactory(normalizedUrl, tenantId);

    this.dedicatedPool.set(tenantId, {
      tenantId,
      client,
      credentialVersion: dbConfig.credentialVersion,
      createdAt: now,
      lastUsedAt: now
    });

    return client;
  }

  public async evictTenant(tenantId: string): Promise<boolean> {
    this.sharedScopedCache.delete(tenantId);
    const existing = this.dedicatedPool.get(tenantId);
    if (!existing) {
      return false;
    }
    this.dedicatedPool.delete(tenantId);
    await existing.client.$disconnect().catch(() => undefined);
    return true;
  }

  public async evictIdleClients(now: number = Date.now()): Promise<number> {
    const expiredIds: string[] = [];
    for (const [tenantId, entry] of this.dedicatedPool.entries()) {
      if (now - entry.lastUsedAt >= this.idleTtlMs) {
        expiredIds.push(tenantId);
      }
    }

    for (const id of expiredIds) {
      const entry = this.dedicatedPool.get(id);
      this.dedicatedPool.delete(id);
      if (entry) {
        await entry.client.$disconnect().catch(() => undefined);
      }
    }
    return expiredIds.length;
  }

  public async revokeAll(): Promise<void> {
    const entries = Array.from(this.dedicatedPool.values());
    this.dedicatedPool.clear();
    this.sharedScopedCache.clear();
    await Promise.all(entries.map((entry) => entry.client.$disconnect().catch(() => undefined)));
  }

  public async probeDedicatedConnection(
    encryptedDatabaseUrl: string,
    tenantId: string
  ): Promise<DedicatedConnectionProbeResult> {
    let normalizedUrl = '';
    try {
      const rawUrl = decryptTenantSecret(encryptedDatabaseUrl, { tenantId });
      normalizedUrl = normalizeDedicatedPostgresUrl(rawUrl, 1);
    } catch (err: any) {
      return {
        reachable: false,
        errorCode: 'DECRYPT_OR_URL_INVALID',
        errorSummary: sanitizeDiagnosticMessage(err?.message || 'Kredensial Dedicated DB tidak valid')
      };
    }

    const probeClient = this.dedicatedClientFactory(normalizedUrl, tenantId);
    try {
      await probeClient.$queryRawUnsafe('SELECT 1');
      return { reachable: true, errorCode: null, errorSummary: null };
    } catch (err: any) {
      return {
        reachable: false,
        errorCode: typeof err?.code === 'string' ? err.code : 'DEDICATED_DB_UNREACHABLE',
        errorSummary: sanitizeDiagnosticMessage(err?.message || String(err), [normalizedUrl])
      };
    } finally {
      await probeClient.$disconnect().catch(() => undefined);
    }
  }

  public getStats(): {
    dedicatedActiveCount: number;
    maxDedicatedClients: number;
    sharedWrappersCount: number;
    activeTenantIds: string[];
  } {
    return {
      dedicatedActiveCount: this.dedicatedPool.size,
      maxDedicatedClients: this.maxDedicatedClients,
      sharedWrappersCount: this.sharedScopedCache.size,
      activeTenantIds: Array.from(this.dedicatedPool.keys())
    };
  }
}
