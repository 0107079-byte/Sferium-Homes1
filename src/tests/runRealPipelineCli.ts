import { runRealPipelineIntegrationTests } from './integration/realSyncPipeline.test';

async function main() {
  console.log('================================================================');
  console.log('🧪 SFERIUM-HOMES: REAL PRODUCTION SYNC PIPELINE INTEGRATION TESTS');
  console.log('================================================================');

  try {
    const results = await runRealPipelineIntegrationTests();
    let passedCount = 0;
    let failedCount = 0;

    for (const res of results) {
      if (res.passed) {
        passedCount++;
        console.log(`✅ [PASS] ${res.name}`);
      } else {
        failedCount++;
        console.log(`❌ [FAIL] ${res.name}`);
      }
      console.log(`   └─ Details: ${res.details}`);
    }

    console.log('\n----------------------------------------------------------------');
    console.log(`Summary: ${passedCount} PASSED / ${failedCount} FAILED (Total: ${results.length})`);
    console.log('----------------------------------------------------------------');

    if (failedCount > 0) {
      process.exit(1);
    } else {
      console.log('🎉 ALL REAL PRODUCTION SYNC INTEGRATION TESTS PASSED PERFECTLY.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test runner failure:', err);
    process.exit(1);
  }
}

main();
