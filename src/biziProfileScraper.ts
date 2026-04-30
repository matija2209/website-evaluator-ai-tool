import { chromium, Browser, Page } from 'playwright';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

type RawRow = Record<string, string>;

interface InputRecord {
  sourceRow: RawRow;
  sourceUrl: string;
}

interface ScrapedProfileRecord extends RawRow {
  sourceUrl: string;
  finalUrl: string;
  companyName: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  taxNumber: string;
  registrationNumber: string;
  vatLiable: string;
  skis: string;
  registrationDate: string;
  tsmediaActivity: string;
  openAccounts: string;
  openAccountsDetail: string;
  foreignAccounts: string;
  closedAccounts: string;
  blockedAccounts: string;
  status: 'SUCCESS' | 'FAILED';
  error: string;
  scrapedAt: string;
}

interface CliOptions {
  input?: string;
  output?: string;
  url?: string;
  concurrency: number;
  limit?: number;
  headful: boolean;
  proxies?: string[];
  batchSize: number;
}

const URL_COLUMN_CANDIDATES = [
  'url',
  'URL',
  'profileUrl',
  'profile_url',
  'biziUrl',
  'bizi_url',
  'Original_URL',
  'original_url',
  'Source_URL',
  'source_url',
];

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    concurrency: 3,
    headful: false,
    batchSize: 50,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      continue;
    } else if (arg === '--input') {
      options.input = argv[i + 1];
      i += 1;
    } else if (arg === '--output') {
      options.output = argv[i + 1];
      i += 1;
    } else if (arg === '--url') {
      options.url = argv[i + 1];
      i += 1;
    } else if (arg === '--concurrency') {
      options.concurrency = Number(argv[i + 1]) || options.concurrency;
      i += 1;
    } else if (arg === '--batchSize') {
      options.batchSize = Number(argv[i + 1]) || options.batchSize;
      i += 1;
    } else if (arg === '--limit') {
      options.limit = Number(argv[i + 1]) || undefined;
      i += 1;
    } else if (arg === '--headful') {
      options.headful = true;
    } else if (arg === '--proxies') {
      options.proxies = argv[i + 1].split(',').map(p => p.trim()).filter(Boolean);
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    } else {
      console.warn(`[WARN] Ignoring unknown argument: ${arg}`);
    }
  }

  if (!options.proxies && process.env.SCRAPER_PROXIES) {
    options.proxies = process.env.SCRAPER_PROXIES.split(',').map(p => p.trim()).filter(Boolean);
  }

  if (!options.input && !options.url) {
    printUsageAndExit(1);
  }

  return options;
}

function printUsageAndExit(code: number): never {
  const usage = [
    'Usage:',
    '  pnpm scrape:bizi-profiles -- --input ./input.csv --output ./bizi-profiles.csv',
    '  pnpm scrape:bizi-profiles -- --url https://www.bizi.si/BIOTEH-D-O-O/',
    '',
    'Options:',
    '  --input <path>        CSV file containing BIZI profile URLs',
    '  --output <path>       Output CSV path',
    '  --url <url>           Scrape a single BIZI profile URL',
    '  --concurrency <n>     Number of parallel pages, default 3',
    '  --batchSize <n>       Process in chunks of n URLs, default 50',
    '  --limit <n>           Limit number of CSV rows to process',
    '  --headful             Launch visible Chrome instead of headless',
    '  --proxies <list>      Comma-separated list of HTTP proxies (e.g. http://proxy1,http://proxy2)',
  ].join('\n');

  console.error(usage);
  process.exit(code);
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeLabel(value: string): string {
  return normalizeWhitespace(value).replace(/\s*:\s*$/, '');
}

async function readInputRecords(inputPath: string): Promise<InputRecord[]> {
  return new Promise((resolve, reject) => {
    const records: InputRecord[] = [];

    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (row: RawRow) => {
        const sourceUrl = detectSourceUrl(row);
        if (!sourceUrl) {
          return;
        }

        records.push({
          sourceRow: row,
          sourceUrl,
        });
      })
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

function detectSourceUrl(row: RawRow): string | null {
  for (const candidate of URL_COLUMN_CANDIDATES) {
    const value = row[candidate];
    if (value && /^https?:\/\/(www\.)?bizi\.si\//i.test(value.trim())) {
      return value.trim();
    }
  }

  for (const value of Object.values(row)) {
    if (value && /^https?:\/\/(www\.)?bizi\.si\//i.test(value.trim())) {
      return value.trim();
    }
  }

  return null;
}

async function launchBrowser(headful: boolean): Promise<Browser> {
  const launchArgs = {
    headless: !headful,
    timeout: 30000,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--window-size=1440,1200',
    ],
  };

  try {
    return await chromium.launch({
      ...launchArgs,
      channel: 'chrome',
    });
  } catch (error) {
    console.warn('[WARN] Falling back to bundled Playwright Chromium:', error);
    return chromium.launch(launchArgs);
  }
}

async function extractContactField(page: Page, selector: string): Promise<string> {
  const locator = page.locator(selector).first();
  if (await locator.count() === 0) {
    return '';
  }

  return normalizeWhitespace(await locator.textContent());
}

async function extractWebsite(page: Page): Promise<string> {
  const locator = page
    .locator('.b-box-company-info .b-box-body.b-contacts a.i-ostalo-link')
    .filter({ hasNot: page.locator('[href*="itis.siol.net"]') })
    .first();

  if (await locator.count() === 0) {
    return '';
  }

  return normalizeWhitespace(await locator.textContent());
}

async function extractBoxFields(page: Page, titleText: string): Promise<Record<string, string>> {
  const box = page
    .locator('.b-box')
    .filter({ has: page.locator('.b-box-head .b-box-title', { hasText: titleText }) })
    .first();

  if (await box.count() === 0) {
    return {};
  }

  return box.evaluate((element) => {
    const result: Record<string, string> = {};
    const rows = element.querySelectorAll('.row.b-attr-group');

    const normalize = (value: string | null | undefined): string =>
      (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

    rows.forEach((row) => {
      const labelElement = row.querySelector('.b-attr-name');
      if (!labelElement) {
        return;
      }

      const rawLabel = normalize(labelElement.textContent);
      if (!rawLabel) {
        return;
      }

      const valueParts = Array.from(
        row.querySelectorAll('.b-attr-value, .b-attr-value-detail')
      )
        .map((node) => normalize(node.textContent))
        .filter(Boolean);

      if (rawLabel.includes(':')) {
        const separatorIndex = rawLabel.indexOf(':');
        const inlineLabel = normalize(rawLabel.slice(0, separatorIndex));
        const inlineValue = normalize(rawLabel.slice(separatorIndex + 1));

        if (inlineLabel && inlineValue) {
          result[inlineLabel] = inlineValue;
          if (valueParts.length > 0) {
            result[`${inlineLabel} detail`] = valueParts.join(' | ');
          }
          return;
        }
      }

      const label = rawLabel.replace(/\s*:\s*$/, '');
      result[label] = valueParts.join(' | ');
    });

    return result;
  });
}

function emptyRecord(sourceUrl: string, sourceRow: RawRow): ScrapedProfileRecord {
  return {
    ...sourceRow,
    sourceUrl,
    finalUrl: '',
    companyName: '',
    address: '',
    phone: '',
    website: '',
    email: '',
    taxNumber: '',
    registrationNumber: '',
    vatLiable: '',
    skis: '',
    registrationDate: '',
    tsmediaActivity: '',
    openAccounts: '',
    openAccountsDetail: '',
    foreignAccounts: '',
    closedAccounts: '',
    blockedAccounts: '',
    status: 'FAILED',
    error: '',
    scrapedAt: new Date().toISOString(),
  };
}

async function scrapeProfile(browser: Browser, record: InputRecord, proxyUrl?: string): Promise<ScrapedProfileRecord> {
  const result = emptyRecord(record.sourceUrl, record.sourceRow);
  const contextOptions: any = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1200 },
  };

  if (proxyUrl) {
    contextOptions.proxy = { server: proxyUrl };
  }

  const context = await browser.newContext(contextOptions);

  try {
    const page = await context.newPage();
    
    // Add a random delay between 2000ms and 5000ms to mimic human behavior and avoid blocking
    const randomDelay = Math.floor(Math.random() * 3000) + 2000;
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    await page.goto(record.sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
    await page.waitForSelector('.b-box-company-info h1', { timeout: 30000 });

    const companyInfo = await extractBoxFields(page, 'Matično podjetje');
    const trrInfo = await extractBoxFields(page, 'TRR in blokade');

    result.finalUrl = page.url();
    result.companyName = normalizeWhitespace(
      await page.locator('.b-box-company-info h1').first().textContent()
    );
    result.address = await extractContactField(
      page,
      '.b-box-company-info .b-box-body.b-contacts a[onclick*="openMapTis"]'
    );
    result.phone = await extractContactField(page, '.b-box-company-info a[href^="tel:"]');
    result.website = await extractWebsite(page);
    result.email = await extractContactField(page, '.b-box-company-info a[href^="mailto:"]');

    // Fallback: If website is missing or generic, infer from email domain
    if ((!result.website || result.website === 'Več kontaktov v TIS-u') && result.email) {
      const emailMatch = result.email.match(/@([^@\s]+\.[^@\s]+)$/);
      if (emailMatch) {
        const domain = emailMatch[1].toLowerCase();
        const skipDomains = [
          'gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com',
          'me.com', 't-2.net', 'telemach.net', 'siol.net', 'amis.net', 'volja.net',
          'email.si', 'siol.com', 'triera.net', 'arnes.si'
        ];
        if (!skipDomains.includes(domain)) {
          result.website = `https://www.${domain}`;
          console.log(`[INFO] [${result.companyName}] Inferred website from email: ${result.website}`);
        }
      }
    }
    result.taxNumber = companyInfo['Davčna številka SI'] || '';
    result.registrationNumber = companyInfo['Matična'] || '';
    result.vatLiable = companyInfo['Zavezanec za DDV'] || '';
    result.skis = companyInfo.SKIS || '';
    result.registrationDate = companyInfo['Datum vpisa'] || '';
    result.tsmediaActivity = companyInfo['Dejavnost TSmedia'] || '';
    result.openAccounts = trrInfo.Odprtih || '';
    result.openAccountsDetail = trrInfo['Odprtih detail'] || '';
    result.foreignAccounts = trrInfo['Tuji TRR'] || '';
    result.closedAccounts = trrInfo.Zaprtih || '';
    result.blockedAccounts = trrInfo.Blokiranih || '';
    result.status = 'SUCCESS';
    result.scrapedAt = new Date().toISOString();

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.scrapedAt = new Date().toISOString();
    return result;
  } finally {
    await context.close();
  }
}

async function getAlreadyScrapedUrls(outputPath: string): Promise<Set<string>> {
  const scrapedUrls = new Set<string>();
  if (await fs.pathExists(outputPath)) {
    return new Promise((resolve, reject) => {
      fs.createReadStream(outputPath)
        .pipe(csv())
        .on('data', (row: any) => {
          const hasValidWebsite = row.website && row.website.trim() !== '' && row.website !== 'Več kontaktov v TIS-u';
          if (row.status === 'SUCCESS' && row.sourceUrl && hasValidWebsite) {
            scrapedUrls.add(row.sourceUrl);
          }
        })
        .on('end', () => resolve(scrapedUrls))
        .on('error', reject);
    });
  }
  return scrapedUrls;
}

function verifyBatchQuality(batchResults: ScrapedProfileRecord[]): { ok: boolean; message: string } {
  if (batchResults.length === 0) return { ok: true, message: 'Empty batch' };

  let failedCount = 0;
  let missingKeyFields = 0;
  const keyFields = ['companyName', 'taxNumber', 'registrationNumber'];

  for (const result of batchResults) {
    if (result.status === 'FAILED') {
      failedCount++;
      continue;
    }

    let missing = 0;
    for (const field of keyFields) {
      if (!result[field as keyof ScrapedProfileRecord]) {
        missing++;
      }
    }
    if (missing >= 2) {
      missingKeyFields++;
    }
  }

  const failedRate = failedCount / batchResults.length;
  const missingRate = missingKeyFields / batchResults.length;

  if (failedRate > 0.2) {
    return { ok: false, message: `High failure rate: ${(failedRate * 100).toFixed(1)}% failed.` };
  }
  if (missingRate > 0.3) {
    return { ok: false, message: `High degradation: ${(missingRate * 100).toFixed(1)}% missing key data.` };
  }

  return { ok: true, message: `Quality OK (Failed: ${(failedRate * 100).toFixed(1)}%, Missing data: ${(missingRate * 100).toFixed(1)}%)` };
}

async function writeOutput(records: ScrapedProfileRecord[], outputPath: string, append: boolean): Promise<void> {
  const keySet = new Set<string>();

  records.forEach((record) => {
    Object.keys(record).forEach((key) => keySet.add(key));
  });

  const orderedKeys = [
    'sourceUrl',
    'finalUrl',
    'companyName',
    'address',
    'phone',
    'website',
    'email',
    'taxNumber',
    'registrationNumber',
    'vatLiable',
    'skis',
    'registrationDate',
    'tsmediaActivity',
    'openAccounts',
    'openAccountsDetail',
    'foreignAccounts',
    'closedAccounts',
    'blockedAccounts',
    'status',
    'error',
    'scrapedAt',
  ];

  const remainingKeys = Array.from(keySet).filter((key) => !orderedKeys.includes(key));
  const headers = [...remainingKeys, ...orderedKeys].map((key) => ({
    id: key,
    title: key,
  }));

  await fs.ensureDir(path.dirname(outputPath));

  const writer = createObjectCsvWriter({
    path: outputPath,
    header: headers,
    append: append,
  });

  await writer.writeRecords(records);
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function buildInput(options: CliOptions): Promise<InputRecord[]> {
  if (options.url) {
    return [
      {
        sourceRow: {},
        sourceUrl: options.url,
      },
    ];
  }

  const records = await readInputRecords(options.input!);
  if (options.limit) {
    return records.slice(0, options.limit);
  }

  return records;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const outputPath =
    options.output ||
    path.resolve(process.cwd(), 'output', `bizi-profile-scrape-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);

  let inputRecords = await buildInput(options);

  const alreadyScraped = await getAlreadyScrapedUrls(outputPath);
  if (alreadyScraped.size > 0) {
    const originalCount = inputRecords.length;
    inputRecords = inputRecords.filter(r => !alreadyScraped.has(r.sourceUrl));
    console.log(`[INFO] Idempotency: Skipped ${originalCount - inputRecords.length} URLs already successfully scraped.`);
  }

  if (inputRecords.length === 0) {
    console.log('[INFO] No URLs to process (all already scraped or none provided).');
    return;
  }

  console.log(`[INFO] Scraping ${inputRecords.length} BIZI profile page(s)`);
  console.log(`[INFO] Output: ${outputPath}`);

  const browser = await launchBrowser(options.headful);

  const proxyList: (string | undefined)[] = [undefined];
  if (options.proxies && options.proxies.length > 0) {
    proxyList.push(...options.proxies);
  }

  try {
    const batchSize = options.batchSize;
    let globalIndex = 0;

    for (let i = 0; i < inputRecords.length; i += batchSize) {
      const batchRecords = inputRecords.slice(i, i + batchSize);
      console.log(`\n[INFO] Starting batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(inputRecords.length / batchSize)} (${batchRecords.length} records)`);

      const batchResults = await runWithConcurrency(
        batchRecords,
        options.concurrency,
        async (record, index) => {
          const currentIndex = globalIndex + index;
          const proxyUrl = proxyList[currentIndex % proxyList.length];
          console.log(`[INFO] [${currentIndex + 1}/${inputRecords.length}] ${record.sourceUrl} ${proxyUrl ? `(Proxy: ${proxyUrl})` : '(No proxy)'}`);
          const scraped = await scrapeProfile(browser, record, proxyUrl);
          console.log(`[INFO] [${currentIndex + 1}/${inputRecords.length}] ${scraped.status}`);
          if (scraped.error) {
            console.log(`[WARN] ${scraped.error}`);
          }
          return scraped;
        }
      );

      globalIndex += batchRecords.length;

      const append = await fs.pathExists(outputPath);
      await writeOutput(batchResults, outputPath, append);

      const quality = verifyBatchQuality(batchResults);
      if (!quality.ok) {
        console.error(`\n[ERROR] Data quality degradation detected: ${quality.message}`);
        console.error(`[ERROR] Pausing scraper to prevent burning proxies or getting blocked.`);
        process.exit(1);
      } else {
        console.log(`[INFO] Batch quality verification passed: ${quality.message}`);
      }
    }
    console.log(`\n[INFO] Finished all batches successfully.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('[ERROR]', error);
  process.exit(1);
});
