import { WebsiteDiscoveryService } from './src/websiteDiscovery';
import path from 'path';

async function testPhase2() {
  console.log(`🧪 Testing Phase 2: Website Discovery with 3 companies`);
  
  try {
    const discoveryService = new WebsiteDiscoveryService();
    const inputCsvPath = './test_3_companies.csv';
    
    console.log(`📂 Input file: ${inputCsvPath}`);
    console.log(`⚙️  Starting website discovery...`);
    
    const result = await discoveryService.runDiscoveryPhase(inputCsvPath);
    
    console.log(`\n🎉 Test completed!`);
    console.log(`📊 Results:`);
    console.log(`   Run ID: ${result.runId}`);
    console.log(`   Run Dir: ${result.runDir}`);
    console.log(`   Total companies: ${result.stats.total}`);
    console.log(`   Websites discovered: ${result.stats.discovered}`);
    console.log(`   Failed: ${result.stats.failed}`);
    console.log(`   Success rate: ${result.stats.successRate}%`);
    
    console.log(`\n📋 Company results:`);
    result.companies.forEach((company, i) => {
      console.log(`   ${i + 1}. ${company.title}`);
      console.log(`      Status: ${company.searchStatus}`);
      if (company.discoveredWebsite) {
        console.log(`      Website: ${company.discoveredWebsite}`);
      }
      if (company.searchError) {
        console.log(`      Error: ${company.searchError}`);
      }
      console.log(``);
    });
    
  } catch (error) {
    console.error(`❌ Test failed:`, error);
    throw error;
  }
}

// Run the test
testPhase2().catch(console.error); 