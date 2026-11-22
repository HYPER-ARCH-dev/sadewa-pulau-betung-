import crypto from 'node:crypto';
import dnsPromises from 'node:dns/promises';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformToken,
  generateSalt,
  hashPassword,
  verifyPassword
} from '../auth';
import { sanitizeDiagnosticMessage } from '../db/connection-diagnostic';
import {
  getControlPlanePrisma,
  getTenantConnectionRegistry
} from '../db/prisma-helpers';
import {
  createTenantScopedPrisma,
  normalizeDedicatedPostgresUrl,
  TenantConnectionRegistry
} from '../db/tenantConnectionRegistry';
import { isMultiTenantRoutingEnabled } from '../db/tenantContext';
import { invalidateTenantResolutionCache } from '../middleware/tenantResolver';
import {
  decryptTenantSecret,
  encryptTenantSecret,
  parseEnvelopeMetadata
} from '../security/credentialVault';

export class PlatformControlPlaneError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, message: string, code: string = 'PLATFORM_ERROR') {
    super(message);
    this.name = 'PlatformControlPlaneError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface PlatformActor {
  userId: string;
  name: string;
  username: string;
  role: 'platform_super_admin' | 'platform_ops';
}

export interface DnsLookupAdapter {
  resolveTxt(hostname: string): Promise<string[][]>;
  resolveCname(hostname: string): Promise<string[]>;
}

export interface MaskedDbConfigSummary {
  configured: boolean;
  maskedTarget: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  isPooler: boolean;
  sslMode: string | null;
  hasDirectUrl: boolean;
  hasSupabaseStorage: boolean;
  storageBucket: string | null;
  keyVersion: number;
  credentialVersion: number;
  lastProbeAt: string | null;
  lastProbeStatus: string | null;
  rotatedAt: string | null;
  decryptionError?: boolean;
}

const RESERVED_TENANT_SLUGS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'static',
  'cdn',
  'mail',
  'root',
  'system',
  'sadewa',
  'assets',
  'verify',
  'v',
  'localhost',
  'status',
  'docs'
]);

const DEFAULT_DNS_ADAPTER: DnsLookupAdapter = {
  resolveTxt: (hostname: string) => dnsPromises.resolveTxt(hostname),
  resolveCname: (hostname: string) => dnsPromises.resolveCname(hostname)
};

export function getPlatformRootDomain(): string {
  return (process.env.PLATFORM_DOMAIN || 'sadewa.id').trim().toLowerCase();
}

export function getPlatformCnameTarget(): string {
  return (process.env.PLATFORM_CNAME_TARGET || `cname.${getPlatformRootDomain()}`).trim().toLowerCase();
}

export function getPlatformConfigSummary() {
  return {
    platformDomain: getPlatformRootDomain(),
    cnameTarget: getPlatformCnameTarget(),
    multiTenantRouting: isMultiTenantRoutingEnabled(),
    requiresBootstrapPasscode: Boolean(process.env.PLATFORM_BOOTSTRAP_PASSCODE?.trim())
  };
}

export function validateTenantSlug(rawSlug: string): string {
  const slug = String(rawSlug || '').trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)) {
    throw new PlatformControlPlaneError(
      400,
      'Slug desa hanya boleh huruf kecil, angka, dan tanda hubung (3–50 karakter).',
      'INVALID_SLUG'
    );
  }
  if (slug.includes('--') || RESERVED_TENANT_SLUGS.has(slug)) {
    throw new PlatformControlPlaneError(
      400,
      `Slug "${slug}" bersifat cadangan sistem atau tidak valid.`,
      'RESERVED_SLUG'
    );
  }
  return slug;
}

export function validateLetterCodePrefix(rawPrefix: string | undefined | null, fallbackSlug: string): string {
  const candidate = String(rawPrefix || fallbackSlug.replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'DESA')
    .trim()
    .toUpperCase();
  if (!/^[A-Z0-9-]{2,16}$/.test(candidate)) {
    throw new PlatformControlPlaneError(
      400,
      'Kode prefix surat hanya boleh huruf kapital, angka, dan strip (2–16 karakter).',
      'INVALID_LETTER_PREFIX'
    );
  }
  return candidate;
}

export function validateCustomDomain(rawDomain: string): string {
  const domain = String(rawDomain || '').trim().toLowerCase().replace(/\.+$/, '');
  if (!domain) {
    throw new PlatformControlPlaneError(400, 'Nama domain tidak boleh kosong.', 'INVALID_DOMAIN');
  }
  if (
    domain.includes('://') ||
    domain.includes('/') ||
    domain.includes(':') ||
    domain.includes('*') ||
    /\s/.test(domain)
  ) {
    throw new PlatformControlPlaneError(
      400,
      'Masukkan nama hostname domain murni tanpa protokol (http/https), port, wildcard, atau path.',
      'INVALID_DOMAIN'
    );
  }

  // Tolak IPv4 / localhost / internal TLDs
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(domain)) {
    throw new PlatformControlPlaneError(400, 'Alamat IP tidak diizinkan sebagai custom domain.', 'INVALID_DOMAIN');
  }
  if (
    domain === 'localhost' ||
    domain.endsWith('.localhost') ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    domain.endsWith('.arpa')
  ) {
    throw new PlatformControlPlaneError(400, 'Hostname internal atau localhost tidak valid untuk custom domain.', 'INVALID_DOMAIN');
  }

  const rootDomain = getPlatformRootDomain();
  if (domain === rootDomain || domain.endsWith(`.${rootDomain}`)) {
    throw new PlatformControlPlaneError(
      400,
      `Subdomain di bawah *.${rootDomain} dikelola otomatis dari slug desa dan tidak perlu didaftarkan sebagai custom domain.`,
      'PLATFORM_SUBDOMAIN_RESERVED'
    );
  }

  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new PlatformControlPlaneError(400, `Format hostname domain "${domain}" tidak valid.`, 'INVALID_DOMAIN');
  }

  return domain;
}

export function assertSafeDedicatedPostgresUrl(rawUrl: string, maxConnections: number = 5): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    throw new PlatformControlPlaneError(400, 'Connection string DATABASE_URL wajib diisi.', 'INVALID_DB_URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new PlatformControlPlaneError(400, 'Format PostgreSQL connection string tidak valid.', 'INVALID_DB_URL');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new PlatformControlPlaneError(
      400,
      'Protokol database Dedicated wajib menggunakan postgresql:// atau postgres://.',
      'INVALID_DB_URL'
    );
  }

  if (!parsed.hostname || !parsed.username) {
    throw new PlatformControlPlaneError(
      400,
      'Connection string Dedicated harus menyertakan hostname dan kredensial pengguna database.',
      'INVALID_DB_URL'
    );
  }

  const hostLower = parsed.hostname.toLowerCase();
  if (
    hostLower === '169.254.169.254' ||
    hostLower.startsWith('169.254.') ||
    hostLower === 'metadata.google.internal' ||
    hostLower === '0.0.0.0'
  ) {
    throw new PlatformControlPlaneError(400, 'Target host database tidak diizinkan (SSRF guard).', 'UNSAFE_DB_HOST');
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_LOCAL_DEDICATED_DB !== 'true' &&
    (hostLower === 'localhost' || hostLower === '127.0.0.1' || hostLower === '::1')
  ) {
    throw new PlatformControlPlaneError(
      400,
      'Host database lokal/loopback tidak diizinkan pada lingkungan production.',
      'UNSAFE_DB_HOST'
    );
  }

  return normalizeDedicatedPostgresUrl(trimmed, maxConnections);
}

export function summarizeMaskedDbConfig(
  dbConfig: {
    encryptedDatabaseUrl: string;
    encryptedDirectUrl?: string | null;
    encryptedSupabaseUrl?: string | null;
    encryptedServiceKey?: string | null;
    storageBucket?: string | null;
    keyVersion: number;
    credentialVersion: number;
    lastProbeAt?: Date | string | null;
    lastProbeStatus?: string | null;
    rotatedAt?: Date | string | null;
  } | null | undefined,
  tenantId: string
): MaskedDbConfigSummary | null {
  if (!dbConfig) return null;

  let host: string | null = null;
  let port: string | null = null;
  let database: string | null = null;
  let isPooler = false;
  let sslMode: string | null = null;
  let decryptionError = false;

  try {
    const rawUrl = decryptTenantSecret(dbConfig.encryptedDatabaseUrl, { tenantId });
    const parsed = new URL(rawUrl);
    host = parsed.hostname;
    port = parsed.port || '5432';
    database = parsed.pathname.replace(/^\//, '') || 'postgres';
    isPooler = parsed.searchParams.get('pgbouncer') === 'true' || port === '6543';
    sslMode =
      parsed.searchParams.get('sslmode') ||
      (host.endsWith('.supabase.co') || host.endsWith('.supabase.com') ? 'require' : 'default');
  } catch {
    decryptionError = true;
  }

  return {
    configured: true,
    maskedTarget: host ? `postgresql://***@${host}:${port}/${database}` : null,
    host,
    port,
    database,
    isPooler,
    sslMode,
    hasDirectUrl: Boolean(dbConfig.encryptedDirectUrl),
    hasSupabaseStorage: Boolean(dbConfig.encryptedSupabaseUrl && dbConfig.encryptedServiceKey),
    storageBucket: dbConfig.storageBucket || null,
    keyVersion: dbConfig.keyVersion,
    credentialVersion: dbConfig.credentialVersion,
    lastProbeAt: dbConfig.lastProbeAt ? new Date(dbConfig.lastProbeAt).toISOString() : null,
    lastProbeStatus: dbConfig.lastProbeStatus || null,
    rotatedAt: dbConfig.rotatedAt ? new Date(dbConfig.rotatedAt).toISOString() : null,
    ...(decryptionError ? { decryptionError: true } : {})
  };
}

function getTenantInitialProfileId(tenantId: string): string {
  return tenantId === 'tenant_pulau_betung' ? 'default' : `profile-${tenantId}`;
}

async function invalidateAllTenantDomainCaches(controlPlane: PrismaClient, tenantId: string): Promise<void> {
  const domains = await (controlPlane as any).tenantDomain.findMany({
    where: { tenantId },
    select: { domain: true }
  });
  for (const row of domains) {
    invalidateTenantResolutionCache(row.domain);
  }
}

export async function recordPlatformAudit(
  actor: Pick<PlatformActor, 'userId' | 'name' | 'role'>,
  action: string,
  module: string,
  details: string,
  options: { targetTenantId?: string | null; ipAddress?: string; level?: 'info' | 'warning' | 'critical' } = {},
  controlPlane: PrismaClient = getControlPlanePrisma()
): Promise<void> {
  try {
    await (controlPlane as any).platformAuditLog.create({
      data: {
        platformUserId: actor.userId,
        platformUserName: actor.name,
        platformUserRole: actor.role,
        targetTenantId: options.targetTenantId ?? null,
        action,
        module,
        details: sanitizeDiagnosticMessage(details),
        ipAddress: options.ipAddress || '127.0.0.1',
        level: options.level || 'info'
      }
    });
  } catch (err: any) {
    console.warn('⚠️ [PLATFORM-AUDIT-WARN]:', sanitizeDiagnosticMessage(err?.message || String(err)));
  }
}

// ============================================================================
// 🔐 PLATFORM AUTH & FIRST-RUN BOOTSTRAP
// ============================================================================

export async function getPlatformBootstrapStatus(controlPlane: PrismaClient = getControlPlanePrisma()) {
  let count = 0;
  let databaseOffline = false;
  let databaseError: string | null = null;
  try {
    count = await (controlPlane as any).platformUser.count();
  } catch (err: any) {
    databaseOffline = true;
    databaseError = sanitizeDiagnosticMessage(err?.message || String(err));
  }
  return {
    needsBootstrap: count === 0,
    databaseOffline,
    databaseError,
    requiresPasscode: Boolean(process.env.PLATFORM_BOOTSTRAP_PASSCODE?.trim()),
    ...getPlatformConfigSummary()
  };
}

export async function claimPlatformBootstrap(
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
    bootstrapPasscode?: string;
    ipAddress?: string;
  },
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const configuredPasscode = process.env.PLATFORM_BOOTSTRAP_PASSCODE?.trim();
  if (configuredPasscode) {
    const provided = String(input.bootstrapPasscode || '').trim();
    const expectedBuf = Buffer.from(configuredPasscode, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      throw new PlatformControlPlaneError(
        403,
        'Kode otorisasi bootstrap platform tidak sesuai.',
        'INVALID_BOOTSTRAP_PASSCODE'
      );
    }
  }

  const name = String(input.name || '').trim();
  const username = String(input.username || '').trim().toLowerCase();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');

  if (name.length < 3) {
    throw new PlatformControlPlaneError(400, 'Nama pengelola platform minimal 3 karakter.', 'INVALID_INPUT');
  }
  if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new PlatformControlPlaneError(
      400,
      'Username hanya boleh huruf kecil, angka, titik, strip, atau underscore (3–32 karakter).',
      'INVALID_INPUT'
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PlatformControlPlaneError(400, 'Format alamat email tidak valid.', 'INVALID_INPUT');
  }
  if (password.length < 10) {
    throw new PlatformControlPlaneError(
      400,
      'Kata sandi Platform Super Admin minimal 10 karakter.',
      'WEAK_PASSWORD'
    );
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  const created = await (controlPlane as any).$transaction(async (tx: any) => {
    const existingCount = await tx.platformUser.count();
    if (existingCount > 0) {
      throw new PlatformControlPlaneError(
        409,
        'Platform Super Admin sudah diaktivasi sebelumnya. Silakan login dengan akun yang terdaftar.',
        'BOOTSTRAP_ALREADY_CLAIMED'
      );
    }

    return tx.platformUser.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        salt,
        role: 'platform_super_admin',
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 1,
        lastLogin: new Date()
      }
    });
  });

  const token = createPlatformToken({
    id: created.id,
    username: created.username,
    role: 'platform_super_admin',
    name: created.name,
    tokenVersion: created.tokenVersion
  });

  await recordPlatformAudit(
    { userId: created.id, name: created.name, role: 'platform_super_admin' },
    'Aktivasi Bootstrap Platform',
    'Keamanan Platform',
    `Platform Super Admin perdana (${created.username}) diaktivasi untuk Control Plane SADEWA.`,
    { ipAddress: input.ipAddress, level: 'critical' },
    controlPlane
  );

  return {
    token,
    user: {
      id: created.id,
      name: created.name,
      username: created.username,
      email: created.email,
      role: created.role,
      lastLogin: created.lastLogin ? created.lastLogin.toISOString() : null
    }
  };
}

export async function loginPlatformUser(
  input: { username: string; password: string; ipAddress?: string },
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const identifier = String(input.username || '').trim();
  const password = String(input.password || '');
  if (!identifier || !password) {
    throw new PlatformControlPlaneError(400, 'Username/email dan kata sandi wajib diisi.', 'INVALID_INPUT');
  }

  const user = await (controlPlane as any).platformUser.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: 'insensitive' } },
        { email: { equals: identifier, mode: 'insensitive' } }
      ],
      isActive: true
    }
  });

  if (!user) {
    throw new PlatformControlPlaneError(401, 'Kredensial pengelola platform tidak valid.', 'INVALID_CREDENTIALS');
  }

  if (user.lockoutUntil && new Date(user.lockoutUntil).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 60000);
    throw new PlatformControlPlaneError(
      403,
      `Akun platform terkunci sementara demi keamanan. Coba lagi dalam ${minutesLeft} menit.`,
      'ACCOUNT_LOCKED'
    );
  }

  const valid = verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    const nextFailed = (user.failedLoginCount || 0) + 1;
    const isLock = nextFailed >= 5;
    await (controlPlane as any).platformUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextFailed,
        ...(isLock ? { lockoutUntil: new Date(Date.now() + 15 * 60 * 1000) } : {})
      }
    });

    if (isLock) {
      await recordPlatformAudit(
        { userId: user.id, name: user.name, role: user.role },
        'Kunci Brute-Force Login Platform',
        'Keamanan Platform',
        `Akun ${user.username} dikunci 15 menit setelah 5x percobaan login gagal.`,
        { ipAddress: input.ipAddress, level: 'warning' },
        controlPlane
      );
      throw new PlatformControlPlaneError(
        403,
        'Terlalu banyak percobaan gagal. Akun dikunci sementara 15 menit.',
        'ACCOUNT_LOCKED'
      );
    }

    throw new PlatformControlPlaneError(
      401,
      `Kata sandi salah. Percobaan ke-${nextFailed} dari 5.`,
      'INVALID_CREDENTIALS'
    );
  }

  const now = new Date();
  await (controlPlane as any).platformUser.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockoutUntil: null, lastLogin: now }
  });

  const token = createPlatformToken({
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    tokenVersion: user.tokenVersion
  });

  await recordPlatformAudit(
    { userId: user.id, name: user.name, role: user.role },
    'Login Platform Control Plane',
    'Autentikasi Platform',
    `Pengelola platform ${user.name} (${user.role}) masuk ke konsol pusat.`,
    { ipAddress: input.ipAddress, level: 'info' },
    controlPlane
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      lastLogin: now.toISOString()
    }
  };
}

// ============================================================================
// 🏛️ OVERVIEW & TENANT REGISTRY
// ============================================================================

export async function getPlatformOverview(
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const [tenants, domainCount, verifiedCustomDomainCount, recentLogs] = await Promise.all([
    (controlPlane as any).tenant.findMany({
      select: { id: true, tenancyMode: true, status: true }
    }),
    (controlPlane as any).tenantDomain.count(),
    (controlPlane as any).tenantDomain.count({
      where: { isCustom: true, verificationStatus: 'VERIFIED' }
    }),
    (controlPlane as any).platformAuditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10
    })
  ]);

  const stats = {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t: any) => t.status === 'ACTIVE').length,
    suspendedTenants: tenants.filter((t: any) => t.status === 'SUSPENDED').length,
    sharedModeCount: tenants.filter((t: any) => t.tenancyMode === 'SHARED').length,
    dedicatedModeCount: tenants.filter((t: any) => t.tenancyMode === 'DEDICATED').length,
    totalDomains: domainCount,
    verifiedCustomDomains: verifiedCustomDomainCount,
    poolStats: registry.getStats(),
    config: getPlatformConfigSummary()
  };

  return {
    stats,
    recentLogs
  };
}

export function sanitizeTenantForPlatformResponse(tenant: any) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    letterCodePrefix: tenant.letterCodePrefix,
    tenancyMode: tenant.tenancyMode,
    status: tenant.status,
    primaryDomain: tenant.primaryDomain,
    createdAt: tenant.createdAt instanceof Date ? tenant.createdAt.toISOString() : tenant.createdAt,
    updatedAt: tenant.updatedAt instanceof Date ? tenant.updatedAt.toISOString() : tenant.updatedAt,
    domains: Array.isArray(tenant.domains)
      ? tenant.domains.map((d: any) => ({
          id: d.id,
          tenantId: d.tenantId,
          domain: d.domain,
          isCustom: d.isCustom,
          isPrimary: d.isPrimary,
          verificationStatus: d.verificationStatus,
          verificationToken: d.verificationToken,
          sslStatus: d.sslStatus,
          verifiedAt: d.verifiedAt instanceof Date ? d.verifiedAt.toISOString() : d.verifiedAt,
          createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt
        }))
      : [],
    dbConfig: summarizeMaskedDbConfig(tenant.dbConfig, tenant.id)
  };
}

export async function listPlatformTenants(
  filters: { search?: string; tenancyMode?: string; status?: string } = {},
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const where: any = {};
  if (filters.tenancyMode === 'SHARED' || filters.tenancyMode === 'DEDICATED') {
    where.tenancyMode = filters.tenancyMode;
  }
  if (filters.status && ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(filters.status)) {
    where.status = filters.status;
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { primaryDomain: { contains: q, mode: 'insensitive' } }
    ];
  }

  const tenants = await (controlPlane as any).tenant.findMany({
    where,
    include: {
      domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      dbConfig: true
    },
    orderBy: [{ createdAt: 'desc' }]
  });

  return tenants.map(sanitizeTenantForPlatformResponse);
}

export async function createTenantVillage(
  input: {
    slug: string;
    name: string;
    letterCodePrefix?: string;
    tenancyMode?: 'SHARED' | 'DEDICATED';
    customDomain?: string;
    databaseUrl?: string;
    directUrl?: string;
    storageBucket?: string;
    district?: string;
    regency?: string;
    province?: string;
    postalCode?: string;
    initialAdmin?: {
      name: string;
      username: string;
      email: string;
      password: string;
    };
  },
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const slug = validateTenantSlug(input.slug);
  const name = String(input.name || '').trim();
  if (name.length < 3) {
    throw new PlatformControlPlaneError(400, 'Nama desa minimal 3 karakter.', 'INVALID_TENANT_NAME');
  }

  const letterCodePrefix = validateLetterCodePrefix(input.letterCodePrefix, slug);
  const tenancyMode: 'SHARED' | 'DEDICATED' = input.tenancyMode === 'DEDICATED' ? 'DEDICATED' : 'SHARED';
  const rootDomain = getPlatformRootDomain();
  const defaultSubdomain = `${slug}.${rootDomain}`;

  let validatedCustomDomain: string | null = null;
  if (input.customDomain && input.customDomain.trim()) {
    validatedCustomDomain = validateCustomDomain(input.customDomain);
  }

  let normalizedDedicatedUrl: string | null = null;
  let normalizedDirectUrl: string | null = null;
  if (tenancyMode === 'DEDICATED') {
    if (!input.databaseUrl || !input.databaseUrl.trim()) {
      throw new PlatformControlPlaneError(
        400,
        'Mode DEDICATED mewajibkan connection string PostgreSQL Dedicated (DATABASE_URL).',
        'DEDICATED_URL_REQUIRED'
      );
    }
    normalizedDedicatedUrl = assertSafeDedicatedPostgresUrl(input.databaseUrl, 5);
    if (input.directUrl && input.directUrl.trim()) {
      normalizedDirectUrl = assertSafeDedicatedPostgresUrl(input.directUrl, 2);
    }
  }

  if (input.initialAdmin) {
    if (
      !input.initialAdmin.name?.trim() ||
      !input.initialAdmin.username?.trim() ||
      !input.initialAdmin.email?.trim() ||
      !input.initialAdmin.password ||
      input.initialAdmin.password.length < 10
    ) {
      throw new PlatformControlPlaneError(
        400,
        'Data Super Admin Desa awal harus lengkap dan kata sandi minimal 10 karakter.',
        'INVALID_INITIAL_ADMIN'
      );
    }
  }

  // Pastikan slug & custom domain belum terdaftar
  const existingSlug = await (controlPlane as any).tenant.findUnique({ where: { slug } });
  if (existingSlug) {
    throw new PlatformControlPlaneError(409, `Slug desa "${slug}" sudah terdaftar pada platform.`, 'SLUG_EXISTS');
  }
  const existingSubdomain = await (controlPlane as any).tenantDomain.findUnique({ where: { domain: defaultSubdomain } });
  if (existingSubdomain) {
    throw new PlatformControlPlaneError(409, `Subdomain "${defaultSubdomain}" sudah terpakai.`, 'DOMAIN_EXISTS');
  }
  if (validatedCustomDomain) {
    const existingCustom = await (controlPlane as any).tenantDomain.findUnique({ where: { domain: validatedCustomDomain } });
    if (existingCustom) {
      throw new PlatformControlPlaneError(409, `Custom domain "${validatedCustomDomain}" sudah terdaftar di desa lain.`, 'DOMAIN_EXISTS');
    }
  }

  const tenantId = `tenant_${slug.replace(/-/g, '_')}_${crypto.randomBytes(3).toString('hex')}`;

  // Jika DEDICATED, lakukan probe konektivitas dengan vault ciphertext terikat ke tenantId sebelum commit DB
  let encryptedDbUrl: string | null = null;
  let encryptedDirectUrl: string | null = null;
  if (tenancyMode === 'DEDICATED' && normalizedDedicatedUrl) {
    encryptedDbUrl = encryptTenantSecret(normalizedDedicatedUrl, { tenantId, keyVersion: 1 });
    if (normalizedDirectUrl) {
      encryptedDirectUrl = encryptTenantSecret(normalizedDirectUrl, { tenantId, keyVersion: 1 });
    }
    const probe = await registry.probeDedicatedConnection(encryptedDbUrl, tenantId);
    if (!probe.reachable) {
      throw new PlatformControlPlaneError(
        502,
        `Koneksi Dedicated database gagal dijangkau (${probe.errorCode}): ${probe.errorSummary}`,
        'DEDICATED_DB_UNREACHABLE'
      );
    }
  }

  const now = new Date();
  const createdTenant = await (controlPlane as any).$transaction(async (tx: any) => {
    const tenant = await tx.tenant.create({
      data: {
        id: tenantId,
        slug,
        name,
        letterCodePrefix,
        tenancyMode,
        status: 'ACTIVE',
        primaryDomain: defaultSubdomain
      }
    });

    await tx.tenantDomain.create({
      data: {
        tenantId: tenant.id,
        domain: defaultSubdomain,
        isCustom: false,
        isPrimary: true,
        verificationStatus: 'VERIFIED',
        sslStatus: 'ACTIVE',
        verifiedAt: now
      }
    });

    if (validatedCustomDomain) {
      await tx.tenantDomain.create({
        data: {
          tenantId: tenant.id,
          domain: validatedCustomDomain,
          isCustom: true,
          isPrimary: false,
          verificationStatus: 'PENDING_VERIFICATION',
          verificationToken: `sadewa-verify=${crypto.randomBytes(16).toString('hex')}`,
          sslStatus: 'PENDING'
        }
      });
    }

    if (tenancyMode === 'DEDICATED' && encryptedDbUrl) {
      await tx.tenantDatabaseConfig.create({
        data: {
          tenantId: tenant.id,
          encryptedDatabaseUrl: encryptedDbUrl,
          encryptedDirectUrl,
          storageBucket: input.storageBucket?.trim() || null,
          keyVersion: 1,
          credentialVersion: 1,
          lastProbeAt: now,
          lastProbeStatus: 'HEALTHY',
          rotatedAt: now
        }
      });
    }

    return tenant;
  });

  // Seed profil desa & admin awal sesuai tenancyMode
  let seedingNotice: string | null = null;
  try {
    const targetPrisma =
      tenancyMode === 'DEDICATED'
        ? await registry.getClientForTenant({
            tenantId: createdTenant.id,
            tenancyMode: 'DEDICATED',
            dbConfig: { encryptedDatabaseUrl: encryptedDbUrl!, credentialVersion: 1 }
          })
        : createTenantScopedPrisma(controlPlane, createdTenant.id);

    await seedNewTenantOperationalData(targetPrisma, createdTenant.id, {
      villageName: name,
      letterCodePrefix,
      district: input.district,
      regency: input.regency,
      province: input.province,
      postalCode: input.postalCode,
      initialAdmin: input.initialAdmin
    });
  } catch (seedErr: any) {
    seedingNotice = `Tenant terdaftar, namun inisialisasi tabel awal perlu dijalankan manual (${sanitizeDiagnosticMessage(seedErr?.message || String(seedErr))}).`;
  }

  invalidateTenantResolutionCache(defaultSubdomain);
  if (validatedCustomDomain) {
    invalidateTenantResolutionCache(validatedCustomDomain);
  }

  await recordPlatformAudit(
    actor,
    'Daftarkan Tenant Desa Baru',
    'Manajemen Tenant',
    `Mendaftarkan desa "${name}" (slug: ${slug}, mode: ${tenancyMode}, subdomain: ${defaultSubdomain}${validatedCustomDomain ? `, custom: ${validatedCustomDomain}` : ''}).`,
    { targetTenantId: createdTenant.id, ipAddress, level: 'info' },
    controlPlane
  );

  const hydrated = await (controlPlane as any).tenant.findUnique({
    where: { id: createdTenant.id },
    include: {
      domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      dbConfig: true
    }
  });

  return {
    tenant: sanitizeTenantForPlatformResponse(hydrated),
    seedingNotice
  };
}

async function seedNewTenantOperationalData(
  scopedPrisma: PrismaClient,
  tenantId: string,
  opts: {
    villageName: string;
    letterCodePrefix: string;
    district?: string;
    regency?: string;
    province?: string;
    postalCode?: string;
    initialAdmin?: { name: string; username: string; email: string; password: string };
  }
) {
  const profileId = getTenantInitialProfileId(tenantId);
  await (scopedPrisma as any).villageProfile.upsert({
    where: { id: profileId },
    update: {},
    create: {
      id: profileId,
      villageId: tenantId,
      villageName: opts.villageName,
      district: opts.district?.trim() || 'Kecamatan',
      regency: opts.regency?.trim() || 'Kabupaten',
      province: opts.province?.trim() || 'Indonesia',
      postalCode: opts.postalCode?.trim() || '00000',
      letterCodePrefix: opts.letterCodePrefix,
      motto: `Melayani dengan Hati untuk ${opts.villageName}`,
      vision: `Mewujudkan ${opts.villageName} yang mandiri, transparan, dan berdaya saing digital.`,
      mission: ['Meningkatkan pelayanan administrasi warga', 'Mendorong keterbukaan informasi & APBDes'],
      history: `${opts.villageName} bergabung ke platform SADEWA untuk digitalisasi layanan administrasi desa.`,
      totalPopulation: 0,
      totalFamilies: 0,
      areaSqKm: 0,
      borders: { north: '-', south: '-', east: '-', west: '-' }
    }
  });

  if (opts.initialAdmin) {
    const salt = generateSalt();
    const passwordHash = hashPassword(opts.initialAdmin.password, salt);
    await (scopedPrisma as any).user.create({
      data: {
        villageId: tenantId,
        name: opts.initialAdmin.name.trim(),
        username: opts.initialAdmin.username.trim().toLowerCase(),
        email: opts.initialAdmin.email.trim().toLowerCase(),
        passwordHash,
        salt,
        role: 'super_admin',
        roleTitle: 'Super Admin Desa',
        isActive: true,
        mustChangePassword: true,
        tokenVersion: 1
      }
    });
  }
}

export async function updateTenantStatus(
  tenantId: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  if (!['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    throw new PlatformControlPlaneError(400, 'Status tenant tidak valid.', 'INVALID_STATUS');
  }

  const existing = await (controlPlane as any).tenant.findUnique({
    where: { id: tenantId },
    include: { domains: true, dbConfig: true }
  });
  if (!existing) {
    throw new PlatformControlPlaneError(404, 'Tenant desa tidak ditemukan.', 'TENANT_NOT_FOUND');
  }

  const updated = await (controlPlane as any).tenant.update({
    where: { id: tenantId },
    data: { status },
    include: {
      domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      dbConfig: true
    }
  });

  if (status === 'SUSPENDED' || status === 'ARCHIVED') {
    await registry.evictTenant(tenantId);
  }
  await invalidateAllTenantDomainCaches(controlPlane, tenantId);

  await recordPlatformAudit(
    actor,
    'Ubah Status Tenant',
    'Manajemen Tenant',
    `Status desa "${updated.name}" diubah dari ${existing.status} menjadi ${status}.`,
    {
      targetTenantId: tenantId,
      ipAddress,
      level: status === 'ACTIVE' ? 'info' : 'warning'
    },
    controlPlane
  );

  return sanitizeTenantForPlatformResponse(updated);
}

// ============================================================================
// 🌐 CUSTOM DOMAIN & SERVER-SIDE DNS VERIFICATION
// ============================================================================

export async function addTenantCustomDomain(
  tenantId: string,
  rawDomain: string,
  isPrimary: boolean = false,
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const domain = validateCustomDomain(rawDomain);
  const tenant = await (controlPlane as any).tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new PlatformControlPlaneError(404, 'Tenant desa tidak ditemukan.', 'TENANT_NOT_FOUND');
  }

  const existing = await (controlPlane as any).tenantDomain.findUnique({ where: { domain } });
  if (existing) {
    throw new PlatformControlPlaneError(
      409,
      `Domain "${domain}" sudah terdaftar pada sistem.`,
      'DOMAIN_EXISTS'
    );
  }

  const verificationToken = `sadewa-verify=${crypto.randomBytes(16).toString('hex')}`;
  const createdDomain = await (controlPlane as any).tenantDomain.create({
    data: {
      tenantId,
      domain,
      isCustom: true,
      isPrimary: Boolean(isPrimary),
      verificationStatus: 'PENDING_VERIFICATION',
      verificationToken,
      sslStatus: 'PENDING'
    }
  });

  invalidateTenantResolutionCache(domain);

  await recordPlatformAudit(
    actor,
    'Daftarkan Custom Domain',
    'Domain & SSL',
    `Menambahkan custom domain "${domain}" ke desa ${tenant.name} (menunggu verifikasi TXT DNS).`,
    { targetTenantId: tenantId, ipAddress, level: 'info' },
    controlPlane
  );

  return {
    domain: createdDomain,
    dnsInstructions: {
      txtHost: `_sadewa-verify.${domain}`,
      txtValue: verificationToken,
      cnameHost: domain,
      cnameTarget: getPlatformCnameTarget()
    }
  };
}

function constantTimeTokenMatch(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected.trim(), 'utf8');
  const b = Buffer.from(candidate.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function verifyTenantDomainDns(
  tenantId: string,
  domainId: string,
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  dnsAdapter: DnsLookupAdapter = DEFAULT_DNS_ADAPTER
) {
  const domainRecord = await (controlPlane as any).tenantDomain.findFirst({
    where: { id: domainId, tenantId },
    include: { tenant: true }
  });

  if (!domainRecord) {
    throw new PlatformControlPlaneError(404, 'Catatan domain tidak ditemukan.', 'DOMAIN_NOT_FOUND');
  }

  if (!domainRecord.isCustom) {
    return {
      verified: true,
      txtVerified: true,
      cnameVerified: true,
      domain: domainRecord,
      message: 'Subdomain bawaan SADEWA dilindungi wildcard SSL otomatis dan aktif.'
    };
  }

  const expectedToken = String(domainRecord.verificationToken || '').trim();
  if (!expectedToken) {
    throw new PlatformControlPlaneError(400, 'Token verifikasi DNS belum tersedia.', 'MISSING_TOKEN');
  }

  const txtHost = `_sadewa-verify.${domainRecord.domain}`;
  const observedTxtValues: string[] = [];

  for (const candidateHost of [txtHost, domainRecord.domain]) {
    try {
      const records = await dnsAdapter.resolveTxt(candidateHost);
      for (const chunkArr of records) {
        observedTxtValues.push(chunkArr.join('').trim());
      }
    } catch {
      // NXDOMAIN / ENOTFOUND ditoleransi untuk host sekunder
    }
  }

  const txtVerified = observedTxtValues.some((val) => constantTimeTokenMatch(expectedToken, val));

  let observedCnames: string[] = [];
  const expectedCname = getPlatformCnameTarget();
  try {
    observedCnames = (await dnsAdapter.resolveCname(domainRecord.domain)).map((c) => c.trim().toLowerCase().replace(/\.+$/, ''));
  } catch {
    observedCnames = [];
  }
  const cnameVerified = observedCnames.includes(expectedCname);

  const now = new Date();
  const nextStatus = txtVerified ? 'VERIFIED' : 'FAILED';
  const nextSslStatus = txtVerified ? 'ACTIVE' : 'PENDING';

  const updatedDomain = await (controlPlane as any).tenantDomain.update({
    where: { id: domainRecord.id },
    data: {
      verificationStatus: nextStatus,
      sslStatus: nextSslStatus,
      verifiedAt: txtVerified ? now : null
    }
  });

  if (txtVerified && domainRecord.isPrimary) {
    await (controlPlane as any).tenant.update({
      where: { id: tenantId },
      data: { primaryDomain: domainRecord.domain }
    });
  }

  invalidateTenantResolutionCache(domainRecord.domain);

  await recordPlatformAudit(
    actor,
    txtVerified ? 'Verifikasi DNS Domain Berhasil' : 'Verifikasi DNS Domain Gagal',
    'Domain & SSL',
    txtVerified
      ? `Custom domain "${domainRecord.domain}" milik ${domainRecord.tenant.name} terverifikasi (TXT valid${cnameVerified ? ', CNAME valid' : ', CNAME menunggu propagasi'}).`
      : `Verifikasi TXT DNS untuk "${domainRecord.domain}" belum cocok. Target host: ${txtHost}.`,
    { targetTenantId: tenantId, ipAddress, level: txtVerified ? 'info' : 'warning' },
    controlPlane
  );

  return {
    verified: txtVerified,
    txtVerified,
    cnameVerified,
    expectedTxtHost: txtHost,
    expectedTxtValue: expectedToken,
    expectedCnameTarget: expectedCname,
    observedCnames,
    domain: updatedDomain,
    message: txtVerified
      ? `Kepemilikan domain ${domainRecord.domain} terverifikasi dan siap melayani trafik HTTPS.`
      : `Record TXT "${expectedToken}" belum ditemukan pada ${txtHost}. Pastikan DNS sudah disebar lalu coba lagi.`
  };
}

export async function removeTenantDomain(
  tenantId: string,
  domainId: string,
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const domainRecord = await (controlPlane as any).tenantDomain.findFirst({
    where: { id: domainId, tenantId },
    include: { tenant: true }
  });
  if (!domainRecord) {
    throw new PlatformControlPlaneError(404, 'Domain tidak ditemukan.', 'DOMAIN_NOT_FOUND');
  }
  if (!domainRecord.isCustom) {
    throw new PlatformControlPlaneError(
      400,
      'Subdomain bawaan *.sadewa.id tidak dapat dihapus agar portal desa tetap memiliki rute cadangan.',
      'CANNOT_DELETE_BUILTIN_SUBDOMAIN'
    );
  }

  await (controlPlane as any).tenantDomain.delete({ where: { id: domainRecord.id } });
  if (domainRecord.tenant.primaryDomain === domainRecord.domain) {
    const fallbackSub = `${domainRecord.tenant.slug}.${getPlatformRootDomain()}`;
    await (controlPlane as any).tenant.update({
      where: { id: tenantId },
      data: { primaryDomain: fallbackSub }
    });
  }

  invalidateTenantResolutionCache(domainRecord.domain);

  await recordPlatformAudit(
    actor,
    'Hapus Custom Domain',
    'Domain & SSL',
    `Menghapus custom domain "${domainRecord.domain}" dari desa ${domainRecord.tenant.name}.`,
    { targetTenantId: tenantId, ipAddress, level: 'warning' },
    controlPlane
  );

  return { deletedDomain: domainRecord.domain };
}

// ============================================================================
// 🗄️ DEDICATED DATABASE ONBOARDING, TEST, ROTATION & REVOCATION
// ============================================================================

export async function probeTenantDatabaseUrl(
  tenantId: string,
  rawDatabaseUrl: string,
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const tenant = await (controlPlane as any).tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new PlatformControlPlaneError(404, 'Tenant desa tidak ditemukan.', 'TENANT_NOT_FOUND');
  }

  const normalizedUrl = assertSafeDedicatedPostgresUrl(rawDatabaseUrl, 1);
  const ephemeralCipher = encryptTenantSecret(normalizedUrl, { tenantId, keyVersion: 1 });
  const probe = await registry.probeDedicatedConnection(ephemeralCipher, tenantId);

  const parsed = new URL(normalizedUrl);
  const maskedTarget = `postgresql://***@${parsed.hostname}:${parsed.port || '5432'}/${parsed.pathname.replace(/^\//, '') || 'postgres'}`;

  return {
    reachable: probe.reachable,
    maskedTarget,
    host: parsed.hostname,
    port: parsed.port || '5432',
    isPooler: parsed.searchParams.get('pgbouncer') === 'true' || parsed.port === '6543',
    errorCode: probe.errorCode,
    errorSummary: probe.errorSummary
  };
}

export async function upsertDedicatedDatabaseConfig(
  tenantId: string,
  input: {
    databaseUrl: string;
    directUrl?: string;
    supabaseUrl?: string;
    serviceRoleKey?: string;
    storageBucket?: string;
  },
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const tenant = await (controlPlane as any).tenant.findUnique({
    where: { id: tenantId },
    include: { dbConfig: true }
  });
  if (!tenant) {
    throw new PlatformControlPlaneError(404, 'Tenant desa tidak ditemukan.', 'TENANT_NOT_FOUND');
  }

  const normalizedDbUrl = assertSafeDedicatedPostgresUrl(input.databaseUrl, 5);
  const normalizedDirectUrl = input.directUrl?.trim() ? assertSafeDedicatedPostgresUrl(input.directUrl, 2) : null;

  let cleanSupabaseUrl: string | null = null;
  if (input.supabaseUrl && input.supabaseUrl.trim()) {
    try {
      const supaParsed = new URL(input.supabaseUrl.trim());
      if (supaParsed.protocol !== 'https:' && supaParsed.protocol !== 'http:') {
        throw new Error('invalid');
      }
      cleanSupabaseUrl = supaParsed.origin;
    } catch {
      throw new PlatformControlPlaneError(400, 'Format SUPABASE_URL Dedicated tidak valid.', 'INVALID_SUPABASE_URL');
    }
  }

  const keyVersion = Number.parseInt(process.env.TENANT_CREDENTIAL_KEY_VERSION || '1', 10) || 1;
  const encryptedDatabaseUrl = encryptTenantSecret(normalizedDbUrl, { tenantId, keyVersion });
  const encryptedDirectUrl = normalizedDirectUrl
    ? encryptTenantSecret(normalizedDirectUrl, { tenantId, keyVersion })
    : null;
  const encryptedSupabaseUrl = cleanSupabaseUrl
    ? encryptTenantSecret(cleanSupabaseUrl, { tenantId, keyVersion })
    : null;
  const encryptedServiceKey = input.serviceRoleKey?.trim()
    ? encryptTenantSecret(input.serviceRoleKey.trim(), { tenantId, keyVersion })
    : null;

  // Wajib lolos probe konektivitas sebelum diaktifkan
  const probe = await registry.probeDedicatedConnection(encryptedDatabaseUrl, tenantId);
  if (!probe.reachable) {
    throw new PlatformControlPlaneError(
      502,
      `Koneksi Dedicated database gagal dijangkau (${probe.errorCode}): ${probe.errorSummary}`,
      'DEDICATED_DB_UNREACHABLE'
    );
  }

  const nextCredVersion = (tenant.dbConfig?.credentialVersion ?? 0) + 1;
  const now = new Date();

  const updated = await (controlPlane as any).$transaction(async (tx: any) => {
    await tx.tenantDatabaseConfig.upsert({
      where: { tenantId },
      update: {
        encryptedDatabaseUrl,
        ...(encryptedDirectUrl !== null ? { encryptedDirectUrl } : {}),
        ...(encryptedSupabaseUrl !== null ? { encryptedSupabaseUrl } : {}),
        ...(encryptedServiceKey !== null ? { encryptedServiceKey } : {}),
        ...(input.storageBucket !== undefined ? { storageBucket: input.storageBucket?.trim() || null } : {}),
        keyVersion,
        credentialVersion: nextCredVersion,
        lastProbeAt: now,
        lastProbeStatus: 'HEALTHY',
        rotatedAt: now
      },
      create: {
        tenantId,
        encryptedDatabaseUrl,
        encryptedDirectUrl,
        encryptedSupabaseUrl,
        encryptedServiceKey,
        storageBucket: input.storageBucket?.trim() || null,
        keyVersion,
        credentialVersion: nextCredVersion,
        lastProbeAt: now,
        lastProbeStatus: 'HEALTHY',
        rotatedAt: now
      }
    });

    return tx.tenant.update({
      where: { id: tenantId },
      data: { tenancyMode: 'DEDICATED' },
      include: {
        domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        dbConfig: true
      }
    });
  });

  await registry.evictTenant(tenantId);
  await invalidateAllTenantDomainCaches(controlPlane, tenantId);

  const maskedSummary = summarizeMaskedDbConfig(updated.dbConfig, tenantId);

  await recordPlatformAudit(
    actor,
    'Aktifkan / Perbarui Dedicated Database',
    'Database Tenant',
    `Mengkonfigurasi Dedicated DB terenkripsi AES-256-GCM untuk ${updated.name} (host: ${maskedSummary?.host || 'unknown'}, credentialVersion: v${nextCredVersion}).`,
    { targetTenantId: tenantId, ipAddress, level: 'critical' },
    controlPlane
  );

  return sanitizeTenantForPlatformResponse(updated);
}

export async function rotateDedicatedDatabaseCredentials(
  tenantId: string,
  input: { newDatabaseUrl?: string; newDirectUrl?: string },
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const tenant = await (controlPlane as any).tenant.findUnique({
    where: { id: tenantId },
    include: { dbConfig: true }
  });

  if (!tenant || !tenant.dbConfig) {
    throw new PlatformControlPlaneError(
      404,
      'Tenant belum memiliki konfigurasi Dedicated database untuk dirotasi.',
      'DEDICATED_CONFIG_NOT_FOUND'
    );
  }

  const targetKeyVersion = Number.parseInt(process.env.TENANT_CREDENTIAL_KEY_VERSION || '', 10) || tenant.dbConfig.keyVersion || 1;
  const plainDbUrl = input.newDatabaseUrl?.trim()
    ? assertSafeDedicatedPostgresUrl(input.newDatabaseUrl, 5)
    : decryptTenantSecret(tenant.dbConfig.encryptedDatabaseUrl, { tenantId });

  const nextEncryptedDbUrl = encryptTenantSecret(plainDbUrl, { tenantId, keyVersion: targetKeyVersion });
  const probe = await registry.probeDedicatedConnection(nextEncryptedDbUrl, tenantId);
  if (!probe.reachable) {
    throw new PlatformControlPlaneError(
      502,
      `Rotasi dibatalkan karena URL Dedicated database baru tidak dapat dijangkau (${probe.errorCode}): ${probe.errorSummary}`,
      'DEDICATED_DB_UNREACHABLE'
    );
  }

  let nextEncryptedDirectUrl = tenant.dbConfig.encryptedDirectUrl;
  if (input.newDirectUrl?.trim()) {
    const plainDirect = assertSafeDedicatedPostgresUrl(input.newDirectUrl, 2);
    nextEncryptedDirectUrl = encryptTenantSecret(plainDirect, { tenantId, keyVersion: targetKeyVersion });
  } else if (nextEncryptedDirectUrl && parseEnvelopeMetadata(nextEncryptedDirectUrl)?.keyVersion !== targetKeyVersion) {
    const plainExistingDirect = decryptTenantSecret(nextEncryptedDirectUrl, { tenantId });
    nextEncryptedDirectUrl = encryptTenantSecret(plainExistingDirect, { tenantId, keyVersion: targetKeyVersion });
  }

  const nextCredVersion = (tenant.dbConfig.credentialVersion ?? 1) + 1;
  const now = new Date();

  await (controlPlane as any).tenantDatabaseConfig.update({
    where: { tenantId },
    data: {
      encryptedDatabaseUrl: nextEncryptedDbUrl,
      encryptedDirectUrl: nextEncryptedDirectUrl,
      keyVersion: targetKeyVersion,
      credentialVersion: nextCredVersion,
      lastProbeAt: now,
      lastProbeStatus: 'HEALTHY',
      rotatedAt: now
    }
  });

  // Paksa pemutusan koneksi LRU lama segera setelah rotasi
  await registry.evictTenant(tenantId);
  await invalidateAllTenantDomainCaches(controlPlane, tenantId);

  const hydrated = await (controlPlane as any).tenant.findUnique({
    where: { id: tenantId },
    include: {
      domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      dbConfig: true
    }
  });

  await recordPlatformAudit(
    actor,
    'Rotasi Kredensial Dedicated DB',
    'Keamanan Database',
    `Kredensial Dedicated DB untuk ${tenant.name} dirotasi ke credentialVersion v${nextCredVersion} (key v${targetKeyVersion}) dan connection pool lama dieviksi.`,
    { targetTenantId: tenantId, ipAddress, level: 'critical' },
    controlPlane
  );

  return sanitizeTenantForPlatformResponse(hydrated);
}

export async function revokeDedicatedDatabaseConfig(
  tenantId: string,
  options: { suspendTenant?: boolean } = {},
  actor: PlatformActor,
  ipAddress: string = '127.0.0.1',
  controlPlane: PrismaClient = getControlPlanePrisma(),
  registry: TenantConnectionRegistry = getTenantConnectionRegistry()
) {
  const tenant = await (controlPlane as any).tenant.findUnique({
    where: { id: tenantId },
    include: { dbConfig: true }
  });
  if (!tenant) {
    throw new PlatformControlPlaneError(404, 'Tenant desa tidak ditemukan.', 'TENANT_NOT_FOUND');
  }

  await registry.evictTenant(tenantId);

  const nextStatus = options.suspendTenant ? 'SUSPENDED' : tenant.status;

  const updated = await (controlPlane as any).$transaction(async (tx: any) => {
    if (tenant.dbConfig) {
      await tx.tenantDatabaseConfig.delete({ where: { tenantId } });
    }
    return tx.tenant.update({
      where: { id: tenantId },
      data: {
        tenancyMode: 'SHARED',
        status: nextStatus
      },
      include: {
        domains: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        dbConfig: true
      }
    });
  });

  await invalidateAllTenantDomainCaches(controlPlane, tenantId);

  await recordPlatformAudit(
    actor,
    'Cabut Kredensial Dedicated DB',
    'Keamanan Database',
    `Kredensial Dedicated DB untuk ${tenant.name} dicabut, pool diputus, dan routing dikembalikan ke SHARED${options.suspendTenant ? ' (tenant disuspend)' : ''}.`,
    { targetTenantId: tenantId, ipAddress, level: 'critical' },
    controlPlane
  );

  return sanitizeTenantForPlatformResponse(updated);
}

export async function listPlatformAuditLogs(
  options: { targetTenantId?: string; limit?: number } = {},
  controlPlane: PrismaClient = getControlPlanePrisma()
) {
  const limit = Math.max(1, Math.min(200, options.limit ?? 60));
  return (controlPlane as any).platformAuditLog.findMany({
    where: options.targetTenantId ? { targetTenantId: options.targetTenantId } : undefined,
    orderBy: { timestamp: 'desc' },
    take: limit
  });
}
