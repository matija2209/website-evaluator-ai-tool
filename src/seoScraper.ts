import { Page } from 'playwright';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import type { PagePreparationResult } from './types';
import { PlaywrightSessionManager } from './playwrightSession';

dotenv.config();

export interface SeoScraperOptions {
  input: string;
  output?: string;
  urlColumn?: string;
  concurrency?: number;
  limit?: number;
  batchSize?: number;
  timeout?: number;
}

export interface SeoScrapeResult {
  website: string;
  biziUrl: string;
  targetUrl: string;
  pageTitle: string;
  metaDescription: string;
  jsonLd: string;
  textContent: string;
  status: 'SUCCESS' | 'FAILED' | 'INVALID_URL';
  error: string;
  scrapedAt: string;
  pagePreparation?: PagePreparationResult;
}

export class SeoScraper {
  private sessionManager: PlaywrightSessionManager;

  constructor() {
    this.sessionManager = new PlaywrightSessionManager();
  }

  async run(options: SeoScraperOptions): Promise<SeoScrapeResult[]> {
    const input = options.input;
    const urlColumn = options.urlColumn || 'website';
    const concurrency = options.concurrency || 3;
    const batchSize = options.batchSize || 50;
    const timeout = options.timeout || 30000;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const outputPath = options.output || path.resolve(process.cwd(), 'output', `seo-scrape-${timestamp}.csv`);

    console.log(`[SEO] Reading input file: ${input}`);
    let inputRecords = await this.readInputRecords(input, urlColumn);

    if (options.limit) {
      inputRecords = inputRecords.slice(0, options.limit);
    }

    if (inputRecords.length === 0) {
      console.log('[SEO] No records found to process.');
      return [];
    }

    console.log(`[SEO] Found ${inputRecords.length} URLs to process. Concurrency: ${concurrency}`);

    const allResults: SeoScrapeResult[] = [];
    const preparationLogPath = path.join(path.dirname(outputPath), 'page-preparation.ndjson');

    for (let i = 0; i < inputRecords.length; i += batchSize) {
      const batch = inputRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(inputRecords.length / batchSize);

      console.log(`[SEO] Processing batch ${batchNum}/${totalBatches}`);

      const results = await this.runWithConcurrency(
        batch,
        concurrency,
        async (record, index) => {
          const globalIdx = i + index + 1;
          console.log(`[SEO] [${globalIdx}/${inputRecords.length}] Scraping: ${record.websiteUrl}`);
          return await this.scrapePage(record, timeout, preparationLogPath);
        }
      );

      allResults.push(...results);
      const append = await fs.pathExists(outputPath);
      await this.writeOutput(results, outputPath, append);
    }

    console.log(`[SEO] All tasks completed. Saved to: ${outputPath}`);
    return allResults;
  }

  private async scrapePage(record: any, timeout: number, preparationLogPath?: string): Promise<SeoScrapeResult> {
    const result: SeoScrapeResult = {
      website: record.sourceRow['website'] || '',
      biziUrl: record.sourceRow['URL'] || '',
      targetUrl: record.websiteUrl,
      pageTitle: '',
      metaDescription: '',
      jsonLd: '',
      textContent: '',
      status: 'FAILED',
      error: '',
      scrapedAt: new Date().toISOString(),
    };

    if (!this.isValidUrl(record.websiteUrl)) {
      result.status = 'INVALID_URL';
      result.error = 'Invalid URL format';
      return result;
    }

    const normalizedUrl = this.normalizeUrl(record.websiteUrl);
    let session: Awaited<ReturnType<PlaywrightSessionManager['openPreparedDesktopSession']>> | null = null;

    try {
      session = await this.sessionManager.openPreparedDesktopSession({
        url: normalizedUrl,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        waitUntil: 'domcontentloaded',
        timeoutMs: timeout,
        runLogPath: preparationLogPath,
        purpose: 'seo-scrape'
      });
      await session.page.waitForTimeout(2000);

      const data = await this.scrapePageDirectly(session.page);

      result.pageTitle = data.title;
      result.metaDescription = data.metaDescription;
      result.jsonLd = data.jsonLd;
      result.textContent = data.fullText;
      result.status = 'SUCCESS';
      result.pagePreparation = session.pagePreparation;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (session) {
        await session.close();
      }
    }
    return result;
  }

  async scrapePageDirectly(page: Page) {
    return await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach(s => s.remove());
      
      return {
        title: document.title,
        metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ||
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '',
        jsonLd: JSON.stringify(Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
          try { return JSON.parse(s.textContent || '{}'); } catch { return null; }
        }).filter(Boolean)),
        jsonLdFound: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
        fullText: (document.body.innerText || '').replace(/\s+/g, ' ').trim().substring(0, 30000)
      };
    });
  }

  private async readInputRecords(inputPath: string, urlColumn: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      fs.createReadStream(inputPath)
        .pipe(csv())
        .on('data', (row) => {
          let url = row[urlColumn];
          if (!url || url.trim() === '') {
            for (const value of Object.values(row)) {
              if (typeof value === 'string' && this.isValidUrl(value)) {
                url = value;
                break;
              }
            }
          }
          if (url && !url.includes('bizi.si')) {
            records.push({ sourceRow: row, websiteUrl: url.trim() });
          }
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private async runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const idx = nextIndex++;
        results[idx] = await worker(items[idx], idx);
      }
    });
    await Promise.all(runners);
    return results;
  }

  private async writeOutput(records: SeoScrapeResult[], outputPath: string, append: boolean): Promise<void> {
    const headers = [
      { id: 'website', title: 'website' },
      { id: 'biziUrl', title: 'biziUrl' },
      { id: 'targetUrl', title: 'targetUrl' },
      { id: 'pageTitle', title: 'pageTitle' },
      { id: 'metaDescription', title: 'metaDescription' },
      { id: 'jsonLd', title: 'jsonLd' },
      { id: 'textContent', title: 'textContent' },
      { id: 'status', title: 'status' },
      { id: 'error', title: 'error' },
      { id: 'scrapedAt', title: 'scrapedAt' }
    ];
    await fs.ensureDir(path.dirname(outputPath));
    const writer = createObjectCsvWriter({ path: outputPath, header: headers, append });
    await writer.writeRecords(records);
  }

  private isValidUrl(url: string): boolean {
    try { 
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`); 
      return !parsed.hostname.includes('bizi.si');
    } catch { return false; }
  }

  private normalizeUrl(url: string): string {
    return url.startsWith('http') ? url : `https://${url}`;
  }
}

// CLI entry point
if (require.main === module) {
  const scraper = new SeoScraper();
  const args = process.argv.slice(2);
  const options: SeoScraperOptions = { input: '' };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input') options.input = args[++i];
    if (arg === '--output') options.output = args[++i];
    if (arg === '--urlColumn') options.urlColumn = args[++i];
    if (arg === '--concurrency') options.concurrency = parseInt(args[++i]);
    if (arg === '--limit') options.limit = parseInt(args[++i]);
  }

  if (options.input) {
    scraper.run(options).catch(console.error);
  } else {
    console.error('Usage: ts-node src/seoScraper.ts --input <path> [--urlColumn <name>] [--concurrency <n>]');
  }
}
