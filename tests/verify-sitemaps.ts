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

async function verifySitemaps(inputPath: string, column: string = 'website') {
  console.log(`🔍 Verifying sitemap results for input: ${inputPath}`);
  
  const rows = await readInputCsv(inputPath);
  if (rows.length === 0) {
    console.error('❌ No rows found in input CSV');
    return;
  }

  const outputDir = path.join('output', 'sitemaps');
  let successful = 0;
  let missingFolders = 0;
  let missingFiles = 0;
  let invalidDomains = 0;

  for (const row of rows) {
    const url = row[column];
    const domain = extractDomain(url);
    
    if (!domain) {
      invalidDomains++;
      continue;
    }

    const domainDir = path.join(outputDir, domain);

    if (!await fs.pathExists(domainDir)) {
      missingFolders++;
      continue;
    }

    const robotsPath = path.join(domainDir, 'robots.txt');
    const sitemapPath = path.join(domainDir, 'sitemap.csv');

    const robotsExists = await fs.pathExists(robotsPath);
    const sitemapExists = await fs.pathExists(sitemapPath);

    // Robots.txt is optional, but sitemap.csv must exist
    if (!sitemapExists) {
      console.warn(`⚠️  Missing sitemap.csv for: ${domain}`);
      missingFiles++;
    } else {
      successful++;
    }
  }

  console.log('\n📊 Verification Summary:');
  console.log(`   Total sites in CSV: ${rows.length}`);
  console.log(`   Invalid websites skipped: ${invalidDomains}`);
  console.log(`   Valid sites to check: ${rows.length - invalidDomains}`);
  console.log(`   -----------------------------------`);
  console.log(`   Successfully processed: ${successful}`);
  console.log(`   Missing folders: ${missingFolders}`);
  console.log(`   Missing sitemap.csv: ${missingFiles}`);
  
  if (missingFolders === 0 && missingFiles === 0) {
    console.log('\n✅ All valid sites processed correctly!');
  } else {
    console.log('\n❌ Some sites have missing data.');
  }
}

const inputPath = process.argv[2] || 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
const column = process.argv[3] || 'website';

verifySitemaps(inputPath, column).catch(console.error);
