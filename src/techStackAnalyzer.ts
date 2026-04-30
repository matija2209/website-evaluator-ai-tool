
import fs from 'fs-extra';
import csv from 'csv-parser';
import { WappalyzerWrapper } from './wappalyzerWrapper';
import path from 'path';

export interface TechStackAnalyzerOptions {
  path?: string;
  column?: string;
  limit?: number;
  concurrency?: number;
  outputDir?: string;
}

export class TechStackAnalyzer {
  private wappalyzer: WappalyzerWrapper;

  constructor() {
    this.wappalyzer = new WappalyzerWrapper();
  }

  async run(options: TechStackAnalyzerOptions) {
    if (!options.path || !options.column) {
      throw new Error('CSV path and column name are required for TechStackAnalyzer');
    }

    const csvPath = path.resolve(options.path);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found at ${csvPath}`);
    }

    const concurrency = options.concurrency || 3;
    const outputDir = options.outputDir || 'output/tech_analysis';
    const preparationLogPath = path.join(outputDir, 'page-preparation.ndjson');
    await fs.ensureDir(outputDir);

    console.log(`[TECH] Analyzing URLs from ${options.path} (column: ${options.column})`);
    console.log(`[TECH] Concurrency: ${concurrency}`);

    const records = await this.readCsv(csvPath, options.column, options.limit);
    console.log(`[TECH] Found ${records.length} URLs to analyze.`);

    const results: any[] = [];
    let completed = 0;
    let skipped = 0;
    let failed = 0;

    // Process with concurrency control
    await this.runWithConcurrency(records, concurrency, async (record, index) => {
      const { url, domain, companyName } = record;
      const individualOutputPath = path.join(outputDir, `${domain}.json`);

      // Resume capability
      if (fs.existsSync(individualOutputPath)) {
        skipped++;
        completed++;
        return;
      }

      console.log(`[TECH] [${completed + 1}/${records.length}] Analyzing: ${url}`);
      
      try {
        const techStack = await this.wappalyzer.analyze(url, 'full', {
          runLogPath: preparationLogPath,
          purpose: 'tech-stack-analyzer'
        });
        await fs.writeJson(individualOutputPath, techStack, { spaces: 2 });
        results.push({ url, techStack });
      } catch (error) {
        console.error(`[TECH] [ERROR] Failed to analyze ${url}:`, error instanceof Error ? error.message : String(error));
        failed++;
      }
      completed++;
    });

    console.log('\n--- Tech Analysis Complete ---');
    console.log(`Total processed: ${completed}`);
    console.log(`Successfully analyzed: ${results.length}`);
    console.log(`Skipped (existing): ${skipped}`);
    console.log(`Failed: ${failed}`);

    if (results.length > 0) {
      const batchOutputPath = path.join(outputDir, `batch_summary_${Date.now()}.json`);
      await fs.writeJson(batchOutputPath, results, { spaces: 2 });
      console.log(`Batch results summary saved to: ${batchOutputPath}`);
    }
    
    return results;
  }

  private async readCsv(filePath: string, column: string, limit?: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const records: any[] = [];
      let count = 0;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (limit && count >= limit) return;
          
          let url = row[column];
          if (!url || url === 'Več kontaktov v TIS-u') {
            // Try to infer from email if available
            if (row.email) {
              const inferred = this.inferWebsiteFromEmail(row.email);
              if (inferred) url = inferred;
            }
          }

          if (url && url !== 'Več kontaktov v TIS-u' && !url.includes('bizi.si')) {
            const normalized = this.normalizeUrl(url);
            try {
              const domain = new URL(normalized).hostname.replace('www.', '');
              records.push({
                url: normalized,
                domain,
                companyName: row.companyName || row.Title || 'Unknown'
              });
              count++;
            } catch (e) {}
          }
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private async runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
    const activeWorkers: Promise<void>[] = [];
    let nextIndex = 0;

    const spawnWorker = async (): Promise<void> => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        await worker(items[index], index);
      }
    };

    for (let i = 0; i < Math.min(concurrency, items.length); i++) {
      activeWorkers.push(spawnWorker());
    }

    await Promise.all(activeWorkers);
  }

  private inferWebsiteFromEmail(email: string): string | null {
    const emailMatch = email.match(/@([^@\s]+\.[^@\s]+)$/);
    if (!emailMatch) return null;
    const domain = emailMatch[1].toLowerCase();
    const skipDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com', 'me.com', 't-2.net', 'telemach.net', 'siol.net', 'amis.net', 'volja.net', 'email.si', 'siol.com', 'triera.net', 'arnes.si'];
    if (skipDomains.includes(domain)) return null;
    return `https://www.${domain}`;
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
}

// CLI entry point
if (require.main === module) {
  const analyzer = new TechStackAnalyzer();
  const args = process.argv.slice(2);
  const options: TechStackAnalyzerOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--path' || arg === '-p') options.path = args[++i];
    if (arg === '--column' || arg === '-c') options.column = args[++i];
    if (arg === '--limit' || arg === '-l') options.limit = parseInt(args[++i]);
    if (arg === '--concurrency') options.concurrency = parseInt(args[++i]);
  }

  if (options.path && options.column) {
    analyzer.run(options).catch(console.error);
  } else {
    console.error('Usage: ts-node src/techStackAnalyzer.ts --path <csv_path> --column <column_name> [--limit <number>] [--concurrency <number>]');
  }
}
