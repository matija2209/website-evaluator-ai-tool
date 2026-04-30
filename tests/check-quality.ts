import fs from 'fs-extra';
import path from 'path';
import csv from 'csv-parser';

async function readInputCsv(inputPath: string): Promise<any[]> {
  if (!await fs.pathExists(inputPath)) return [];
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function extractDomain(url: string): string | null {
  if (!url || url.includes(' ') || url.length < 4) return null;
  if (url.toLowerCase().includes('tis-u')) return null;
  if (url.toLowerCase().includes('bizi.si')) return null;
  if (url.toLowerCase().includes('mimovrste.com')) return null;

  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const domain = u.hostname.replace(/^www\./, '');
    if (domain.includes('.') && domain.length > 3) return domain;
    return null;
  } catch {
    if (url.includes('.') && !url.includes('/') && !url.includes(' ')) {
      return url.replace(/^www\./, '');
    }
    return null;
  }
}

async function checkQuality(inputPath: string, column: string = 'website') {
  console.log(`🧐 Checking quality of scraped sitemaps for: ${inputPath}`);
  
  const rows = await readInputCsv(inputPath);
  const outputDir = path.join('output', 'sitemaps');
  
  const stats = {
    totalRows: rows.length,
    invalidInCsv: 0,
    validToProcess: 0,
    missingFolder: 0,
    emptySitemap: 0, // 0 URLs
    thinSitemap: 0,  // 1-5 URLs
    healthySitemap: 0, // > 5 URLs
    massiveSitemap: 0, // > 50000 URLs or flagged
    missingRobots: 0,
    emptyRobots: 0
  };

  const emptySitemaps: string[] = [];
  const massiveSitemaps: string[] = [];

  for (const row of rows) {
    const url = row[column];
    const domain = extractDomain(url);
    
    if (!domain) {
      stats.invalidInCsv++;
      continue;
    }

    stats.validToProcess++;
    const domainDir = path.join(outputDir, domain);

    if (!await fs.pathExists(domainDir)) {
      stats.missingFolder++;
      continue;
    }

    const sitemapPath = path.join(domainDir, 'sitemap.csv');
    const robotsPath = path.join(domainDir, 'robots.txt');

    // Check Sitemap
    if (await fs.pathExists(sitemapPath)) {
      const content = await fs.readFile(sitemapPath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l.trim() !== '');
      const urlCount = Math.max(0, lines.length - 1); // Subtract header

      if (urlCount === 0) {
        stats.emptySitemap++;
        emptySitemaps.push(domain);
      } else if (urlCount > 50000) {
        stats.massiveSitemap++;
        massiveSitemaps.push(`${domain} (${urlCount} URLs)`);
      } else if (urlCount <= 5) {
        stats.thinSitemap++;
      } else {
        stats.healthySitemap++;
      }
    } else {
      stats.emptySitemap++;
      emptySitemaps.push(`${domain} (missing csv)`);
    }

    // Check Robots
    if (await fs.pathExists(robotsPath)) {
      const content = await fs.readFile(robotsPath, 'utf8');
      if (content.trim().length === 0) {
        stats.emptyRobots++;
      }
    } else {
      stats.missingRobots++;
    }
  }

  console.log('\n📊 Quality Audit Summary:');
  console.log(`   Total rows in CSV:        ${stats.totalRows}`);
  console.log(`   Invalid websites:         ${stats.invalidInCsv}`);
  console.log(`   Valid domains found:      ${stats.validToProcess}`);
  console.log(`   -----------------------------------`);
  console.log(`   Missing folders:          ${stats.missingFolder}`);
  console.log(`   Empty sitemaps (0 URLs):  ${stats.emptySitemap}`);
  console.log(`   Thin sitemaps (1-5 URLs): ${stats.thinSitemap}`);
  console.log(`   Healthy sitemaps:         ${stats.healthySitemap}`);
  console.log(`   Massive sitemaps:         ${stats.massiveSitemap} (Flagged/Huge)`);
  console.log(`   -----------------------------------`);
  console.log(`   Missing robots.txt:       ${stats.missingRobots}`);
  console.log(`   Empty robots.txt:         ${stats.emptyRobots}`);

  if (emptySitemaps.length > 0) {
    console.log('\n🚫 Empty Sitemaps (0 URLs):');
    console.log('   ' + emptySitemaps.slice(0, 50).join(', ') + (emptySitemaps.length > 50 ? '...' : ''));
  }

  if (massiveSitemaps.length > 0) {
    console.log('\n🐘 Massive Sitemaps:');
    console.log('   ' + massiveSitemaps.join(', '));
  }
}

const args = process.argv.slice(2);
const input = args[0] || 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
const col = args[1] || 'website';

checkQuality(input, col).catch(console.error);
