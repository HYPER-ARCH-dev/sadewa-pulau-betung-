import dotenv from 'dotenv';
import { getPrisma, probeDatabaseStatus } from '../server/db/prisma-helpers';
import { verifyMigrationConsistency, DEFAULT_TENANT_ID } from '../server/services/tenantMigration';

dotenv.config();

async function main() {
  console.log('====================================================================');
  console.log('  SADEWA PHASE 2: VERIFIKASI KONSISTENSI MIGRASI TENANT');
  console.log('====================================================================');

  const status = await probeDatabaseStatus(0);
  if (!status.reachable) {
    console.error(`❌ Database PostgreSQL tidak terjangkau [${status.errorCode}]: ${status.errorSummary}`);
    process.exit(1);
  }

  const prisma = getPrisma();
  try {
    const report = await verifyMigrationConsistency(prisma, DEFAULT_TENANT_ID);

    console.log(`\n🏛️ Tenant "${report.tenantId}" ACTIVE : ${report.tenantActive ? '✅ YA' : '❌ TIDAK'}`);
    console.log(`🌐 Primary Domain VERIFIED            : ${report.primaryDomainVerified ? '✅ YA' : '❌ TIDAK'}`);
    console.log(`🗂️ Total baris villageId IS NULL      : ${report.totalNullRows}`);
    console.log(`🔢 LetterCounter tidak sinkron        : ${report.letterCounterMismatches.length}`);
    console.log(`🔍 Arsip QR ServiceRequest terperiksa : ${report.historicalQrRecordsChecked}`);

    if (!report.passed) {
      console.error('\n❌ VERIFIKASI GAGAL! Temuan:');
      for (const err of report.errors) {
        console.error(`   - ${err}`);
      }
      process.exit(1);
    }

    console.log('\n✅ VERIFIKASI KONSISTENSI PHASE 2 LULUS 100%! Siap menuju Phase 3.');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('❌ Verifikasi konsistensi gagal:', err);
  process.exit(1);
});
