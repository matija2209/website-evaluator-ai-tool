import { CsvProcessor } from '../src/csvProcessor';
import { RunManager } from '../src/runManager';


async function testInfrastructure() {
  console.log(`🧪 Testing Infrastructure: CSV Processing & Run Management`);
  
  try {
    // Test 1: CSV Reading
    console.log(`\n📖 Test 1: Reading CSV file`);
    const inputCsvPath = './test_3_companies.csv';
    const rawCompanies = await CsvProcessor.readCompaniesFromCsv(inputCsvPath);
    console.log(`   ✅ Successfully read ${rawCompanies.length} companies`);
    
    rawCompanies.forEach((company, i) => {
      console.log(`   ${i + 1}. ${company.title} (${company.city})`);
    });
    
    // Test 2: Company Processing
    console.log(`\n🔄 Test 2: Company Processing`);
    const processedCompanies = rawCompanies.map(company => 
      CsvProcessor.prepareCompanyForProcessing(company)
    );
    console.log(`   ✅ Successfully processed ${processedCompanies.length} companies`);
    
    processedCompanies.forEach((company, i) => {
      console.log(`   ${i + 1}. ${company.title}`);
      console.log(`      Cleaned name: "${company.cleanedName}"`);
      console.log(`      City: ${company.city}`);
      console.log(`      Status: ${company.searchStatus}`);
      console.log(``);
    });
    
    // Test 3: Run Manager
    console.log(`\n📁 Test 3: Run Manager`);
    const runInfo = await RunManager.initializeRun(inputCsvPath);
    console.log(`   ✅ Successfully created run:`);
    console.log(`      Run ID: ${runInfo.runId}`);
    console.log(`      Run Dir: ${runInfo.runDir}`);
    
    // Test 4: Metadata
    console.log(`\n💾 Test 4: Metadata Management`);
    const metadata = {
      runId: runInfo.runId,
      startTime: new Date().toISOString(),
      inputFile: inputCsvPath,
      totalCompanies: processedCompanies.length,
      currentPhase: 'DISCOVERY' as const,
      companiesProcessed: 0,
      companiesWithWebsites: 0,
      companiesWithScreenshots: 0,
      companiesAnalyzed: 0
    };
    
    await RunManager.saveRunMetadata(runInfo.runDir, metadata);
    console.log(`   ✅ Successfully saved metadata`);
    
    const loadedMetadata = await RunManager.loadRunMetadata(runInfo.runDir);
    if (loadedMetadata) {
      console.log(`   ✅ Successfully loaded metadata:`);
      console.log(`      Phase: ${loadedMetadata.currentPhase}`);
      console.log(`      Companies: ${loadedMetadata.totalCompanies}`);
    } else {
      throw new Error('Failed to load metadata');
    }
    
    // Test 5: Progress Files
    console.log(`\n📊 Test 5: Progress File Handling`);
    await CsvProcessor.writeWebsiteDiscoveryProgress(runInfo.runDir, processedCompanies);
    console.log(`   ✅ Successfully wrote progress file`);
    
    const loadedProgress = await CsvProcessor.readWebsiteDiscoveryProgress(runInfo.runDir);
    console.log(`   ✅ Successfully read progress file: ${loadedProgress.length} companies`);
    
    console.log(`\n🎉 All infrastructure tests passed!`);
    console.log(`📁 Test run created at: ${runInfo.runDir}`);
    console.log(`\n✨ Ready to test Phase 2 with API keys!`);
    
  } catch (error) {
    console.error(`❌ Infrastructure test failed:`, error);
    throw error;
  }
}

// Run the test
testInfrastructure().catch(console.error); 