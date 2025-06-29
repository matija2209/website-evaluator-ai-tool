import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
const dayjs = require('dayjs');
const csvParser = require('csv-parser');
import { createObjectCsvWriter } from 'csv-writer';
import { 
  ScreenshotConfig, 
  ScreenshotResult, 
  ViewportConfig, 
  BrowserPoolConfig,
  ScreenshotProgressData 
} from './types';
import { 
  screenshotConfig, 
  viewportConfigs, 
  browserPoolConfig,
  config 
} from '../config';

// Browser Pool Management
class BrowserPool {
  private browsers: Browser[] = [];
  private availableBrowsers: Browser[] = [];
  private pageCounters: Map<Browser, number> = new Map();
  private config: BrowserPoolConfig;

  constructor(config: BrowserPoolConfig) {
    this.config = config;
  }

  async initialize(concurrency: number): Promise<void> {
    console.log(`[INFO] Initializing browser pool with ${concurrency} browsers...`);
    
    const browserCount = Math.min(concurrency, this.config.maxBrowsers);
    
    for (let i = 0; i < browserCount; i++) {
      try {
        const browser = await this.createBrowser();
        this.browsers.push(browser);
        this.availableBrowsers.push(browser);
        this.pageCounters.set(browser, 0);
        console.log(`[INFO] Browser ${i + 1}/${browserCount} initialized`);
      } catch (error) {
        console.error(`[ERROR] Failed to initialize browser ${i + 1}: ${error}`);
        throw error;
      }
    }
  }

  private async createBrowser(): Promise<Browser> {
    return await chromium.launch({
      headless: true,
      timeout: this.config.launchTimeout,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
  }

  async getBrowser(): Promise<Browser> {
    // Wait for available browser
    while (this.availableBrowsers.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const browser = this.availableBrowsers.pop()!;
    const pageCount = this.pageCounters.get(browser) || 0;

    // Check if browser needs restart due to page limit
    if (pageCount >= this.config.restartAfterPages) {
      console.log(`[INFO] Restarting browser after ${pageCount} pages`);
      try {
        await browser.close();
        const newBrowser = await this.createBrowser();
        this.pageCounters.set(newBrowser, 0);
        return newBrowser;
      } catch (error) {
        console.error(`[ERROR] Failed to restart browser: ${error}`);
      }
    }

    return browser;
  }

  releaseBrowser(browser: Browser): void {
    const currentCount = this.pageCounters.get(browser) || 0;
    this.pageCounters.set(browser, currentCount + 1);
    this.availableBrowsers.push(browser);
  }

  async cleanup(): Promise<void> {
    console.log('[INFO] Cleaning up browser pool...');
    await Promise.all(this.browsers.map(async (browser) => {
      try {
        await browser.close();
      } catch (error) {
        console.error('[ERROR] Failed to close browser:', error);
      }
    }));
    this.browsers = [];
    this.availableBrowsers = [];
    this.pageCounters.clear();
  }
}

// Screenshot Processing
class ScreenshotProcessor {
  private config: ScreenshotConfig;
  private viewports: ViewportConfig[];

  constructor(config: ScreenshotConfig, viewports: ViewportConfig[]) {
    this.config = config;
    this.viewports = viewports;
  }

  async processUrl(
    url: string, 
    companyName: string, 
    runId: string, 
    browser: Browser
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();
    const domain = this.extractDomain(url);
    const normalizedUrl = this.normalizeUrl(url);
    
    const result: ScreenshotResult = {
      url: normalizedUrl,
      domain,
      companyName,
      status: 'FAILED',
      desktopSections: 0,
      mobileSections: 0,
      loadTimeMs: 0,
      retryCount: 0,
      timestamp: dayjs().toISOString(),
      screenshotPaths: {
        desktop: [],
        mobile: []
      }
    };

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // Create folder structure
      const screenshotDir = await this.createFolderStructure(runId, domain);
      
      // Create browser context
      context = await browser.newContext({
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      page = await context.newPage();

      // Navigate to page
      console.log(`[INFO] Loading ${domain}...`);
      
      await page.goto(normalizedUrl, { 
        waitUntil: 'networkidle',
        timeout: this.config.pageTimeout 
      });

      // Wait for content if enabled
      if (this.config.enableContentWait) {
        await this.waitForContent(page);
      }

      // Capture screenshots for each viewport
      for (const viewport of this.viewports) {
        console.log(`[INFO] Capturing ${viewport.name} screenshots for ${domain}...`);
        
        const sections = await this.captureViewportSections(
          page, 
          viewport, 
          path.join(screenshotDir, viewport.name)
        );

        if (viewport.name === 'desktop') {
          result.desktopSections = sections;
          result.screenshotPaths.desktop = this.generateSectionPaths(
            runId, domain, 'desktop', sections
          );
        } else {
          result.mobileSections = sections;
          result.screenshotPaths.mobile = this.generateSectionPaths(
            runId, domain, 'mobile', sections
          );
        }
      }

      result.status = 'SUCCESS';
      result.loadTimeMs = Date.now() - startTime;
      
      console.log(`[SUCCESS] ${domain}: ${result.desktopSections} desktop, ${result.mobileSections} mobile sections (${(result.loadTimeMs / 1000).toFixed(1)}s)`);

    } catch (error) {
      result.errorMessage = error instanceof Error ? error.message : String(error);
      result.loadTimeMs = Date.now() - startTime;
      console.error(`[ERROR] ${domain}: ${result.errorMessage}`);
    } finally {
      // Cleanup
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.error(`[WARN] Failed to close page for ${domain}:`, error);
        }
      }
      if (context) {
        try {
          await context.close();
        } catch (error) {
          console.error(`[WARN] Failed to close context for ${domain}:`, error);
        }
      }
    }

    return result;
  }

  private async waitForContent(page: Page): Promise<void> {
    try {
      await page.waitForFunction(() => {
        return document.body.scrollHeight > 100 && 
               document.querySelectorAll('img, div, p, h1, h2, h3').length > 0;
      }, { timeout: 10000 });
      
      await page.waitForTimeout(this.config.scrollDelay);
    } catch (error) {
      console.log(`[WARN] Content wait timeout - proceeding with screenshots`);
    }
  }

  private async captureViewportSections(
    page: Page, 
    viewport: ViewportConfig, 
    outputDir: string
  ): Promise<number> {
    await fs.ensureDir(outputDir);
    
    // Set viewport
    await page.setViewportSize({ 
      width: viewport.width, 
      height: viewport.height 
    });

    // Get total page height
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const sectionsNeeded = Math.ceil(totalHeight / viewport.sectionHeight);
    
    console.log(`[INFO] ${viewport.name}: ${totalHeight}px tall, ${sectionsNeeded} sections needed`);

    for (let i = 0; i < sectionsNeeded; i++) {
      const scrollY = i * viewport.sectionHeight;
      
      // Scroll to position
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      
      // Wait for content to load after scroll
      await page.waitForTimeout(this.config.scrollDelay);

      // Take screenshot
      const screenshotPath = path.join(outputDir, `section-${i + 1}.jpeg`);
      
      await page.screenshot({
        path: screenshotPath,
        type: 'jpeg',
        quality: this.config.jpegQuality,
        fullPage: false
      });
    }

    return sectionsNeeded;
  }

  private async createFolderStructure(runId: string, domain: string): Promise<string> {
    const baseDir = path.join(config.paths.runsDirectory, runId, config.paths.screenshotsSubdir);
    const domainDir = path.join(baseDir, this.sanitizeFolderName(domain));
    
    await fs.ensureDir(path.join(domainDir, 'desktop'));
    await fs.ensureDir(path.join(domainDir, 'mobile'));
    
    return domainDir;
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch (error) {
      return 'invalid-domain';
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http')) {
      return 'https://' + url;
    }
    return url;
  }

  private sanitizeFolderName(name: string): string {
    return name.replace(/[\/\\:*?"<>|]/g, '-');
  }

  private generateSectionPaths(
    runId: string, 
    domain: string, 
    viewport: string, 
    sections: number
  ): string[] {
    const paths: string[] = [];
    const sanitizedDomain = this.sanitizeFolderName(domain);
    
    for (let i = 1; i <= sections; i++) {
      paths.push(`runs/${runId}/screenshots/${sanitizedDomain}/${viewport}/section-${i}.jpeg`);
    }
    
    return paths;
  }
}

// Progress Tracking
class ProgressTracker {
  private csvPath: string;
  private processedUrls: Map<string, ScreenshotResult> = new Map();

  constructor(csvPath: string) {
    this.csvPath = csvPath;
  }

  async loadExistingProgress(): Promise<void> {
    console.log('[INFO] Loading existing screenshot progress...');
    
    try {
      const data: ScreenshotProgressData[] = [];
      
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(this.csvPath)
          .pipe(csvParser())
          .on('data', (row: any) => data.push(row))
          .on('end', resolve)
          .on('error', reject);
      });

      let existingCount = 0;
      for (const row of data) {
        if (row.Screenshot_Status === 'SUCCESS' && row.Discovered_Website) {
          this.processedUrls.set(row.Discovered_Website, {
            url: row.Discovered_Website,
            domain: this.extractDomain(row.Discovered_Website),
            companyName: row.Company_Name,
            status: 'SUCCESS',
            desktopSections: parseInt(row.Desktop_Sections) || 0,
            mobileSections: parseInt(row.Mobile_Sections) || 0,
            loadTimeMs: parseInt(row.Load_Time_MS) || 0,
            retryCount: parseInt(row.Screenshot_Retry_Count) || 0,
            timestamp: row.Screenshot_Timestamp,
            screenshotPaths: { desktop: [], mobile: [] }
          });
          existingCount++;
        }
      }

      console.log(`[INFO] Found ${existingCount} existing successful screenshots`);
    } catch (error) {
      console.log('[INFO] No existing progress found, starting fresh');
    }
  }

  shouldSkipUrl(url: string): boolean {
    return this.processedUrls.has(url);
  }

  async updateCsvProgress(results: ScreenshotResult[]): Promise<void> {
    console.log('[INFO] Updating CSV with screenshot progress...');
    
    const resultsMap = new Map<string, ScreenshotResult>();
    results.forEach(result => resultsMap.set(result.url, result));

    const existingData: ScreenshotProgressData[] = [];
    
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(this.csvPath)
        .pipe(csvParser())
        .on('data', (row: any) => existingData.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    for (const row of existingData) {
      const result = resultsMap.get(row.Discovered_Website);
      if (result) {
        row.Screenshot_Status = result.status;
        row.Desktop_Sections = result.desktopSections.toString();
        row.Mobile_Sections = result.mobileSections.toString();
        row.Screenshot_Error = result.errorMessage || '';
        row.Load_Time_MS = result.loadTimeMs.toString();
        row.Screenshot_Retry_Count = result.retryCount.toString();
        row.Screenshot_Timestamp = result.timestamp;
      }
    }

    const csvWriter = createObjectCsvWriter({
      path: this.csvPath,
      header: [
        { id: 'Company_Name', title: 'Company_Name' },
        { id: 'Cleaned_Name', title: 'Cleaned_Name' },
        { id: 'City', title: 'City' },
        { id: 'Normalized_City', title: 'Normalized_City' },
        { id: 'Original_URL', title: 'Original_URL' },
        { id: 'Discovered_Website', title: 'Discovered_Website' },
        { id: 'Search_Status', title: 'Search_Status' },
        { id: 'Search_Query', title: 'Search_Query' },
        { id: 'Search_Error', title: 'Search_Error' },
        { id: 'SERP_Position', title: 'SERP_Position' },
        { id: 'AI_Confidence', title: 'AI_Confidence' },
        { id: 'AI_Reasoning', title: 'AI_Reasoning' },
        { id: 'Tokens_Used', title: 'Tokens_Used' },
        { id: 'Multiple_Valid_Found', title: 'Multiple_Valid_Found' },
        { id: 'Processing_Date', title: 'Processing_Date' },
        { id: 'Screenshot_Status', title: 'Screenshot_Status' },
        { id: 'Desktop_Sections', title: 'Desktop_Sections' },
        { id: 'Mobile_Sections', title: 'Mobile_Sections' },
        { id: 'Screenshot_Error', title: 'Screenshot_Error' },
        { id: 'Load_Time_MS', title: 'Load_Time_MS' },
        { id: 'Screenshot_Retry_Count', title: 'Screenshot_Retry_Count' },
        { id: 'Screenshot_Timestamp', title: 'Screenshot_Timestamp' }
      ]
    });

    await csvWriter.writeRecords(existingData);
    console.log('[INFO] CSV updated successfully');
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch (error) {
      return 'invalid-domain';
    }
  }

  generateSummaryReport(results: ScreenshotResult[], totalTimeMs: number): void {
    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'FAILED').length;
    const totalSections = results.reduce((sum, r) => sum + r.desktopSections + r.mobileSections, 0);
    const avgLoadTime = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.loadTimeMs, 0) / results.length / 1000 : 0;

    console.log('\n' + '='.repeat(60));
    console.log('📸 SCREENSHOT CAPTURE SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📱 Total sections captured: ${totalSections}`);
    console.log(`⏱️  Average load time: ${avgLoadTime.toFixed(1)}s`);
    console.log(`🕐 Total time: ${(totalTimeMs / 1000 / 60).toFixed(1)} minutes`);
    console.log('='.repeat(60) + '\n');
  }
}

// Main Screenshot Manager
export class ScreenshotManager {
  private browserPool: BrowserPool;
  private processor: ScreenshotProcessor;
  private config: ScreenshotConfig;

  constructor(config?: Partial<ScreenshotConfig>) {
    this.config = { ...screenshotConfig, ...config };
    this.browserPool = new BrowserPool(browserPoolConfig);
    this.processor = new ScreenshotProcessor(this.config, viewportConfigs);
  }

  async processRun(runId: string): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🚀 Starting screenshot capture for run: ${runId}`);
    console.log(`⚙️  Concurrency: ${this.config.concurrency}, Quality: ${this.config.jpegQuality}%\n`);

    const csvPath = path.join(config.paths.runsDirectory, runId, 'website-discovery-progress.csv');
    const progressTracker = new ProgressTracker(csvPath);

    try {
      await progressTracker.loadExistingProgress();

      const urlsToProcess = await this.loadUrlsToProcess(csvPath, progressTracker);
      
      if (urlsToProcess.length === 0) {
        console.log('[INFO] No websites to process - all already completed or no websites discovered');
        return;
      }

      console.log(`[INFO] Processing ${urlsToProcess.length} websites...`);

      await this.browserPool.initialize(this.config.concurrency);

      const results = await this.processUrlsConcurrently(urlsToProcess, runId);

      await progressTracker.updateCsvProgress(results);

      const totalTime = Date.now() - startTime;
      progressTracker.generateSummaryReport(results, totalTime);

    } catch (error) {
      console.error('[ERROR] Screenshot processing failed:', error);
      throw error;
    } finally {
      await this.browserPool.cleanup();
    }
  }

  private async loadUrlsToProcess(
    csvPath: string, 
    progressTracker: ProgressTracker
  ): Promise<Array<{ url: string; companyName: string }>> {
    const urlsToProcess: Array<{ url: string; companyName: string }> = [];
    
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csvParser())
        .on('data', (row: ScreenshotProgressData) => {
          if (row.Search_Status === 'WEBSITE_DISCOVERED' && 
              row.Discovered_Website && 
              !progressTracker.shouldSkipUrl(row.Discovered_Website)) {
            urlsToProcess.push({
              url: row.Discovered_Website,
              companyName: row.Company_Name
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    return urlsToProcess;
  }

  private async processUrlsConcurrently(
    urlsToProcess: Array<{ url: string; companyName: string }>,
    runId: string
  ): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];
    let completed = 0;

    const processUrl = async (urlData: { url: string; companyName: string }) => {
      try {
        const browser = await this.browserPool.getBrowser();
        
        console.log(`[INFO] Progress: ${completed + 1}/${urlsToProcess.length} (${((completed + 1) / urlsToProcess.length * 100).toFixed(1)}%) - Processing: ${urlData.url}`);
        
        let result = await this.processWithRetries(urlData, runId, browser);
        
        this.browserPool.releaseBrowser(browser);
        results.push(result);
        completed++;
        
        return result;
      } catch (error) {
        console.error(`[ERROR] Failed to process ${urlData.url}:`, error);
        completed++;
        return {
          url: urlData.url,
          domain: this.processor['extractDomain'](urlData.url),
          companyName: urlData.companyName,
          status: 'FAILED' as const,
          desktopSections: 0,
          mobileSections: 0,
          loadTimeMs: 0,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryCount: 0,
          timestamp: dayjs().toISOString(),
          screenshotPaths: { desktop: [], mobile: [] }
        };
      }
    };

    // Process with concurrency control
    const chunks = [];
    for (let i = 0; i < urlsToProcess.length; i += this.config.concurrency) {
      chunks.push(urlsToProcess.slice(i, i + this.config.concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(processUrl));
      results.push(...chunkResults);
    }

    return results;
  }

  private async processWithRetries(
    urlData: { url: string; companyName: string },
    runId: string,
    browser: Browser
  ): Promise<ScreenshotResult> {
    let lastError: string = '';
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.processor.processUrl(
          urlData.url, 
          urlData.companyName, 
          runId, 
          browser
        );
        
        result.retryCount = attempt;
        
        if (result.status === 'SUCCESS') {
          return result;
        }
        
        lastError = result.errorMessage || 'Unknown error';
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(3000 * (attempt + 1), 10000);
          console.log(`[WARN] ${urlData.url}: Retrying due to ${lastError} (attempt ${attempt + 2}/${this.config.maxRetries + 1}) - waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt < this.config.maxRetries) {
          const delay = Math.min(3000 * (attempt + 1), 10000);
          console.log(`[WARN] ${urlData.url}: Retrying due to ${lastError} (attempt ${attempt + 2}/${this.config.maxRetries + 1}) - waiting ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      url: urlData.url,
      domain: this.processor['extractDomain'](urlData.url),
      companyName: urlData.companyName,
      status: 'FAILED',
      desktopSections: 0,
      mobileSections: 0,
      loadTimeMs: 0,
      errorMessage: `Failed after ${this.config.maxRetries + 1} attempts: ${lastError}`,
      retryCount: this.config.maxRetries,
      timestamp: dayjs().toISOString(),
      screenshotPaths: { desktop: [], mobile: [] }
    };
  }
}

// Main execution function
export async function runScreenshotCapture(
  runId: string, 
  concurrency: number = 1,
  configOverrides?: Partial<ScreenshotConfig>
): Promise<void> {
  const manager = new ScreenshotManager({
    concurrency,
    ...configOverrides
  });
  
  await manager.processRun(runId);
}

// Export for testing
export { BrowserPool, ScreenshotProcessor, ProgressTracker }; 