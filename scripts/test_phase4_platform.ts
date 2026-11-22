import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import {
  authenticatePlatformToken,
  authenticateToken,
  createPlatformToken,
  createToken
} from '../server/auth';
import { runWithTenantContext } from '../server/db/tenantContext';
import { TenantConnectionRegistry } from '../server/db/tenantConnectionRegistry';
import { decryptTenantSecret, isEncryptedEnvelope } from '../server/security/credentialVault';
import {
  addTenantCustomDomain,
  claimPlatformBootstrap,
  createTenantVillage,
  getPlatformBootstrapStatus,
  listPlatformAuditLogs,
  loginPlatformUser,
  PlatformControlPlaneError,
  revokeDedicatedDatabaseConfig,
  rotateDedicatedDatabaseCredentials,
  updateTenantStatus,
  upsertDedicatedDatabaseConfig,
  validateCustomDomain,
  verifyTenantDomainDns
} from '../server/services/platformControlPlane';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'sadewa-test-session-secret-key-min-32-chars!!';
process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY =
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// ============================================================================
// 🧪 IN-MEMORY CONTROL PLANE PRISMA MOCK
// ============================================================================
function createInMemoryControlPlane() {
  const state = {
    tenants: [] as any[],
    domains: [] as any[],
    dbConfigs: [] as any[],
    platformUsers: [] as any[],
    platformAuditLogs: [] as any[],
    villageProfiles: [] as any[],
    users: [] as any[]
  };

  let idSeq = 1;
  const nextId = (prefix: string) => `${prefix}_${idSeq++}`;

  const hydrateTenant = (t: any, include?: any) => {
    if (!t) return null;
    const copy = { ...t };
    if (include?.domains) {
      copy.domains = state.domains.filter((d) => d.tenantId === t.id);
    }
    if (include?.dbConfig) {
      copy.dbConfig = state.dbConfigs.find((c) => c.tenantId === t.id) || null;
    }
    return copy;
  };

  const client: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
    $queryRawUnsafe: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
    $extends: () => client,

    platformUser: {
      count: async () => state.platformUsers.length,
      findUnique: async ({ where, select }: any) => {
        const found = state.platformUsers.find((u) => u.id === where.id || u.username === where.username);
        if (!found) return null;
        if (!select) return { ...found };
        const picked: any = {};
        for (const k of Object.keys(select)) if (select[k]) picked[k] = found[k];
        return picked;
      },
      findFirst: async ({ where }: any) => {
        return (
          state.platformUsers.find((u) => {
            if (where.isActive !== undefined && u.isActive !== where.isActive) return false;
            if (Array.isArray(where.OR)) {
              return where.OR.some((cond: any) => {
                if (cond.username?.equals) {
                  return u.username.toLowerCase() === cond.username.equals.toLowerCase();
                }
                if (cond.email?.equals) {
                  return u.email.toLowerCase() === cond.email.toLowerCase() ||
                    u.email.toLowerCase() === cond.email.equals.toLowerCase();
                }
                return false;
              });
            }
            return true;
          }) || null
        );
      },
      create: async ({ data }: any) => {
        const row = { id: nextId('plat_usr'), failedLoginCount: 0, lockoutUntil: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.platformUsers.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const idx = state.platformUsers.findIndex((u) => u.id === where.id);
        assert.notEqual(idx, -1);
        const cur = state.platformUsers[idx];
        const next = { ...cur, ...data };
        if (data.tokenVersion?.increment) {
          next.tokenVersion = cur.tokenVersion + data.tokenVersion.increment;
        }
        state.platformUsers[idx] = next;
        return { ...next };
      }
    },

    platformAuditLog: {
      create: async ({ data }: any) => {
        const row = { id: nextId('plat_log'), timestamp: new Date(), ...data };
        state.platformAuditLogs.unshift(row);
        return { ...row };
      },
      findMany: async ({ where, take }: any = {}) => {
        let rows = [...state.platformAuditLogs];
        if (where?.targetTenantId) {
          rows = rows.filter((r) => r.targetTenantId === where.targetTenantId);
        }
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      }
    },

    tenant: {
      findUnique: async ({ where, include }: any) => {
        const found = state.tenants.find((t) => (where.id ? t.id === where.id : t.slug === where.slug));
        return hydrateTenant(found, include);
      },
      findMany: async ({ include }: any = {}) => state.tenants.map((t) => hydrateTenant(t, include)),
      create: async ({ data }: any) => {
        const row = { createdAt: new Date(), updatedAt: new Date(), ...data };
        state.tenants.push(row);
        return { ...row };
      },
      update: async ({ where, data, include }: any) => {
        const idx = state.tenants.findIndex((t) => t.id === where.id);
        assert.notEqual(idx, -1);
        state.tenants[idx] = { ...state.tenants[idx], ...data, updatedAt: new Date() };
        return hydrateTenant(state.tenants[idx], include);
      }
    },

    tenantDomain: {
      count: async ({ where }: any = {}) => {
        if (!where) return state.domains.length;
        return state.domains.filter(
          (d) =>
            (where.isCustom === undefined || d.isCustom === where.isCustom) &&
            (where.verificationStatus === undefined || d.verificationStatus === where.verificationStatus)
        ).length;
      },
      findUnique: async ({ where }: any) => state.domains.find((d) => d.domain === where.domain) || null,
      findFirst: async ({ where, include }: any) => {
        const found = state.domains.find((d) => d.id === where.id && (!where.tenantId || d.tenantId === where.tenantId));
        if (!found) return null;
        const res: any = { ...found };
        if (include?.tenant) {
          res.tenant = state.tenants.find((t) => t.id === found.tenantId) || null;
        }
        return res;
      },
      findMany: async ({ where }: any = {}) =>
        where?.tenantId ? state.domains.filter((d) => d.tenantId === where.tenantId) : [...state.domains],
      create: async ({ data }: any) => {
        const row = { id: nextId('dom'), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.domains.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const idx = state.domains.findIndex((d) => d.id === where.id);
        assert.notEqual(idx, -1);
        state.domains[idx] = { ...state.domains[idx], ...data, updatedAt: new Date() };
        return { ...state.domains[idx] };
      },
      delete: async ({ where }: any) => {
        const idx = state.domains.findIndex((d) => d.id === where.id);
        if (idx !== -1) state.domains.splice(idx, 1);
      }
    },

    tenantDatabaseConfig: {
      upsert: async ({ where, create, update }: any) => {
        const idx = state.dbConfigs.findIndex((c) => c.tenantId === where.tenantId);
        if (idx === -1) {
          const row = { id: nextId('dbc'), createdAt: new Date(), updatedAt: new Date(), ...create };
          state.dbConfigs.push(row);
          return { ...row };
        }
        state.dbConfigs[idx] = { ...state.dbConfigs[idx], ...update, updatedAt: new Date() };
        return { ...state.dbConfigs[idx] };
      },
      update: async ({ where, data }: any) => {
        const idx = state.dbConfigs.findIndex((c) => c.tenantId === where.tenantId);
        assert.notEqual(idx, -1);
        state.dbConfigs[idx] = { ...state.dbConfigs[idx], ...data, updatedAt: new Date() };
        return { ...state.dbConfigs[idx] };
      },
      delete: async ({ where }: any) => {
        const idx = state.dbConfigs.findIndex((c) => c.tenantId === where.tenantId);
        if (idx !== -1) state.dbConfigs.splice(idx, 1);
      }
    },

    villageProfile: {
      upsert: async ({ where, create }: any) => {
        const existing = state.villageProfiles.find((p) => p.id === where.id);
        if (existing) return existing;
        const row = { ...create };
        state.villageProfiles.push(row);
        return row;
      }
    },

    user: {
      create: async ({ data }: any) => {
        const row = { id: nextId('usr'), ...data };
        state.users.push(row);
        return row;
      }
    }
  };

  return { client, state };
}

async function runTests() {
  console.log('🚀 Memulai Pengujian Phase 4 — Platform Control Plane & Multi-Tenant Operations...');
  const { client: mockCp, state } = createInMemoryControlPlane();

  // Mock Registry melacak jumlah factory & evictions
  let disconnectedCount = 0;
  let createdClientCount = 0;
  const registry = new TenantConnectionRegistry({
    sharedPrismaProvider: () => mockCp,
    dedicatedClientFactory: (_url) => {
      createdClientCount++;
      return {
        $queryRawUnsafe: async () => [{ ok: 1 }],
        $disconnect: async () => {
          disconnectedCount++;
        }
      } as any;
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: First-Run Platform Bootstrap Lock & Brute Force Lockout
  // --------------------------------------------------------------------------
  const bootStatusBefore = await getPlatformBootstrapStatus(mockCp);
  assert.equal(bootStatusBefore.needsBootstrap, true);

  const bootClaim = await claimPlatformBootstrap(
    {
      name: 'Super Platform Admin',
      username: 'platform_root',
      email: 'root@sadewa.id',
      password: 'VeryStrongPlatformPass!2026'
    },
    mockCp
  );
  assert.equal(bootClaim.user.role, 'platform_super_admin');
  assert.ok(bootClaim.token.length > 20);

  await assert.rejects(
    () =>
      claimPlatformBootstrap(
        {
          name: 'Attacker',
          username: 'hacker',
          email: 'hacker@evil.com',
          password: 'Password123456'
        },
        mockCp
      ),
    (err: any) => err instanceof PlatformControlPlaneError && err.code === 'BOOTSTRAP_ALREADY_CLAIMED'
  );

  // Brute force lockout pada ke-5 salah password
  for (let i = 1; i <= 4; i++) {
    await assert.rejects(
      () => loginPlatformUser({ username: 'platform_root', password: 'WrongPassword!' }, mockCp),
      (err: any) => err instanceof PlatformControlPlaneError && err.statusCode === 401
    );
  }
  await assert.rejects(
    () => loginPlatformUser({ username: 'platform_root', password: 'WrongPassword!' }, mockCp),
    (err: any) => err instanceof PlatformControlPlaneError && err.code === 'ACCOUNT_LOCKED' && err.statusCode === 403
  );
  // Reset lockout state agar bisa lanjut
  state.platformUsers[0].failedLoginCount = 0;
  state.platformUsers[0].lockoutUntil = null;
  const validLogin = await loginPlatformUser(
    { username: 'platform_root', password: 'VeryStrongPlatformPass!2026' },
    mockCp
  );
  assert.ok(validLogin.token);
  console.log('✅ Test 1 Lolos: First-run Bootstrap Lock & Brute-Force Protection bekerja ketat.');

  // --------------------------------------------------------------------------
  // TEST 2: Scope Isolation (Platform Token vs Village Token)
  // --------------------------------------------------------------------------
  const app = express();
  app.use(express.json());
  app.get('/api/admin/ping', (req, res, next) => {
    runWithTenantContext(
      {
        tenantId: 'tenant_desa_a',
        slug: 'desa-a',
        tenantName: 'Desa A',
        letterCodePrefix: 'DSA',
        tenancyMode: 'SHARED',
        isPlatformScope: false,
        credentialVersion: 1,
        requestId: 'req-1'
      },
      () => authenticateToken(req, res, () => res.json({ ok: true }))
    );
  });
  app.get('/api/platform/ping', (req, res) => {
    runWithTenantContext(
      {
        tenantId: null,
        slug: null,
        tenantName: 'Platform',
        letterCodePrefix: null,
        tenancyMode: 'SHARED',
        isPlatformScope: true,
        credentialVersion: 1,
        requestId: 'req-2'
      },
      () =>
        authenticatePlatformToken(req, res, () => res.json({ ok: true, role: (req as any).user?.role }))
    );
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  try {
    const platToken = createPlatformToken({
      id: bootClaim.user.id,
      username: 'platform_root',
      role: 'platform_super_admin',
      name: 'Super Platform Admin',
      tokenVersion: 1
    });
    const villageToken = createToken({
      id: 'usr_desa_a',
      username: 'kades_a',
      role: 'super_admin',
      name: 'Kades A',
      tokenVersion: 1,
      villageId: 'tenant_desa_a'
    });

    // Platform token ditolak di endpoint desa
    const resPlatOnVillage = await fetch(`http://127.0.0.1:${port}/api/admin/ping`, {
      headers: { Authorization: `Bearer ${platToken}` }
    });
    assert.equal(resPlatOnVillage.status, 403);

    // Village token ditolak di endpoint platform
    const resVillageOnPlat = await fetch(`http://127.0.0.1:${port}/api/platform/ping`, {
      headers: { Authorization: `Bearer ${villageToken}` }
    });
    assert.equal(resVillageOnPlat.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log('✅ Test 2 Lolos: Token Platform & Token Desa terisolasi mutlak (403 Cross-Scope ditolak).');

  // --------------------------------------------------------------------------
  // TEST 3: Tenant Onboarding & Custom Domain DNS Verification + SSRF Guards
  // --------------------------------------------------------------------------
  const actor = {
    userId: bootClaim.user.id,
    name: 'Super Platform Admin',
    username: 'platform_root',
    role: 'platform_super_admin' as const
  };

  // Tolak domain tidak aman / wildcard / subdomain sadewa.id
  assert.throws(() => validateCustomDomain('localhost'), PlatformControlPlaneError);
  assert.throws(() => validateCustomDomain('127.0.0.1'), PlatformControlPlaneError);
  assert.throws(() => validateCustomDomain('*.desa.id'), PlatformControlPlaneError);
  assert.throws(() => validateCustomDomain('desa-x.sadewa.id'), PlatformControlPlaneError);

  const created = await createTenantVillage(
    {
      slug: 'suka-maju',
      name: 'Desa Suka Maju',
      letterCodePrefix: 'SKM',
      tenancyMode: 'SHARED',
      initialAdmin: {
        name: 'Sekdes Suka Maju',
        username: 'admin_sukamaju',
        email: 'admin@sukamaju.desa.id',
        password: 'DesaSukaMaju#2026'
      }
    },
    actor,
    '127.0.0.1',
    mockCp,
    registry
  );

  assert.equal(created.tenant.slug, 'suka-maju');
  assert.equal(created.tenant.primaryDomain, 'suka-maju.sadewa.id');
  assert.equal(state.villageProfiles.length, 1);
  assert.equal(state.villageProfiles[0].id, `profile-${created.tenant.id}`);
  assert.equal(state.users[0].villageId, created.tenant.id);

  const domAdd = await addTenantCustomDomain(
    created.tenant.id,
    'portal.sukamaju.desa.id',
    true,
    actor,
    '127.0.0.1',
    mockCp
  );
  assert.ok(domAdd.dnsInstructions.txtValue.startsWith('sadewa-verify='));

  // Simulasi DNS salah -> FAILED
  const dnsFail = await verifyTenantDomainDns(
    created.tenant.id,
    domAdd.domain.id,
    actor,
    '127.0.0.1',
    mockCp,
    {
      resolveTxt: async () => [['sadewa-verify=wrong-token']],
      resolveCname: async () => []
    }
  );
  assert.equal(dnsFail.verified, false);
  assert.equal(dnsFail.domain.verificationStatus, 'FAILED');

  // Simulasi DNS benar -> VERIFIED & sslStatus ACTIVE
  const dnsOk = await verifyTenantDomainDns(
    created.tenant.id,
    domAdd.domain.id,
    actor,
    '127.0.0.1',
    mockCp,
    {
      resolveTxt: async (host) =>
        host === `_sadewa-verify.portal.sukamaju.desa.id` ? [[domAdd.dnsInstructions.txtValue]] : [],
      resolveCname: async () => ['cname.sadewa.id']
    }
  );
  assert.equal(dnsOk.verified, true);
  assert.equal(dnsOk.cnameVerified, true);
  assert.equal(dnsOk.domain.sslStatus, 'ACTIVE');
  console.log('✅ Test 3 Lolos: Onboarding tenant, validasi domain SSRF, dan verifikasi TXT/CNAME DNS lulus.');

  // --------------------------------------------------------------------------
  // TEST 4: Dedicated DB Vault Encryption, Secret Masking, Rotation & Revocation
  // --------------------------------------------------------------------------
  const secretRawDbUrl =
    'postgresql://postgres.dedicatedref:SuperSecretDBPass99!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?schema=sadewa';

  // Tolak SSRF metadata IP
  await assert.rejects(
    () =>
      upsertDedicatedDatabaseConfig(
        created.tenant.id,
        { databaseUrl: 'postgresql://user:pass@169.254.169.254:5432/postgres' },
        actor,
        '127.0.0.1',
        mockCp,
        registry
      ),
    (err: any) => err instanceof PlatformControlPlaneError && err.code === 'UNSAFE_DB_HOST'
  );

  const upgradedTenant = await upsertDedicatedDatabaseConfig(
    created.tenant.id,
    { databaseUrl: secretRawDbUrl, storageBucket: 'bucket-suka-maju' },
    actor,
    '127.0.0.1',
    mockCp,
    registry
  );

  assert.equal(upgradedTenant.tenancyMode, 'DEDICATED');
  assert.equal(upgradedTenant.dbConfig?.credentialVersion, 1);
  assert.equal(upgradedTenant.dbConfig?.host, 'aws-0-ap-southeast-1.pooler.supabase.com');
  assert.equal(upgradedTenant.dbConfig?.isPooler, true);

  // Pastikan kredensial mentah TIDAK PERNAH muncul pada respon API terserialisasi
  const serializedResp = JSON.stringify(upgradedTenant);
  assert.equal(serializedResp.includes('SuperSecretDBPass99!'), false);
  assert.equal(serializedResp.includes('postgres.dedicatedref'), false);

  // Pastikan database control plane menyimpan envelope AES-256-GCM yang valid & terikat tenantId
  const storedConfig = state.dbConfigs.find((c) => c.tenantId === created.tenant.id);
  assert.ok(isEncryptedEnvelope(storedConfig.encryptedDatabaseUrl));
  const decrypted = decryptTenantSecret(storedConfig.encryptedDatabaseUrl, { tenantId: created.tenant.id });
  assert.ok(decrypted.includes('pgbouncer=true'));

  // Warm pool Dedicated DB lalu lakukan rotasi kredensial -> pool lama harus ter-evict & credentialVersion -> 2
  await registry.getClientForTenant({
    tenantId: created.tenant.id,
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: storedConfig.encryptedDatabaseUrl, credentialVersion: 1 }
  });
  assert.equal(registry.getStats().dedicatedActiveCount, 1);

  const rotatedTenant = await rotateDedicatedDatabaseCredentials(
    created.tenant.id,
    {
      newDatabaseUrl:
        'postgresql://postgres.dedicatedref:RotatedNewPass2026!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?schema=sadewa'
    },
    actor,
    '127.0.0.1',
    mockCp,
    registry
  );
  assert.equal(rotatedTenant.dbConfig?.credentialVersion, 2);
  assert.equal(registry.getStats().dedicatedActiveCount, 0);
  assert.ok(disconnectedCount >= 1);
  assert.equal(JSON.stringify(rotatedTenant).includes('RotatedNewPass2026!'), false);

  // Revoke Dedicated DB -> revert to SHARED & hapus config terenkripsi
  const revokedTenant = await revokeDedicatedDatabaseConfig(
    created.tenant.id,
    { suspendTenant: false },
    actor,
    '127.0.0.1',
    mockCp,
    registry
  );
  assert.equal(revokedTenant.tenancyMode, 'SHARED');
  assert.equal(revokedTenant.dbConfig, null);
  console.log('✅ Test 4 Lolos: AES-256-GCM Dedicated DB Vault, Secret Masking, Rotation (v2 + Evict), dan Revocation lulus.');

  // --------------------------------------------------------------------------
  // TEST 5: Tenant Suspend & Audit Trail Completeness
  // --------------------------------------------------------------------------
  const suspended = await updateTenantStatus(created.tenant.id, 'SUSPENDED', actor, '127.0.0.1', mockCp, registry);
  assert.equal(suspended.status, 'SUSPENDED');

  const logs = await listPlatformAuditLogs({ targetTenantId: created.tenant.id }, mockCp);
  assert.ok(logs.length >= 5);
  assert.equal(JSON.stringify(logs).includes('SuperSecretDBPass99!'), false);
  assert.equal(JSON.stringify(logs).includes('RotatedNewPass2026!'), false);
  assert.ok(createdClientCount >= 3);
  console.log('✅ Test 5 Lolos: Status lifecycle & PlatformAuditLog bebas bocoran rahasia lulus.');

  console.log('🎉 SELURUH TEST PHASE 4 LULUS SEMPURNA (5/5).');
}

runTests().catch((err) => {
  console.error('❌ Test Phase 4 gagal:', err);
  process.exit(1);
});
