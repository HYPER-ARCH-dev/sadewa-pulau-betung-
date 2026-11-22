import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { createApiApp } from '../server/app';
import { createToken, createPlatformToken } from '../server/auth';
import { assignServerLetterNumberAtomic } from '../server/services/letterNumbering';
import {
  getCurrentTenantContext,
  runWithTenantContext
} from '../server/db/tenantContext';
import {
  getPrisma,
  isJsonFallbackAllowed
} from '../server/db/prisma-helpers';
import { TenantConnectionRegistry } from '../server/db/tenantConnectionRegistry';
import { encryptTenantSecret } from '../server/security/credentialVault';
import { invalidateTenantResolutionCache } from '../server/middleware/tenantResolver';
import {
  clearTenantAuthSession,
  getTenantAuthToken,
  getTenantStorageKey,
  loadTenantStored,
  setTenantAuthToken
} from '../src/utils/tenantStorage';

interface CapturedQuery {
  targetDb: string;
  model?: string;
  operation: string;
  args: any;
}

async function makeHttpRequest(
  port: number,
  path: string,
  options: {
    method?: string;
    host?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const bodyStr = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method || 'GET',
        headers: {
          Host: options.host || 'localhost:3000',
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
          ...(options.headers || {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, json: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 0, json: { raw } });
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function testMiddlewareHybridRoutingAndAuth() {
  console.log('🧪 [1/5] Menguji TenantResolver, Anti-Spoofing, Hybrid DB Routing, & Scoped Auth...');

  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/shared?schema=sadewa';
  process.env.MULTI_TENANT_ROUTING = 'true';
  invalidateTenantResolutionCache();

  const queriesLog: CapturedQuery[] = [];

  const tenantRecords: Record<string, any> = {
    'desa-a': {
      id: 'tenant-a',
      slug: 'desa-a',
      name: 'Desa A Maju',
      letterCodePrefix: 'DSA',
      status: 'ACTIVE',
      tenancyMode: 'SHARED',
      dbConfig: null
    },
    'desa-b': {
      id: 'tenant-b',
      slug: 'desa-b',
      name: 'Desa B Mandiri',
      letterCodePrefix: 'DSB',
      status: 'ACTIVE',
      tenancyMode: 'DEDICATED',
      dbConfig: {
        tenantId: 'tenant-b',
        credentialVersion: 1,
        encryptedDatabaseUrl: encryptTenantSecret(
          'postgresql://postgres.desab:secret@aws-0-ap.pooler.supabase.com:6543/postgres?schema=sadewa',
          { tenantId: 'tenant-b', keyVersion: 1 }
        )
      }
    },
    'desa-suspended': {
      id: 'tenant-susp',
      slug: 'desa-suspended',
      name: 'Desa Nonaktif',
      letterCodePrefix: 'DSS',
      status: 'SUSPENDED',
      tenancyMode: 'SHARED',
      dbConfig: null
    }
  };

  const domainRecords: Record<string, any> = {
    'desa-b.id': {
      domain: 'desa-b.id',
      isCustom: true,
      verificationStatus: 'VERIFIED',
      tenant: tenantRecords['desa-b']
    },
    'pending-custom.desa.id': {
      domain: 'pending-custom.desa.id',
      isCustom: true,
      verificationStatus: 'PENDING',
      tenant: tenantRecords['desa-a']
    }
  };

  const usersByTenant: Record<string, any> = {
    'tenant-a': {
      id: 'usr-a',
      username: 'admin_a',
      name: 'Admin Desa A',
      role: 'super_admin',
      isActive: true,
      tokenVersion: 1,
      villageId: 'tenant-a'
    },
    'tenant-b': {
      id: 'usr-b',
      username: 'admin_b',
      name: 'Admin Desa B',
      role: 'super_admin',
      isActive: true,
      tokenVersion: 1,
      villageId: 'tenant-b'
    }
  };

  const profilesByTenant: Record<string, any> = {
    'tenant-a': { id: 'profile-tenant-a', villageId: 'tenant-a', villageName: 'Desa A Maju' },
    'tenant-b': { id: 'profile-tenant-b', villageId: 'tenant-b', villageName: 'Desa B Mandiri' }
  };

  const lettersByTenant: Record<string, any> = {
    'tenant-a': {
      id: 'req-a-1',
      villageId: 'tenant-a',
      trackingCode: 'REQ-A-2026-001',
      officialLetterNumber: '470 / 001 / SK-DOM / DSA / XI / 2026',
      serviceName: 'Surat Keterangan Domisili',
      citizenName: 'Siti A',
      citizenNik: '1504010101010001',
      status: 'selesai',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    'tenant-b': {
      id: 'req-b-1',
      villageId: 'tenant-b',
      trackingCode: 'REQ-B-2026-001',
      officialLetterNumber: '510 / 001 / SKU / DSB / XI / 2026',
      serviceName: 'Surat Keterangan Usaha',
      citizenName: 'Budi B',
      citizenNik: '1504010101010002',
      status: 'selesai',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  };

  const extractVillageFilter = (where: any): string | undefined => {
    if (!where) return undefined;
    if (typeof where.villageId === 'string') return where.villageId;
    if (Array.isArray(where.AND)) {
      for (const item of where.AND) {
        const found = extractVillageFilter(item);
        if (found) return found;
      }
    }
    return undefined;
  };

  const executeSharedQuery = async (model: string, operation: string, args: any) => {
    queriesLog.push({ targetDb: 'SHARED_DB', model, operation, args });

    if (model === 'Tenant' && operation === 'findUnique') {
      return tenantRecords[args?.where?.slug] || null;
    }
    if (model === 'TenantDomain' && operation === 'findUnique') {
      return domainRecords[args?.where?.domain] || null;
    }

    const scopedTenantId = extractVillageFilter(args?.where);
    if (model === 'User' && operation === 'findFirst') {
      if (!scopedTenantId) return null;
      return usersByTenant[scopedTenantId] || null;
    }
    if (model === 'VillageProfile' && operation === 'findFirst') {
      if (!scopedTenantId) return null;
      return profilesByTenant[scopedTenantId] || null;
    }
    if (model === 'ServiceRequest' && operation === 'findFirst') {
      if (!scopedTenantId) return null;
      return lettersByTenant[scopedTenantId] || null;
    }
    return null;
  };

  const makeModelProxy = (
    modelName: string,
    opHook?: (params: { model: string; operation: string; args: any; query: (a: any) => Promise<any> }) => Promise<any>
  ) => ({
    findUnique: (args: any) =>
      opHook
        ? opHook({ model: modelName, operation: 'findUnique', args, query: (a) => executeSharedQuery(modelName, 'findUnique', a) })
        : executeSharedQuery(modelName, 'findUnique', args),
    findFirst: (args: any) =>
      opHook
        ? opHook({ model: modelName, operation: 'findFirst', args, query: (a) => executeSharedQuery(modelName, 'findFirst', a) })
        : executeSharedQuery(modelName, 'findFirst', args)
  });

  const sharedStub = {
    $queryRawUnsafe: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
    $extends: (extConfig: any) => {
      const opHook = extConfig?.query?.$allModels?.$allOperations;
      return {
        $queryRawUnsafe: async () => [{ '?column?': 1 }],
        $disconnect: async () => undefined,
        tenant: makeModelProxy('Tenant', opHook),
        tenantDomain: makeModelProxy('TenantDomain', opHook),
        user: makeModelProxy('User', opHook),
        villageProfile: makeModelProxy('VillageProfile', opHook),
        serviceRequest: makeModelProxy('ServiceRequest', opHook)
      };
    },
    tenant: makeModelProxy('Tenant'),
    tenantDomain: makeModelProxy('TenantDomain'),
    user: makeModelProxy('User'),
    villageProfile: makeModelProxy('VillageProfile'),
    serviceRequest: makeModelProxy('ServiceRequest')
  } as unknown as PrismaClient;

  const dedicatedStub = {
    $queryRawUnsafe: async () => [{ '?column?': 1 }],
    $disconnect: async () => undefined,
    user: {
      findFirst: async (args: any) => {
        queriesLog.push({ targetDb: 'DEDICATED_B', model: 'User', operation: 'findFirst', args });
        return usersByTenant['tenant-b'];
      }
    },
    villageProfile: {
      findFirst: async (args: any) => {
        queriesLog.push({ targetDb: 'DEDICATED_B', model: 'VillageProfile', operation: 'findFirst', args });
        return profilesByTenant['tenant-b'];
      }
    },
    serviceRequest: {
      findFirst: async (args: any) => {
        queriesLog.push({ targetDb: 'DEDICATED_B', model: 'ServiceRequest', operation: 'findFirst', args });
        return lettersByTenant['tenant-b'];
      }
    }
  } as unknown as PrismaClient;

  const g = globalThis as any;
  const prevPrisma = g.prisma;
  const prevRegistry = g.tenantRegistry;
  const prevCacheMap = g.dbAvailabilityCacheMap;

  g.dbAvailabilityCacheMap = new Map();
  g.prisma = sharedStub;
  g.tenantRegistry = new TenantConnectionRegistry({
    sharedPrismaProvider: () => sharedStub,
    dedicatedClientFactory: (_url, tenantId) => {
      assert.equal(tenantId, 'tenant-b');
      return dedicatedStub;
    }
  });

  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const port = address.port;

  try {
    // 1. Spoofed X-Tenant-Id / Origin header must be IGNORED; Host header rules
    const spoofRes = await makeHttpRequest(port, '/api/public/tenant-info', {
      host: 'desa-a.sadewa.id',
      headers: {
        'X-Tenant-Id': 'tenant-b',
        Origin: 'https://desa-b.id'
      }
    });
    assert.equal(spoofRes.status, 200);
    assert.equal(spoofRes.json?.data?.id, 'tenant-a', 'Header X-Tenant-Id palsu wajib diabaikan');
    assert.equal(spoofRes.json?.data?.tenancyMode, 'SHARED');

    // 2. Verified custom domain routes to DEDICATED tenant-b
    const customRes = await makeHttpRequest(port, '/api/public/tenant-info', {
      host: 'desa-b.id'
    });
    assert.equal(customRes.status, 200);
    assert.equal(customRes.json?.data?.id, 'tenant-b');
    assert.equal(customRes.json?.data?.tenancyMode, 'DEDICATED');

    // 3. Pending unverified custom domain -> 404
    const pendingRes = await makeHttpRequest(port, '/api/public/tenant-info', {
      host: 'pending-custom.desa.id'
    });
    assert.equal(pendingRes.status, 404);
    assert.equal(pendingRes.json?.code, 'TENANT_NOT_FOUND');

    // 4. Suspended tenant -> 403
    const suspRes = await makeHttpRequest(port, '/api/public/tenant-info', {
      host: 'desa-suspended.sadewa.id'
    });
    assert.equal(suspRes.status, 403);
    assert.equal(suspRes.json?.code, 'TENANT_SUSPENDED');

    // 5. Unknown domain -> 404
    const unknownRes = await makeHttpRequest(port, '/api/public/tenant-info', {
      host: 'unregistered-hacker.com'
    });
    assert.equal(unknownRes.status, 404);

    // 6. Token scoping & cross-tenant rejection + platform token rejection
    const tokenA = createToken(usersByTenant['tenant-a']);
    const tokenB = createToken(usersByTenant['tenant-b']);
    const platformToken = createPlatformToken({
      id: 'plat-1',
      username: 'platform_root',
      role: 'platform_super_admin',
      name: 'Platform Super Admin'
    });

    // Valid token A on Desa A host -> 200 + Shared DB with villageId='tenant-a'
    const okA = await makeHttpRequest(port, '/api/admin/profile', {
      host: 'desa-a.sadewa.id',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(okA.status, 200);
    assert.equal(okA.json?.data?.villageName, 'Desa A Maju');

    // Valid token B on Custom Domain Desa B -> 200 + Dedicated DB
    const okB = await makeHttpRequest(port, '/api/admin/profile', {
      host: 'desa-b.id',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.equal(okB.status, 200);
    assert.equal(okB.json?.data?.villageName, 'Desa B Mandiri');

    // Token A replayed against Desa B -> 403 Forbidden
    const crossAtoB = await makeHttpRequest(port, '/api/admin/profile', {
      host: 'desa-b.id',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(crossAtoB.status, 403, 'Token tenant A wajib ditolak di portal tenant B');

    // Platform token replayed against tenant admin endpoint -> 403 Forbidden
    const platformToTenant = await makeHttpRequest(port, '/api/admin/profile', {
      host: 'desa-a.sadewa.id',
      headers: { Authorization: `Bearer ${platformToken}` }
    });
    assert.equal(platformToTenant.status, 403, 'Token scope platform tidak boleh mengakses API admin desa');

    // 7. Concurrent interleaved requests across SHARED and DEDICATED tenants
    const concurrentResults = await Promise.all(
      Array.from({ length: 10 }, (_, idx) => {
        const isA = idx % 2 === 0;
        return makeHttpRequest(port, '/api/admin/profile', {
          host: isA ? 'desa-a.sadewa.id' : 'desa-b.id',
          headers: { Authorization: `Bearer ${isA ? tokenA : tokenB}` }
        }).then((res) => ({ isA, res }));
      })
    );
    for (const item of concurrentResults) {
      assert.equal(item.res.status, 200);
      assert.equal(
        item.res.json?.data?.villageName,
        item.isA ? 'Desa A Maju' : 'Desa B Mandiri',
        'Concurrent requests across Shared & Dedicated DB must never bleed'
      );
    }

    // 8. Dynamic /manifest.webmanifest & central QR /v/:slug/verify/:identifier
    const manifestA = await makeHttpRequest(port, '/manifest.webmanifest', { host: 'desa-a.sadewa.id' });
    const manifestB = await makeHttpRequest(port, '/manifest.webmanifest', { host: 'desa-b.id' });
    assert.equal(manifestA.status, 200);
    assert.equal(manifestB.status, 200);
    assert.equal(manifestA.json?.name, 'Portal Desa A Maju');
    assert.equal(manifestB.json?.name, 'Portal Desa B Mandiri');

    const qrPortalA = await makeHttpRequest(port, '/v/desa-a/verify/REQ-A-2026-001?format=json', {
      host: 'sadewa.id'
    });
    assert.equal(qrPortalA.status, 200);
    assert.equal(qrPortalA.json?.verified, true);
    assert.equal(qrPortalA.json?.certificate?.citizenName, 'Siti A');

    const qrPortalB = await makeHttpRequest(port, '/v/desa-b/verify/REQ-B-2026-001?format=json', {
      host: 'sadewa.id'
    });
    assert.equal(qrPortalB.status, 200);
    assert.equal(qrPortalB.json?.verified, true);
    assert.equal(qrPortalB.json?.certificate?.citizenName, 'Budi B');

    // Pastikan tidak ada query User/Profile ke SHARED_DB yang dilakukan untuk DEDICATED tenant-b
    const dedicatedProfileQueries = queriesLog.filter(
      (q) => q.targetDb === 'DEDICATED_B' && q.model === 'VillageProfile'
    );
    assert.ok(dedicatedProfileQueries.length >= 5, 'Tenant B wajib diarahkan ke Dedicated DB client');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    g.prisma = prevPrisma;
    g.tenantRegistry = prevRegistry;
    g.dbAvailabilityCacheMap = prevCacheMap;
  }

  console.log('   ✅ TenantResolver, Anti-Spoofing, Hybrid Routing, Manifest, QR, & Scoped Auth lulus.');
}

async function testConcurrentAsyncLocalStorageIsolation() {
  console.log('🧪 [2/5] Menguji Isolasi AsyncLocalStorage di lintas microtask/setTimeout...');
  const observed: string[] = [];

  await Promise.all([
    runWithTenantContext(
      {
        tenantId: 't-alpha',
        slug: 'alpha',
        tenancyMode: 'SHARED',
        isPlatformScope: false,
        credentialVersion: 1
      },
      async () => {
        await new Promise((r) => setTimeout(r, 15));
        observed.push(`A:${getCurrentTenantContext()?.tenantId}`);
        getPrisma();
      }
    ),
    runWithTenantContext(
      {
        tenantId: 't-beta',
        slug: 'beta',
        tenancyMode: 'SHARED',
        isPlatformScope: false,
        credentialVersion: 1
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        observed.push(`B:${getCurrentTenantContext()?.tenantId}`);
        getPrisma();
      }
    )
  ]);

  assert.ok(observed.includes('A:t-alpha'));
  assert.ok(observed.includes('B:t-beta'));
  console.log('   ✅ AsyncLocalStorage tetap terisolasi penuh setelah await/timer.');
}

async function testAtomicPerTenantLetterNumbering() {
  console.log('🧪 [3/5] Menguji Penomoran Surat Atomik Per-Desa (Zero Collision)...');
  const counters = new Map<string, number>();

  const mockTxPrisma = {
    $queryRawUnsafe: async (_sql: string, _id: string, villageId: string, code: string, year: number, month: number) => {
      const key = `${villageId}:${code}:${year}:${month}`;
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return [{ lastSequence: next }];
    },
    serviceRequest: {
      findFirst: async () => null
    }
  } as unknown as PrismaClient;

  // Dua desa mengeluarkan SKU di bulan yang sama -> masing-masing harus mendapat 001 secara independen
  const [numA1, numB1, numA2, numA3, numB2] = await Promise.all([
    assignServerLetterNumberAtomic('Surat Keterangan Usaha', '2026-11-15', [], 'r-a1', {
      prisma: mockTxPrisma,
      villageId: 'tenant-a',
      villageCode: 'DSA'
    }),
    assignServerLetterNumberAtomic('Surat Keterangan Usaha', '2026-11-15', [], 'r-b1', {
      prisma: mockTxPrisma,
      villageId: 'tenant-b',
      villageCode: 'DSB'
    }),
    assignServerLetterNumberAtomic('Surat Keterangan Usaha', '2026-11-16', [], 'r-a2', {
      prisma: mockTxPrisma,
      villageId: 'tenant-a',
      villageCode: 'DSA'
    }),
    assignServerLetterNumberAtomic('Surat Keterangan Usaha', '2026-11-17', [], 'r-a3', {
      prisma: mockTxPrisma,
      villageId: 'tenant-a',
      villageCode: 'DSA'
    }),
    assignServerLetterNumberAtomic('Surat Keterangan Usaha', '2026-11-18', [], 'r-b2', {
      prisma: mockTxPrisma,
      villageId: 'tenant-b',
      villageCode: 'DSB'
    })
  ]);

  assert.equal(numA1, '510 / 001 / SKU / DSA / XI / 2026');
  assert.equal(numB1, '510 / 001 / SKU / DSB / XI / 2026');
  assert.equal(numA2, '510 / 002 / SKU / DSA / XI / 2026');
  assert.equal(numA3, '510 / 003 / SKU / DSA / XI / 2026');
  assert.equal(numB2, '510 / 002 / SKU / DSB / XI / 2026');

  console.log('   ✅ Penomoran surat atomik menghasilkan urutan independen per desa tanpa duplikasi.');
}

function testJsonFallbackGating() {
  console.log('🧪 [4/5] Menguji Blokir JSON Fallback Lintas Tenant (isJsonFallbackAllowed)...');

  process.env.MIGRATION_PHASE = 'PHASE_2';
  process.env.MULTI_TENANT_ROUTING = 'true';
  assert.equal(isJsonFallbackAllowed(), false, 'JSON fallback wajib mati saat MULTI_TENANT_ROUTING=true');

  process.env.MULTI_TENANT_ROUTING = 'false';
  assert.equal(isJsonFallbackAllowed(), true, 'Mode single-tenant legacy tetap mengizinkan fallback dev');

  const otherTenantAllowed = runWithTenantContext(
    {
      tenantId: 'tenant-sukamaju',
      slug: 'sukamaju',
      tenancyMode: 'SHARED',
      isPlatformScope: false,
      credentialVersion: 1
    },
    () => isJsonFallbackAllowed()
  );
  assert.equal(otherTenantAllowed, false, 'Tenant non-Pulau-Betung wajib dilarang membaca database.json lokal');

  console.log('   ✅ Safeguard anti-kebocoran JSON fallback berjalan tepat.');
}

function testFrontendHostScopedStorage() {
  console.log('🧪 [5/5] Menguji Isolasi LocalStorage Frontend Per Domain Host...');
  const store = new Map<string, string>();
  const mockLocalStorage = {
    get length() {
      return store.size;
    },
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k)
  };

  const g = globalThis as any;
  const prevWindow = g.window;
  const prevLocalStorage = g.localStorage;

  try {
    g.localStorage = mockLocalStorage;
    // Simulasikan sesi legacy Pulau Betung sudah ada
    store.set('pulau_betung_auth_token', 'legacy-pb-token');
    store.set('pulau_betung_current_user', JSON.stringify({ id: 'pb-admin' }));

    // Pada domain tenant lain (desa-sukamaju.sadewa.id), token legacy Pulau Betung TIDAK BOLEH terbaca!
    g.window = { location: { host: 'desa-sukamaju.sadewa.id' } };
    assert.equal(getTenantAuthToken(), null, 'Domain desa-sukamaju tidak boleh membaca token legacy Pulau Betung');
    assert.equal(loadTenantStored('current_user', null), null);

    setTenantAuthToken('token-sukamaju-123');
    assert.equal(store.get('sadewa:desa-sukamaju.sadewa.id:auth_token'), 'token-sukamaju-123');
    assert.equal(getTenantStorageKey('auth_token'), 'sadewa:desa-sukamaju.sadewa.id:auth_token');

    // Pada domain pulau-betung.sadewa.id, sesi terisolasi ke namespace host Pulau Betung + backward compatible
    g.window = { location: { host: 'pulau-betung.sadewa.id' } };
    assert.equal(getTenantAuthToken(), 'legacy-pb-token');
    clearTenantAuthSession();
    assert.equal(getTenantAuthToken(), null);
    assert.equal(
      store.get('sadewa:desa-sukamaju.sadewa.id:auth_token'),
      'token-sukamaju-123',
      'Logout di satu domain tidak boleh menghapus token di domain desa lain'
    );
  } finally {
    g.window = prevWindow;
    g.localStorage = prevLocalStorage;
  }

  console.log('   ✅ Isolasi penyimpanan sesi frontend per host berjalan aman.');
}

async function main() {
  await testMiddlewareHybridRoutingAndAuth();
  await testConcurrentAsyncLocalStorageIsolation();
  await testAtomicPerTenantLetterNumbering();
  testJsonFallbackGating();
  testFrontendHostScopedStorage();
  console.log('\n🎉 SELURUH PENGUJIAN PHASE 3 HYBRID MULTI-TENANT ROUTING & AUTH BERHASIL!');
}

main().catch((err) => {
  console.error('❌ Pengujian Phase 3 gagal:', err);
  process.exit(1);
});
