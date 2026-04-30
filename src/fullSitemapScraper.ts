import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import * as cheerio from 'cheerio';
import zlib from 'zlib';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { once } from 'events';
import { createReadStream, createWriteStream, WriteStream } from 'fs';
import readline from 'readline';
import * as dotenv from 'dotenv';

const gunzip = promisify(zlib.gunzip);
const DEFAULT_BUCKET_COUNT = 128;
const GOOGLEBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

dotenv.config();

export interface FullSitemapCliOptions {
  sitemaps: string[];
  outputDir: string;
  headful: boolean;
  maxSitemaps?: number;
}

export interface RawSitemapFetcher {
  fetch(url: string): Promise<Buffer | null>;
  close?(): Promise<void>;
}

export interface ParsedSitemapDocument {
  kind: 'sitemapindex' | 'urlset' | 'unknown';
  childSitemaps: string[];
  pageUrls: string[];
}

export interface FullSitemapScrapeResult {
  rootSitemapUrl: string;
  outputPath: string;
  urlsFound: number;
  sitemapsProcessed: number;
  truncated: boolean;
  error?: string;
}

function parseArgs(argv: string[]): FullSitemapCliOptions {
  const options: FullSitemapCliOptions = {
    sitemaps: [],
    outputDir: '',
    headful: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--sitemap') {
      const sitemapUrl = argv[i + 1];
      if (sitemapUrl) {
        options.sitemaps.push(sitemapUrl);
      }
      i += 1;
    } else if (arg === '--output-dir') {
      options.outputDir = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--max-sitemaps') {
      const parsed = Number(argv[i + 1]);
      options.maxSitemaps = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      i += 1;
    } else if (arg === '--headful') {
      options.headful = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    }
  }

  if (options.sitemaps.length === 0) {
    console.error('[ERROR] At least one --sitemap URL is required');
    printUsageAndExit(1);
  }

  if (!options.outputDir) {
    console.error('[ERROR] --output-dir is required');
    printUsageAndExit(1);
  }

  return options;
}

function printUsageAndExit(code: number): never {
  const usage = [
    'Usage:',
    '  npx ts-node src/fullSitemapScraper.ts --sitemap <url> [--sitemap <url>] --output-dir <dir>',
    '',
    'Options:',
    '  --sitemap <url>       Root sitemap or sitemap index URL (repeatable, required)',
    '  --output-dir <path>   Directory where per-root CSV files will be written',
    '  --max-sitemaps <n>    Optional cap on processed sitemap documents',
    '  --headful             Launch visible Chrome instead of headless',
  ].join('\n');

  console.error(usage);
  process.exit(code);
}

async function launchBrowser(headful: boolean): Promise<Browser> {
  return chromium.launch({
    headless: !headful,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeUrlCandidate(rawValue: string, baseUrl: string): string | null {
  const trimmed = decodeXmlEntities(rawValue.trim());
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function getUniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collectLocValues(
  $: cheerio.CheerioAPI,
  selector: string,
  baseUrl: string
): string[] {
  const values: string[] = [];

  $(selector).each((_, element) => {
    const text = $(element).text();
    const normalized = normalizeUrlCandidate(text, baseUrl);
    if (normalized) {
      values.push(normalized);
    }
  });

  return getUniqueValues(values);
}

export function parseSitemapDocument(xml: string, sitemapUrl: string): ParsedSitemapDocument {
  const $ = cheerio.load(xml, { xmlMode: true });
  const hasSitemapIndex = $('sitemapindex').length > 0;
  const hasUrlSet = $('urlset').length > 0;
  const childSitemaps = collectLocValues($, 'sitemap > loc', sitemapUrl);
  const pageUrls = collectLocValues($, 'url > loc', sitemapUrl);

  if (hasSitemapIndex) {
    return {
      kind: 'sitemapindex',
      childSitemaps,
      pageUrls: [],
    };
  }

  if (hasUrlSet) {
    return {
      kind: 'urlset',
      childSitemaps: [],
      pageUrls,
    };
  }

  return {
    kind: 'unknown',
    childSitemaps,
    pageUrls,
  };
}

export async function decodeSitemapBuffer(url: string, buffer: Buffer): Promise<string> {
  if (
    url.toLowerCase().endsWith('.gz') ||
    (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)
  ) {
    try {
      const decompressed = await gunzip(buffer);
      return decompressed.toString('utf8');
    } catch (error) {
      console.warn(`[WARN] Failed to gunzip ${url}, falling back to raw text.`);
    }
  }

  return buffer.toString('utf8');
}

function buildOutputStem(rootSitemapUrl: string): string {
  const parsed = new URL(rootSitemapUrl);
  const base = `${parsed.hostname}${parsed.pathname}${parsed.search}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sitemap';
  const hash = createHash('sha1').update(rootSitemapUrl).digest('hex').slice(0, 8);

  return `${base}-${hash}`;
}

function escapeCsvField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function writeStreamLine(stream: WriteStream, line: string): Promise<void> {
  if (!stream.write(line)) {
    await once(stream, 'drain');
  }
}

async function closeStream(stream: WriteStream): Promise<void> {
  stream.end();
  await once(stream, 'finish');
}

class BucketedUrlStore {
  private streams = new Map<number, WriteStream>();
  private closed = false;

  constructor(
    private tempDir: string,
    private bucketCount: number
  ) {}

  async init(): Promise<void> {
    await fs.ensureDir(this.tempDir);
  }

  private getBucketIndex(url: string): number {
    const digest = createHash('sha1').update(url).digest();
    return digest[0] % this.bucketCount;
  }

  private getBucketPath(bucketIndex: number): string {
    return path.join(this.tempDir, `bucket-${bucketIndex.toString().padStart(3, '0')}.jsonl`);
  }

  private getBucketStream(bucketIndex: number): WriteStream {
    const existing = this.streams.get(bucketIndex);
    if (existing) {
      return existing;
    }

    const stream = createWriteStream(this.getBucketPath(bucketIndex), { flags: 'a' });
    this.streams.set(bucketIndex, stream);
    return stream;
  }

  async append(url: string, sourceSitemap: string): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot append after bucket store is closed');
    }

    const bucketIndex = this.getBucketIndex(url);
    const line = JSON.stringify({ url, sourceSitemap }) + '\n';
    await writeStreamLine(this.getBucketStream(bucketIndex), line);
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    await Promise.all(Array.from(this.streams.values(), (stream) => closeStream(stream)));
    this.streams.clear();
  }

  async writeDedupedCsv(outputPath: string): Promise<number> {
    if (!this.closed) {
      throw new Error('Bucket store must be closed before writing output');
    }

    await fs.ensureDir(path.dirname(outputPath));
    const output = createWriteStream(outputPath, { flags: 'w' });
    let urlsFound = 0;

    try {
      await writeStreamLine(output, 'url,source_sitemap\n');

      for (let bucketIndex = 0; bucketIndex < this.bucketCount; bucketIndex += 1) {
        const bucketPath = this.getBucketPath(bucketIndex);
        if (!await fs.pathExists(bucketPath)) {
          continue;
        }

        const seen = new Set<string>();
        const reader = readline.createInterface({
          input: createReadStream(bucketPath),
          crlfDelay: Infinity,
        });

        for await (const line of reader) {
          if (!line.trim()) {
            continue;
          }

          const record = JSON.parse(line) as { url: string; sourceSitemap: string };
          if (seen.has(record.url)) {
            continue;
          }

          seen.add(record.url);
          urlsFound += 1;
          await writeStreamLine(
            output,
            `${escapeCsvField(record.url)},${escapeCsvField(record.sourceSitemap)}\n`
          );
        }
      }
    } finally {
      await closeStream(output);
    }

    return urlsFound;
  }

  async cleanup(): Promise<void> {
    if (!this.closed) {
      await this.close();
    }

    await fs.remove(this.tempDir);
  }
}

export class PlaywrightSitemapFetcher implements RawSitemapFetcher {
  constructor(private browser: Browser) {}

  private async fetchViaRequest(context: BrowserContext, url: string): Promise<Buffer | null> {
    try {
      const response = await context.request.get(url, {
        headers: {
          'User-Agent': GOOGLEBOT_USER_AGENT,
          Accept: 'application/xml,text/xml,application/gzip,application/octet-stream,*/*',
        },
        timeout: 30000,
      });

      if (!response.ok()) {
        return null;
      }

      return Buffer.from(await response.body());
    } catch (error) {
      console.warn(
        `[WARN] Request fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private async fetchViaPage(context: BrowserContext, url: string): Promise<Buffer | null> {
    let page: Page | null = null;

    try {
      page = await context.newPage();
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 30000 });
      if (!response || !response.ok()) {
        return null;
      }

      return await response.body();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Download is starting')) {
        return await this.fetchViaRequest(context, url);
      }

      console.warn(`[WARN] Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async fetch(url: string): Promise<Buffer | null> {
    let context: BrowserContext | null = null;

    try {
      context = await this.browser.newContext({
        userAgent: GOOGLEBOT_USER_AGENT,
      });

      const requestBuffer = await this.fetchViaRequest(context, url);
      if (requestBuffer) {
        return requestBuffer;
      }

      return await this.fetchViaPage(context, url);
    } catch (error) {
      console.warn(
        `[WARN] Failed to initialize fetch context for ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    } finally {
      if (context) {
        await context.close();
      }
    }
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

export class FullSitemapScraperService {
  constructor(
    private fetcher: RawSitemapFetcher,
    private bucketCount: number = DEFAULT_BUCKET_COUNT
  ) {}

  async scrapeRootSitemap(
    rootSitemapUrl: string,
    outputDir: string,
    options: { maxSitemaps?: number } = {}
  ): Promise<FullSitemapScrapeResult> {
    const normalizedRoot = normalizeUrlCandidate(rootSitemapUrl, rootSitemapUrl);
    if (!normalizedRoot) {
      throw new Error(`Invalid sitemap URL: ${rootSitemapUrl}`);
    }

    const outputStem = buildOutputStem(normalizedRoot);
    const outputPath = path.join(outputDir, `${outputStem}.csv`);
    const tempDir = path.join(outputDir, '.tmp', outputStem);
    const bucketStore = new BucketedUrlStore(tempDir, this.bucketCount);
    const sitemapsToProcess: string[] = [normalizedRoot];
    const visitedSitemaps = new Set<string>();
    let truncated = false;

    await bucketStore.init();

    try {
      while (sitemapsToProcess.length > 0) {
        const currentSitemap = sitemapsToProcess.shift();
        if (!currentSitemap || visitedSitemaps.has(currentSitemap)) {
          continue;
        }

        if (options.maxSitemaps && visitedSitemaps.size >= options.maxSitemaps) {
          truncated = true;
          console.warn(`[WARN] Reached --max-sitemaps=${options.maxSitemaps}. Stopping traversal.`);
          break;
        }

        visitedSitemaps.add(currentSitemap);
        console.log(`[INFO] Parsing sitemap: ${currentSitemap}`);

        const buffer = await this.fetcher.fetch(currentSitemap);
        if (!buffer) {
          console.warn(`[WARN] Skipping unreadable sitemap: ${currentSitemap}`);
          continue;
        }

        const xml = await decodeSitemapBuffer(currentSitemap, buffer);
        const parsed = parseSitemapDocument(xml, currentSitemap);

        for (const childSitemap of parsed.childSitemaps) {
          if (!visitedSitemaps.has(childSitemap)) {
            sitemapsToProcess.push(childSitemap);
          }
        }

        for (const pageUrl of parsed.pageUrls) {
          await bucketStore.append(pageUrl, currentSitemap);
        }
      }

      await bucketStore.close();
      const urlsFound = await bucketStore.writeDedupedCsv(outputPath);

      return {
        rootSitemapUrl: normalizedRoot,
        outputPath,
        urlsFound,
        sitemapsProcessed: visitedSitemaps.size,
        truncated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        rootSitemapUrl: normalizedRoot,
        outputPath,
        urlsFound: 0,
        sitemapsProcessed: visitedSitemaps.size,
        truncated,
        error: errorMessage,
      };
    } finally {
      await bucketStore.cleanup();
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(`[INFO] Starting full sitemap scraper for ${options.sitemaps.length} root sitemap(s).`);

  const browser = await launchBrowser(options.headful);
  const fetcher = new PlaywrightSitemapFetcher(browser);
  const service = new FullSitemapScraperService(fetcher);
  let hadErrors = false;

  try {
    await fs.ensureDir(options.outputDir);

    for (const sitemapUrl of options.sitemaps) {
      const result = await service.scrapeRootSitemap(sitemapUrl, options.outputDir, {
        maxSitemaps: options.maxSitemaps,
      });

      if (result.error) {
        hadErrors = true;
        console.error(`[ERROR] ${result.rootSitemapUrl}: ${result.error}`);
        continue;
      }

      console.log(
        `[SUCCESS] ${result.rootSitemapUrl} -> ${result.urlsFound} URLs from ${result.sitemapsProcessed} sitemap files (${result.outputPath})`
      );
      if (result.truncated) {
        console.warn(`[WARN] Output for ${result.rootSitemapUrl} was truncated by --max-sitemaps.`);
      }
    }
  } finally {
    if (fetcher.close) {
      await fetcher.close();
    } else {
      await browser.close();
    }
  }

  if (hadErrors) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
