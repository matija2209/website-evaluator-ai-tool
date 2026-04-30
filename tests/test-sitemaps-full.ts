import assert from 'assert';
import path from 'path';
import fs from 'fs-extra';
import zlib from 'zlib';
import { promisify } from 'util';
import {
  FullSitemapScraperService,
  RawSitemapFetcher,
} from '../src/fullSitemapScraper';

const gzip = promisify(zlib.gzip);

class FixtureSitemapFetcher implements RawSitemapFetcher {
  private fixtureMap = new Map<string, string>([
    ['https://fixtures.test/root-index.xml', 'root-index.xml'],
    ['https://fixtures.test/sub-01.xml', 'sub-01.xml'],
    ['https://fixtures.test/sub-02.xml', 'sub-02.xml'],
    ['https://fixtures.test/sub-03.xml', 'sub-03.xml'],
    ['https://fixtures.test/sub-04.xml', 'sub-04.xml'],
    ['https://fixtures.test/sub-05.xml', 'sub-05.xml'],
    ['https://fixtures.test/sub-06.xml', 'sub-06.xml'],
    ['https://fixtures.test/sub-07.xml', 'sub-07.xml'],
    ['https://fixtures.test/sub-08.xml', 'sub-08.xml'],
    ['https://fixtures.test/nested-index.xml', 'nested-index.xml'],
    ['https://fixtures.test/nested-leaf.xml', 'nested-leaf.xml'],
    ['https://fixtures.test/escaped-parent.xml', 'escaped-parent.xml'],
    ['https://fixtures.test/query-child.xml?foo=1&bar=2', 'query-child.xml'],
    ['https://fixtures.test/sub-gz.xml.gz', 'sub-gz.xml'],
  ]);

  constructor(private fixturesDir: string) {}

  async fetch(url: string): Promise<Buffer | null> {
    const fixtureName = this.fixtureMap.get(url);
    if (!fixtureName) {
      return null;
    }

    const content = await fs.readFile(path.join(this.fixturesDir, fixtureName));
    if (url.endsWith('.gz')) {
      return gzip(content);
    }

    return content;
  }
}

function parseCsvLine(line: string): string[] {
  return line
    .replace(/^"/, '')
    .replace(/"$/, '')
    .split('","')
    .map((value) => value.replace(/""/g, '"'));
}

async function testFullSitemapScraper(): Promise<void> {
  console.log('🧪 Testing full sitemap scraper with offline fixtures');

  const fixturesDir = path.join(__dirname, 'fixtures', 'sitemaps', 'full');
  const outputDir = path.join('output', 'sitemaps_full_test');

  await fs.remove(outputDir);
  await fs.ensureDir(outputDir);

  const service = new FullSitemapScraperService(new FixtureSitemapFetcher(fixturesDir), 8);
  const result = await service.scrapeRootSitemap('https://fixtures.test/root-index.xml', outputDir);

  assert.ok(!result.error, `Expected successful result, got error: ${result.error}`);
  assert.equal(result.truncated, false, 'Traversal should not be truncated');
  assert.equal(result.sitemapsProcessed, 14, 'Expected full traversal across nested sitemap files');
  assert.equal(result.urlsFound, 13, 'Expected deduped URL count');
  assert.ok(await fs.pathExists(result.outputPath), 'Expected output CSV to be written');

  const csvContent = await fs.readFile(result.outputPath, 'utf8');
  const lines = csvContent.trim().split('\n');
  assert.equal(lines[0], 'url,source_sitemap', 'Expected CSV header');
  assert.equal(lines.length, 14, 'Expected 13 result rows plus header');

  const rows = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const [url, sourceSitemap] = parseCsvLine(line);
    rows.set(url, sourceSitemap);
  }

  assert.equal(
    rows.get('https://example.test/duplicate-shared'),
    'https://fixtures.test/sub-02.xml',
    'Expected first source sitemap to win for duplicates'
  );
  assert.equal(
    rows.get('https://example.test/page-11'),
    'https://fixtures.test/query-child.xml?foo=1&bar=2',
    'Expected XML-escaped child sitemap URL to be decoded before refetch'
  );
  assert.equal(
    rows.get('https://example.test/page-12'),
    'https://fixtures.test/sub-gz.xml.gz',
    'Expected gzip sitemap source to be preserved'
  );

  console.log('✅ Full sitemap scraper fixture test passed');
}

testFullSitemapScraper().catch((error) => {
  console.error(error);
  process.exit(1);
});
