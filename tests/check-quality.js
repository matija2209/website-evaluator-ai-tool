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
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const csv_parser_1 = __importDefault(require("csv-parser"));
function readInputCsv(inputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield fs_extra_1.default.pathExists(inputPath)))
            return [];
        return new Promise((resolve, reject) => {
            const results = [];
            fs_extra_1.default.createReadStream(inputPath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    });
}
function extractDomain(url) {
    if (!url || url.includes(' ') || url.length < 4)
        return null;
    if (url.toLowerCase().includes('tis-u'))
        return null;
    if (url.toLowerCase().includes('bizi.si'))
        return null;
    if (url.toLowerCase().includes('mimovrste.com'))
        return null;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        const domain = u.hostname.replace(/^www\./, '');
        if (domain.includes('.') && domain.length > 3)
            return domain;
        return null;
    }
    catch (_a) {
        if (url.includes('.') && !url.includes('/') && !url.includes(' ')) {
            return url.replace(/^www\./, '');
        }
        return null;
    }
}
function checkQuality(inputPath_1) {
    return __awaiter(this, arguments, void 0, function* (inputPath, column = 'website') {
        console.log(`🧐 Checking quality of scraped sitemaps for: ${inputPath}`);
        const rows = yield readInputCsv(inputPath);
        const outputDir = path_1.default.join('output', 'sitemaps');
        const stats = {
            totalRows: rows.length,
            invalidInCsv: 0,
            validToProcess: 0,
            missingFolder: 0,
            emptySitemap: 0, // 0 URLs
            thinSitemap: 0, // 1-5 URLs
            healthySitemap: 0, // > 5 URLs
            massiveSitemap: 0, // > 50000 URLs or flagged
            missingRobots: 0,
            emptyRobots: 0
        };
        const emptySitemaps = [];
        const massiveSitemaps = [];
        for (const row of rows) {
            const url = row[column];
            const domain = extractDomain(url);
            if (!domain) {
                stats.invalidInCsv++;
                continue;
            }
            stats.validToProcess++;
            const domainDir = path_1.default.join(outputDir, domain);
            if (!(yield fs_extra_1.default.pathExists(domainDir))) {
                stats.missingFolder++;
                continue;
            }
            const sitemapPath = path_1.default.join(domainDir, 'sitemap.csv');
            const robotsPath = path_1.default.join(domainDir, 'robots.txt');
            // Check Sitemap
            if (yield fs_extra_1.default.pathExists(sitemapPath)) {
                const content = yield fs_extra_1.default.readFile(sitemapPath, 'utf8');
                const lines = content.trim().split('\n').filter(l => l.trim() !== '');
                const urlCount = Math.max(0, lines.length - 1); // Subtract header
                if (urlCount === 0) {
                    stats.emptySitemap++;
                    emptySitemaps.push(domain);
                }
                else if (urlCount > 50000) {
                    stats.massiveSitemap++;
                    massiveSitemaps.push(`${domain} (${urlCount} URLs)`);
                }
                else if (urlCount <= 5) {
                    stats.thinSitemap++;
                }
                else {
                    stats.healthySitemap++;
                }
            }
            else {
                stats.emptySitemap++;
                emptySitemaps.push(`${domain} (missing csv)`);
            }
            // Check Robots
            if (yield fs_extra_1.default.pathExists(robotsPath)) {
                const content = yield fs_extra_1.default.readFile(robotsPath, 'utf8');
                if (content.trim().length === 0) {
                    stats.emptyRobots++;
                }
            }
            else {
                stats.missingRobots++;
            }
        }
        console.log('\n📊 Quality Audit Summary:');
        console.log(`   Total rows in CSV:        ${stats.totalRows}`);
        console.log(`   Invalid websites:         ${stats.invalidInCsv}`);
        console.log(`   Valid domains found:      ${stats.validToProcess}`);
        console.log(`   -----------------------------------`);
        console.log(`   Missing folders:          ${stats.missingFolder}`);
        console.log(`   Empty sitemaps (0 URLs):  ${stats.emptySitemap}`);
        console.log(`   Thin sitemaps (1-5 URLs): ${stats.thinSitemap}`);
        console.log(`   Healthy sitemaps:         ${stats.healthySitemap}`);
        console.log(`   Massive sitemaps:         ${stats.massiveSitemap} (Flagged/Huge)`);
        console.log(`   -----------------------------------`);
        console.log(`   Missing robots.txt:       ${stats.missingRobots}`);
        console.log(`   Empty robots.txt:         ${stats.emptyRobots}`);
        if (emptySitemaps.length > 0) {
            console.log('\n🚫 Empty Sitemaps (0 URLs):');
            console.log('   ' + emptySitemaps.slice(0, 50).join(', ') + (emptySitemaps.length > 50 ? '...' : ''));
        }
        if (massiveSitemaps.length > 0) {
            console.log('\n🐘 Massive Sitemaps:');
            console.log('   ' + massiveSitemaps.join(', '));
        }
    });
}
const args = process.argv.slice(2);
const input = args[0] || 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
const col = args[1] || 'website';
checkQuality(input, col).catch(console.error);
