import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { SERVER_CONFIG } from '../config/constants';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';
import {
  getControlPlanePrisma,
  getPrismaForActiveContext,
  getTenantConnectionRegistry,
  getTenantVillageProfileId,
  isDatabaseAvailableCached,
  isJsonFallbackAllowed
} from '../db/prisma-helpers';
import {
  getCurrentTenantContext,
  isMultiTenantRoutingEnabled,
  runWithTenantContext,
  TenantScopeViolationError
} from '../db/tenantContext';
import { getDb } from '../db/database';

export interface DatabaseBackupResult {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  mode: 'prisma' | 'json-fallback';
  tenantId?: string | null;
  tenantSlug?: string | null;
}

export interface TenantBackupSweepSummary {
  totalTenants: number;
  succeeded: number;
  failed: number;
  results: Array<{
    tenantId: string | null;
    slug: string | null;
    status: 'ok' | 'error';
    fileName?: string;
    sizeBytes?: number;
    error?: string;
  }>;
}

export interface TenantRestoreResult {
  tenantId: string;
  restoredModels: Record<string, number>;
  totalRowsRestored: number;
}

export const BACKUP_MODELS = [
  'user',
  'villageProfile',
  'dusun',
  'rW',
  'rT',
  'villageService',
  'serviceRequest',
  'deletedServiceRequest',
  'complaint',
  'resident',
  'bansosRecipient',
  'newsItem',
  'announcement',
  'agendaItem',
  'galleryItem',
  'budgetYearData',
  'developmentProject',
  'villagePotential',
  'umkmItem',
  'villageOfficial',
  'mapFacility',
  'landParcel',
  'toddlerRecord',
  'toddlerMeasurement',
  'posyanduSchedule',
  'auditLog',
  'attendanceLog',
  'gisTenantConfig',
  'gisVillageBoundary',
  'gisRoad',
  'gisInfrastructure',
  'gisPotentialArea',
  'gisDataSource',
  'gisImportJob',
  'gisChangeLog'
] as const;

const OPTIONAL_GIS_MODELS = new Set<string>([
  'gisTenantConfig',
  'gisVillageBoundary',
  'gisRoad',
  'gisInfrastructure',
  'gisPotentialArea',
  'gisDataSource',
  'gisImportJob',
  'gisChangeLog'
]);

// Urutan aman untuk deleteMany (child sebelum parent FK) dan createMany (parent sebelum child FK)
const RESTORE_DELETE_ORDER = [
  'gisChangeLog',
  'gisImportJob',
  'gisDataSource',
  'gisPotentialArea',
  'gisInfrastructure',
  'gisRoad',
  'gisVillageBoundary',
  'gisTenantConfig',
  'toddlerMeasurement',
  'toddlerRecord',
  'bansosRecipient',
  'rT',
  'rW',
  'dusun',
  'resident',
  'deletedServiceRequest',
  'serviceRequest',
  'villageService',
  'complaint',
  'newsItem',
  'announcement',
  'agendaItem',
  'galleryItem',
  'budgetYearData',
  'developmentProject',
  'villagePotential',
  'umkmItem',
  'villageOfficial',
  'mapFacility',
  'landParcel',
  'posyanduSchedule',
  'attendanceLog',
  'auditLog',
  'villageProfile'
] as const;

const RESTORE_INSERT_ORDER = [...RESTORE_DELETE_ORDER].reverse();

function sanitizeBackupUsers(users: any[]): any[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) => {
    if (!u || typeof u !== 'object') return u;
    const { passwordHash: _ph, salt: _s, ...safeUser } = u;
    return safeUser;
  });
}

function cleanupOldBackups(backupDir: string): void {
  if (!fs.existsSync(backupDir)) return;
  const files = fs.readdirSync(backupDir);
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
      fs.unlinkSync(filePath);
      console.log(`🧹 [BACKUP] Deleted old backup: ${file}`);
    }
  }
}

export async function buildTenantSnapshotPayload(
  prisma: PrismaClient,
  tenantId: string | null,
  tenantSlug: string | null
) {
  const createdAt = new Date().toISOString();
  const backupPayload: Record<string, any> = {};

  for (const model of BACKUP_MODELS) {
    const delegate = (prisma as any)[model];
    if (!delegate || typeof delegate.findMany !== 'function') {
      backupPayload[model] = [];
      continue;
    }
    try {
      const rows = await delegate.findMany(
        tenantId ? { where: { villageId: tenantId } } : undefined
      );
      backupPayload[model] = model === 'user' ? sanitizeBackupUsers(rows) : rows;
    } catch (err: any) {
      if (OPTIONAL_GIS_MODELS.has(model) && err?.code === 'P2021') {
        backupPayload[model] = [];
      } else {
        throw err;
      }
    }
  }

  return {
    meta: {
      app: tenantSlug ? `SADEWA (${tenantSlug})` : 'SADEWA - Sistem Administrasi & Pelayanan Desa',
      tenantId,
      tenantSlug,
      mode: 'prisma' as const,
      exportedAt: createdAt
    },
    data: backupPayload
  };
}

export async function runDatabaseBackup(): Promise<DatabaseBackupResult> {
  const ctx = getCurrentTenantContext();
  const tenantId = ctx?.tenantId || null;
  const tenantSlug = ctx?.slug || null;
  console.log(`🚀 [BACKUP] Starting database backup${tenantSlug ? ` (tenant: ${tenantSlug})` : ''}...`);

  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[:.]/g, '-');
  const baseBackupDir = SERVER_CONFIG.BACKUP_DIR;
  const backupDir = tenantId ? path.join(baseBackupDir, 'tenants', tenantId) : baseBackupDir;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = tenantSlug
    ? `sadewa_backup_${tenantSlug}_${timestamp}.json`
    : `sadewa_backup_${timestamp}.json`;
  const backupFile = path.join(backupDir, fileName);
  let mode: 'prisma' | 'json-fallback' = 'prisma';
  let finalSnapshot: any;

  if (await isDatabaseAvailableCached()) {
    const prisma = await getPrismaForActiveContext();
    finalSnapshot = await buildTenantSnapshotPayload(prisma, tenantId, tenantSlug);
  } else {
    if (!isJsonFallbackAllowed()) {
      throw new Error('Database tidak tersedia untuk ekspor backup tenant pada mode multi-tenant.');
    }
    mode = 'json-fallback';
    const jsonDb = getDb();
    finalSnapshot = {
      meta: {
        app: tenantSlug ? `SADEWA (${tenantSlug})` : 'SADEWA - Sistem Administrasi & Pelayanan Desa',
        tenantId,
        tenantSlug,
        mode,
        exportedAt: createdAt
      },
      data: {
        ...jsonDb,
        users: sanitizeBackupUsers(jsonDb.users || [])
      }
    };
  }

  fs.writeFileSync(backupFile, JSON.stringify(finalSnapshot, null, 2), 'utf-8');
  const stats = fs.statSync(backupFile);
  cleanupOldBackups(backupDir);

  console.log(`✅ [BACKUP] Success (${mode})! Saved to: ${backupFile}`);

  return {
    fileName,
    filePath: backupFile,
    sizeBytes: stats.size,
    createdAt,
    mode,
    tenantId,
    tenantSlug
  };
}

/**
 * Menjalankan cron backup harian yang terpartisi per-tenant.
 * - Setiap tenant ACTIVE diekspor di dalam TenantContext masing-masing ke `tenants/<tenantId>/...`.
 * - Tidak pernah mencampur data antar desa dalam satu arsip JSON.
 */
export async function runAllTenantsBackupSweep(): Promise<TenantBackupSweepSummary> {
  const controlPlane = getControlPlanePrisma();
  const registry = getTenantConnectionRegistry();
  let activeTenants: any[] = [];

  try {
    activeTenants = await (controlPlane as any).tenant.findMany({
      where: { status: 'ACTIVE' },
      include: { dbConfig: true },
      orderBy: { createdAt: 'asc' }
    });
  } catch {
    activeTenants = [];
  }

  // Jika belum ada registry Tenant aktif & multi-tenant belum aktif -> fallback single-tenant
  if (activeTenants.length === 0) {
    if (isMultiTenantRoutingEnabled()) {
      return { totalTenants: 0, succeeded: 0, failed: 0, results: [] };
    }
    try {
      const singleRes = await runDatabaseBackup();
      return {
        totalTenants: 1,
        succeeded: 1,
        failed: 0,
        results: [
          {
            tenantId: null,
            slug: 'legacy-single-tenant',
            status: 'ok',
            fileName: singleRes.fileName,
            sizeBytes: singleRes.sizeBytes
          }
        ]
      };
    } catch (err: any) {
      return {
        totalTenants: 1,
        succeeded: 0,
        failed: 1,
        results: [
          {
            tenantId: null,
            slug: 'legacy-single-tenant',
            status: 'error',
            error: sanitizeDiagnosticMessage(err?.message || String(err))
          }
        ]
      };
    }
  }

  const results: TenantBackupSweepSummary['results'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const tenant of activeTenants) {
    try {
      const activeClient =
        tenant.tenancyMode === 'DEDICATED' && tenant.dbConfig?.encryptedDatabaseUrl
          ? await registry.getClientForTenant({
              tenantId: tenant.id,
              tenancyMode: 'DEDICATED',
              dbConfig: {
                encryptedDatabaseUrl: tenant.dbConfig.encryptedDatabaseUrl,
                credentialVersion: tenant.dbConfig.credentialVersion ?? 1
              }
            })
          : registry.getSharedScopedClient(tenant.id);

      const backupRes = await runWithTenantContext(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          tenantName: tenant.name,
          letterCodePrefix: tenant.letterCodePrefix,
          tenancyMode: tenant.tenancyMode,
          isPlatformScope: false,
          credentialVersion: tenant.dbConfig?.credentialVersion ?? 1,
          requestId: `cron-backup-${crypto.randomUUID()}`,
          activeClient
        },
        () => runDatabaseBackup()
      );

      succeeded++;
      results.push({
        tenantId: tenant.id,
        slug: tenant.slug,
        status: 'ok',
        fileName: backupRes.fileName,
        sizeBytes: backupRes.sizeBytes
      });
    } catch (err: any) {
      failed++;
      results.push({
        tenantId: tenant.id,
        slug: tenant.slug,
        status: 'error',
        error: sanitizeDiagnosticMessage(err?.message || String(err))
      });
    }
  }

  return {
    totalTenants: activeTenants.length,
    succeeded,
    failed,
    results
  };
}

/**
 * Memulihkan arsip snapshot JSON KHUSUS untuk satu tenant target secara transaksional.
 * - Memblokir snapshot milik tenant lain agar tidak terjadi kontaminasi data lintas desa.
 * - Menggunakan `where: { villageId: targetTenantId }` secara ketat saat membersihkan & memulihkan
 *   sehingga baris data milik desa tetangga pada Shared DB tetap 100% utuh.
 */
export async function restoreTenantBackupSnapshot(
  snapshot: { meta?: { tenantId?: string | null }; data?: Record<string, any> },
  targetTenantId: string,
  targetPrisma: PrismaClient,
  options: { allowCrossTenantRemap?: boolean } = {}
): Promise<TenantRestoreResult> {
  const cleanTenantId = String(targetTenantId || '').trim();
  if (!cleanTenantId) {
    throw new TenantScopeViolationError('targetTenantId wajib disediakan untuk pemulihan data tenant.');
  }
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.data || typeof snapshot.data !== 'object') {
    throw new Error('Format snapshot backup JSON tidak valid (objek data tidak ditemukan).');
  }

  const snapshotTenantId = snapshot.meta?.tenantId ? String(snapshot.meta.tenantId).trim() : null;
  if (snapshotTenantId && snapshotTenantId !== cleanTenantId && !options.allowCrossTenantRemap) {
    throw new TenantScopeViolationError(
      `Penolakan keamanan lintas-tenant: arsip milik "${snapshotTenantId}" tidak dapat dipulihkan ke "${cleanTenantId}".`
    );
  }

  const data = snapshot.data;
  const restoredModels: Record<string, number> = {};
  let totalRowsRestored = 0;

  await (targetPrisma as any).$transaction(async (tx: any) => {
    // 1. Bersihkan data operasional HANYA milik tenant target (tidak pernah global deleteMany({}))
    for (const model of RESTORE_DELETE_ORDER) {
      const delegate = tx[model];
      if (!delegate || typeof delegate.deleteMany !== 'function') continue;
      try {
        await delegate.deleteMany({ where: { villageId: cleanTenantId } });
      } catch (err: any) {
        if (!(OPTIONAL_GIS_MODELS.has(model) && err?.code === 'P2021')) {
          throw err;
        }
      }
    }

    // 2. Pulihkan baris dalam urutan parent -> child dan paksa stempel villageId = targetTenantId
    for (const model of RESTORE_INSERT_ORDER) {
      const rawRows = data[model];
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        restoredModels[model] = 0;
        continue;
      }

      const delegate = tx[model];
      if (!delegate) {
        restoredModels[model] = 0;
        continue;
      }

      const preparedRows = rawRows.map((row: Record<string, any>) => {
        const cloned: Record<string, any> = { ...row, villageId: cleanTenantId };
        if (model === 'villageProfile') {
          cloned.id =
            cleanTenantId === 'tenant_pulau_betung'
              ? 'default'
              : getTenantVillageProfileId() !== 'default'
              ? getTenantVillageProfileId()
              : `profile-${cleanTenantId}`;
        }
        return cloned;
      });

      try {
        if (typeof delegate.createMany === 'function') {
          await delegate.createMany({
            data: preparedRows,
            skipDuplicates: true
          });
        } else {
          for (const item of preparedRows) {
            await delegate.create({ data: item });
          }
        }
        restoredModels[model] = preparedRows.length;
        totalRowsRestored += preparedRows.length;
      } catch (err: any) {
        if (OPTIONAL_GIS_MODELS.has(model) && err?.code === 'P2021') {
          restoredModels[model] = 0;
        } else {
          throw err;
        }
      }
    }
  });

  return {
    tenantId: cleanTenantId,
    restoredModels,
    totalRowsRestored
  };
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  path.basename(process.argv[1]).startsWith('db-backup');

if (isDirectCli) {
  runAllTenantsBackupSweep().catch((error) => {
    console.error('❌ [BACKUP] Failed:', error?.message || error);
    process.exit(1);
  });
}
