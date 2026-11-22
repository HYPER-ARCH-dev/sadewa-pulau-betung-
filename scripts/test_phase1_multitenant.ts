import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  encryptTenantSecret,
  decryptTenantSecret,
  rotateTenantSecret,
  isEncryptedEnvelope,
  parseEnvelopeMetadata
} from '../server/security/credentialVault';
import {
  runWithTenantContext,
  getCurrentTenantContext,
  assertSafeUnscopedMutation,
  getScopedDeleteWhere,
  TenantScopeViolationError
} from '../server/db/tenantContext';
import {
  createTenantScopedPrisma,
  normalizeDedicatedPostgresUrl,
  TenantConnectionRegistry
} from '../server/db/tenantConnectionRegistry';
import { clearSupabaseStorageBucket } from '../server/routes/upload';

async function testCredentialVault() {
  console.log('🧪 [1/4] Menguji Credential Vault AES-256-GCM...');
  const keyV1 = crypto.randomBytes(32).toString('hex');
  const keyV2 = crypto.randomBytes(32).toString('hex');
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY = keyV1;
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY_V2 = keyV2;

  const tenantA = 'tenant-pulau-betung';
  const tenantB = 'tenant-sukamaju';
  const rawSecret = 'postgresql://postgres.abcd1234:SuperSecretPass!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?schema=sadewa';

  const encA = encryptTenantSecret(rawSecret, { tenantId: tenantA, keyVersion: 1 });
  assert.equal(isEncryptedEnvelope(encA), true, 'Output enkripsi harus berbentuk envelope valid');
  assert.deepEqual(parseEnvelopeMetadata(encA), { keyVersion: 1 });
  assert.equal(encA.includes('SuperSecretPass'), false, 'Ciphertext tidak boleh membocorkan plaintext');

  const decA = decryptTenantSecret(encA, { tenantId: tenantA });
  assert.equal(decA, rawSecret, 'Dekripsi untuk tenant yang sama harus cocok 100%');

  // Cross-tenant ciphertext transplantation check (AAD binding)
  assert.throws(
    () => decryptTenantSecret(encA, { tenantId: tenantB }),
    /Unsupported state or unable to authenticate data/i,
    'Ciphertext tenant A wajib ditolak jika didekripsi dengan AAD tenant B'
  );

  // Tamper check
  const parts = encA.split(':');
  const tamperedTag = Buffer.from(parts[3], 'base64');
  tamperedTag[0] ^= 0xff;
  const tamperedEnvelope = [parts[0], parts[1], parts[2], tamperedTag.toString('base64'), parts[4]].join(':');
  assert.throws(
    () => decryptTenantSecret(tamperedEnvelope, { tenantId: tenantA }),
    /Unsupported state or unable to authenticate data/i,
    'Ciphertext/AuthTag yang dimodifikasi wajib ditolak'
  );

  // Key rotation v1 -> v2
  const rotated = rotateTenantSecret(encA, { tenantId: tenantA, newKeyVersion: 2 });
  assert.deepEqual(parseEnvelopeMetadata(rotated), { keyVersion: 2 });
  assert.equal(decryptTenantSecret(rotated, { tenantId: tenantA }), rawSecret);

  console.log('   ✅ Credential Vault lulus semua uji keamanan & rotasi.');
}

async function testTenantConnectionRegistry() {
  console.log('🧪 [2/4] Menguji TenantConnectionRegistry (LRU, URL normalization, credential rotation)...');
  const keyV1 = crypto.randomBytes(32).toString('hex');
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY = keyV1;

  // Normalisasi URL Pooler Supabase
  const norm = normalizeDedicatedPostgresUrl(
    'postgresql://postgres.proj123:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?schema=sadewa',
    5
  );
  const parsedNorm = new URL(norm);
  assert.equal(parsedNorm.searchParams.get('pgbouncer'), 'true');
  assert.equal(parsedNorm.searchParams.get('connection_limit'), '5');

  const createdClients: Array<{ tenantId: string; url: string; disconnected: boolean }> = [];
  const PrismaCtor = PrismaClient as unknown as new (opts?: Record<string, unknown>) => PrismaClient;
  const baseSharedStub = new PrismaCtor({
    datasources: { db: { url: 'postgresql://user:pass@localhost:5432/shared?schema=sadewa' } }
  });

  const registry = new TenantConnectionRegistry({
    maxDedicatedClients: 2,
    idleTtlMs: 5000,
    maxConnectionsPerDedicatedTenant: 4,
    sharedPrismaProvider: () => baseSharedStub,
    dedicatedClientFactory: (connectionUrl, tenantId) => {
      const tracker = { tenantId, url: connectionUrl, disconnected: false };
      createdClients.push(tracker);
      return {
        $disconnect: async () => {
          tracker.disconnected = true;
        },
        $queryRawUnsafe: async () => [{ '?column?': 1 }]
      } as unknown as PrismaClient;
    }
  });

  const enc1 = encryptTenantSecret('postgresql://postgres.t1:pw@aws-0-ap.pooler.supabase.com:6543/postgres', {
    tenantId: 't1'
  });
  const enc2 = encryptTenantSecret('postgresql://postgres.t2:pw@aws-0-ap.pooler.supabase.com:6543/postgres', {
    tenantId: 't2'
  });
  const enc3 = encryptTenantSecret('postgresql://postgres.t3:pw@aws-0-ap.pooler.supabase.com:6543/postgres', {
    tenantId: 't3'
  });

  await registry.getClientForTenant({
    tenantId: 't1',
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: enc1, credentialVersion: 1 }
  });
  await registry.getClientForTenant({
    tenantId: 't2',
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: enc2, credentialVersion: 1 }
  });

  // Akses t1 lagi agar t2 menjadi LRU
  await registry.getClientForTenant({
    tenantId: 't1',
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: enc1, credentialVersion: 1 }
  });

  // Tambah t3 -> t2 harus ter-evict dan $disconnect() dipanggil
  await registry.getClientForTenant({
    tenantId: 't3',
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: enc3, credentialVersion: 1 }
  });

  assert.equal(registry.getStats().dedicatedActiveCount, 2);
  assert.equal(createdClients[1].tenantId, 't2');
  assert.equal(createdClients[1].disconnected, true, 'LRU client t2 wajib di-$disconnect saat ter-evict');
  assert.equal(createdClients[0].disconnected, false, 'MRU client t1 harus tetap aktif');

  // Uji rotasi credentialVersion pada t1 (v1 -> v2)
  const enc1New = encryptTenantSecret('postgresql://postgres.t1:newpw@aws-0-ap.pooler.supabase.com:6543/postgres', {
    tenantId: 't1'
  });
  await registry.getClientForTenant({
    tenantId: 't1',
    tenancyMode: 'DEDICATED',
    dbConfig: { encryptedDatabaseUrl: enc1New, credentialVersion: 2 }
  });
  assert.equal(createdClients[0].disconnected, true, 'Client t1 versi lama wajib di-$disconnect saat credentialVersion berubah');

  // Uji evictTenant & revokeAll
  await registry.evictTenant('t3');
  assert.equal(createdClients[2].disconnected, true);
  await registry.revokeAll();
  assert.equal(registry.getStats().dedicatedActiveCount, 0);
  await baseSharedStub.$disconnect().catch(() => undefined);

  console.log('   ✅ TenantConnectionRegistry LRU, pooler params, rotasi & disconnect lulus.');
}

async function testSharedPrismaScopingExtension() {
  console.log('🧪 [3/4] Menguji Shared Prisma $extends villageId scoping...');
  const capturedCalls: Array<{ model?: string; operation: string; args: any }> = [];

  const PrismaCtor = PrismaClient as unknown as new (opts?: Record<string, unknown>) => PrismaClient;
  const realBase = new PrismaCtor({
    datasources: { db: { url: 'postgresql://user:pass@localhost:5432/shared?schema=sadewa' } }
  });

  const tenantScoped = createTenantScopedPrisma(realBase, 'desa-pulau-betung');
  const spiedScoped = (tenantScoped as any).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }: any) {
          capturedCalls.push({ model, operation, args });
          return { __intercepted: true, model, operation, args };
        }
      }
    }
  }) as PrismaClient;

  await spiedScoped.serviceRequest.findMany({ where: { status: 'selesai' } });
  await spiedScoped.serviceRequest.create({
    data: {
      trackingCode: 'TRK-01',
      serviceId: 'srv-1',
      serviceName: 'SKU',
      citizenName: 'Budi',
      citizenNikMasked: '1504***0001',
      phone: '0812',
      addressDusun: 'Dusun 1',
      status: 'diajukan'
    }
  });
  await spiedScoped.tenant.findMany({ where: { status: 'ACTIVE' } });

  assert.equal(capturedCalls[0].model, 'ServiceRequest');
  assert.deepEqual(capturedCalls[0].args.where, {
    AND: [{ status: 'selesai' }, { villageId: 'desa-pulau-betung' }]
  });

  assert.equal(capturedCalls[1].model, 'ServiceRequest');
  assert.equal(capturedCalls[1].args.data.villageId, 'desa-pulau-betung');

  // Control plane model 'Tenant' tidak boleh diinjeksi villageId!
  assert.equal(capturedCalls[2].model, 'Tenant');
  assert.deepEqual(capturedCalls[2].args.where, { status: 'ACTIVE' });

  await realBase.$disconnect().catch(() => undefined);
  console.log('   ✅ Shared Prisma $extends mengisolasi model tenant & mengecualikan Control Plane.');
}

async function testContextAndGlobalMutationSafeguards() {
  console.log('🧪 [4/4] Menguji AsyncLocalStorage TenantContext & Safeguard mutasi global...');

  // 1. Mode single-tenant default (MULTI_TENANT_ROUTING=false) tanpa context -> diizinkan (backward compatible)
  process.env.MULTI_TENANT_ROUTING = 'false';
  assert.deepEqual(assertSafeUnscopedMutation('test-legacy'), { tenantId: null, scoped: false });
  assert.deepEqual(getScopedDeleteWhere({}), {});

  // 2. Saat MULTI_TENANT_ROUTING=true tanpa tenant context -> WAJIB DITOLAK
  process.env.MULTI_TENANT_ROUTING = 'true';
  assert.throws(
    () => assertSafeUnscopedMutation('POST /api/admin/reset-data'),
    (err: any) => err instanceof TenantScopeViolationError && err.statusCode === 403
  );
  await assert.rejects(
    () => clearSupabaseStorageBucket(),
    (err: any) => err instanceof TenantScopeViolationError
  );

  // 3. Saat MULTI_TENANT_ROUTING=true DENGAN tenant context -> diizinkan & otomatis scoped ke villageId
  const scopedResult = runWithTenantContext(
    {
      tenantId: 'tenant-123',
      slug: 'pulau-betung',
      tenancyMode: 'SHARED',
      isPlatformScope: false,
      credentialVersion: 1
    },
    () => {
      assert.equal(getCurrentTenantContext()?.slug, 'pulau-betung');
      return getScopedDeleteWhere({ status: 'archived' }, 'deleteMany');
    }
  );
  assert.deepEqual(scopedResult, { status: 'archived', villageId: 'tenant-123' });

  // 4. Platform scope tanpa tenantId -> WAJIB DITOLAK untuk operasi tabel tenant
  runWithTenantContext(
    {
      tenantId: null,
      slug: null,
      tenancyMode: 'SHARED',
      isPlatformScope: true,
      credentialVersion: 1
    },
    () => {
      assert.throws(
        () => assertSafeUnscopedMutation('POST /api/admin/reset-database'),
        (err: any) => err instanceof TenantScopeViolationError
      );
    }
  );

  process.env.MULTI_TENANT_ROUTING = 'false';
  console.log('   ✅ AsyncLocalStorage TenantContext & Global Safeguard bekerja sesuai ekspektasi.');
}

async function main() {
  await testCredentialVault();
  await testTenantConnectionRegistry();
  await testSharedPrismaScopingExtension();
  await testContextAndGlobalMutationSafeguards();
  console.log('\n🎉 SELURUH PENGUJIAN PHASE 1 MULTI-TENANT PRIMITIVES BERHASIL!');
}

main().catch((err) => {
  console.error('❌ Pengujian Phase 1 gagal:', err);
  process.exit(1);
});
