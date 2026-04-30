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
const websiteDiscovery_1 = require("../src/websiteDiscovery");
function testPhase2() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🧪 Testing Phase 2: Website Discovery with 3 companies`);
        try {
            const discoveryService = new websiteDiscovery_1.WebsiteDiscoveryService();
            const inputCsvPath = './test_3_companies.csv';
            console.log(`📂 Input file: ${inputCsvPath}`);
            console.log(`⚙️  Starting website discovery...`);
            const result = yield discoveryService.runDiscoveryPhase(inputCsvPath);
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
        }
        catch (error) {
            console.error(`❌ Test failed:`, error);
            throw error;
        }
    });
}
// Run the test
testPhase2().catch(console.error);
