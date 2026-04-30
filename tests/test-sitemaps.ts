import { chromium } from 'playwright';
import { SitemapScraperService } from '../src/sitemapScraper';
import path from 'path';
import fs from 'fs-extra';

async function testSitemaps() {
  console.log('🧪 Testing Sitemap Scraper Service');
  
  const testUrls = [
    'https://www.kristaldoo.si',
    'https://www.bioshop.si'
  ];

  const browser = await chromium.launch({ headless: true });
  const service = new SitemapScraperService(browser);
  const testOutputDir = path.join('output', 'sitemaps_test');
  
  await fs.ensureDir(testOutputDir);

  try {
    for (const url of testUrls) {
      console.log(`\n--- Testing ${url} ---`);
      const result = await service.scrapeDomain(url, testOutputDir);
      
      console.log(`📊 Result for ${result.domain}:`);
      console.log(`   URLs found: ${result.urlsFound}`);
      console.log(`   Robots.txt found: ${result.robotsFound}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      // Verification
      const domainDir = path.join(testOutputDir, result.domain);
      const robotsExists = await fs.pathExists(path.join(domainDir, 'robots.txt'));
      const sitemapCsvExists = await fs.pathExists(path.join(domainDir, 'sitemap.csv'));
      
      if (robotsExists) console.log('✅ robots.txt saved correctly');
      if (sitemapCsvExists) console.log('✅ sitemap.csv saved correctly');
    }
  } finally {
    await browser.close();
    console.log('\n✨ Test finished.');
  }
}

testSitemaps().catch(console.error);
