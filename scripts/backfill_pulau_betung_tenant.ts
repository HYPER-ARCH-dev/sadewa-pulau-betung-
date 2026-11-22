import dotenv from 'dotenv';
import { getPrisma, probeDatabaseStatus } from '../server/db/prisma-helpers';
import {
  backfillDefaultPulauBetungTenant,
  DEFAULT_TENANT_DOMAIN,
  DEFAULT_TENANT_ID
} from '../server/services/tenantMigration';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const customDomainArg = args.find((a) => a.startsWith('--custom-domain='))?.split('=')[1] || process.env.CUSTOM_PRIMARY_DOMAIN || null;

  console.log('====================================================================');
  console.log(`  SADEWA PHASE 2: BACKFILL TENANT AWAL (${DEFAULT_TENANT_ID})`);
  console.log(`  Mode: ${dryRun ? 'DRY-RUN (Tanpa mengubah database)' : 'EKSEKUSI LANGSUNG'}`);
  console.log('====================================================================');

  const status = await probeDatabaseStatus(0);
  if (!status.reachable) {
    console.error(`❌ Database PostgreSQL tidak terjangkau [${status.errorCode}]: ${status.errorSummary}`);
    process.exit(1);
  }

  const prisma = getPrisma();
  try {
    const report = await backfillDefaultPulauBetungTenant(prisma, {
      dryRun,
      customDomain: customDomainArg,
      primaryDomain: DEFAULT_TENANT_DOMAIN
    });

    console.log('\n📊 Ringkasan Backfill per Tabel (27 Model):');
    for (const [model, count] of Object.entries(report.tableUpdates)) {
      console.log(`   - ${model.padEnd(24, ' ')}: ${count} baris ${dryRun ? 'akan diisi' : 'diperbarui'}`);
    }

    console.log(`\n📌 Total baris ${dryRun ? 'kandidat' : 'terbackfill'}: ${report.totalRowsAffected}`);
    console.log(`📌 LetterSequenceCounter dihitung: ${report.letterCountersComputed.length} periode`);
    if (!dryRun) {
      console.log(`📌 LetterSequenceCounter tersimpan/diperbarui: ${report.letterCountersUpserted}`);
    }

    console.log('\n✅ Backfill Phase 2 selesai. Lanjutkan dengan `npx tsx scripts/verify_migration_consistency.ts`.');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error('❌ Backfill Phase 2 gagal:', err);
  process.exit(1);
});
