
import fs from 'fs';
import csv from 'csv-parser';

const results = [];
fs.createReadStream('output/seo-scrape-2026-04-28-20-11-00.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    console.log(`Total records in output: ${results.length}`);
    const statuses = results.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Statuses:', JSON.stringify(statuses, null, 2));
  });
