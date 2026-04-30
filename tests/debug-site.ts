import { chromium } from 'playwright';
import { SitemapScraperService } from '../src/sitemapScraper';

async function debugSite(url: string) {
  const browser = await chromium.launch({ headless: true });
  const service = new SitemapScraperService(browser);
  
  console.log(`\n🕵️ Debugging site: ${url}`);
  
  // Test raw fetch
  const sitemapUrl = `${url.startsWith('http') ? '' : 'https://'}${url}/sitemap.xml`;
  console.log(`[DEBUG] Fetching ${sitemapUrl} directly...`);
  const content = await service.fetchContent(sitemapUrl);
  console.log(`[DEBUG] Content snippet: ${content?.substring(0, 200)}`);
  const locMatches = content?.match(/<loc>([\s\S]*?)<\/loc>/gi);
  console.log(`[DEBUG] Loc matches found: ${locMatches?.length || 0}`);
  if (locMatches) {
    console.log(`[DEBUG] First 3 locs: ${locMatches.slice(0, 3).map(m => m.replace(/<\/?loc>/gi, '').trim()).join(', ')}`);
  }
  
  const result = await service.scrapeDomain(url, 'output/sitemaps_debug');
  
  console.log('\n📊 Result:', JSON.stringify(result, null, 2));
  
  await browser.close();
}

const site = process.argv[2] || 'dfvu.org';
debugSite(site).catch(console.error);
