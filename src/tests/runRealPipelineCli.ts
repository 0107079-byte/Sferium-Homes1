import { runRealPipelineIntegrationTests } from './integration/realSyncPipeline.test';
import { runRoomJoinAuditIntegrationTests } from './integration/roomJoinDatabaseAudit.test';

async function main() {
  console.log('================================================================');
  console.log('🧪 SFERIUM-HOMES: REAL PRODUCTION PIPELINE INTEGRATION TESTS');
  console.log('================================================================');

  try {
    console.log('\n--- SUITE 1: Video Sync, Latency & Revision Tests ---');
    const syncResults = await runRealPipelineIntegrationTests();
    for (const res of syncResults) {
      if (res.passed) {
        console.log(`✅ [PASS] ${res.name}`);
      } else {
        console.log(`❌ [FAIL] ${res.name}`);
      }
      console.log(`   └─ Details: ${res.details}`);
    }

    console.log('\n--- SUITE 2: Room Join / PostgreSQL Source of Truth Invariant Tests ---');
    const joinAuditResults = await runRoomJoinAuditIntegrationTests();
    for (const res of joinAuditResults) {
      if (res.passed) {
        console.log(`✅ [PASS] ${res.name}`);
      } else {
        console.log(`❌ [FAIL] ${res.name}`);
      }
      console.log(`   └─ Details: ${res.details}`);
    }

    const allResults = [...syncResults, ...joinAuditResults];
    const passedCount = allResults.filter((r) => r.passed).length;
    const failedCount = allResults.filter((r) => !r.passed).length;

    console.log('\n================================================================');
    console.log(`Summary: ${passedCount} PASSED / ${failedCount} FAILED (Total: ${allResults.length})`);
    console.log('================================================================');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL PRODUCTION SYNC & ROOM JOIN AUDIT TESTS PASSED.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test runner failure:', err);
    process.exit(1);
  }
}

main();
