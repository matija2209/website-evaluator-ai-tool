import { chromium, Browser, Page, BrowserContext } from 'playwright';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

dotenv.config();

interface CliOptions {
  input: string;
  column: string;
  concurrency: number;
  headful: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    input: '',
    column: 'website',
    concurrency: 3,
    headful: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--input') {
      options.input = argv[i + 1];
      i += 1;
    } else if (arg === '--column') {
      options.column = argv[i + 1];
      i += 1;
    } else if (arg === '--concurrency') {
      options.concurrency = Number(argv[i + 1]) || options.concurrency;
      i += 1;
    } else if (arg === '--limit') {
      options.limit = Number(argv[i + 1]) || undefined;
      i += 1;
    } else if (arg === '--headful') {
      options.headful = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    }
  }

  if (!options.input) {
    console.error('[ERROR] --input is required');
    printUsageAndExit(1);
  }

  return options;
}

function printUsageAndExit(code: number): never {
  const usage = [
    'Usage:',
    '  npx ts-node src/sitemapScraper.ts --input ./output/bizi-scrape.csv --column website',
    '',
    'Options:',
    '  --input <path>        CSV file containing website URLs',
    '  --column <name>       Column name for the website URL (default: "website")',
    '  --concurrency <n>     Number of parallel domains, default 3',
    '  --limit <n>           Limit number of CSV rows to process',
    '  --headful             Launch visible Chrome instead of headless',
  ].join('\n');

  console.error(usage);
  process.exit(code);
}

async function launchBrowser(headful: boolean): Promise<Browser> {
  return await chromium.launch({
    headless: !headful,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

export interface SitemapScrapeResult {
  domain: string;
  urlsFound: number;
  robotsFound: boolean;
  isMassive?: boolean;
  error?: string;
}

export class SitemapScraperService {
  constructor(private browser: Browser) {}

  async fetchContent(url: string): Promise<string | null> {
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    try {
      context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      });
      page = await context.newPage();
      
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
      if (!response || !response.ok()) {
        return null;
      }
      
      const buffer = await response.body();
      
      // Check if it's gzipped (magic bytes 1f 8b) or if URL ends in .gz
      if (url.toLowerCase().endsWith('.gz') || (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)) {
        try {
          const decompressed = await gunzip(buffer);
          return decompressed.toString('utf8');
        } catch (e) {
          console.warn(`[WARN] Failed to gunzip ${url}, trying raw text...`);
          return buffer.toString('utf8');
        }
      }

      return buffer.toString('utf8');
    } catch (error) {
      console.warn(`[WARN] Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      if (page) await page.close();
      if (context) await context.close();
    }
  }

  async scrapeDomain(startUrl: string, outputDirBase: string = 'output/sitemaps'): Promise<SitemapScrapeResult | null> {
    const domain = this.extractDomain(startUrl);
    if (!domain) return null;
    
    const outputDir = path.join(outputDirBase, domain);
    const csvPath = path.join(outputDir, 'sitemap.csv');

    // Idempotency: Skip if sitemap.csv already exists and is non-empty
    if (await fs.pathExists(csvPath)) {
      const existingData = await fs.readFile(csvPath, 'utf8');
      const lines = existingData.trim().split('\n').filter(l => l.trim() !== '');
      const urlCount = Math.max(0, lines.length - 1);
      
      if (urlCount > 0) {
        console.log(`[INFO] [${domain}] Already processed with ${urlCount} URLs. Skipping.`);
        return {
          domain,
          urlsFound: urlCount,
          robotsFound: await fs.pathExists(path.join(outputDir, 'robots.txt'))
        };
      } else {
        console.log(`[INFO] [${domain}] Previous run was empty. Re-attempting...`);
      }
    }

    await fs.ensureDir(outputDir);

    try {
      const baseUrl = startUrl.startsWith('http') ? new URL(startUrl).origin : `https://${startUrl}`;
      
      // 1. robots.txt
      console.log(`[INFO] [${domain}] Fetching robots.txt...`);
      const robotsUrl = `${baseUrl}/robots.txt`;
      const robotsContent = await this.fetchContent(robotsUrl);
      
      const sitemapUrls = new Set<string>();
      let robotsFound = false;
      if (robotsContent) {
        robotsFound = true;
        await fs.writeFile(path.join(outputDir, 'robots.txt'), robotsContent);
        
        // Parse robots.txt for sitemaps using regex
        const sitemapRegex = /^sitemap:\s*(.*)$/gim;
        let match;
        while ((match = sitemapRegex.exec(robotsContent)) !== null) {
          const sitemapUrl = match[1].trim();
          if (sitemapUrl) {
            sitemapUrls.add(sitemapUrl);
          }
        }
      }

      if (sitemapUrls.size === 0) {
        sitemapUrls.add(`${baseUrl}/sitemap.xml`);
      }

      // 2. Recursive Sitemaps
      const discoveredUrls = new Set<string>();
      const processedSitemaps = new Set<string>();
      const sitemapsToProcess = Array.from(sitemapUrls);
      let isMassive = false;

      while (sitemapsToProcess.length > 0) {
        if (processedSitemaps.size >= 10) {
          console.warn(`[WARN] [${domain}] Massive site detected (>10 sitemaps). Stopping recursion.`);
          isMassive = true;
          break;
        }

        const currentSitemap = sitemapsToProcess.shift()!;
        if (processedSitemaps.has(currentSitemap)) continue;
        processedSitemaps.add(currentSitemap);

        console.log(`[INFO] [${domain}] Parsing sitemap: ${currentSitemap}`);
        const xml = await this.fetchContent(currentSitemap);
        if (!xml) continue;

        const isIndex = /<sitemapindex/i.test(xml);
        
        // Extract all <loc> content using regex (handles namespaces and weird formatting better)
        // We use [\s\S]*? to match across newlines
        const locMatches = xml.match(/<loc>([\s\S]*?)<\/loc>/gi);
        
        if (locMatches) {
          for (const match of locMatches) {
            const loc = match.replace(/<\/?loc>/gi, '').trim();
            if (!loc) continue;

            if (isIndex || loc.toLowerCase().endsWith('.xml') || loc.toLowerCase().endsWith('.xml.gz')) {
              if (!processedSitemaps.has(loc)) {
                sitemapsToProcess.push(loc);
              }
            } else {
              discoveredUrls.add(loc);
            }
          }
        }
        
        // Fallback for weirdly nested sitemaps if no URLs found yet
        if (!isIndex && discoveredUrls.size === 0) {
            const nestedLocMatches = xml.match(/<sitemap>\s*<loc>(.*?)<\/loc>/gi);
            if (nestedLocMatches) {
                for (const match of nestedLocMatches) {
                    const loc = match.replace(/<[^>]+>/g, '').trim();
                    if (loc && !processedSitemaps.has(loc)) sitemapsToProcess.push(loc);
                }
            }
        }
      }

      // 3. Save sitemap.csv
      const writer = createObjectCsvWriter({
        path: csvPath,
        header: [{ id: 'url', title: 'url' }],
      });

      const records = Array.from(discoveredUrls).map(url => ({ url }));
      await writer.writeRecords(records);
      console.log(`[SUCCESS] [${domain}] Found ${discoveredUrls.size} URLs. Saved to ${csvPath}`);

      return {
        domain,
        urlsFound: discoveredUrls.size,
        robotsFound,
        isMassive
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] [${domain}] ${errorMessage}`);
      return {
        domain,
        urlsFound: 0,
        robotsFound: false,
        error: errorMessage
      };
    }
  }

  public extractDomain(url: string): string | null {
    if (!url || url.includes(' ') || url.length < 4) return null;
    if (url.toLowerCase().includes('tis-u')) return null;
    if (url.toLowerCase().includes('bizi.si')) return null;
    if (url.toLowerCase().includes('mimovrste.com')) return null;

    try {
      const u = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = u.hostname.replace(/^www\./, '');
      if (domain.includes('.') && domain.length > 3) return domain;
      return null;
    } catch {
      if (url.includes('.') && !url.includes('/') && !url.includes(' ')) {
        return url.replace(/^www\./, '');
      }
      return null;
    }
  }
}

async function readInputCsv(inputPath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(`[INFO] Starting sitemap scraper with input: ${options.input}`);

  if (!await fs.pathExists(options.input)) {
    console.error(`[ERROR] Input file not found: ${options.input}`);
    process.exit(1);
  }

  const rows = await readInputCsv(options.input);
  const rowsToProcess = options.limit ? rows.slice(0, options.limit) : rows;
  
  console.log(`[INFO] Found ${rows.length} rows, processing ${rowsToProcess.length} rows.`);

  const browser = await launchBrowser(options.headful);
  const service = new SitemapScraperService(browser);

  try {
    await runWithConcurrency(rowsToProcess, options.concurrency, async (row) => {
      const url = row[options.column];
      if (!url) {
        console.warn(`[WARN] Missing URL in column "${options.column}" for row:`, row);
        return;
      }
      await service.scrapeDomain(url);
    });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
