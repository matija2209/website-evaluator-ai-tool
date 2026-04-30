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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const sitemapScraper_1 = require("../src/sitemapScraper");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
function testSitemaps() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🧪 Testing Sitemap Scraper Service');
        const testUrls = [
            'https://www.kristaldoo.si',
            'https://www.bioshop.si'
        ];
        const browser = yield playwright_1.chromium.launch({ headless: true });
        const service = new sitemapScraper_1.SitemapScraperService(browser);
        const testOutputDir = path_1.default.join('output', 'sitemaps_test');
        yield fs_extra_1.default.ensureDir(testOutputDir);
        try {
            for (const url of testUrls) {
                console.log(`\n--- Testing ${url} ---`);
                const result = yield service.scrapeDomain(url, testOutputDir);
                console.log(`📊 Result for ${result.domain}:`);
                console.log(`   URLs found: ${result.urlsFound}`);
                console.log(`   Robots.txt found: ${result.robotsFound}`);
                if (result.error) {
                    console.log(`   Error: ${result.error}`);
                }
                // Verification
                const domainDir = path_1.default.join(testOutputDir, result.domain);
                const robotsExists = yield fs_extra_1.default.pathExists(path_1.default.join(domainDir, 'robots.txt'));
                const sitemapCsvExists = yield fs_extra_1.default.pathExists(path_1.default.join(domainDir, 'sitemap.csv'));
                if (robotsExists)
                    console.log('✅ robots.txt saved correctly');
                if (sitemapCsvExists)
                    console.log('✅ sitemap.csv saved correctly');
            }
        }
        finally {
            yield browser.close();
            console.log('\n✨ Test finished.');
        }
    });
}
testSitemaps().catch(console.error);
