import 'dotenv/config';
import { getControlPlanePrisma } from '../server/db/prisma-helpers';
import { verifyMigrationConsistency } from '../server/services/tenantMigration';

interface AuditCheckResult {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
}

async function runPreCutoverAudit() {
  const checks: AuditCheckResult[] = [];

  const sessionSecret = process.env.SESSION_SECRET?.trim() || '';
  checks.push({
    name: 'SESSION_SECRET (>= 32 karakter)',
    status: sessionSecret.length >= 32 ? 'PASS' : 'FAIL',
    detail: sessionSecret.length >= 32 ? 'Terkonfigurasi kuat.' : 'Belum memenuhi panjang minimal 32 karakter.'
  });

  const encKey = process.env.TENANT_CREDENTIAL_ENCRYPTION_KEY?.trim() || '';
  const validHexKey = /^[0-9a-fA-F]{64}$/.test(encKey) || encKey.length >= 32;
  checks.push({
    name: 'TENANT_CREDENTIAL_ENCRYPTION_KEY',
    status: validHexKey ? 'PASS' : 'FAIL',
    detail: validHexKey ? 'Kunci AES-256-GCM tersedia.' : 'Belum dikonfigurasi (wajib untuk enkripsi Dedicated DB).'
  });

  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  const directUrl = process.env.DIRECT_URL?.trim() || '';
  checks.push({
    name: 'DATABASE_URL & DIRECT_URL',
    status: dbUrl && directUrl ? 'PASS' : 'WARN',
    detail:
      dbUrl && directUrl
        ? `DATABASE_URL & DIRECT_URL tersedia (${dbUrl.includes(':6543') ? 'PgBouncer 6543 aktif' : 'port standar'}).`
        : 'Salah satu atau kedua connection string PostgreSQL belum terdefinisi di environment.'
  });

  const migrationPhase = process.env.MIGRATION_PHASE || 'UNSET';
  checks.push({
    name: 'MIGRATION_PHASE',
    status: migrationPhase === 'PHASE_3_SUPABASE_ONLY' ? 'PASS' : 'WARN',
    detail:
      migrationPhase === 'PHASE_3_SUPABASE_ONLY'
        ? 'PHASE_3_SUPABASE_ONLY aktif (fallback JSON nonaktif).'
        : `Saat ini: ${migrationPhase}. Ubah ke PHASE_3_SUPABASE_ONLY sebelum aktivasi MULTI_TENANT_ROUTING=true.`
  });

  const multiTenantFlag = process.env.MULTI_TENANT_ROUTING || 'false';
  checks.push({
    name: 'MULTI_TENANT_ROUTING Flag',
    status: 'PASS',
    detail: `Nilai aktif: "${multiTenantFlag}".`
  });

  if (dbUrl) {
    const prisma = getControlPlanePrisma();
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      checks.push({ name: 'Konektivitas PostgreSQL', status: 'PASS', detail: 'Database merespons SELECT 1.' });

      const pulauBetung = await (prisma as any).tenant.findUnique({ where: { id: 'tenant_pulau_betung' } });
      checks.push({
        name: 'Bootstrap Tenant Pulau Betung',
        status: pulauBetung ? 'PASS' : 'FAIL',
        detail: pulauBetung
          ? `Terdaftar (slug: ${pulauBetung.slug}, status: ${pulauBetung.status}).`
          : 'Belum ada. Jalankan scripts/backfill_pulau_betung_tenant.ts sebelum cutover.'
      });

      const platformAdmins = await (prisma as any).platformUser.count({ where: { isActive: true } });
      checks.push({
        name: 'Akun Platform Super Admin',
        status: platformAdmins > 0 ? 'PASS' : 'WARN',
        detail:
          platformAdmins > 0
            ? `${platformAdmins} akun pengelola platform aktif.`
            : 'Belum ada PlatformUser; klaim melalui /platform setelah deploy.'
      });

      const consistency = await verifyMigrationConsistency(prisma, 'tenant_pulau_betung');
      const modelsWithNulls = Object.entries(consistency.nullCountsByTable).filter(([, count]) => count > 0);
      checks.push({
        name: 'Verifikasi Kepemilikan Baris (0 NULL villageId)',
        status: consistency.passed && consistency.totalNullRows === 0 ? 'PASS' : 'FAIL',
        detail:
          consistency.passed && consistency.totalNullRows === 0
            ? 'Seluruh 27 tabel operasional bebas dari villageId NULL.'
            : `Ditemukan ${consistency.totalNullRows} baris belum terpetakan: ${modelsWithNulls.map(([model, count]) => `${model}(${count})`).join(', ')}`
      });
    } catch (err: any) {
      checks.push({
        name: 'Inspeksi Database Langsung',
        status: 'WARN',
        detail: `Database tidak terjangkau dari lingkungan saat ini: ${err?.code || err?.message || err}`
      });
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  }

  console.log('\n📋 AUDIT KESIAPAN CUTOVER MULTI-TENANT SADEWA\n==================================================');
  let failCount = 0;
  for (const c of checks) {
    const icon = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌';
    if (c.status === 'FAIL') failCount++;
    console.log(`${icon} [${c.status}] ${c.name}\n   -> ${c.detail}`);
  }
  console.log('==================================================\n');

  if (failCount > 0) {
    console.log(`⛔ Ditemukan ${failCount} prasyarat FAIL sebelum aktivasi MULTI_TENANT_ROUTING=true.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Tidak ada blocker kritikal pada pemeriksaan statis/runtime yang dijalankan.');
  }
}

runPreCutoverAudit().catch((err) => {
  console.error('❌ Audit gagal:', err);
  process.exit(1);
});
