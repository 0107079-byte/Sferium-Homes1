import { runAllSyncTests } from './syncSuite.test';
import { runServerAuthorityTests } from './serverSync.test';
import { runRealPipelineIntegrationTests } from './integration/realSyncPipeline.test';

async function main() {
  const clientSuccess = await runAllSyncTests();
  const serverSuccess = await runServerAuthorityTests();
  
  console.log('\n[SUITE 11] Real Pipeline Integration Tests');
  const pipelineResults = await runRealPipelineIntegrationTests();
  let pipelinePassed = 0;
  for (const res of pipelineResults) {
    if (res.passed) {
      pipelinePassed++;
      console.log(`  ✅ PASS: ${res.name}`);
    } else {
      console.log(`  ❌ FAIL: ${res.name} (${res.details})`);
    }
  }
  console.log(`Real Pipeline Tests: ${pipelinePassed}/${pipelineResults.length} PASSED`);

  if (!clientSuccess || !serverSuccess || pipelinePassed !== pipelineResults.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
