
import { WebsiteDiscoveryService } from './websiteDiscovery';
import { runScreenshotCapture } from './screenshotCapture';
import { SeoScraper } from './seoScraper';
import { TechStackAnalyzer } from './techStackAnalyzer';
import { runWebsiteAnalysis } from './websiteAnalysisRunner';
import { SuperScraper } from './superScraper';
import { RunManager } from './runManager';
import path from 'path';
import fs from 'fs-extra';

/**
 * Unified Pipeline CLI
 * Orchestrates evaluation phases with concurrency control.
 */

async function main() {
  const args = process.argv.slice(2);
  const options = {
    input: '',
    runId: '',
    phases: 'discovery,screenshot,seo,tech,analysis',
    concurrency: 3,
    limit: 0,
    urlColumn: 'website'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') options.input = args[++i];
    if (arg === '--runId' || arg === '-r') options.runId = args[++i];
    if (arg === '--phases' || arg === '-p') options.phases = args[++i];
    if (arg === '--concurrency' || arg === '-c') options.concurrency = parseInt(args[++i]);
    if (arg === '--limit' || arg === '-l') options.limit = parseInt(args[++i]);
    if (arg === '--urlColumn') options.urlColumn = args[++i];
  }

  if (!options.input && !options.runId) {
    console.error('Usage: ts-node src/pipeline-cli.ts --input <file.csv> [--phases discovery,seo,tech] [--concurrency 3]');
    process.exit(1);
  }

  const selectedPhases = options.phases.split(',').map(p => p.trim().toLowerCase());
  let currentRunId = options.runId;
  let inputPath = options.input;

  console.log(`\n🌊 Starting Unified Pipeline`);
  console.log(`⚙️  Phases: ${selectedPhases.join(', ')}`);
  console.log(`⚙️  Concurrency: ${options.concurrency}`);
  if (options.limit) console.log(`⚙️  Limit: ${options.limit}`);

  try {
    // Phase 1: Discovery / Initialization
    if (selectedPhases.includes('discovery')) {
      console.log(`\n--- [PHASE: DISCOVERY] ---`);
      const discoveryService = new WebsiteDiscoveryService();
      const result = await discoveryService.runDiscoveryPhase(inputPath);
      currentRunId = result.runId;
      console.log(`✅ Run initialized: ${currentRunId}`);
    } else if (!currentRunId && inputPath) {
      // Auto-initialize run if input provided but discovery skipped
      currentRunId = new Date().toISOString().replace(/[:T]/g, '_').slice(0, 15);
      const runDir = RunManager.getRunDirectory(currentRunId);
      await fs.ensureDir(runDir);
      
      // Copy input to progress file to simulate "discovery" completion
      const progressCsv = path.join(runDir, 'website-discovery-progress.csv');
      
      // We need to transform the input CSV into the format the pipeline expects
      // but for now, we'll just try to use the raw input if it matches or has Discovered_Website
      console.log(`✨ Auto-initializing Run ID: ${currentRunId}`);
      
      // In a manual start, we need to make sure the progressCsv exists
      // If the user's input is already "final", we use it as the source.
      const csvContent = await fs.readFile(inputPath, 'utf8');
      
      // Basic heuristic: if it doesn't have Search_Status, we add it for the pipeline
      if (!csvContent.includes('Search_Status')) {
         console.log(`📝 Normalizing input CSV for pipeline...`);
         // We'll let the scraper handle the raw input if we can't find website-discovery-progress.csv
      }
      
      await fs.writeFile(progressCsv, csvContent);
    }

    if (!currentRunId) {
      throw new Error('No Run ID available. Either start with "discovery" phase or provide --runId');
    }

    const runDir = RunManager.getRunDirectory(currentRunId);
    const progressCsv = path.join(runDir, 'website-discovery-progress.csv');

    // Super Scraper Phases (SEO, Tech, Screenshot)
    const scrapingPhases = selectedPhases.filter(p => ['seo', 'tech', 'screenshot'].includes(p));
    
    if (scrapingPhases.length > 0) {
      console.log(`\n--- [PHASE: UNIFIED SCRAPING (${scrapingPhases.join(', ')})] ---`);
      
      const superScraper = new SuperScraper({
        phases: scrapingPhases,
        concurrency: options.concurrency,
        runId: currentRunId,
        outputDir: runDir,
        maxRetries: 2
      });

      await superScraper.initialize();

      // Load URLs from progressCsv
      const urlsToProcess: any[] = [];
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(progressCsv)
          .pipe(require('csv-parser')())
          .on('data', (row: any) => {
            // Flexible column detection
            const websiteUrl = row.Discovered_Website || row.website || row.URL || '';
            const status = row.Search_Status || 'WEBSITE_DISCOVERED'; // Assume discovered if manual
            const companyName = row.Company_Name || row.title || row.company || 'Unknown';

            if (status === 'WEBSITE_DISCOVERED' && websiteUrl && !websiteUrl.includes('bizi.si')) {
              urlsToProcess.push({
                url: websiteUrl,
                companyName: companyName
              });
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      let items = urlsToProcess;
      if (options.limit && options.limit > 0) {
        items = items.slice(0, options.limit);
      }

      console.log(`🚀 Processing ${items.length} websites with concurrency ${options.concurrency}...`);

      const seoResults: any[] = [];
      const failedResults: any[] = [];

      let completed = 0;
      const total = items.length;

      console.log(`🚀 Processing ${total} websites with a fluid pool (concurrency: ${options.concurrency})...`);

      // Fluid Worker Pool Logic
      const worker = async () => {
        while (items.length > 0) {
          const item = items.shift();
          if (!item) break;

          try {
            const res = await superScraper.scrape(item.url, item.companyName);
            completed++;
            
            // UI Progress Update
            process.stdout.write(`\r[SuperScraper] Progress: ${completed}/${total} (${(completed/total*100).toFixed(1)}%) | Current: ${item.url.substring(0, 30)}...`);

            // Process results
            if (res.status === 'SUCCESS' || res.status === 'PARTIAL') {
              if (res.seo && !res.seo.error) {
                seoResults.push({
                  website: item.url,
                  biziUrl: '', 
                  targetUrl: res.url,
                  pageTitle: res.seo.title,
                  metaDescription: res.seo.metaDescription,
                  jsonLd: JSON.stringify(res.seo.jsonLdFound),
                  textContent: res.seo.fullText || '',
                  status: 'SUCCESS',
                  error: '',
                  scrapedAt: res.timestamp
                });

                // AUTO-SAVE SEO results every 10 items
                if (seoResults.length % 10 === 0) {
                  const seoOutput = path.join(runDir, 'seo-results.csv');
                  const writer = require('csv-writer').createObjectCsvWriter({
                    path: seoOutput,
                    header: Object.keys(seoResults[0]).map(k => ({ id: k, title: k }))
                  });
                  await writer.writeRecords(seoResults);
                }
              }
              if (res.tech && !res.tech.error) {
                const techMap: any = {};
                res.tech.technologies.forEach(t => {
                  techMap[t.name] = { version: t.version, categories: t.categories };
                });
                
                const techFile = path.join(runDir, 'tech_analysis', `${res.domain}.json`);
                await fs.ensureDir(path.dirname(techFile));
                await fs.writeJson(techFile, techMap, { spaces: 2 });
              }
            }

            if (res.status === 'FAILED' || res.status === 'PARTIAL') {
              const errors = [];
              if (res.error) errors.push(`Global: ${res.error}`);
              if (res.seo?.error) errors.push(`SEO: ${res.seo.error}`);
              if (res.tech?.error) errors.push(`Tech: ${res.tech.error}`);
              if (res.screenshots?.error) errors.push(`Screenshots: ${res.screenshots.error}`);
              
              if (errors.length > 0) {
                failedResults.push({
                  companyName: res.companyName,
                  url: res.url,
                  status: res.status,
                  errors: errors.join(' | ')
                });

                // AUTO-SAVE Failures every 10 items
                if (failedResults.length % 10 === 0) {
                  const failuresOutput = path.join(runDir, 'scraping-failures.csv');
                  const writer = require('csv-writer').createObjectCsvWriter({
                    path: failuresOutput,
                    header: [
                      { id: 'companyName', title: 'Company_Name' },
                      { id: 'url', title: 'URL' },
                      { id: 'status', title: 'Status' },
                      { id: 'errors', title: 'Errors' }
                    ]
                  });
                  await writer.writeRecords(failedResults);
                }
              }
            }
          } catch (err) {
            console.error(`\n[FATAL] Worker error for ${item.url}:`, err);
          }
        }
      };

      // Start workers
      const workers = Array.from({ length: options.concurrency }, () => worker());
      await Promise.all(workers);
      
      console.log('\n✅ Unified scraping complete.');

      // Save SEO Master CSV
      if (scrapingPhases.includes('seo') && seoResults.length > 0) {
        const seoOutput = path.join(runDir, 'seo-results.csv');
        const writer = require('csv-writer').createObjectCsvWriter({
          path: seoOutput,
          header: Object.keys(seoResults[0]).map(k => ({ id: k, title: k }))
        });
        await writer.writeRecords(seoResults);
        console.log(`📝 SEO master results saved to: ${seoOutput}`);
      }

      // Save Failures CSV
      if (failedResults.length > 0) {
        const failuresOutput = path.join(runDir, 'scraping-failures.csv');
        const writer = require('csv-writer').createObjectCsvWriter({
          path: failuresOutput,
          header: [
            { id: 'companyName', title: 'Company_Name' },
            { id: 'url', title: 'URL' },
            { id: 'status', title: 'Status' },
            { id: 'errors', title: 'Errors' }
          ]
        });
        await writer.writeRecords(failedResults);
        console.log(`⚠️  Failures detected! Check details in: ${failuresOutput}`);
      }

      await superScraper.cleanup();
    }

    // Phase 5: AI Analysis
    if (selectedPhases.includes('analysis')) {
      console.log(`\n--- [PHASE: ANALYSIS] ---`);
      await runWebsiteAnalysis(currentRunId, false);
    }

    console.log(`\n🎉 Pipeline completed successfully for Run ID: ${currentRunId}`);

  } catch (error) {
    console.error(`\n❌ Pipeline failed:`, error);
    process.exit(1);
  }
}

main().catch(console.error);
