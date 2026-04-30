import fs from 'fs-extra';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

async function mergeResults() {
  const filePath = 'output/bizi-profile-recovered.csv';
  const records = new Map<string, any>();
  
  if (!await fs.pathExists(filePath)) return;
  
  await new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Use sourceUrl as the unique key. Later records overwrite earlier ones.
        if (data.sourceUrl) {
          records.set(data.sourceUrl, data);
        }
      })
      .on('end', resolve);
  });
  
  const mergedRecords = Array.from(records.values());
  const header = Object.keys(mergedRecords[0]).map(k => ({ id: k, title: k }));
  
  const writer = createObjectCsvWriter({
    path: 'output/bizi-profile-merged.csv',
    header
  });
  
  await writer.writeRecords(mergedRecords);
  console.log(`Merged ${mergedRecords.length} unique records into bizi-profile-merged.csv`);
}

mergeResults().catch(console.error);
