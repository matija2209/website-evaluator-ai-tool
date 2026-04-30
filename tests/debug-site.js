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
const playwright_1 = require("playwright");
const sitemapScraper_1 = require("../src/sitemapScraper");
function debugSite(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield playwright_1.chromium.launch({ headless: true });
        const service = new sitemapScraper_1.SitemapScraperService(browser);
        console.log(`\n🕵️ Debugging site: ${url}`);
        // Test raw fetch
        const sitemapUrl = `${url.startsWith('http') ? '' : 'https://'}${url}/sitemap.xml`;
        console.log(`[DEBUG] Fetching ${sitemapUrl} directly...`);
        const content = yield service.fetchContent(sitemapUrl);
        console.log(`[DEBUG] Content snippet: ${content === null || content === void 0 ? void 0 : content.substring(0, 200)}`);
        const locMatches = content === null || content === void 0 ? void 0 : content.match(/<loc>([\s\S]*?)<\/loc>/gi);
        console.log(`[DEBUG] Loc matches found: ${(locMatches === null || locMatches === void 0 ? void 0 : locMatches.length) || 0}`);
        if (locMatches) {
            console.log(`[DEBUG] First 3 locs: ${locMatches.slice(0, 3).map(m => m.replace(/<\/?loc>/gi, '').trim()).join(', ')}`);
        }
        const result = yield service.scrapeDomain(url, 'output/sitemaps_debug');
        console.log('\n📊 Result:', JSON.stringify(result, null, 2));
        yield browser.close();
    });
}
const site = process.argv[2] || 'dfvu.org';
debugSite(site).catch(console.error);
