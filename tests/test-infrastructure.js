"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const csvProcessor_1 = require("../src/csvProcessor");
const runManager_1 = require("../src/runManager");
function testInfrastructure() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🧪 Testing Infrastructure: CSV Processing & Run Management`);
        try {
            // Test 1: CSV Reading
            console.log(`\n📖 Test 1: Reading CSV file`);
            const inputCsvPath = './test_3_companies.csv';
            const rawCompanies = yield csvProcessor_1.CsvProcessor.readCompaniesFromCsv(inputCsvPath);
            console.log(`   ✅ Successfully read ${rawCompanies.length} companies`);
            rawCompanies.forEach((company, i) => {
                console.log(`   ${i + 1}. ${company.title} (${company.city})`);
            });
            // Test 2: Company Processing
            console.log(`\n🔄 Test 2: Company Processing`);
            const processedCompanies = rawCompanies.map(company => csvProcessor_1.CsvProcessor.prepareCompanyForProcessing(company));
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
            const runInfo = yield runManager_1.RunManager.initializeRun(inputCsvPath);
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
                currentPhase: 'DISCOVERY',
                companiesProcessed: 0,
                companiesWithWebsites: 0,
                companiesWithScreenshots: 0,
                companiesAnalyzed: 0
            };
            yield runManager_1.RunManager.saveRunMetadata(runInfo.runDir, metadata);
            console.log(`   ✅ Successfully saved metadata`);
            const loadedMetadata = yield runManager_1.RunManager.loadRunMetadata(runInfo.runDir);
            if (loadedMetadata) {
                console.log(`   ✅ Successfully loaded metadata:`);
                console.log(`      Phase: ${loadedMetadata.currentPhase}`);
                console.log(`      Companies: ${loadedMetadata.totalCompanies}`);
            }
            else {
                throw new Error('Failed to load metadata');
            }
            // Test 5: Progress Files
            console.log(`\n📊 Test 5: Progress File Handling`);
            yield csvProcessor_1.CsvProcessor.writeWebsiteDiscoveryProgress(runInfo.runDir, processedCompanies);
            console.log(`   ✅ Successfully wrote progress file`);
            const loadedProgress = yield csvProcessor_1.CsvProcessor.readWebsiteDiscoveryProgress(runInfo.runDir);
            console.log(`   ✅ Successfully read progress file: ${loadedProgress.length} companies`);
            console.log(`\n🎉 All infrastructure tests passed!`);
            console.log(`📁 Test run created at: ${runInfo.runDir}`);
            console.log(`\n✨ Ready to test Phase 2 with API keys!`);
        }
        catch (error) {
            console.error(`❌ Infrastructure test failed:`, error);
            throw error;
        }
    });
}
// Run the test
testInfrastructure().catch(console.error);
