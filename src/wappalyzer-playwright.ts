import { Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
const Wappalyzer = require('wappalyzer/wappalyzer');
import { PlaywrightSessionManager } from './playwrightSession';

export class WappalyzerPlaywright {
  private technologies: any = {};
  private categories: any = {};
  private sessionManager: PlaywrightSessionManager;

  constructor() {
    this.loadPatterns();
    this.sessionManager = new PlaywrightSessionManager();
  }

  private loadPatterns() {
    const wappPath = path.dirname(require.resolve('wappalyzer/package.json'));
    
    const categories = fs.readJsonSync(path.join(wappPath, 'categories.json'));
    Wappalyzer.setCategories(categories);

    let technologies: any = {};
    for (const index of Array(27).keys()) {
      const character = index ? String.fromCharCode(index + 96) : '_';
      const techFile = path.join(wappPath, 'technologies', `${character}.json`);
      if (fs.existsSync(techFile)) {
        technologies = {
          ...technologies,
          ...fs.readJsonSync(techFile)
        };
      }
    }
    Wappalyzer.setTechnologies(technologies);
  }

  async analyze(url: string, options?: { runLogPath?: string; purpose?: string }): Promise<any> {
    const detections: any[] = [];
    const headers: Record<string, string[]> = {};
    let session: Awaited<ReturnType<PlaywrightSessionManager['openPreparedDesktopSession']>> | null = null;

    try {
      session = await this.sessionManager.openPreparedDesktopSession({
        url,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        waitUntil: 'networkidle',
        timeoutMs: 30000,
        runLogPath: options?.runLogPath,
        purpose: options?.purpose || 'wappalyzer-analyze',
        beforeNavigation: async (page) => {
          this.setupAnalysisListeners(page, url, detections, headers);
        }
      });
      return await this.analyzePage(session.page, url, detections, headers);
    } finally {
      if (session) {
        await session.close();
      }
    }
  }

  async analyzePage(
    page: Page,
    url: string,
    detections: any[] = [],
    headers: Record<string, string[]> = {}
  ): Promise<any> {
    const context = page.context();

      // Trigger re-analysis of current state if needed, but setupAnalysisListeners 
      // should have caught mostly everything during navigation if it was called BEFORE goto.
      // Since analyzePage might be called AFTER goto, we manually trigger some checks.

      // 1. Analyze URL
      try {
        detections.push(...Wappalyzer.analyze({ url }));
      } catch (e) {
        // Ignore individual analysis errors
      }

      // 2. Analyze Headers
      if (Object.keys(headers).length > 0) {
        try {
          detections.push(...Wappalyzer.analyze({ headers }));
        } catch (e) {}
      }

      // 3. Analyze Cookies
      const cookies = await context.cookies();
      const cookieData: Record<string, string[]> = {};
      cookies.forEach(c => {
        cookieData[c.name.toLowerCase()] = [c.value];
      });
      try {
        detections.push(...Wappalyzer.analyze({ cookies: cookieData }));
      } catch (e) {}

      // 4. Analyze HTML
      const html = await page.content();
      try {
        detections.push(...Wappalyzer.analyze({ html }));
      } catch (e) {}

      // 5. Analyze Meta tags
      const meta = await page.$$eval('meta', (metas) => {
        const data: Record<string, string[]> = {};
        metas.forEach(m => {
          const name = m.getAttribute('name') || m.getAttribute('property');
          const content = m.getAttribute('content');
          if (name && content) {
            data[name.toLowerCase()] = [content];
          }
        });
        return data;
      });
      try {
        detections.push(...Wappalyzer.analyze({ meta }));
      } catch (e) {}

      // 6. Analyze JS variables
      const jsDetections = await this.getJsDetections(page);
      detections.push(...jsDetections);

      // 7. Analyze DOM
      const domDetections = await this.getDomDetections(page);
      detections.push(...domDetections);

    const resolved = Wappalyzer.resolve(detections);
    
    const result: any = {};
    resolved.forEach((tech: any) => {
      result[tech.name] = {
        version: tech.version || '',
        confidence: tech.confidence || 100,
        categories: tech.categories.map((c: any) => c.name),
        groups: [] 
      };
    });

    return result; // Simplified return for direct use
  }

  private setupAnalysisListeners(page: Page, url: string, detections: any[], headers: Record<string, string[]>) {
    page.on('response', async (response) => {
      const responseUrl = response.url();
      
      if (responseUrl === url || responseUrl === url + '/') {
        const allHeaders = response.headers();
        for (const [key, value] of Object.entries(allHeaders)) {
          headers[key.toLowerCase()] = [value];
        }
      }

      try {
        if (response.request().resourceType() === 'script') {
          const content = await response.text();
          if (content) {
            detections.push(...Wappalyzer.analyze({ scripts: [content] }));
          }
        }
      } catch (e) {}
    });
  }

  private async getJsDetections(page: Page): Promise<any[]> {
    const technologies = Wappalyzer.technologies.filter((t: any) => t.js && Object.keys(t.js).length > 0);
    
    const results = await page.evaluate((techs) => {
      const detections: any[] = [];
      techs.forEach((t: any) => {
        for (const chain in t.js) {
          const parts = chain.split('.');
          let obj: any = window;
          let found = true;
          for (const part of parts) {
            try {
              if (obj && part in obj) {
                obj = obj[part];
              } else {
                found = false;
                break;
              }
            } catch (e) {
              found = false;
              break;
            }
          }
          if (found) {
            detections.push({ name: t.name, chain, value: typeof obj === 'string' ? obj : !!obj });
          }
        }
      });
      return detections;
    }, technologies);

    return results.map(r => {
      const tech = Wappalyzer.technologies.find((t: any) => t.name === r.name);
      try {
        return Wappalyzer.analyzeManyToMany(tech, 'js', { [r.chain]: [r.value] });
      } catch (e) {
        return [];
      }
    }).flat();
  }

  private async getDomDetections(page: Page): Promise<any[]> {
    const technologies = Wappalyzer.technologies.filter((t: any) => t.dom && Object.keys(t.dom).length > 0);
    
    const results = await page.evaluate((techs) => {
      const detections: any[] = [];
      techs.forEach((t: any) => {
        for (const selector in t.dom) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              detections.push({ name: t.name, selector, exists: true });
            }
          } catch (e) {}
        }
      });
      return detections;
    }, technologies);

    return results.map(r => {
      const tech = Wappalyzer.technologies.find((t: any) => t.name === r.name);
      try {
        // Some DOM patterns are not just 'exists', they might have subtypes.
        // We use a safe approach here.
        return Wappalyzer.analyzeManyToMany(tech, 'dom.exists', { [r.selector]: [''] });
      } catch (e) {
        return [];
      }
    }).flat();
  }
}
