
import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

/**
 * URL Recoverer & CSV Fixer
 * 
 * Goal: Takes a Bizi-scraped CSV, ensures every entry has a 'website' URL,
 * falling back to email-based domain inference if necessary.
 */

async function recoverUrls(inputPath: string, outputPath: string) {
  console.log(`\n🛠️  Starting URL Recovery: ${inputPath}`);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    return;
  }

  const results: any[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`📊 Loaded ${results.length} records.`);

        let recoveredCount = 0;
        let alreadyHasWebsite = 0;
        let skippedCount = 0;

    const processed = results.map((row: any) => {
          let website = row.website?.trim();
          const email = row.email?.trim();

          // 1. If we already have a website, check if it's valid and not bizi.si
          if (website && website.length > 5 && website.includes('.') && !website.includes('bizi.si')) {
            if (!website.startsWith('http')) {
              website = `https://${website}`;
            }
            alreadyHasWebsite++;
            return { ...row, website };
          }

          // 2. Fallback to Email-based inference
          if (email && email.includes('@')) {
            const domain = email.split('@')[1];
            
            // Filter out common public mail providers
            const publicProviders = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 't-2.net', 'telekom.si', 'siol.net'];
            
            if (!publicProviders.includes(domain.toLowerCase())) {
              website = `https://www.${domain}`;
              recoveredCount++;
              return { ...row, website };
            }
          }

          // 3. No website and no valid email domain
          skippedCount++;
          return { ...row, website: '' };
        });

        // Write output
        if (processed.length > 0) {
          const headers = Object.keys(processed[0]).map(key => ({ id: key, title: key }));
          const csvWriter = createObjectCsvWriter({
            path: outputPath,
            header: headers
          });

          await csvWriter.writeRecords(processed);
        }

        console.log(`\n✅ URL Recovery Complete!`);
        console.log(`💾 Saved to: ${outputPath}`);
        console.log(`✨ Already had website: ${alreadyHasWebsite}`);
        console.log(`🔗 Recovered from email: ${recoveredCount}`);
        console.log(`⚠️  Could not recover:    ${skippedCount}`);
        console.log(`🚀 Ready for Sitemaps, Tech Analysis, and Screenshots!`);
        resolve(true);
      })
      .on('error', reject);
  });
}

// CLI usage
const args = process.argv.slice(2);
const input = args[0] || 'output/bizi-profile-recovered.csv';
const output = args[1] || 'input/slovenian_ecommerces_final.csv';

recoverUrls(input, output).catch(console.error);
