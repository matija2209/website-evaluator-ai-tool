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
function verifySitemaps(inputPath_1) {
    return __awaiter(this, arguments, void 0, function* (inputPath, column = 'website') {
        console.log(`🔍 Verifying sitemap results for input: ${inputPath}`);
        const rows = yield readInputCsv(inputPath);
        if (rows.length === 0) {
            console.error('❌ No rows found in input CSV');
            return;
        }
        const outputDir = path_1.default.join('output', 'sitemaps');
        let successful = 0;
        let missingFolders = 0;
        let missingFiles = 0;
        let invalidDomains = 0;
        for (const row of rows) {
            const url = row[column];
            const domain = extractDomain(url);
            if (!domain) {
                invalidDomains++;
                continue;
            }
            const domainDir = path_1.default.join(outputDir, domain);
            if (!(yield fs_extra_1.default.pathExists(domainDir))) {
                missingFolders++;
                continue;
            }
            const robotsPath = path_1.default.join(domainDir, 'robots.txt');
            const sitemapPath = path_1.default.join(domainDir, 'sitemap.csv');
            const robotsExists = yield fs_extra_1.default.pathExists(robotsPath);
            const sitemapExists = yield fs_extra_1.default.pathExists(sitemapPath);
            // Robots.txt is optional, but sitemap.csv must exist
            if (!sitemapExists) {
                console.warn(`⚠️  Missing sitemap.csv for: ${domain}`);
                missingFiles++;
            }
            else {
                successful++;
            }
        }
        console.log('\n📊 Verification Summary:');
        console.log(`   Total sites in CSV: ${rows.length}`);
        console.log(`   Invalid websites skipped: ${invalidDomains}`);
        console.log(`   Valid sites to check: ${rows.length - invalidDomains}`);
        console.log(`   -----------------------------------`);
        console.log(`   Successfully processed: ${successful}`);
        console.log(`   Missing folders: ${missingFolders}`);
        console.log(`   Missing sitemap.csv: ${missingFiles}`);
        if (missingFolders === 0 && missingFiles === 0) {
            console.log('\n✅ All valid sites processed correctly!');
        }
        else {
            console.log('\n❌ Some sites have missing data.');
        }
    });
}
const inputPath = process.argv[2] || 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
const column = process.argv[3] || 'website';
verifySitemaps(inputPath, column).catch(console.error);
