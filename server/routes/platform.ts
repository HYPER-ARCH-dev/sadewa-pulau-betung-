import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  AuthenticatedRequest,
  authenticatePlatformToken,
  requirePlatformRoles,
  requirePlatformScopeHost
} from '../auth';
import { getControlPlanePrisma, getTenantConnectionRegistry } from '../db/prisma-helpers';
import { runWithTenantContext, TenantScopeViolationError } from '../db/tenantContext';
import { restoreTenantBackupSnapshot, runDatabaseBackup } from '../scripts/db-backup';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';
import {
  addTenantCustomDomain,
  claimPlatformBootstrap,
  createTenantVillage,
  getPlatformBootstrapStatus,
  getPlatformOverview,
  listPlatformAuditLogs,
  listPlatformTenants,
  loginPlatformUser,
  PlatformActor,
  PlatformControlPlaneError,
  probeTenantDatabaseUrl,
  recordPlatformAudit,
  removeTenantDomain,
  revokeDedicatedDatabaseConfig,
  rotateDedicatedDatabaseCredentials,
  updateTenantStatus,
  upsertDedicatedDatabaseConfig,
  verifyTenantDomainDns
} from '../services/platformControlPlane';

const router = Router();

const platformAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    error: 'Terlalu banyak percobaan autentikasi platform. Silakan coba lagi dalam 15 menit.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

function getPlatformActor(req: AuthenticatedRequest): PlatformActor {
  return {
    userId: req.user?.userId || 'unknown',
    name: req.user?.name || 'Platform Admin',
    username: req.user?.username || 'platform',
    role: req.user?.role === 'platform_ops' ? 'platform_ops' : 'platform_super_admin'
  };
}

function handlePlatformError(res: Response, err: unknown, fallbackMessage: string) {
  if (err instanceof PlatformControlPlaneError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      error: err.message
    });
  }
  const cleanMsg = sanitizeDiagnosticMessage(err instanceof Error ? err.message : String(err));
  console.warn(`⚠️ [PLATFORM-API-ERROR]: ${cleanMsg}`);
  return res.status(500).json({
    success: false,
    error: fallbackMessage
  });
}

// Pastikan seluruh endpoint Platform Control Plane hanya bisa diakses pada scope platform
router.use(requirePlatformScopeHost);

// ============================================================================
// 🔑 1. PLATFORM AUTHENTICATION & BOOTSTRAP
// ============================================================================
router.get('/auth/bootstrap-status', async (_req: Request, res: Response) => {
  try {
    const status = await getPlatformBootstrapStatus();
    return res.json({ success: true, ...status });
  } catch (err) {
    return handlePlatformError(res, err, 'Gagal memeriksa status aktivasi Control Plane.');
  }
});

router.post('/auth/claim-bootstrap', platformAuthLimiter, async (req: Request, res: Response) => {
  try {
    const result = await claimPlatformBootstrap({
      name: req.body?.name,
      username: req.body?.username,
      email: req.body?.email,
      password: req.body?.password,
      bootstrapPasscode: req.body?.bootstrapPasscode,
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.status(201).json({
      success: true,
      message: 'Platform Super Admin perdana berhasil diaktivasi.',
      ...result
    });
  } catch (err) {
    return handlePlatformError(res, err, 'Gagal mengaktivasi akun Platform Super Admin.');
  }
});

router.post('/auth/login', platformAuthLimiter, async (req: Request, res: Response) => {
  try {
    const result = await loginPlatformUser({
      username: req.body?.username,
      password: req.body?.password,
      ipAddress: req.ip || '127.0.0.1'
    });
    return res.json({
      success: true,
      message: `Selamat datang di Control Plane, ${result.user.name}.`,
      ...result
    });
  } catch (err) {
    return handlePlatformError(res, err, 'Gagal memproses login pengelola platform.');
  }
});

router.get('/auth/me', authenticatePlatformToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const platformUser = await (getControlPlanePrisma() as any).platformUser.findUnique({
      where: { id: req.user?.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        lastLogin: true
      }
    });
    if (!platformUser) {
      return res.status(404).json({ success: false, error: 'Akun platform tidak ditemukan.' });
    }
    return res.json({
      success: true,
      user: {
        ...platformUser,
        lastLogin: platformUser.lastLogin ? platformUser.lastLogin.toISOString() : null
      }
    });
  } catch (err) {
    return handlePlatformError(res, err, 'Gagal memuat profil pengelola platform.');
  }
});

router.post('/auth/logout', authenticatePlatformToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.userId) {
      await (getControlPlanePrisma() as any).platformUser.update({
        where: { id: req.user.userId },
        data: { tokenVersion: { increment: 1 } }
      });
      await recordPlatformAudit(
        getPlatformActor(req),
        'Logout Platform Control Plane',
        'Autentikasi Platform',
        `Pengelola platform ${req.user.name} keluar dan mencabut token sesi.`,
        { ipAddress: req.ip || '127.0.0.1' }
      );
    }
    return res.json({ success: true, message: 'Sesi platform berhasil diakhiri.' });
  } catch (err) {
    return handlePlatformError(res, err, 'Gagal mengakhiri sesi platform.');
  }
});

// ============================================================================
// 📊 2. OVERVIEW & TENANT REGISTRY
// ============================================================================
router.get(
  '/overview',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const overview = await getPlatformOverview();
      return res.json({ success: true, ...overview });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal memuat ringkasan Platform Control Plane.');
    }
  }
);

router.get(
  '/tenants',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenants = await listPlatformTenants({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        tenancyMode: typeof req.query.tenancyMode === 'string' ? req.query.tenancyMode : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined
      });
      return res.json({ success: true, tenants });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal memuat daftar tenant desa.');
    }
  }
);

router.post(
  '/tenants',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const result = await createTenantVillage(req.body || {}, actor, req.ip || '127.0.0.1');
      return res.status(201).json({
        success: true,
        message: `Tenant ${result.tenant.name} berhasil didaftarkan.`,
        ...result
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal mendaftarkan tenant desa baru.');
    }
  }
);

router.patch(
  '/tenants/:id/status',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const tenant = await updateTenantStatus(
        req.params.id,
        req.body?.status,
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        message: `Status portal ${tenant.name} diperbarui menjadi ${tenant.status}.`,
        tenant
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal mengubah status tenant.');
    }
  }
);

// ============================================================================
// 🌐 3. CUSTOM DOMAIN & DNS VERIFICATION
// ============================================================================
router.post(
  '/tenants/:id/domains',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const result = await addTenantCustomDomain(
        req.params.id,
        req.body?.domain,
        Boolean(req.body?.isPrimary),
        actor,
        req.ip || '127.0.0.1'
      );
      return res.status(201).json({
        success: true,
        message: `Custom domain ${result.domain.domain} ditambahkan. Selesaikan konfigurasi DNS TXT untuk aktivasi.`,
        ...result
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal mendaftarkan custom domain.');
    }
  }
);

router.post(
  '/tenants/:id/domains/:domainId/verify',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const result = await verifyTenantDomainDns(
        req.params.id,
        req.params.domainId,
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal memverifikasi record DNS domain.');
    }
  }
);

router.delete(
  '/tenants/:id/domains/:domainId',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const result = await removeTenantDomain(
        req.params.id,
        req.params.domainId,
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        message: `Custom domain ${result.deletedDomain} berhasil dihapus.`,
        ...result
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal menghapus custom domain.');
    }
  }
);

// ============================================================================
// 🗄️ 4. DEDICATED DATABASE PROBING, CREDENTIAL ROTATION & REVOCATION
// ============================================================================
router.post(
  '/tenants/:id/database/test',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const probeResult = await probeTenantDatabaseUrl(req.params.id, req.body?.databaseUrl);
      return res.json({
        success: true,
        ...probeResult
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal menguji koneksi Dedicated database.');
    }
  }
);

router.put(
  '/tenants/:id/database',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const tenant = await upsertDedicatedDatabaseConfig(
        req.params.id,
        req.body || {},
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        message: `Dedicated database untuk ${tenant.name} berhasil dienkripsi dan diaktifkan.`,
        tenant
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal mengaktifkan konfigurasi Dedicated database.');
    }
  }
);

router.post(
  '/tenants/:id/database/rotate',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const tenant = await rotateDedicatedDatabaseCredentials(
        req.params.id,
        req.body || {},
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        message: `Kredensial Dedicated DB ${tenant.name} berhasil dirotasi (v${tenant.dbConfig?.credentialVersion || 1}).`,
        tenant
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal merotasi kredensial Dedicated database.');
    }
  }
);

router.post(
  '/tenants/:id/database/revoke',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const actor = getPlatformActor(req);
      const tenant = await revokeDedicatedDatabaseConfig(
        req.params.id,
        { suspendTenant: Boolean(req.body?.suspendTenant) },
        actor,
        req.ip || '127.0.0.1'
      );
      return res.json({
        success: true,
        message: `Kredensial Dedicated DB ${tenant.name} berhasil dicabut.`,
        tenant
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal mencabut kredensial Dedicated database.');
    }
  }
);

// ============================================================================
// 💾 5. PER-TENANT BACKUP & SINGLE-TENANT RESTORE DRILL
// ============================================================================
router.post(
  '/tenants/:id/backup',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const controlPlane = getControlPlanePrisma();
      const tenant = await (controlPlane as any).tenant.findUnique({
        where: { id: req.params.id },
        include: { dbConfig: true }
      });
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant desa tidak ditemukan.' });
      }

      const registry = getTenantConnectionRegistry();
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

      const result = await runWithTenantContext(
        {
          tenantId: tenant.id,
          slug: tenant.slug,
          tenantName: tenant.name,
          letterCodePrefix: tenant.letterCodePrefix,
          tenancyMode: tenant.tenancyMode,
          isPlatformScope: false,
          credentialVersion: tenant.dbConfig?.credentialVersion ?? 1,
          requestId: crypto.randomUUID(),
          activeClient
        },
        () => runDatabaseBackup()
      );

      await recordPlatformAudit(
        getPlatformActor(req),
        'Backup Terisolasi Per-Tenant',
        'Backup & Recovery',
        `Mengekspor snapshot terisolasi untuk desa ${tenant.name} ke ${result.fileName} (${result.sizeBytes} bytes).`,
        { targetTenantId: tenant.id, ipAddress: req.ip || '127.0.0.1' }
      );

      return res.status(201).json({
        success: true,
        message: `Backup terisolasi untuk ${tenant.name} berhasil dibuat.`,
        backup: {
          fileName: result.fileName,
          sizeBytes: result.sizeBytes,
          createdAt: result.createdAt,
          mode: result.mode,
          tenantId: tenant.id
        }
      });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal membuat backup terisolasi untuk tenant.');
    }
  }
);

router.post(
  '/tenants/:id/restore',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const controlPlane = getControlPlanePrisma();
      const tenant = await (controlPlane as any).tenant.findUnique({
        where: { id: req.params.id },
        include: { dbConfig: true }
      });
      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant desa tidak ditemukan.' });
      }

      const registry = getTenantConnectionRegistry();
      const targetPrisma =
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

      const snapshot = req.body?.snapshot;
      const result = await restoreTenantBackupSnapshot(snapshot, tenant.id, targetPrisma, {
        allowCrossTenantRemap: Boolean(req.body?.allowCrossTenantRemap)
      });

      await recordPlatformAudit(
        getPlatformActor(req),
        'Restore Terisolasi Single-Tenant',
        'Backup & Recovery',
        `Memulihkan ${result.totalRowsRestored} baris data secara transaksional untuk ${tenant.name} tanpa menyentuh tenant lain.`,
        { targetTenantId: tenant.id, ipAddress: req.ip || '127.0.0.1', level: 'critical' }
      );

      return res.json({
        success: true,
        message: `Pemulihan data terisolasi untuk ${tenant.name} berhasil (${result.totalRowsRestored} baris).`,
        restore: result
      });
    } catch (err: any) {
      if (err instanceof TenantScopeViolationError) {
        return res.status(403).json({ success: false, error: err.message });
      }
      return handlePlatformError(res, err, 'Gagal memulihkan snapshot data tenant.');
    }
  }
);

// ============================================================================
// 📜 6. PLATFORM AUDIT LOGS
// ============================================================================
router.get(
  '/audit-logs',
  authenticatePlatformToken,
  requirePlatformRoles('platform_super_admin', 'platform_ops'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetTenantId = typeof req.query.tenantId === 'string' && req.query.tenantId.trim()
        ? req.query.tenantId.trim()
        : undefined;
      const limit = Number.parseInt(String(req.query.limit || '60'), 10);
      const logs = await listPlatformAuditLogs({
        targetTenantId,
        limit: Number.isFinite(limit) ? limit : 60
      });
      return res.json({ success: true, logs });
    } catch (err) {
      return handlePlatformError(res, err, 'Gagal memuat log audit platform.');
    }
  }
);

export default router;
