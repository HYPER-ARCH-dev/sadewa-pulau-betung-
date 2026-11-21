import dotenv from 'dotenv';
import minimist from 'minimist';
import { verifyDatabaseConnectionDiagnostic } from '../server/db/connection-diagnostic';

dotenv.config();

async function main() {
  const args = minimist(process.argv.slice(2));
  const expectedProjectRef =
    typeof args.expected === 'string'
      ? args.expected
      : typeof args.ref === 'string'
      ? args.ref
      : undefined;

  const report = await verifyDatabaseConnectionDiagnostic({
    expectedProjectRef,
    silent: false,
    checkLiveConnection: true
  });

  if (report.overallStatus !== 'HEALTHY') {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('❌ [DIAG-FATAL]:', err?.message || err);
  process.exit(1);
});
