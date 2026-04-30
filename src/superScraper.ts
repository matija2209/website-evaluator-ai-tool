import * as path from 'path';
import { SeoScraper } from './seoScraper';
import { WappalyzerPlaywright } from './wappalyzer-playwright';
import { ScreenshotProcessor } from './screenshotCapture';
import type { SuperScrapeConfig, SuperScrapeResult } from './types';
import { screenshotConfig, viewportConfigs } from '../config';
import { PlaywrightSessionManager } from './playwrightSession';

const dayjs = require('dayjs');

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';

export class SuperScraper {
  private seoScraper: SeoScraper;
  private wappalyzer: WappalyzerPlaywright;
  private screenshotProcessor: ScreenshotProcessor;
  private sessionManager: PlaywrightSessionManager;
  private config: SuperScrapeConfig;

  constructor(config: SuperScrapeConfig) {
    this.config = config;
    this.seoScraper = new SeoScraper();
    this.wappalyzer = new WappalyzerPlaywright();
    this.screenshotProcessor = new ScreenshotProcessor(screenshotConfig, viewportConfigs);
    this.sessionManager = new PlaywrightSessionManager();
  }

  async initialize(): Promise<void> {
    return;
  }

  async cleanup(): Promise<void> {
    return;
  }

  async scrape(url: string, companyName: string): Promise<SuperScrapeResult> {
    const startTime = Date.now();
    const domain = this.extractDomain(url);
    const normalizedUrl = this.normalizeUrl(url);
    const preparationLogPath = this.sessionManager.getPreparationLogPath(this.config.outputDir);

    const result: SuperScrapeResult = {
      url: normalizedUrl,
      domain,
      companyName,
      status: 'FAILED',
      loadTimeMs: 0,
      timestamp: dayjs().toISOString()
    };

    const runPhases = this.config.phases;
    const hasSeo = runPhases.includes('seo');
    const hasTech = runPhases.includes('tech');
    const hasScreenshot = runPhases.includes('screenshot');

    const scrapePromise = (async () => {
      let desktopSession: Awaited<ReturnType<PlaywrightSessionManager['openPreparedDesktopSession']>> | null = null;
      let mobileSession: Awaited<ReturnType<PlaywrightSessionManager['openPreparedMobileSession']>> | null = null;

      try {
        if (hasSeo || hasTech || hasScreenshot) {
          desktopSession = await this.sessionManager.openPreparedDesktopSession({
            url: normalizedUrl,
            userAgent: DESKTOP_USER_AGENT,
            waitUntil: 'networkidle',
            timeoutMs: 60000,
            runLogPath: preparationLogPath,
            purpose: 'super-scraper-desktop'
          });

          result.pagePreparation = desktopSession.pagePreparation;
          const page = desktopSession.page;

          if (hasSeo) {
            try {
              const seoData = await this.seoScraper.scrapePageDirectly(page);
              result.seo = {
                title: seoData.title,
                metaDescription: seoData.metaDescription,
                h1: [],
                wordCount: (seoData.fullText || '').split(/\s+/).filter(Boolean).length,
                jsonLdFound: seoData.jsonLdFound,
                fullText: seoData.fullText
              };
            } catch (error) {
              result.seo = {
                title: '',
                metaDescription: '',
                h1: [],
                wordCount: 0,
                jsonLdFound: false,
                error: String(error)
              };
            }
          }

          if (hasTech) {
            try {
              const techData = await this.wappalyzer.analyzePage(page, normalizedUrl);
              result.tech = {
                technologies: Object.entries(techData).map(([name, data]: [string, any]) => ({
                  name,
                  version: data.version || null,
                  categories: data.categories
                }))
              };
            } catch (error) {
              result.tech = { technologies: [], error: String(error) };
            }
          }

          if (hasScreenshot) {
            try {
              const desktopViewport = viewportConfigs.find(viewport => viewport.name === 'desktop');
              if (desktopViewport) {
                const outputDir = path.join(this.config.outputDir, 'screenshots', domain, 'desktop');
                const sections = await this.screenshotProcessor.captureViewportSections(page, desktopViewport, outputDir);
                result.screenshots = {
                  desktopPaths: Array.from(
                    { length: sections },
                    (_, index) => `runs/${this.config.runId}/screenshots/${domain}/desktop/section-${index + 1}.jpeg`
                  ),
                  mobilePaths: []
                };
              }
            } catch (error) {
              result.screenshots = {
                desktopPaths: [],
                mobilePaths: [],
                error: String(error)
              };
            }
          }
        }

        if (hasScreenshot && !result.error) {
          mobileSession = await this.sessionManager.openPreparedMobileSession({
            url: normalizedUrl,
            userAgent: MOBILE_USER_AGENT,
            waitUntil: 'networkidle',
            timeoutMs: 60000,
            runLogPath: preparationLogPath,
            purpose: 'super-scraper-mobile',
            viewport: { width: 390, height: 844 },
            isMobile: true
          });

          try {
            const mobileViewport = viewportConfigs.find(viewport => viewport.name === 'mobile');
            if (mobileViewport) {
              const outputDir = path.join(this.config.outputDir, 'screenshots', domain, 'mobile');
              const sections = await this.screenshotProcessor.captureViewportSections(mobileSession.page, mobileViewport, outputDir);
              if (!result.screenshots) {
                result.screenshots = { desktopPaths: [], mobilePaths: [] };
              }
              result.screenshots.mobilePaths = Array.from(
                { length: sections },
                (_, index) => `runs/${this.config.runId}/screenshots/${domain}/mobile/section-${index + 1}.jpeg`
              );
            }
          } catch (error) {
            if (!result.screenshots) {
              result.screenshots = { desktopPaths: [], mobilePaths: [] };
            }
            result.screenshots.error = `${result.screenshots.error ? `${result.screenshots.error}; ` : ''}Mobile nav failed: ${String(error)}`;
          }
        }

        const failures = [result.error, result.seo?.error, result.tech?.error, result.screenshots?.error].filter(Boolean);
        const successes = [
          result.seo && !result.seo.error,
          result.tech && !result.tech.error,
          result.screenshots && !result.screenshots.error
        ].filter(Boolean);

        if (failures.length === 0 && successes.length > 0) result.status = 'SUCCESS';
        else if (successes.length > 0) result.status = 'PARTIAL';
        else result.status = 'FAILED';
      } catch (error) {
        result.error = String(error);
        result.status = 'FAILED';
      } finally {
        if (mobileSession) {
          await mobileSession.close();
        }
        if (desktopSession) {
          await desktopSession.close();
        }
      }

      return result;
    })();

    const timeoutPromise = new Promise<SuperScrapeResult>((resolve) => {
      setTimeout(() => {
        result.status = 'FAILED';
        result.error = 'Global 5-minute timeout exceeded';
        resolve(result);
      }, 300000);
    });

    const finalResult = await Promise.race([scrapePromise, timeoutPromise]);
    finalResult.loadTimeMs = Date.now() - startTime;
    return finalResult;
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch {
      return 'invalid-domain';
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http')) {
      return `https://${url}`;
    }
    return url;
  }
}
