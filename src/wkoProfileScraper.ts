import { chromium, Browser, Page, request } from 'playwright';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

type RawRow = Record<string, string>;

type PageState = 'active_profile' | 'inactive_profile' | 'help_page' | 'access_denied' | 'unknown';
type FailureCategory = '' | 'ACCESS_DENIED';

interface InputRecord {
  sourceRow: RawRow;
  sourceUrl: string;
}

interface CliOptions {
  input?: string;
  output?: string;
  url?: string;
  concurrency: number;
  limit?: number;
  headful: boolean;
  batchSize: number;
  proxies?: ProxyConfig[];
}

interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  raw: string;
}

interface ProxyHealthResult {
  proxy?: ProxyConfig;
  ok: boolean;
  publicIp?: string;
  error?: string;
}

interface ExtractedPermission {
  heading: string;
  summaryLines: string[];
  details: Record<string, string>;
}

interface ExtractedAward {
  title: string;
  description: string;
  imageUrl: string;
  links: string[];
  details: Record<string, string>;
}

interface ExtractedLocationGroup {
  region: string;
  countLabel: string;
  entries: Array<{
    label: string;
    href: string;
    isActive: boolean;
  }>;
}

interface ExtractedDisclosure {
  title: string;
  details: Record<string, string>;
}

interface PageExtraction {
  pageTitle: string;
  pageState: PageState;
  pageNoticeText: string;
  availableSectionIds: string[];
  sectionHeadings: Record<string, string>;
  otherSections: Array<{ id: string; heading: string; preview: string }>;
  companyName: string;
  categoryPills: string[];
  isLehrbetrieb: boolean;
  phone: string;
  email: string;
  website: string;
  streetAddress: string;
  postalCode: string;
  locality: string;
  fullAddress: string;
  routeUrl: string;
  aboutText: string;
  lehrbetriebNoticeText: string;
  lehrbetriebDetailUrl: string;
  productsText: string;
  firmData: Record<string, string>;
  permissions: ExtractedPermission[];
  awards: ExtractedAward[];
  locations: ExtractedLocationGroup[];
  disclosure: ExtractedDisclosure[];
}

interface ScrapedWkoProfileRecord extends RawRow {
  sourceUrl: string;
  finalUrl: string;
  pageTitle: string;
  pageState: PageState | '';
  pageNoticeText: string;
  availableSectionIds: string;
  sectionHeadingsJson: string;
  otherSectionsJson: string;
  companyName: string;
  categoryPillsJson: string;
  isLehrbetrieb: string;
  phone: string;
  email: string;
  website: string;
  streetAddress: string;
  postalCode: string;
  locality: string;
  fullAddress: string;
  routeUrl: string;
  aboutText: string;
  lehrbetriebNoticeText: string;
  lehrbetriebDetailUrl: string;
  productsText: string;
  firmDataJson: string;
  registeredFirmName: string;
  registryNumber: string;
  court: string;
  gln: string;
  uidNumber: string;
  supervisionAuthority: string;
  permissionsCount: string;
  permissionsJson: string;
  awardsCount: string;
  awardsJson: string;
  locationsCount: string;
  locationsJson: string;
  disclosureCount: string;
  disclosureJson: string;
  failureCategory: FailureCategory;
  attemptCount: string;
  proxyUsed: string;
  status: 'SUCCESS' | 'FAILED';
  error: string;
  scrapedAt: string;
}

const URL_COLUMN_CANDIDATES = [
  'url',
  'URL',
  'profileUrl',
  'profile_url',
  'wkoUrl',
  'wko_url',
  'sourceUrl',
  'source_url',
  'Original_URL',
  'original_url',
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
    } else if (arg === '--proxies') {
      options.proxies = parseProxyList(argv[i + 1]);
      i += 1;
    } else if (arg === '--headful') {
      options.headful = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsageAndExit(0);
    } else {
      console.warn(`[WARN] Ignoring unknown argument: ${arg}`);
    }
  }

  if (!options.proxies) {
    options.proxies = parseProxyList(process.env.SCRAPER_PROXIES_AUTH || process.env.SCRAPER_PROXIES);
  }

  if (!options.input && !options.url) {
    printUsageAndExit(1);
  }

  return options;
}

function printUsageAndExit(code: number): never {
  const usage = [
    'Usage:',
    '  pnpm scrape:wko-profiles -- --input ./input.csv --output ./wko-profiles.csv',
    '  pnpm scrape:wko-profiles -- --url https://firmen.wko.at/example/burgenland/?firmaid=...',
    '',
    'Options:',
    '  --input <path>        CSV file containing WKO profile URLs',
    '  --output <path>       Output CSV path',
    '  --url <url>           Scrape a single WKO profile URL',
    '  --concurrency <n>     Number of parallel pages, default 3',
    '  --batchSize <n>       Process in chunks of n URLs, default 50',
    '  --limit <n>           Limit number of CSV rows to process',
    '  --proxies <list>      Comma-separated proxies: http://host:port or http://host:port|user|pass',
    '  --headful             Launch visible Chrome instead of headless',
  ].join('\n');

  console.error(usage);
  process.exit(code);
}

function parseProxyEntry(entry: string): ProxyConfig {
  const trimmed = entry.trim();
  if (!trimmed) {
    throw new Error('Empty proxy entry');
  }

  const authParts = trimmed.split('|');
  if (authParts.length === 3) {
    const [server, username, password] = authParts.map((part) => part.trim());
    if (!server || !username || !password) {
      throw new Error(`Invalid auth proxy entry: ${entry}`);
    }
    return {
      server,
      username,
      password,
      raw: `${server}|${username}|${password}`,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      const server = `${parsed.protocol}//${parsed.host}`;
      return {
        server,
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        raw: trimmed,
      };
    }
  } catch {
    // Fallback to plain server-style parsing below.
  }

  return {
    server: trimmed,
    raw: trimmed,
  };
}

function parseProxyList(value?: string): ProxyConfig[] | undefined {
  if (!value) {
    return undefined;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return undefined;
  }

  return entries.map((entry) => parseProxyEntry(entry));
}

async function testProxyConnectivity(proxy?: ProxyConfig): Promise<ProxyHealthResult> {
  const context = await request.newContext({
    timeout: 12000,
    proxy: proxy
      ? {
        server: proxy.server,
        username: proxy.username,
        password: proxy.password,
      }
      : undefined,
  });

  try {
    const response = await context.get('https://api.ipify.org?format=json', { timeout: 10000 });
    if (!response.ok()) {
      return {
        proxy,
        ok: false,
        error: `HTTP ${response.status()} from ipify`,
      };
    }

    const data = await response.json();
    return {
      proxy,
      ok: true,
      publicIp: typeof data?.ip === 'string' ? data.ip : undefined,
    };
  } catch (error) {
    return {
      proxy,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.dispose();
  }
}

async function filterHealthyProxies(proxies: ProxyConfig[]): Promise<ProxyConfig[]> {
  if (proxies.length === 0) {
    return [];
  }

  console.log(`[INFO] Preflight testing ${proxies.length} configured proxy/proxies...`);
  const healthy: ProxyConfig[] = [];

  for (const proxy of proxies) {
    const result = await testProxyConnectivity(proxy);
    if (result.ok) {
      healthy.push(proxy);
      console.log(`[INFO] Proxy OK: ${proxy.raw} -> ${result.publicIp || 'IP unknown'}`);
    } else {
      console.warn(`[WARN] Proxy skipped: ${proxy.raw} -> ${result.error || 'Unknown error'}`);
    }
  }

  console.log(`[INFO] Proxy preflight done: ${healthy.length}/${proxies.length} healthy.`);
  return healthy;
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeLabel(value: string): string {
  return normalizeWhitespace(value).replace(/\s*:\s*$/, '');
}

function safeJsonStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value) && value.length === 0) {
    return '[]';
  }

  if (!Array.isArray(value) && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0) {
    return '{}';
  }

  return JSON.stringify(value);
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
    if (value && /^https?:\/\/firmen\.wko\.at\//i.test(value.trim())) {
      return value.trim();
    }
  }

  for (const value of Object.values(row)) {
    if (value && /^https?:\/\/firmen\.wko\.at\//i.test(value.trim())) {
      return value.trim();
    }
  }

  return null;
}

function proxyKey(proxy?: ProxyConfig): string {
  if (!proxy) {
    return '__local__';
  }
  return `${proxy.server}|${proxy.username || ''}|${proxy.password || ''}`;
}

async function launchBrowser(headful: boolean, proxy?: ProxyConfig): Promise<Browser> {
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
  const playwrightProxy = proxy
    ? {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password,
    }
    : undefined;

  try {
    return await chromium.launch({
      ...launchArgs,
      channel: 'chrome',
      proxy: playwrightProxy,
    });
  } catch (error) {
    console.warn('[WARN] Falling back to bundled Playwright Chromium:', error);
    return chromium.launch({
      ...launchArgs,
      proxy: playwrightProxy,
    });
  }
}

async function acceptCookiesIfPresent(page: Page): Promise<void> {
  const cookieButton = page.locator('button.set-single-cookie, button.set-cookie-all').first();

  try {
    if (await cookieButton.count() > 0 && await cookieButton.isVisible()) {
      await cookieButton.click({ timeout: 2000 });
      await page.waitForTimeout(400);
    }
  } catch {
    // Ignore cookie UI issues; core profile data is still available without this.
  }
}

class BrowserPool {
  private readonly browsers = new Map<string, Browser>();

  constructor(private readonly headful: boolean) {}

  async getBrowser(proxy?: ProxyConfig): Promise<Browser> {
    const key = proxyKey(proxy);
    const existing = this.browsers.get(key);
    if (existing) {
      return existing;
    }

    const browser = await launchBrowser(this.headful, proxy);
    this.browsers.set(key, browser);
    return browser;
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.browsers.values()).map(async (browser) => {
        try {
          await browser.close();
        } catch {
          // Ignore close errors during shutdown.
        }
      })
    );
    this.browsers.clear();
  }
}

async function extractProfile(page: Page): Promise<PageExtraction> {
  return page.evaluate(() => {
    const clean = (value: string | null | undefined): string =>
      (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

    const normalizeLabelInner = (value: string): string => clean(value).replace(/\s*:\s*$/, '');
    const textWithBreaks = (element: Element | null): string => {
      if (!element) {
        return '';
      }

      const parts: string[] = [];

      Array.from(element.childNodes).forEach((node) => {
        if (node.nodeName === 'BR') {
          parts.push('\n');
          return;
        }

        parts.push(clean(node.textContent || ''));
      });

      return parts
        .join('\n')
        .replace(/\n{2,}/g, '\n')
        .split('\n')
        .map((part) => clean(part))
        .filter(Boolean)
        .join('\n');
    };

    const copySuffixPattern = /\s+In die Zwischenablage kopieren$/i;
    const knownSections = new Set([
      'company-info',
      'ueber-uns',
      'produkte',
      'firmendaten',
      'berechtigungen',
      'auszeichnungen',
      'standorte',
      'offenlegung',
    ]);

    const getText = (selector: string): string => clean(document.querySelector(selector)?.textContent || '');
    const getHref = (selector: string): string => document.querySelector<HTMLAnchorElement>(selector)?.href || '';

    const extractDefinitionPairs = (root: ParentNode): Record<string, string> => {
      const result: Record<string, string> = {};

      Array.from(root.querySelectorAll('dt')).forEach((dt) => {
        let sibling = dt.nextElementSibling;
        while (sibling && sibling.tagName !== 'DD') {
          sibling = sibling.nextElementSibling;
        }

        const label = normalizeLabelInner(dt.textContent || '');
        const value = clean(sibling?.textContent || '').replace(copySuffixPattern, '');

        if (label) {
          result[label] = value;
        }
      });

      return result;
    };

    const sectionNodes = Array.from(document.querySelectorAll<HTMLElement>('section[id]'));
    const availableSectionIds = sectionNodes.map((section) => section.id);
    const sectionHeadings: Record<string, string> = {};

    sectionNodes.forEach((section) => {
      const heading = clean(section.querySelector('h1, h2, h3, h4')?.textContent || '');
      sectionHeadings[section.id] = heading;
    });

    const otherSections = sectionNodes
      .filter((section) => !knownSections.has(section.id))
      .map((section) => ({
        id: section.id,
        heading: sectionHeadings[section.id] || '',
        preview: clean(section.textContent || '').slice(0, 300),
      }));

    const siteHeaderTitle = getText('#site-main-header');
    const pageTitle = document.title || siteHeaderTitle;
    const rawPageNoticeText = clean(document.querySelector('main')?.textContent || document.body.textContent || '').slice(0, 1500);
    const h1Text = clean(document.querySelector('h1')?.textContent || '');

    const firmDataRows = Array.from(document.querySelectorAll('#firmendaten .company-data-list-item')).map((row) => {
      const label = normalizeLabelInner(row.querySelector('dt')?.textContent || '');
      const value = clean(row.querySelector('dd')?.textContent || '').replace(copySuffixPattern, '');

      return { label, value };
    }).filter((row) => row.label);

    const firmData = firmDataRows.reduce<Record<string, string>>((acc, row) => {
      acc[row.label] = row.value;
      return acc;
    }, {});

    const permissions = Array.from(document.querySelectorAll('#berechtigungen .card')).map((card) => {
      const heading = clean(card.querySelector('h4')?.textContent || '');
      const summaryLines = Array.from(card.querySelectorAll('.card-body-container p'))
        .map((node) => clean(node.textContent))
        .filter(Boolean);
      const detailContainer = card.querySelector('[hidden]') || card;
      const details = extractDefinitionPairs(detailContainer);

      return {
        heading,
        summaryLines,
        details,
      };
    });

    const awards = Array.from(document.querySelectorAll('#auszeichnungen .card')).map((card) => {
      const title = clean(card.querySelector('h4')?.textContent || '');
      const description = clean(
        card.querySelector('.card-body-wrapper p')?.textContent
        || card.querySelector('.card-body-container p')?.textContent
        || ''
      );
      const imageUrl = card.querySelector<HTMLImageElement>('img')?.src || '';
      const links = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .map((anchor) => anchor.href)
        .filter((href) => href && !href.startsWith('javascript:'));
      const details = extractDefinitionPairs(card.querySelector('.card-body-wrapper') || card);

      return {
        title,
        description,
        imageUrl,
        links,
        details,
      };
    });

    const locations = Array.from(document.querySelectorAll('#standorte .accordion-item')).map((item) => {
      const buttonText = clean(item.querySelector('button')?.textContent || '');
      const countLabel = clean(item.querySelector('.counter-simple')?.textContent || '');
      const region = clean(buttonText.replace(countLabel, ''));
      const entries = Array.from(item.querySelectorAll<HTMLAnchorElement>('.accordion-body a[href]')).map((anchor) => ({
        label: clean(anchor.textContent),
        href: anchor.href,
        isActive: anchor.classList.contains('active'),
      }));

      return {
        region,
        countLabel,
        entries,
      };
    });

    const disclosure = Array.from(document.querySelectorAll('#offenlegung .accordion-item')).map((item) => ({
      title: clean(item.querySelector('button')?.textContent || item.querySelector('h4')?.textContent || ''),
      details: extractDefinitionPairs(item.querySelector('.accordion-body') || item),
    }));

    const companyName = getText('#company-info h1[itemprop="name"], #company-info h1.detail-heading') || firmData.Firmenname || '';
    const categoryPills = Array.from(document.querySelectorAll('#company-info .category-pill'))
      .map((pill) => clean(pill.textContent))
      .filter(Boolean);
    const isLehrbetrieb = categoryPills.some((pill) => /lehrbetrieb/i.test(pill)) || !!document.querySelector('#ueber-uns a[href*="lehrbetriebsuebersicht.wko.at"]');

    const streetAddress = getText('#company-info [itemprop="streetAddress"]');
    const postalCode = getText('#company-info [itemprop="postalCode"]');
    const locality = getText('#company-info [itemprop="addressLocality"]');
    const fullAddress = clean([streetAddress, [postalCode, locality].filter(Boolean).join(' ')].filter(Boolean).join(', '));

    const aboutClone = document.querySelector('#ueber-uns')?.cloneNode(true) as HTMLElement | undefined;
    if (aboutClone) {
      aboutClone.querySelectorAll('.banner, script, style').forEach((node) => node.remove());
    }

    let pageState: PageState = 'unknown';
    if (companyName) {
      pageState = 'active_profile';
    } else if (/Keine aktive Gewerbeberechtigung/i.test(pageTitle) || /Keine aktive Gewerbeberechtigung/i.test(rawPageNoticeText)) {
      pageState = 'inactive_profile';
    } else if (
      /Access Denied/i.test(pageTitle)
      || /Access Denied/i.test(h1Text)
      || /Access Denied/i.test(rawPageNoticeText)
      || /Signature ID\s*:/i.test(rawPageNoticeText)
      || /Message ID\s*:/i.test(rawPageNoticeText)
      || /Client IP\s*:/i.test(rawPageNoticeText)
    ) {
      pageState = 'access_denied';
    } else if (
      /Online Hilfe/i.test(pageTitle)
      || /^WKO Firmen A-Z & Lehrbetriebsübersicht/i.test(pageTitle)
      || /^WKO Firmen A-Z & Lehrbetriebsübersicht/i.test(siteHeaderTitle)
      || /WKO Firmen A-Z & Lehrbetriebsübersicht/i.test(rawPageNoticeText)
    ) {
      pageState = 'help_page';
    }

    return {
      pageTitle,
      pageState,
      pageNoticeText: pageState === 'active_profile' ? '' : rawPageNoticeText,
      availableSectionIds,
      sectionHeadings,
      otherSections,
      companyName,
      categoryPills,
      isLehrbetrieb,
      phone: getText('#company-info [itemprop="telephone"]'),
      email: getText('#company-info [itemprop="email"]'),
      website: getHref('#company-info a[href][data-gtm-event="kontaktinfo-web-click"], #company-info [itemprop="url"]') || getText('#company-info [itemprop="url"]'),
      streetAddress,
      postalCode,
      locality,
      fullAddress,
      routeUrl: getHref('#company-info a[href*="maps.google.com"]'),
      aboutText: clean(aboutClone?.textContent || ''),
      lehrbetriebNoticeText: clean(document.querySelector('#ueber-uns .banner-text')?.textContent || ''),
      lehrbetriebDetailUrl: getHref('#ueber-uns a[href*="lehrbetriebsuebersicht.wko.at"]'),
      productsText: textWithBreaks(document.querySelector('#produkte p[itemprop="description"]')),
      firmData,
      permissions,
      awards,
      locations,
      disclosure,
    };
  });
}

function emptyRecord(sourceUrl: string, sourceRow: RawRow): ScrapedWkoProfileRecord {
  return {
    ...sourceRow,
    sourceUrl,
    finalUrl: '',
    pageTitle: '',
    pageState: '',
    pageNoticeText: '',
    availableSectionIds: '',
    sectionHeadingsJson: '',
    otherSectionsJson: '',
    companyName: '',
    categoryPillsJson: '',
    isLehrbetrieb: '',
    phone: '',
    email: '',
    website: '',
    streetAddress: '',
    postalCode: '',
    locality: '',
    fullAddress: '',
    routeUrl: '',
    aboutText: '',
    lehrbetriebNoticeText: '',
    lehrbetriebDetailUrl: '',
    productsText: '',
    firmDataJson: '',
    registeredFirmName: '',
    registryNumber: '',
    court: '',
    gln: '',
    uidNumber: '',
    supervisionAuthority: '',
    permissionsCount: '',
    permissionsJson: '',
    awardsCount: '',
    awardsJson: '',
    locationsCount: '',
    locationsJson: '',
    disclosureCount: '',
    disclosureJson: '',
    failureCategory: '',
    attemptCount: '0',
    proxyUsed: '',
    status: 'FAILED',
    error: '',
    scrapedAt: new Date().toISOString(),
  };
}

function shortAccessDeniedMessage(pageTitle: string, pageNoticeText: string): string {
  const source = normalizeWhitespace(`${pageTitle} ${pageNoticeText}`);
  if (!source) {
    return 'Access denied';
  }

  return source.slice(0, 180);
}

function isRetryableAccessDenied(result: ScrapedWkoProfileRecord): boolean {
  return result.pageState === 'access_denied';
}

async function scrapeProfile(browser: Browser, record: InputRecord, proxy?: ProxyConfig): Promise<ScrapedWkoProfileRecord> {
  const result = emptyRecord(record.sourceUrl, record.sourceRow);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1200 },
    locale: 'de-AT',
    extraHTTPHeaders: {
      'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
    },
  });

  try {
    const page = await context.newPage();

    const randomDelay = Math.floor(Math.random() * 2000) + 1200;
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    await page.goto(record.sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page.waitForSelector('main, body', { timeout: 10000 }).catch(() => undefined);
    await acceptCookiesIfPresent(page);

    const extracted = await extractProfile(page);

    result.finalUrl = page.url();
    result.pageTitle = extracted.pageTitle;
    result.pageState = extracted.pageState;
    result.pageNoticeText = extracted.pageNoticeText;
    result.availableSectionIds = safeJsonStringify(extracted.availableSectionIds);
    result.sectionHeadingsJson = safeJsonStringify(extracted.sectionHeadings);
    result.otherSectionsJson = safeJsonStringify(extracted.otherSections);
    result.companyName = extracted.companyName;
    result.categoryPillsJson = safeJsonStringify(extracted.categoryPills);
    result.isLehrbetrieb = String(extracted.isLehrbetrieb);
    result.phone = extracted.phone;
    result.email = extracted.email;
    result.website = extracted.website;
    result.streetAddress = extracted.streetAddress;
    result.postalCode = extracted.postalCode;
    result.locality = extracted.locality;
    result.fullAddress = extracted.fullAddress;
    result.routeUrl = extracted.routeUrl;
    result.aboutText = extracted.aboutText;
    result.lehrbetriebNoticeText = extracted.lehrbetriebNoticeText;
    result.lehrbetriebDetailUrl = extracted.lehrbetriebDetailUrl;
    result.productsText = extracted.productsText;
    result.firmDataJson = safeJsonStringify(extracted.firmData);
    result.registeredFirmName = extracted.firmData.Firmenname || '';
    result.registryNumber = extracted.firmData.Firmenbuchnummer || '';
    result.court = extracted.firmData.Firmengericht || '';
    result.gln = extracted.firmData.GLN || '';
    result.uidNumber = extracted.firmData['UID-Nummer'] || '';
    result.supervisionAuthority = extracted.firmData['Weitere Aufsichtsbehörde (gem. ECG)'] || '';
    result.permissionsCount = String(extracted.permissions.length);
    result.permissionsJson = safeJsonStringify(extracted.permissions);
    result.awardsCount = String(extracted.awards.length);
    result.awardsJson = safeJsonStringify(extracted.awards);
    result.locationsCount = String(extracted.locations.length);
    result.locationsJson = safeJsonStringify(extracted.locations);
    result.disclosureCount = String(extracted.disclosure.length);
    result.disclosureJson = safeJsonStringify(extracted.disclosure);
    result.proxyUsed = proxy?.raw || '';
    result.status = extracted.pageState === 'access_denied' ? 'FAILED' : 'SUCCESS';
    result.failureCategory = extracted.pageState === 'access_denied' ? 'ACCESS_DENIED' : '';
    result.error = extracted.pageState === 'access_denied'
      ? shortAccessDeniedMessage(extracted.pageTitle, extracted.pageNoticeText)
      : '';
    result.scrapedAt = new Date().toISOString();

    return result;
  } catch (error) {
    result.proxyUsed = proxy?.raw || '';
    result.error = error instanceof Error ? error.message : String(error);
    result.scrapedAt = new Date().toISOString();
    return result;
  } finally {
    await context.close();
  }
}

async function scrapeProfileWithRetries(
  browserPool: BrowserPool,
  record: InputRecord,
  proxyList: (ProxyConfig | undefined)[],
  startPoolIndex: number
): Promise<ScrapedWkoProfileRecord> {
  const totalAttempts = Math.max(1, proxyList.length);
  let lastResult = emptyRecord(record.sourceUrl, record.sourceRow);

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    const proxy = proxyList[(startPoolIndex + attempt) % proxyList.length];
    const browser = await browserPool.getBrowser(proxy);
    const result = await scrapeProfile(browser, record, proxy);
    result.attemptCount = String(attempt + 1);
    result.proxyUsed = proxy?.raw || '';

    if (!isRetryableAccessDenied(result)) {
      return result;
    }

    lastResult = result;

    if (attempt < totalAttempts - 1) {
      const retryDelay = 800 + Math.floor(Math.random() * 1200);
      console.log(`[WARN] Access denied for ${record.sourceUrl}. Retrying in ${retryDelay}ms ${proxy ? `after proxy ${proxy.raw}` : 'after local attempt'}.`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  lastResult.status = 'FAILED';
  lastResult.pageState = 'access_denied';
  lastResult.failureCategory = 'ACCESS_DENIED';
  lastResult.error = lastResult.error || 'Access denied after retry pool exhausted';
  lastResult.scrapedAt = new Date().toISOString();
  return lastResult;
}

async function getAlreadyScrapedUrls(outputPath: string): Promise<Set<string>> {
  const scrapedUrls = new Set<string>();

  if (!(await fs.pathExists(outputPath))) {
    return scrapedUrls;
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(outputPath)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        if (row.status === 'SUCCESS' && row.sourceUrl) {
          scrapedUrls.add(row.sourceUrl);
        }
      })
      .on('end', () => resolve(scrapedUrls))
      .on('error', reject);
  });
}

function verifyBatchQuality(batchResults: ScrapedWkoProfileRecord[]): { ok: boolean; message: string } {
  if (batchResults.length === 0) {
    return { ok: true, message: 'Empty batch' };
  }

  const failures = batchResults.filter((result) => result.status === 'FAILED').length;
  const blocked = batchResults.filter((result) => result.failureCategory === 'ACCESS_DENIED').length;
  const activeProfiles = batchResults.filter((result) => result.status === 'SUCCESS' && result.pageState === 'active_profile');
  const missingCoreData = activeProfiles.filter((result) => !result.companyName || !result.fullAddress).length;

  const failureRate = failures / batchResults.length;
  const missingRate = activeProfiles.length === 0 ? 0 : missingCoreData / activeProfiles.length;

  if (failureRate > 0.2) {
    return { ok: false, message: `High failure rate: ${(failureRate * 100).toFixed(1)}% failed.` };
  }

  if (missingRate > 0.3) {
    return { ok: false, message: `High degradation: ${(missingRate * 100).toFixed(1)}% of active profiles missed core fields.` };
  }

  return {
    ok: true,
    message: `Quality OK (Failed: ${(failureRate * 100).toFixed(1)}%, Access denied: ${blocked}/${batchResults.length}, Missing active core data: ${(missingRate * 100).toFixed(1)}%)`,
  };
}

async function writeOutput(records: ScrapedWkoProfileRecord[], outputPath: string, append: boolean): Promise<void> {
  const keySet = new Set<string>();

  records.forEach((record) => {
    Object.keys(record).forEach((key) => keySet.add(key));
  });

  const orderedKeys = [
    'sourceUrl',
    'finalUrl',
    'pageTitle',
    'pageState',
    'pageNoticeText',
    'availableSectionIds',
    'sectionHeadingsJson',
    'otherSectionsJson',
    'companyName',
    'categoryPillsJson',
    'isLehrbetrieb',
    'phone',
    'email',
    'website',
    'streetAddress',
    'postalCode',
    'locality',
    'fullAddress',
    'routeUrl',
    'aboutText',
    'lehrbetriebNoticeText',
    'lehrbetriebDetailUrl',
    'productsText',
    'firmDataJson',
    'registeredFirmName',
    'registryNumber',
    'court',
    'gln',
    'uidNumber',
    'supervisionAuthority',
    'permissionsCount',
    'permissionsJson',
    'awardsCount',
    'awardsJson',
    'locationsCount',
    'locationsJson',
    'disclosureCount',
    'disclosureJson',
    'failureCategory',
    'attemptCount',
    'proxyUsed',
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
    append,
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

function defaultOutputPath(): string {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ];

  return path.join('output', `wko-profile-scrape-${parts.join('-')}.csv`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const outputPath = options.output || defaultOutputPath();

  let inputRecords: InputRecord[] = [];

  if (options.url) {
    inputRecords = [{
      sourceRow: {},
      sourceUrl: options.url,
    }];
  } else if (options.input) {
    inputRecords = await readInputRecords(options.input);
  }

  if (typeof options.limit === 'number') {
    inputRecords = inputRecords.slice(0, options.limit);
  }

  const alreadyScrapedUrls = await getAlreadyScrapedUrls(outputPath);
  const pendingRecords = inputRecords.filter((record) => !alreadyScrapedUrls.has(record.sourceUrl));

  console.log(`[INFO] Total input records: ${inputRecords.length}`);
  console.log(`[INFO] Already scraped successfully: ${alreadyScrapedUrls.size}`);
  console.log(`[INFO] Pending records: ${pendingRecords.length}`);

  if (pendingRecords.length === 0) {
    console.log('[INFO] Nothing to scrape.');
    return;
  }

  const healthyProxies = options.proxies && options.proxies.length > 0
    ? await filterHealthyProxies(options.proxies)
    : [];

  const proxyList: (ProxyConfig | undefined)[] = [undefined, ...healthyProxies];

  const browserPool = new BrowserPool(options.headful);
  let append = await fs.pathExists(outputPath);

  try {
    for (let offset = 0; offset < pendingRecords.length; offset += options.batchSize) {
      const batch = pendingRecords.slice(offset, offset + options.batchSize);
      console.log(`[INFO] Processing batch ${Math.floor(offset / options.batchSize) + 1} with ${batch.length} URLs...`);

      const batchResults = await runWithConcurrency(batch, options.concurrency, async (record, index) => {
        const absoluteIndex = offset + index + 1;
        const startPoolIndex = (absoluteIndex - 1) % proxyList.length;
        const startingProxy = proxyList[startPoolIndex];
        console.log(`[INFO] [${absoluteIndex}/${pendingRecords.length}] Scraping ${record.sourceUrl} ${startingProxy ? `(Start proxy: ${startingProxy.raw})` : '(Start: local machine)'}`);
        const scraped = await scrapeProfileWithRetries(browserPool, record, proxyList, startPoolIndex);
        console.log(`[INFO] [${absoluteIndex}/${pendingRecords.length}] ${scraped.status}${scraped.failureCategory ? ` (${scraped.failureCategory})` : ''} after ${scraped.attemptCount} attempt(s)`);
        if (scraped.error) {
          console.log(`[WARN] ${scraped.error}`);
        }
        return scraped;
      });

      await writeOutput(batchResults, outputPath, append);
      append = true;

      const quality = verifyBatchQuality(batchResults);
      console.log(`[INFO] ${quality.message}`);

      if (!quality.ok) {
        console.warn('[WARN] Stopping early because batch quality fell below threshold.');
        break;
      }
    }
  } finally {
    await browserPool.closeAll();
  }

  console.log(`[INFO] Output saved to ${outputPath}`);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
