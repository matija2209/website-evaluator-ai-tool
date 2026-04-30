import { WappalyzerResult } from './types';
import { WappalyzerPlaywright } from './wappalyzer-playwright';

/**
 * Wrapper for the Playwright-based Wappalyzer implementation.
 * Detects technologies used on a website.
 */
export class WappalyzerWrapper {
  private analyzer: WappalyzerPlaywright;

  constructor() {
    this.analyzer = new WappalyzerPlaywright();
  }

  /**
   * Analyzes a single URL using Playwright.
   * @param url The URL to analyze
   * @param _scanType Kept for compatibility, but always performs a full scan with Playwright.
   * @returns WappalyzerResult object
   */
  async analyze(
    url: string,
    _scanType: 'fast' | 'balanced' | 'full' = 'full',
    options?: { runLogPath?: string; purpose?: string }
  ): Promise<WappalyzerResult> {
    try {
      console.log(`[INFO] Analyzing ${url} using Playwright...`);
      const results = await this.analyzer.analyze(url, options);
      return results as WappalyzerResult;
    } catch (error) {
      console.error(`[ERROR] Wappalyzer analysis failed for ${url}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Analyzes multiple URLs from a list.
   * @param urls Array of URLs to analyze
   * @param _threads Kept for compatibility.
   * @returns WappalyzerResult object containing all URLs
   */
  async analyzeBatch(urls: string[], _threads: number = 5): Promise<WappalyzerResult> {
    const combinedResults: WappalyzerResult = {};
    
    for (const url of urls) {
      try {
        const result = await this.analyze(url);
        Object.assign(combinedResults, result);
      } catch (error) {
        console.warn(`[WARN] Skipping failed analysis for ${url}`);
      }
    }
    
    return combinedResults;
  }
}
