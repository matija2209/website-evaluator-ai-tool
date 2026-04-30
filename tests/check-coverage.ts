import fs from 'fs-extra';
import path from 'path';
import csv from 'csv-parser';

async function checkCoverage() {
  const inputPath = 'input/slovenian_ecommerces.csv';
  const outputPath = 'output/bizi-profile-scrape-2026-04-28-14-00-34.csv';
  
  const inputRows: any[] = [];
  const outputRows: any[] = [];
  
  await new Promise((resolve) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => inputRows.push(data))
      .on('end', resolve);
  });
  
  if (await fs.pathExists(outputPath)) {
    await new Promise((resolve) => {
      fs.createReadStream(outputPath)
        .pipe(csv())
        .on('data', (data) => outputRows.push(data))
        .on('end', resolve);
    });
  }

  console.log(`Input rows: ${inputRows.length}`);
  console.log(`Output rows: ${outputRows.length}`);
  
  const outputUrls = new Set(outputRows.map(r => r.sourceUrl || r.URL));
  const missing = inputRows.filter(r => !outputUrls.has(r.URL));
  
  console.log(`Missing from scrape: ${missing.length}`);
  if (missing.length > 0) {
    console.log('First 5 missing:');
    console.log(missing.slice(0, 5).map(m => m.URL));
  }
}

checkCoverage().catch(console.error);
