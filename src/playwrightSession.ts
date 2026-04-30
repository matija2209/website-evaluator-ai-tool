import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { consentHandlingConfig } from '../config';
import type { PagePreparationResult } from './types';
import { preparePageForAutomation } from './pagePreparation';

const BASE_CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--window-size=1920,1080'
];

export interface PreparedPageSession {
  browser?: Browser;
  context: BrowserContext;
  page: Page;
  domain: string;
  storageStatePath: string;
  pagePreparation: PagePreparationResult;
  close(): Promise<void>;
}

interface SharedSessionOptions {
  url: string;
  userAgent: string;
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeoutMs: number;
  runLogPath?: string;
  purpose: string;
  beforeNavigation?: (page: Page) => Promise<void>;
}

interface MobileSessionOptions extends SharedSessionOptions {
  viewport: { width: number; height: number };
  isMobile: boolean;
}

function ensureDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'invalid-domain';
  }
}

async function appendPreparationLog(
  logPath: string | undefined,
  payload: Record<string, unknown>
): Promise<void> {
  if (!logPath) {
    return;
  }

  await fs.ensureDir(path.dirname(logPath));
  await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
}

async function launchPersistentContext(
  userDataDir: string,
  userAgent: string,
  extensionPath: string | undefined
): Promise<{ context: BrowserContext; extensionActive: boolean }> {
  const contextOptions = {
    headless: true,
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    locale: consentHandlingConfig.locale,
    userAgent,
    extraHTTPHeaders: {
      'Accept-Language': consentHandlingConfig.acceptLanguage
    },
    args: [...BASE_CHROMIUM_ARGS]
  };

  if (extensionPath) {
    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        ...contextOptions,
        channel: 'chromium',
        args: [
          ...contextOptions.args,
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`
        ]
      });
      return { context, extensionActive: true };
    } catch (error) {
      console.warn(`[WARN] Failed to launch with Consent-O-Matic extension: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const context = await chromium.launchPersistentContext(userDataDir, contextOptions);
  return { context, extensionActive: false };
}

export class PlaywrightSessionManager {
  private cacheDirectory: string;

  constructor() {
    this.cacheDirectory = consentHandlingConfig.cacheDirectory;
  }

  private getDomainPaths(domain: string) {
    return {
      userDataDir: path.join(this.cacheDirectory, 'user-data', domain),
      storageStatePath: path.join(this.cacheDirectory, 'storage', `${domain}.json`)
    };
  }

  async openPreparedDesktopSession(options: SharedSessionOptions): Promise<PreparedPageSession> {
    const domain = ensureDomain(options.url);
    const { userDataDir, storageStatePath } = this.getDomainPaths(domain);
    await fs.ensureDir(userDataDir);
    await fs.ensureDir(path.dirname(storageStatePath));

    const extensionPath = !consentHandlingConfig.disableExtension && consentHandlingConfig.extensionPath
      && await fs.pathExists(consentHandlingConfig.extensionPath)
      ? consentHandlingConfig.extensionPath
      : undefined;

    const hadStoredState = await fs.pathExists(storageStatePath);
    const { context, extensionActive } = await launchPersistentContext(userDataDir, options.userAgent, extensionPath);

    try {
      const page = context.pages()[0] || await context.newPage();

      if (options.beforeNavigation) {
        await options.beforeNavigation(page);
      }

      await page.goto(options.url, {
        waitUntil: options.waitUntil,
        timeout: options.timeoutMs
      });

      const pagePreparation = await preparePageForAutomation(page, context, options.url, {
        config: consentHandlingConfig,
        hadStoredState,
        extensionActive
      });

      await context.storageState({ path: storageStatePath });
      await appendPreparationLog(options.runLogPath, {
        timestamp: new Date().toISOString(),
        domain,
        url: options.url,
        purpose: options.purpose,
        pagePreparation
      });

      return {
        context,
        page,
        domain,
        storageStatePath,
        pagePreparation,
        close: async () => {
          await context.close();
        }
      };
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  async openPreparedMobileSession(options: MobileSessionOptions): Promise<PreparedPageSession> {
    const domain = ensureDomain(options.url);
    const { storageStatePath } = this.getDomainPaths(domain);
    const browser = await chromium.launch({
      headless: true,
      args: [...BASE_CHROMIUM_ARGS]
    });

    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        locale: consentHandlingConfig.locale,
        userAgent: options.userAgent,
        extraHTTPHeaders: {
          'Accept-Language': consentHandlingConfig.acceptLanguage
        },
        viewport: options.viewport,
        isMobile: options.isMobile,
        storageState: await fs.pathExists(storageStatePath) ? storageStatePath : undefined
      });
      const page = await context.newPage();

      if (options.beforeNavigation) {
        await options.beforeNavigation(page);
      }

      await page.goto(options.url, {
        waitUntil: options.waitUntil,
        timeout: options.timeoutMs
      });

      const pagePreparation = await preparePageForAutomation(page, context, options.url, {
        config: consentHandlingConfig,
        hadStoredState: await fs.pathExists(storageStatePath),
        extensionActive: false
      });

      await appendPreparationLog(options.runLogPath, {
        timestamp: new Date().toISOString(),
        domain,
        url: options.url,
        purpose: options.purpose,
        device: 'mobile',
        pagePreparation
      });

      return {
        browser,
        context,
        page,
        domain,
        storageStatePath,
        pagePreparation,
        close: async () => {
          await context.close();
          await browser.close();
        }
      };
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  getPreparationLogPath(runDir: string): string {
    return path.join(runDir, 'page-preparation.ndjson');
  }

  getDomainFromUrl(url: string): string {
    return ensureDomain(url);
  }
}
