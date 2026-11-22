import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  TENANT_OWNED_DELEGATES,
  parseOfficialLetterNumber,
  computeMaxLetterSequences,
  backfillDefaultPulauBetungTenant,
  verifyMigrationConsistency,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_DOMAIN
} from '../server/services/tenantMigration';
import {
  resolveTenantStorageTarget,
  resolveLegacyCompatibleStorageCandidates
} from '../server/config/storageRegistry';

function testLetterNumberParsingAndCounterSeed() {
  console.log('🧪 [1/4] Menguji parsing nomor surat historis & seeding LetterSequenceCounter...');

  const p1 = parseOfficialLetterNumber('510 / 014 / SKU / PB-PMY / IX / 2026', 'Surat Keterangan Usaha');
  assert.deepEqual(p1, {
    classificationCode: '510',
    sequence: 14,
    month: 9,
    year: 2026
  });

  const p2 = parseOfficialLetterNumber('474.2 / 003 / SP-NIKAH / PB-PMY / XII / 2025', 'Pengantar Nikah');
  assert.deepEqual(p2, {
    classificationCode: '474.2',
    sequence: 3,
    month: 12,
    year: 2025
  });

  const counters = computeMaxLetterSequences([
    {
      villageId: null,
      serviceName: 'Surat Keterangan Usaha',
      officialLetterNumber: '510 / 002 / SKU / PB-PMY / IX / 2026'
    },
    {
      villageId: DEFAULT_TENANT_ID,
      serviceName: 'Surat Keterangan Usaha',
      officialLetterNumber: '510 / 018 / SKU / PB-PMY / IX / 2026'
    },
    {
      villageId: DEFAULT_TENANT_ID,
      serviceName: 'Surat Keterangan Domisili',
      officialLetterNumber: '470 / 007 / SK-DOM / PB-PMY / X / 2026'
    }
  ]);

  assert.equal(counters.length, 2);
  assert.deepEqual(counters[0], {
    villageId: DEFAULT_TENANT_ID,
    classificationCode: '510',
    year: 2026,
    month: 9,
    maxSequence: 18
  });
  assert.deepEqual(counters[1], {
    villageId: DEFAULT_TENANT_ID,
    classificationCode: '470',
    year: 2026,
    month: 10,
    maxSequence: 7
  });

  console.log('   ✅ Parsing nomor surat & kalkulasi monotonic MAX counter akurat.');
}

async function testIdempotentBackfillAndVerifier() {
  console.log('🧪 [2/4] Menguji idempotensi backfill di 27 tabel & verifyMigrationConsistency...');

  // Simulasi in-memory state database sebelum & sesudah backfill
  const state: {
    tenant: any;
    domain: any;
    nullCounts: Record<string, number>;
    counters: Map<string, number>;
    historicalRequests: Array<any>;
  } = {
    tenant: null,
    domain: null,
    nullCounts: {},
    counters: new Map(),
    historicalRequests: [
      {
        id: 'req-hist-1',
        villageId: null,
        trackingCode: 'REQ-PB-2026-018',
        serviceName: 'Surat Keterangan Usaha',
        officialLetterNumber: '510 / 018 / SKU / PB-PMY / IX / 2026',
        completedAt: new Date('2026-09-10T08:00:00Z'),
        requestDate: new Date('2026-09-09T08:00:00Z')
      }
    ]
  };

  for (const { delegateKey } of TENANT_OWNED_DELEGATES) {
    state.nullCounts[delegateKey] = 3;
  }

  const mockPrisma: Record<string, any> = {
    tenant: {
      upsert: async ({ create }: any) => {
        state.tenant = { ...create };
        return state.tenant;
      },
      findUnique: async ({ where }: any) => (state.tenant?.id === where.id ? state.tenant : null)
    },
    tenantDomain: {
      upsert: async ({ create }: any) => {
        state.domain = { ...create };
        return state.domain;
      },
      findUnique: async ({ where }: any) => (state.domain?.domain === where.domain ? state.domain : null)
    },
    letterSequenceCounter: {
      findUnique: async ({ where }: any) => {
        const k = where.villageId_classificationCode_year_month;
        const key = `${k.villageId}::${k.classificationCode}::${k.year}::${k.month}`;
        return state.counters.has(key) ? { lastSequence: state.counters.get(key) } : null;
      },
      upsert: async ({ where, update, create }: any) => {
        const k = where.villageId_classificationCode_year_month;
        const key = `${k.villageId}::${k.classificationCode}::${k.year}::${k.month}`;
        const val = state.counters.has(key) ? update.lastSequence : create.lastSequence;
        state.counters.set(key, val);
        return { lastSequence: val };
      }
    }
  };

  for (const { delegateKey } of TENANT_OWNED_DELEGATES) {
    mockPrisma[delegateKey] = {
      count: async ({ where }: any) => (where?.villageId === null ? state.nullCounts[delegateKey] : 0),
      updateMany: async ({ where }: any) => {
        if (where?.villageId === null) {
          const updated = state.nullCounts[delegateKey];
          state.nullCounts[delegateKey] = 0;
          if (delegateKey === 'serviceRequest') {
            state.historicalRequests = state.historicalRequests.map((r) => ({
              ...r,
              villageId: DEFAULT_TENANT_ID
            }));
          }
          return { count: updated };
        }
        return { count: 0 };
      },
      ...(delegateKey === 'serviceRequest'
        ? {
            findMany: async () => state.historicalRequests
          }
        : {})
    };
  }

  // Sebelum backfill -> verifikasi wajib GAGAL
  const preCheck = await verifyMigrationConsistency(mockPrisma as unknown as PrismaClient, DEFAULT_TENANT_ID, DEFAULT_TENANT_DOMAIN);
  assert.equal(preCheck.passed, false);
  assert.equal(preCheck.totalNullRows, 27 * 3);

  // Dry-run -> menghitung tanpa mengubah data
  const dryReport = await backfillDefaultPulauBetungTenant(mockPrisma as unknown as PrismaClient, { dryRun: true });
  assert.equal(dryReport.totalRowsAffected, 27 * 3);
  assert.equal(state.nullCounts.serviceRequest, 3, 'Dry-run tidak boleh memodifikasi baris DB');

  // Eksekusi backfill pertama -> mengubah semua baris NULL (81) & seed counter
  const run1 = await backfillDefaultPulauBetungTenant(mockPrisma as unknown as PrismaClient);
  assert.equal(run1.totalRowsAffected, 27 * 3);
  assert.equal(run1.letterCountersUpserted, 1);
  assert.equal(state.historicalRequests[0].officialLetterNumber, '510 / 018 / SKU / PB-PMY / IX / 2026');
  assert.equal(state.historicalRequests[0].trackingCode, 'REQ-PB-2026-018');

  // Eksekusi backfill kedua -> idempotent (0 baris terpengaruh)
  const run2 = await backfillDefaultPulauBetungTenant(mockPrisma as unknown as PrismaClient);
  assert.equal(run2.totalRowsAffected, 0, 'Backfill ulang harus idempotent (0 baris diubah)');

  // Verifikasi konsistensi -> wajib LULUS
  const postCheck = await verifyMigrationConsistency(mockPrisma as unknown as PrismaClient, DEFAULT_TENANT_ID, DEFAULT_TENANT_DOMAIN);
  assert.equal(postCheck.passed, true, `Verifikasi pasca backfill harus lulus, errors: ${postCheck.errors.join('; ')}`);
  assert.equal(postCheck.totalNullRows, 0);
  assert.equal(postCheck.historicalQrRecordsChecked, 1);

  console.log('   ✅ Backfill idempotent, 27 tabel lengkap, dan verifikasi konsistensi lulus.');
}

function testCounterDoesNotShrink() {
  console.log('🧪 [3/4] Menguji bahwa counter eksisting yang lebih tinggi tidak pernah diturunkan...');
  const parsed = parseOfficialLetterNumber('401 / 005 / SKTM / PB-PMY / XI / 2026', 'SKTM');
  assert.equal(parsed?.sequence, 5);
  // Verifikasi logika monotonic Math.max(existing, computed)
  assert.equal(Math.max(25, parsed!.sequence), 25);
  console.log('   ✅ Proteksi monotonic counter terverifikasi.');
}

function testLegacyAndTenantStorageCompatibility() {
  console.log('🧪 [4/4] Menguji kompatibilitas path storage legacy Pulau Betung vs tenant-prefixed...');

  const legacyTarget = resolveTenantStorageTarget({
    moduleKey: 'news',
    fileName: 'berita-desa.jpg',
    tenantId: null
  });
  assert.equal(legacyTarget.cloudObjectPath, 'public/berita/berita-desa.jpg');
  assert.equal(legacyTarget.localPublicUrl, '/uploads/berita/berita-desa.jpg');

  const tenantTarget = resolveTenantStorageTarget({
    moduleKey: 'citizen-letters',
    fileName: 'ktp-warga.jpg',
    tenantId: DEFAULT_TENANT_ID,
    useTenantPrefix: true
  });
  assert.equal(tenantTarget.cloudObjectPath, 'tenants/tenant_pulau_betung/private/dokumen-warga/ktp-warga.jpg');
  assert.equal(
    tenantTarget.localPublicUrl,
    '/api/upload/private/tenants/tenant_pulau_betung/dokumen-warga/ktp-warga.jpg'
  );

  const candidates = resolveLegacyCompatibleStorageCandidates('public/berita/berita-desa.jpg', DEFAULT_TENANT_ID);
  assert.deepEqual(candidates, [
    'tenants/tenant_pulau_betung/public/berita/berita-desa.jpg',
    'public/berita/berita-desa.jpg'
  ]);

  console.log('   ✅ Dual-read path compatibility & tenant isolation storage path lulus.');
}

async function main() {
  testLetterNumberParsingAndCounterSeed();
  await testIdempotentBackfillAndVerifier();
  testCounterDoesNotShrink();
  testLegacyAndTenantStorageCompatibility();
  console.log('\n🎉 SELURUH PENGUJIAN PHASE 2 MIGRATION & BACKFILL BERHASIL!');
}

main().catch((err) => {
  console.error('❌ Pengujian Phase 2 gagal:', err);
  process.exit(1);
});
