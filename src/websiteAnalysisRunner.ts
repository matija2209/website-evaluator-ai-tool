import { analyzeWebsiteComplete, AnalysisInput, WebsiteAnalysisResult } from './aiAnalysisService';
import { CsvProcessor } from './csvProcessor';
import { CompanyProcessingState } from './types';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import path from 'path';
import csv from 'csv-parser';

// CSV Column Definitions for Analysis Results
export const analysisColumns = [
  'Analysis_Status',           // SUCCESS, PARTIAL_MOBILE_ONLY, etc.
  'Mobile_Score',              // 0-100
  'Desktop_Score',             // 0-100  
  'Combined_Score',            // 0-100
  'Sophistication_Level',      // EXCELLENT, GOOD_ENOUGH, etc.
  'Opportunity_Level',         // HIGH, MEDIUM, LOW, NONE
  'Mobile_Issues',             // semicolon-separated list
  'Desktop_Issues',            // semicolon-separated list
  'Quick_Wins',                // semicolon-separated recommendations
  'Major_Upgrades',            // semicolon-separated recommendations
  'Analysis_Confidence',       // 0-100
  'Analysis_Reasoning',        // brief explanation
  'Analysis_Tokens_Used',      // total tokens
  'Analysis_Timestamp'         // ISO timestamp
];

// Interface for CSV row with analysis data
interface AnalysisProgressRow {
  Company_Name: string;
  Discovered_Website: string;
  activityDescription: string;
  Screenshot_Status?: string;
  Analysis_Status?: string;
  Mobile_Score?: string;
  Desktop_Score?: string;
  Combined_Score?: string;
  Sophistication_Level?: string;
  Opportunity_Level?: string;
  Mobile_Issues?: string;
  Desktop_Issues?: string;
  Quick_Wins?: string;
  Major_Upgrades?: string;
  Analysis_Confidence?: string;
  Analysis_Reasoning?: string;
  Analysis_Tokens_Used?: string;
  Analysis_Timestamp?: string;
  [key: string]: string | undefined;
}

// Main Analysis Runner Function
export async function runWebsiteAnalysis(runId: string, forceReanalysis: boolean = false): Promise<void> {
  console.log(`Starting website analysis for run: ${runId}`);
  
  const runDir = path.join('./runs', runId);
  const progressCsvPath = path.join(runDir, 'website-discovery-progress.csv');
  const screenshotsDir = path.join(runDir, 'screenshots');
  
  // Step 1: Verify run directory and files exist
  try {
    await fs.access(runDir);
    await fs.access(progressCsvPath);
    await fs.access(screenshotsDir);
  } catch (error) {
    throw new Error(`Run directory or required files not found: ${runDir}`);
  }
  
  // Step 2: Load existing progress CSV
  console.log('Loading existing progress data...');
  const csvData = await readCsvAsArray(progressCsvPath);
  
  if (csvData.length === 0) {
    throw new Error('No data found in progress CSV');
  }
  
  // Step 3: Filter for successful screenshot captures
  const websitesToAnalyze = csvData.filter((row: AnalysisProgressRow) => 
    row.Screenshot_Status === 'SUCCESS' && 
    row.Discovered_Website && 
    row.Discovered_Website.trim() !== ''
  );
  
  if (websitesToAnalyze.length === 0) {
    console.log('No websites with successful screenshots found for analysis');
    return;
  }
  
  console.log(`Found ${websitesToAnalyze.length} websites with screenshots ready for analysis`);
  
  // Step 4: Process each website
  let processed = 0;
  let successful = 0;
  let errors = 0;
  
  for (const row of websitesToAnalyze) {
    try {
      // Skip if already analyzed (unless force reanalysis)
      if (!forceReanalysis && row.Analysis_Status && row.Analysis_Status !== 'FAILED') {
        console.log(`Skipping ${row.Company_Name} - already analyzed (${row.Analysis_Status})`);
        continue;
      }
      
      console.log(`\n--- Processing ${processed + 1}/${websitesToAnalyze.length}: ${row.Company_Name} ---`);
      
      // Extract domain from URL for screenshot paths
      const websiteUrl = row.Discovered_Website;
      if (!websiteUrl) {
        console.error(`No discovered website for: ${row.Company_Name}`);
        errors++;
        continue;
      }
      
      const domain = extractDomainFromUrl(websiteUrl);
      if (!domain) {
        console.error(`Could not extract domain from URL: ${websiteUrl}`);
        errors++;
        continue;
      }
      
      // Build analysis input
      const analysisInput: AnalysisInput = {
        mobileScreenshotPath: path.join(screenshotsDir, domain, 'mobile', 'section-1.jpeg'),
        desktopScreenshotPath: path.join(screenshotsDir, domain, 'desktop', 'section-1.jpeg'),
        websiteUrl: websiteUrl,
        companyActivity: row.activityDescription || 'Business activity not specified',
        companyName: row.Company_Name
      };
      
      // Perform analysis
      const analysisResult = await analyzeWebsiteComplete(analysisInput);
      
      // Update CSV row with analysis results
      updateRowWithAnalysis(row, analysisResult);
      
      successful++;
      console.log(`✅ Analysis completed for ${row.Company_Name} - Score: ${analysisResult.combinedScore}/100`);
      
    } catch (error) {
      console.error(`❌ Analysis failed for ${row.Company_Name}:`, error);
      
      // Mark as failed in CSV
      row.Analysis_Status = 'FAILED';
      row.Analysis_Timestamp = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      row.Analysis_Reasoning = `Analysis failed: ${errorMessage}`;
      
      errors++;
    }
    
    processed++;
    
    // Save progress after each analysis
    await saveCsvData(csvData, progressCsvPath);
    
    // Add delay between analyses to be respectful to the API
    if (processed < websitesToAnalyze.length) {
      await delay(2000); // 2 second delay
    }
  }
  
  // Step 5: Final summary
  console.log(`\n🎯 Analysis Summary for run ${runId}:`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Updated CSV: ${progressCsvPath}`);
  
  if (successful > 0) {
    console.log(`\n✨ Analysis complete! Check the updated CSV for detailed results.`);
  }
}

// Helper function to extract domain from URL
function extractDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    console.error(`Error extracting domain from URL: ${url}`, error);
    return null;
  }
}

// Helper function to update CSV row with analysis results
function updateRowWithAnalysis(row: AnalysisProgressRow, analysis: WebsiteAnalysisResult): void {
  row.Analysis_Status = analysis.analysisStatus;
  row.Mobile_Score = analysis.mobileScore.overall.toString();
  row.Desktop_Score = analysis.desktopScore.overall.toString();
  row.Combined_Score = analysis.combinedScore.toString();
  row.Sophistication_Level = analysis.sophisticationLevel;
  row.Opportunity_Level = analysis.opportunityLevel;
  row.Mobile_Issues = analysis.mobileIssues.join('; ');
  row.Desktop_Issues = analysis.desktopIssues.join('; ');
  row.Quick_Wins = analysis.quickWins.join('; ');
  row.Major_Upgrades = analysis.majorUpgrades.join('; ');
  row.Analysis_Confidence = analysis.confidence.toString();
  row.Analysis_Reasoning = analysis.reasoning;
  row.Analysis_Tokens_Used = analysis.tokensUsed.total.toString();
  row.Analysis_Timestamp = new Date().toISOString();
}

// Helper function to save CSV data
async function saveCsvData(data: AnalysisProgressRow[], filePath: string): Promise<void> {
  try {
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma or quote
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');
    
    await fs.writeFile(filePath, csvContent, 'utf8');
  } catch (error) {
    console.error('Error saving CSV data:', error);
    throw error;
  }
}

// Helper function to read CSV as array of objects
async function readCsvAsArray(filePath: string): Promise<AnalysisProgressRow[]> {
  return new Promise((resolve, reject) => {
    const results: AnalysisProgressRow[] = [];
    
    fsSync.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => {
        results.push(data as AnalysisProgressRow);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error: any) => {
        reject(error);
      });
  });
}

// Delay utility
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 