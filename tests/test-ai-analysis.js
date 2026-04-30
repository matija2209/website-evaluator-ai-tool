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
const aiAnalysisService_1 = require("../src/aiAnalysisService");
const websiteAnalysisRunner_1 = require("../src/websiteAnalysisRunner");
function testIndividualAnalysis() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🧪 Testing Individual Website Analysis');
        console.log('=====================================\n');
        // Test with existing screenshot data from run 20250629_110643
        const testInput = {
            mobileScreenshotPath: 'runs/20250629_110643/screenshots/bioteh.si/mobile/section-1.jpeg',
            desktopScreenshotPath: 'runs/20250629_110643/screenshots/bioteh.si/desktop/section-1.jpeg',
            websiteUrl: 'https://www.bioteh.si/',
            companyActivity: 'Proizvodnja pesticidov in drugih agrokemičnih izdelkov',
            companyName: 'BIOTEH d.o.o.'
        };
        try {
            console.log(`Testing analysis for: ${testInput.companyName}`);
            console.log(`Website: ${testInput.websiteUrl}`);
            console.log(`Business: ${testInput.companyActivity}\n`);
            const startTime = Date.now();
            const result = yield (0, aiAnalysisService_1.analyzeWebsiteComplete)(testInput);
            const duration = Date.now() - startTime;
            console.log('📊 Analysis Results:');
            console.log('===================');
            console.log(`Status: ${result.analysisStatus}`);
            console.log(`Combined Score: ${result.combinedScore}/100`);
            console.log(`Sophistication Level: ${result.sophisticationLevel}`);
            console.log(`Opportunity Level: ${result.opportunityLevel}`);
            console.log(`Confidence: ${result.confidence}%`);
            console.log(`\nMobile Score: ${result.mobileScore.overall}/100`);
            console.log(`  - Visual Design: ${result.mobileScore.visualDesign}/40`);
            console.log(`  - Technical: ${result.mobileScore.technical}/30`);
            console.log(`  - Content: ${result.mobileScore.content}/20`);
            console.log(`  - UX: ${result.mobileScore.userExperience}/10`);
            console.log(`\nDesktop Score: ${result.desktopScore.overall}/100`);
            console.log(`  - Visual Design: ${result.desktopScore.visualDesign}/40`);
            console.log(`  - Technical: ${result.desktopScore.technical}/30`);
            console.log(`  - Content: ${result.desktopScore.content}/20`);
            console.log(`  - UX: ${result.desktopScore.userExperience}/10`);
            console.log(`\n🚨 Mobile Issues (${result.mobileIssues.length}):`);
            result.mobileIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
            console.log(`\n🚨 Desktop Issues (${result.desktopIssues.length}):`);
            result.desktopIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
            console.log(`\n⚡ Quick Wins (${result.quickWins.length}):`);
            result.quickWins.forEach((win, i) => console.log(`  ${i + 1}. ${win}`));
            console.log(`\n🏗️ Major Upgrades (${result.majorUpgrades.length}):`);
            result.majorUpgrades.forEach((upgrade, i) => console.log(`  ${i + 1}. ${upgrade}`));
            console.log(`\n💭 Reasoning: ${result.reasoning}`);
            console.log(`\n📈 Performance:`);
            console.log(`  Duration: ${duration}ms`);
            console.log(`  Mobile Tokens: ${result.tokensUsed.mobileAnalysis}`);
            console.log(`  Desktop Tokens: ${result.tokensUsed.desktopAnalysis}`);
            console.log(`  Total Tokens: ${result.tokensUsed.total}`);
            return true;
        }
        catch (error) {
            console.error('❌ Analysis failed:', error);
            return false;
        }
    });
}
function testVaresiAnalysis() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🧪 Testing Second Website Analysis');
        console.log('==================================\n');
        // Test with Varesi screenshot data
        const testInput = {
            mobileScreenshotPath: 'runs/20250629_110643/screenshots/varesi.si/mobile/section-1.jpeg',
            desktopScreenshotPath: 'runs/20250629_110643/screenshots/varesi.si/desktop/section-1.jpeg',
            websiteUrl: 'http://www.varesi.si/sl',
            companyActivity: 'Varnostno-reševalne storitve',
            companyName: 'VARESI d.o.o.'
        };
        try {
            console.log(`Testing analysis for: ${testInput.companyName}`);
            console.log(`Website: ${testInput.websiteUrl}`);
            console.log(`Business: ${testInput.companyActivity}\n`);
            const startTime = Date.now();
            const result = yield (0, aiAnalysisService_1.analyzeWebsiteComplete)(testInput);
            const duration = Date.now() - startTime;
            console.log('📊 Analysis Results:');
            console.log('===================');
            console.log(`Status: ${result.analysisStatus}`);
            console.log(`Combined Score: ${result.combinedScore}/100`);
            console.log(`Sophistication Level: ${result.sophisticationLevel}`);
            console.log(`Opportunity Level: ${result.opportunityLevel}`);
            console.log(`Confidence: ${result.confidence}%`);
            console.log(`\n📈 Performance:`);
            console.log(`  Duration: ${duration}ms`);
            console.log(`  Total Tokens: ${result.tokensUsed.total}`);
            return true;
        }
        catch (error) {
            console.error('❌ Analysis failed:', error);
            return false;
        }
    });
}
function testMissingScreenshots() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🧪 Testing Missing Screenshots Handling');
        console.log('=======================================\n');
        // Test with non-existent screenshots
        const testInput = {
            mobileScreenshotPath: 'runs/fake/screenshots/nonexistent.si/mobile/section-1.jpeg',
            desktopScreenshotPath: 'runs/fake/screenshots/nonexistent.si/desktop/section-1.jpeg',
            websiteUrl: 'https://nonexistent.si/',
            companyActivity: 'Test business',
            companyName: 'Test Company'
        };
        try {
            console.log(`Testing with missing screenshots...`);
            const result = yield (0, aiAnalysisService_1.analyzeWebsiteComplete)(testInput);
            console.log('❌ Expected failure but got result:', result);
            return false;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log('✅ Correctly handled missing screenshots:', errorMessage);
            return true;
        }
    });
}
function testFullRunIntegration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n🧪 Testing Full Run Integration');
        console.log('===============================\n');
        try {
            console.log('Testing with existing run ID: 20250629_110643');
            // This should process both bioteh.si and varesi.si
            yield (0, websiteAnalysisRunner_1.runWebsiteAnalysis)('20250629_110643');
            console.log('✅ Full run integration test completed successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Full run integration failed:', error);
            return false;
        }
    });
}
function runAllTests() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🚀 Starting AI Analysis Test Suite');
        console.log('===================================\n');
        const results = {
            individualAnalysis: false,
            varesiAnalysis: false,
            missingScreenshots: false,
            fullRunIntegration: false
        };
        // Test 1: Individual Analysis
        results.individualAnalysis = yield testIndividualAnalysis();
        // Wait between tests to respect rate limits
        console.log('\n⏳ Waiting 3 seconds before next test...\n');
        yield new Promise(resolve => setTimeout(resolve, 3000));
        // Test 2: Second Website Analysis  
        results.varesiAnalysis = yield testVaresiAnalysis();
        // Test 3: Missing Screenshots
        results.missingScreenshots = yield testMissingScreenshots();
        // Test 4: Full Run Integration (commented out for now - will process real data)
        // results.fullRunIntegration = await testFullRunIntegration();
        // Summary
        console.log('\n📋 Test Results Summary');
        console.log('=======================');
        console.log(`Individual Analysis: ${results.individualAnalysis ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Varesi Analysis: ${results.varesiAnalysis ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Missing Screenshots: ${results.missingScreenshots ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Full Run Integration: ${results.fullRunIntegration ? '✅ PASSED' : '⏭️ SKIPPED'}`);
        const passedTests = Object.values(results).filter(Boolean).length;
        const totalTests = Object.keys(results).length - 1; // Excluding skipped test
        console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
        if (passedTests === totalTests) {
            console.log('\n🎉 All tests passed! The AI analysis system is ready for production.');
        }
        else {
            console.log('\n🔧 Some tests failed. Please review the issues above.');
        }
    });
}
// Execute tests
runAllTests().catch(console.error);
