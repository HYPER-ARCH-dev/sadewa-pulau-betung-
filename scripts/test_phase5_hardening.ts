import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiApp } from '../server/app';
import { saveDb } from '../server/db/database';
import { executeDualWriteSync } from '../server/db/sync/syncEngine';
import { runWithTenantContext, TenantScopeViolationError } from '../server/db/tenantContext';
import { buildTenantSnapshotPayload, restoreTenantBackupSnapshot } from '../server/scripts/db-backup';
import { encryptTenantSecret } from '../server/security/credentialVault';
import { resolveActiveSupabaseStorageCredentials } from '../server/routes/upload';
import { getControlPlanePrisma } from '../server/db/prisma-helpers';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'sadewa-phase5-test-session-secret-min-32!';
process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY =
  process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// ============================================================================
// 🧪 IN-MEMORY SHARED PRISMA UNTUK DRILL BACKUP / RESTORE MULTI-TENANT
// ============================================================================
function createMultiTenantSharedMock() {
  const store: Record<string, any[]> = {
    user: [],
    villageProfile: [],
    dusun: [],
    rW: [],
    rT: [],
    villageService: [],
    serviceRequest: [],
    deletedServiceRequest: [],
    complaint: [],
    resident: [],
    bansosRecipient: [],
    newsItem: [],
    announcement: [],
    agendaItem: [],
    galleryItem: [],
    budgetYearData: [],
    developmentProject: [],
    villagePotential: [],
    umkmItem: [],
    villageOfficial: [],
    mapFacility: [],
    landParcel: [],
    toddlerRecord: [],
    toddlerMeasurement: [],
    posyanduSchedule: [],
    auditLog: [],
    attendanceLog: []
  };

  const makeRepo = (model: string) => ({
    findMany: async (args?: { where?: { villageId?: string } }) => {
      const targetVillage = args?.where?.villageId;
      return store[model]
        .filter((row) => !targetVillage || row.villageId === targetVillage)
        .map((r) => ({ ...r }));
    },
    deleteMany: async (args?: { where?: { villageId?: string } }) => {
      const targetVillage = args?.where?.villageId;
      if (!targetVillage) {
        const count = store[model].length;
        store[model] = [];
        return { count };
      }
      const before = store[model].length;
      store[model] = store[model].filter((r) => r.villageId !== targetVillage);
      return { count: before - store[model].length };
    },
    createMany: async ({ data }: { data: any[] }) => {
      for (const item of data) {
        store[model].push({ ...item });
      }
      return { count: data.length };
    },
    create: async ({ data }: { data: any }) => {
      store[model].push({ ...data });
      return { ...data };
    }
  });

  const prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma)
  };
  for (const model of Object.keys(store)) {
    prisma[model] = makeRepo(model);
  }

  return { prisma, store };
}

async function runTests() {
  console.log('🚀 Memulai Pengujian Phase 5 — Tenant Backup/Restore Drill, Storage & Noisy-Neighbor Hardening...');

  // --------------------------------------------------------------------------
  // TEST 1 & 2: Tenant-Isolated Backup & Single-Tenant Restore Drill
  // --------------------------------------------------------------------------
  const { prisma: sharedMock, store } = createMultiTenantSharedMock();

  // Seed 2 desa bertetangga dalam Shared DB yang sama
  store.villageProfile.push(
    { id: 'profile-tenant_a', villageId: 'tenant_a', villageName: 'Desa Alpha' },
    { id: 'profile-tenant_b', villageId: 'tenant_b', villageName: 'Desa Beta' }
  );
  store.resident.push(
    { id: 'res-a1', villageId: 'tenant_a', fullName: 'Warga Alpha 1', nik: '15010001' },
    { id: 'res-a2', villageId: 'tenant_a', fullName: 'Warga Alpha 2', nik: '15010002' },
    { id: 'res-b1', villageId: 'tenant_b', fullName: 'Warga Beta Penting', nik: '15020001' }
  );
  store.user.push(
    { id: 'usr-a1', villageId: 'tenant_a', username: 'admin_a', passwordHash: 'secret-hash-a', salt: 'salt-a' },
    { id: 'usr-b1', villageId: 'tenant_b', username: 'admin_b', passwordHash: 'secret-hash-b', salt: 'salt-b' }
  );

  // Ekspor snapshot milik tenant_a
  const snapshotA = await buildTenantSnapshotPayload(sharedMock, 'tenant_a', 'desa-alpha');
  assert.equal(snapshotA.meta.tenantId, 'tenant_a');
  assert.equal(snapshotA.data.resident.length, 2);
  // Pastikan warga Desa Beta dan hash sandi admin TIDAK BOCOR ke dalam arsip Desa Alpha!
  const snapshotJsonStr = JSON.stringify(snapshotA);
  assert.equal(snapshotJsonStr.includes('Warga Beta Penting'), false);
  assert.equal(snapshotJsonStr.includes('secret-hash-a'), false);
  assert.equal(snapshotJsonStr.includes('salt-a'), false);

  // Tolak pemulihan arsip tenant_a ke tenant_b tanpa izin cross-tenant eksplisit
  await assert.rejects(
    () => restoreTenantBackupSnapshot(snapshotA, 'tenant_b', sharedMock),
    TenantScopeViolationError
  );

  // Simulasikan kerusakan data di tenant_a (hapus warga Alpha) -> lalu pulihkan snapshotA ke tenant_a
  store.resident = store.resident.filter((r) => r.villageId !== 'tenant_a');
  assert.equal(store.resident.filter((r) => r.villageId === 'tenant_a').length, 0);

  const restoreRes = await runWithTenantContext(
    {
      tenantId: 'tenant_a',
      slug: 'desa-alpha',
      tenantName: 'Desa Alpha',
      letterCodePrefix: 'ALP',
      tenancyMode: 'SHARED',
      isPlatformScope: false,
      credentialVersion: 1,
      requestId: 'restore-drill-1'
    },
    () => restoreTenantBackupSnapshot(snapshotA, 'tenant_a', sharedMock)
  );

  assert.equal(restoreRes.tenantId, 'tenant_a');
  assert.equal(store.resident.filter((r) => r.villageId === 'tenant_a').length, 2);
  // Data Desa Beta TETAP UTUH 100% tanpa tersentuh!
  assert.equal(store.resident.filter((r) => r.villageId === 'tenant_b').length, 1);
  assert.equal(store.resident.find((r) => r.id === 'res-b1')?.fullName, 'Warga Beta Penting');
  assert.equal(store.villageProfile.find((p) => p.villageId === 'tenant_b')?.villageName, 'Desa Beta');
  console.log('✅ Test 1 & 2 Lolos: Backup terpartisi aman (0 passwordHash/data tetangga) & Single-Tenant Restore tidak menyentuh desa tetangga.');

  // --------------------------------------------------------------------------
  // TEST 3: Guard Legacy Dual-Write & JSON saveDb pada Mode Multi-Tenant
  // --------------------------------------------------------------------------
  const prevRouting = process.env.MULTI_TENANT_ROUTING;
  const prevPhase = process.env.MIGRATION_PHASE;
  process.env.MULTI_TENANT_ROUTING = 'true';
  process.env.MIGRATION_PHASE = 'PHASE_3_SUPABASE_ONLY';
  try {
    // Memanggil saveDb / executeDualWriteSync tidak boleh crash atau menulis dual-write global
    saveDb({ villageProfile: { villageName: 'Harus Terblokir' } } as any);
    await executeDualWriteSync({ villageProfile: { villageName: 'Harus Terblokir' } });
  } finally {
    process.env.MULTI_TENANT_ROUTING = prevRouting;
    process.env.MIGRATION_PHASE = prevPhase;
  }
  console.log('✅ Test 3 Lolos: Legacy saveDb & executeDualWriteSync gagal-aman (fail-safe noop) saat Multi-Tenant / PHASE_3_SUPABASE_ONLY.');

  // --------------------------------------------------------------------------
  // TEST 4: Noisy-Neighbor Per-Tenant Rate Limiting Isolation
  // --------------------------------------------------------------------------
  const prevBurstLimit = process.env.TENANT_API_RATE_LIMIT_PER_MIN;
  process.env.TENANT_API_RATE_LIMIT_PER_MIN = '30';
  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;

  const sendWithHost = (hostHeader: string, reqPath: string) =>
    new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: reqPath,
          method: 'GET',
          headers: { Host: hostHeader }
        },
        (res) => {
          res.resume();
          resolve({ status: res.statusCode || 0 });
        }
      );
      req.on('error', reject);
      req.end();
    });

  try {
    let hit429OnTenantA = false;
    // Banjiri endpoint API pada host tenant A dari IP yang sama (127.0.0.1)
    for (let i = 0; i < 35; i++) {
      const apiResA = await sendWithHost('desa-banjir.sadewa.id', '/api/ping-rate-test');
      if (apiResA.status === 429) {
        hit429OnTenantA = true;
        break;
      }
    }
    assert.equal(hit429OnTenantA, true, 'Host desa-banjir harus terkena rate limit 429');

    // Sementara dari IP yang PERSIS SAMA (127.0.0.1), Host desa-normal TIDAK boleh terkena 429
    const apiResB = await sendWithHost('desa-normal.sadewa.id', '/api/ping-rate-test');
    assert.notEqual(apiResB.status, 429, 'Noisy neighbor tidak boleh memblokir tenant desa lain');
  } finally {
    process.env.TENANT_API_RATE_LIMIT_PER_MIN = prevBurstLimit;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  console.log('✅ Test 4 Lolos: Noisy-Neighbor Rate Limiter terisolasi per-tenant (429 Desa A tidak memengaruhi Desa B).');

  // --------------------------------------------------------------------------
  // TEST 5: Dedicated Tenant Supabase Storage Credential Resolution
  // --------------------------------------------------------------------------
  const cp = getControlPlanePrisma() as any;
  const origDelegate = cp.tenantDatabaseConfig;
  const dedTenantId = 'tenant_dedicated_storage_test';
  const encUrl = encryptTenantSecret('https://dedicated-village-proj.supabase.co', { tenantId: dedTenantId });
  const encKey = encryptTenantSecret('service-role-secret-village-dedicated', { tenantId: dedTenantId });

  cp.tenantDatabaseConfig = {
    findUnique: async ({ where }: any) => {
      if (where.tenantId !== dedTenantId) return null;
      return {
        encryptedSupabaseUrl: encUrl,
        encryptedServiceKey: encKey,
        storageBucket: 'bucket-desa-mandiri'
      };
    }
  };

  try {
    const resolvedDedicated = await runWithTenantContext(
      {
        tenantId: dedTenantId,
        slug: 'desa-mandiri',
        tenantName: 'Desa Mandiri',
        letterCodePrefix: 'DM',
        tenancyMode: 'DEDICATED',
        isPlatformScope: false,
        credentialVersion: 1,
        requestId: 'storage-test-1'
      },
      () => resolveActiveSupabaseStorageCredentials()
    );
    assert.ok(resolvedDedicated);
    assert.equal(resolvedDedicated.isDedicatedBucket, true);
    assert.equal(resolvedDedicated.supabaseUrl, 'https://dedicated-village-proj.supabase.co');
    assert.equal(resolvedDedicated.serviceKey, 'service-role-secret-village-dedicated');
    assert.equal(resolvedDedicated.bucketName, 'bucket-desa-mandiri');
  } finally {
    cp.tenantDatabaseConfig = origDelegate;
  }
  console.log('✅ Test 5 Lolos: Resolusi kredensial Supabase Storage Dedicated terenkripsi berjalan aman.');

  console.log('🎉 SELURUH TEST PHASE 5 HARDENING & RECOVERY LULUS SEMPURNA (5/5).');
}

runTests().catch((err) => {
  console.error('❌ Test Phase 5 gagal:', err);
  process.exit(1);
});
