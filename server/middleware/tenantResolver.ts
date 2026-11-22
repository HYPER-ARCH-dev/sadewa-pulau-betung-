import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import {
  getControlPlanePrisma,
  getTenantConnectionRegistry
} from '../db/prisma-helpers';
import {
  isMultiTenantRoutingEnabled,
  isPreviewOrLocalHost,
  runWithTenantContext,
  TenancyModeType,
  TenantContext
} from '../db/tenantContext';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';

interface ResolvedHostEntry {
  kind: 'PLATFORM' | 'TENANT' | 'NOT_FOUND' | 'SUSPENDED';
  tenantId: string | null;
  slug: string | null;
  tenantName: string | null;
  letterCodePrefix: string | null;
  tenancyMode: TenancyModeType;
  credentialVersion: number;
  encryptedDatabaseUrl?: string | null;
  statusMessage?: string;
  cachedAt: number;
}

const HOST_CACHE_TTL_MS = 30_000;
const hostResolutionCache = new Map<string, ResolvedHostEntry>();

export function normalizeRequestHostname(rawHost: string | undefined | null): string {
  if (!rawHost) return '';
  const firstHost = String(rawHost).split(',')[0].trim().toLowerCase();
  // Strip IPv6 brackets / :port
  const withoutBrackets = firstHost.replace(/^\[([^\]]+)\](?::\d+)?$/, '$1');
  const withoutPort = withoutBrackets.replace(/:\d+$/, '');
  return withoutPort.replace(/\.+$/, '');
}

export function extractTenantRequestHostname(req: Request): string {
  // Jangan pernah mempercayai header X-Tenant-Id / Origin / payload body untuk routing tenant!
  // req.hostname menghormati X-Forwarded-Host hanya sesuai konfigurasi app.set('trust proxy', 1).
  const candidate = req.hostname || (req.headers.host as string | undefined) || '';
  return normalizeRequestHostname(candidate);
}

function getPlatformRootDomains(): string[] {
  const root = (process.env.PLATFORM_DOMAIN || 'sadewa.id').trim().toLowerCase();
  const extras = (process.env.PLATFORM_ADMIN_DOMAINS || `platform.${root},admin.${root}`)
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([root, `www.${root}`, ...extras])];
}

export function invalidateTenantResolutionCache(hostnameOrAll?: string): void {
  if (!hostnameOrAll) {
    hostResolutionCache.clear();
    return;
  }
  const clean = normalizeRequestHostname(hostnameOrAll);
  hostResolutionCache.delete(clean);
}

async function resolveHostnameFromControlPlane(hostname: string, reqPath: string): Promise<ResolvedHostEntry> {
  const now = Date.now();
  const rootDomain = (process.env.PLATFORM_DOMAIN || 'sadewa.id').trim().toLowerCase();
  const platformDomains = new Set(getPlatformRootDomains());
  const isPlatformApiRequest = reqPath.startsWith('/api/platform');

  // 1. Platform domain (sadewa.id / platform.sadewa.id) atau panggilan API platform di host preview/local
  if (platformDomains.has(hostname) || (isPlatformApiRequest && isPreviewOrLocalHost(hostname))) {
    return {
      kind: 'PLATFORM',
      tenantId: null,
      slug: null,
      tenantName: 'SADEWA Platform Control Plane',
      letterCodePrefix: null,
      tenancyMode: 'SHARED',
      credentialVersion: 1,
      cachedAt: now
    };
  }

  const cached = hostResolutionCache.get(hostname);
  if (cached && now - cached.cachedAt < HOST_CACHE_TTL_MS) {
    return cached;
  }

  const controlPlane = getControlPlanePrisma();

  try {
    // 2. Cocokkan persis di tabel TenantDomain (Custom Domain & Subdomain terdaftar)
    const domainRecord = await (controlPlane as any).tenantDomain.findUnique({
      where: { domain: hostname },
      include: {
        tenant: {
          include: { dbConfig: true }
        }
      }
    });

    if (domainRecord) {
      if (domainRecord.isCustom && domainRecord.verificationStatus !== 'VERIFIED') {
        const entry: ResolvedHostEntry = {
          kind: 'NOT_FOUND',
          tenantId: null,
          slug: null,
          tenantName: null,
          letterCodePrefix: null,
          tenancyMode: 'SHARED',
          credentialVersion: 1,
          statusMessage: 'Custom domain belum menyelesaikan verifikasi kepemilikan DNS.',
          cachedAt: now
        };
        hostResolutionCache.set(hostname, entry);
        return entry;
      }

      const t = domainRecord.tenant;
      if (t.status === 'SUSPENDED' || t.status === 'ARCHIVED') {
        const entry: ResolvedHostEntry = {
          kind: 'SUSPENDED',
          tenantId: t.id,
          slug: t.slug,
          tenantName: t.name,
          letterCodePrefix: t.letterCodePrefix,
          tenancyMode: t.tenancyMode,
          credentialVersion: t.dbConfig?.credentialVersion ?? 1,
          statusMessage: `Portal ${t.name} sedang dinonaktifkan sementara oleh pengelola platform.`,
          cachedAt: now
        };
        hostResolutionCache.set(hostname, entry);
        return entry;
      }

      const entry: ResolvedHostEntry = {
        kind: 'TENANT',
        tenantId: t.id,
        slug: t.slug,
        tenantName: t.name,
        letterCodePrefix: t.letterCodePrefix,
        tenancyMode: t.tenancyMode,
        credentialVersion: t.dbConfig?.credentialVersion ?? 1,
        encryptedDatabaseUrl: t.dbConfig?.encryptedDatabaseUrl ?? null,
        cachedAt: now
      };
      hostResolutionCache.set(hostname, entry);
      return entry;
    }

    // 3. Resolusi subdomain wildcard `*.sadewa.id`
    const subdomainSuffix = `.${rootDomain}`;
    if (hostname.endsWith(subdomainSuffix)) {
      const candidateSlug = hostname.slice(0, -subdomainSuffix.length).trim();
      if (candidateSlug && !candidateSlug.includes('.')) {
        const tenant = await (controlPlane as any).tenant.findUnique({
          where: { slug: candidateSlug },
          include: { dbConfig: true }
        });

        if (tenant) {
          if (tenant.status === 'SUSPENDED' || tenant.status === 'ARCHIVED') {
            const entry: ResolvedHostEntry = {
              kind: 'SUSPENDED',
              tenantId: tenant.id,
              slug: tenant.slug,
              tenantName: tenant.name,
              letterCodePrefix: tenant.letterCodePrefix,
              tenancyMode: tenant.tenancyMode,
              credentialVersion: tenant.dbConfig?.credentialVersion ?? 1,
              statusMessage: `Portal ${tenant.name} sedang dinonaktifkan sementara.`,
              cachedAt: now
            };
            hostResolutionCache.set(hostname, entry);
            return entry;
          }

          const entry: ResolvedHostEntry = {
            kind: 'TENANT',
            tenantId: tenant.id,
            slug: tenant.slug,
            tenantName: tenant.name,
            letterCodePrefix: tenant.letterCodePrefix,
            tenancyMode: tenant.tenancyMode,
            credentialVersion: tenant.dbConfig?.credentialVersion ?? 1,
            encryptedDatabaseUrl: tenant.dbConfig?.encryptedDatabaseUrl ?? null,
            cachedAt: now
          };
          hostResolutionCache.set(hostname, entry);
          return entry;
        }
      }
    }

    // 4. Fallback aman untuk localhost & preview domain (hanya jika diizinkan & tenant default ada)
    const allowPreviewFallback = process.env.ALLOW_PREVIEW_TENANT_FALLBACK !== 'false';
    if (allowPreviewFallback && isPreviewOrLocalHost(hostname)) {
      const defaultSlug = (process.env.DEFAULT_TENANT_SLUG || 'pulau-betung').trim();
      const defaultTenant = await (controlPlane as any).tenant.findUnique({
        where: { slug: defaultSlug },
        include: { dbConfig: true }
      });

      if (defaultTenant) {
        const entry: ResolvedHostEntry = {
          kind: 'TENANT',
          tenantId: defaultTenant.id,
          slug: defaultTenant.slug,
          tenantName: defaultTenant.name,
          letterCodePrefix: defaultTenant.letterCodePrefix,
          tenancyMode: defaultTenant.tenancyMode,
          credentialVersion: defaultTenant.dbConfig?.credentialVersion ?? 1,
          encryptedDatabaseUrl: defaultTenant.dbConfig?.encryptedDatabaseUrl ?? null,
          cachedAt: now
        };
        hostResolutionCache.set(hostname, entry);
        return entry;
      }
    }
  } catch (err: any) {
    // Saat DB offline atau tabel Control Plane belum dibuat, mode single-tenant legacy tetap aman berjalan
    if (!isMultiTenantRoutingEnabled()) {
      return {
        kind: 'TENANT',
        tenantId: null,
        slug: null,
        tenantName: null,
        letterCodePrefix: null,
        tenancyMode: 'SHARED',
        credentialVersion: 1,
        cachedAt: now
      };
    }
    throw err;
  }

  const notFoundEntry: ResolvedHostEntry = {
    kind: 'NOT_FOUND',
    tenantId: null,
    slug: null,
    tenantName: null,
    letterCodePrefix: null,
    tenancyMode: 'SHARED',
    credentialVersion: 1,
    statusMessage: `Domain portal desa "${hostname}" tidak terdaftar pada platform SADEWA.`,
    cachedAt: now
  };
  hostResolutionCache.set(hostname, notFoundEntry);
  return notFoundEntry;
}

/**
 * Menyelesaikan TenantContext berdasarkan slug desa (khusus portal pusat /v/:slug/verify/:identifier)
 */
export async function resolveTenantContextBySlug(slug: string): Promise<TenantContext | null> {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    return null;
  }

  const controlPlane = getControlPlanePrisma();
  const tenant = await (controlPlane as any).tenant.findUnique({
    where: { slug: cleanSlug },
    include: { dbConfig: true }
  });

  if (!tenant || tenant.status === 'SUSPENDED' || tenant.status === 'ARCHIVED') {
    return null;
  }

  const registry = getTenantConnectionRegistry();
  let activeClient: unknown;
  if (tenant.tenancyMode === 'DEDICATED' && tenant.dbConfig?.encryptedDatabaseUrl) {
    activeClient = await registry.getClientForTenant({
      tenantId: tenant.id,
      tenancyMode: 'DEDICATED',
      dbConfig: {
        encryptedDatabaseUrl: tenant.dbConfig.encryptedDatabaseUrl,
        credentialVersion: tenant.dbConfig.credentialVersion ?? 1
      }
    });
  } else {
    activeClient = registry.getSharedScopedClient(tenant.id);
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    tenantName: tenant.name,
    letterCodePrefix: tenant.letterCodePrefix,
    tenancyMode: tenant.tenancyMode,
    isPlatformScope: false,
    credentialVersion: tenant.dbConfig?.credentialVersion ?? 1,
    requestId: crypto.randomUUID(),
    activeClient
  };
}

/**
 * Middleware Express untuk menyelesaikan konteks tenant dari `Host` secara otoritatif
 * dan mengisolasi seluruh siklus eksekusi di dalam `AsyncLocalStorage`.
 */
export async function tenantResolverMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const multiTenantActive = isMultiTenantRoutingEnabled();
  const hostname = extractTenantRequestHostname(req);
  const fullReqPath = (req.originalUrl || req.path || '').split('?')[0];
  const requestId = crypto.randomUUID();

  // Jika multi-tenant routing belum diaktifkan, jalankan mode single-tenant legacy tanpa memblokir
  // kecuali host jelas-jelas mengakses endpoint platform atau domain tenant spesifik yang terdaftar.
  if (!multiTenantActive) {
    const legacyCtx: TenantContext = {
      tenantId: null,
      slug: null,
      tenantName: null,
      letterCodePrefix: null,
      tenancyMode: 'SHARED',
      isPlatformScope: fullReqPath.startsWith('/api/platform'),
      credentialVersion: 1,
      requestId
    };
    runWithTenantContext(legacyCtx, () => next());
    return;
  }

  try {
    const resolved = await resolveHostnameFromControlPlane(hostname, fullReqPath);

    if (resolved.kind === 'NOT_FOUND') {
      res.status(404).json({
        success: false,
        error: resolved.statusMessage || 'Portal desa tidak ditemukan.',
        code: 'TENANT_NOT_FOUND'
      });
      return;
    }

    if (resolved.kind === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        error: resolved.statusMessage || 'Portal desa sedang dinonaktifkan sementara.',
        code: 'TENANT_SUSPENDED'
      });
      return;
    }

    let activeClient: unknown = undefined;
    if (resolved.kind === 'TENANT' && resolved.tenantId) {
      const registry = getTenantConnectionRegistry();
      if (resolved.tenancyMode === 'DEDICATED' && resolved.encryptedDatabaseUrl) {
        activeClient = await registry.getClientForTenant({
          tenantId: resolved.tenantId,
          tenancyMode: 'DEDICATED',
          dbConfig: {
            encryptedDatabaseUrl: resolved.encryptedDatabaseUrl,
            credentialVersion: resolved.credentialVersion
          }
        });
      } else {
        activeClient = registry.getSharedScopedClient(resolved.tenantId);
      }
    }

    const context: TenantContext = {
      tenantId: resolved.tenantId,
      slug: resolved.slug,
      tenantName: resolved.tenantName,
      letterCodePrefix: resolved.letterCodePrefix,
      tenancyMode: resolved.tenancyMode,
      isPlatformScope: resolved.kind === 'PLATFORM',
      credentialVersion: resolved.credentialVersion,
      requestId,
      activeClient
    };

    runWithTenantContext(context, () => next());
  } catch (err: any) {
    console.warn('⚠️ [TENANT-RESOLVER-ERROR]:', sanitizeDiagnosticMessage(err?.message || String(err)));
    res.status(503).json({
      success: false,
      error: 'Gagal menyelesaikan konfigurasi portal desa. Silakan coba lagi.'
    });
  }
}
