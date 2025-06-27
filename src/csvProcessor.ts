import csv from 'csv-parser';
import * as csvWriter from 'csv-writer';
import fs from 'fs-extra';
import path from 'path';
import { CompanyData, CompanyProcessingState } from './types';

export class CsvProcessor {
  
  /**
   * Read companies data from input CSV file
   */
  static async readCompaniesFromCsv(filePath: string): Promise<CompanyData[]> {
    return new Promise((resolve, reject) => {
      const companies: CompanyData[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv({
          headers: [
            'filterGroup',
            'title', 
            'url',
            'streetAddress',
            'city',
            'businessId',
            'taxNumber',
            'activityDescription',
            'employeeCount',
            'page'
          ]
        }))
        .on('data', (row) => {
          // Skip header row
          if (row.filterGroup === 'Filter Group') return;
          
          companies.push({
            filterGroup: row.filterGroup,
            title: row.title,
            url: row.url,
            streetAddress: row.streetAddress,
            city: row.city,
            businessId: row.businessId,
            taxNumber: row.taxNumber,
            activityDescription: row.activityDescription,
            employeeCount: row.employeeCount,
            page: row.page
          });
        })
        .on('end', () => {
          console.log(`✅ Successfully read ${companies.length} companies from CSV`);
          resolve(companies);
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV:', error);
          reject(error);
        });
    });
  }

  /**
   * Clean company title (remove d.o.o., d.d., etc. and trim)
   */
  static cleanCompanyTitle(title: string): string {
    return title
      .replace(/\bd\.o\.o\.?\b/gi, '')
      .replace(/\bd\.d\.?\b/gi, '')
      .replace(/\bs\.p\.?\b/gi, '')
      .replace(/\bj\.p\.?\b/gi, '')
      .replace(/\bv\.d\.?\b/gi, '')
      .replace(/\,\s*$/, '') // Remove trailing comma
      .trim();
  }

  /**
   * Normalize city name
   */
  static normalizeCityName(city: string): string {
    return city
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash (e.g., "Koper - Capodistria" -> "Koper")
      .trim();
  }

  /**
   * Convert CompanyData to CompanyProcessingState with cleaned fields
   */
  static prepareCompanyForProcessing(company: CompanyData): CompanyProcessingState {
    return {
      ...company,
      cleanedName: this.cleanCompanyTitle(company.title),
      normalizedCity: this.normalizeCityName(company.city),
      searchStatus: 'PENDING',
      processingDate: new Date().toISOString()
    };
  }

  /**
   * Write website discovery progress to CSV
   */
  static async writeWebsiteDiscoveryProgress(
    runDir: string, 
    companies: CompanyProcessingState[]
  ): Promise<void> {
    const writer = csvWriter.createObjectCsvWriter({
      path: path.join(runDir, 'website-discovery-progress.csv'),
      header: [
        { id: 'title', title: 'Company_Name' },
        { id: 'cleanedName', title: 'Cleaned_Name' },
        { id: 'city', title: 'City' },
        { id: 'normalizedCity', title: 'Normalized_City' },
        { id: 'url', title: 'Original_URL' },
        { id: 'discoveredWebsite', title: 'Discovered_Website' },
        { id: 'searchStatus', title: 'Search_Status' },
        { id: 'searchQuery', title: 'Search_Query' },
        { id: 'searchError', title: 'Search_Error' },
        { id: 'processingDate', title: 'Processing_Date' }
      ]
    });

    await writer.writeRecords(companies);
    console.log(`📝 Website discovery progress saved to ${runDir}/website-discovery-progress.csv`);
  }

  /**
   * Write final output CSV with all results
   */
  static async writeFinalOutput(
    runDir: string,
    companies: CompanyProcessingState[]
  ): Promise<void> {
    const writer = csvWriter.createObjectCsvWriter({
      path: path.join(runDir, 'output.csv'),
      header: [
        { id: 'processingDate', title: 'Timestamp' },
        { id: 'title', title: 'Company_Name' },
        { id: 'url', title: 'Original_URL' },
        { id: 'discoveredWebsite', title: 'Actual_Website' },
        { id: 'searchStatus', title: 'Search_Status' },
        { id: 'analysisResults.desktopScore', title: 'Desktop_Score' },
        { id: 'analysisResults.mobileScore', title: 'Mobile_Score' },
        { id: 'analysisResults.combinedScore', title: 'Combined_Score' },
        { id: 'analysisResults.sophisticationLevel', title: 'Sophistication_Level' },
        { id: 'analysisResults.opportunityLevel', title: 'Opportunity_Level' },
        { id: 'analysisResults.mobileIssues', title: 'Mobile_Issues' },
        { id: 'analysisResults.desktopIssues', title: 'Desktop_Issues' },
        { id: 'analysisResults.primaryRecommendations', title: 'Primary_Recommendations' },
        { id: 'screenshotPaths.desktop', title: 'Desktop_Screenshot_Path' },
        { id: 'screenshotPaths.mobile', title: 'Mobile_Screenshot_Path' },
        { id: 'processingDate', title: 'Analysis_Date' },
        { id: 'analysisResults.tokensUsed', title: 'Tokens_Used' }
      ]
    });

    // Transform data for output
    const outputData = companies.map(company => ({
      ...company,
      'analysisResults.desktopScore': company.analysisResults?.desktopScore || '',
      'analysisResults.mobileScore': company.analysisResults?.mobileScore || '',
      'analysisResults.combinedScore': company.analysisResults?.combinedScore || '',
      'analysisResults.sophisticationLevel': company.analysisResults?.sophisticationLevel || '',
      'analysisResults.opportunityLevel': company.analysisResults?.opportunityLevel || '',
      'analysisResults.mobileIssues': company.analysisResults?.mobileIssues?.join('; ') || '',
      'analysisResults.desktopIssues': company.analysisResults?.desktopIssues?.join('; ') || '',
      'analysisResults.primaryRecommendations': company.analysisResults?.primaryRecommendations?.join('; ') || '',
      'screenshotPaths.desktop': company.screenshotPaths?.desktop?.join('; ') || '',
      'screenshotPaths.mobile': company.screenshotPaths?.mobile?.join('; ') || '',
      'analysisResults.tokensUsed': company.analysisResults?.tokensUsed || ''
    }));

    await writer.writeRecords(outputData);
    console.log(`📝 Final output saved to ${runDir}/output.csv`);
  }

  /**
   * Read existing progress file to resume processing
   */
  static async readWebsiteDiscoveryProgress(runDir: string): Promise<CompanyProcessingState[]> {
    const progressFile = path.join(runDir, 'website-discovery-progress.csv');
    
    if (!await fs.pathExists(progressFile)) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const companies: CompanyProcessingState[] = [];
      
      fs.createReadStream(progressFile)
        .pipe(csv())
        .on('data', (row) => {
          // Convert back to CompanyProcessingState format
          companies.push({
            filterGroup: '',
            title: row.Company_Name,
            url: row.Original_URL,
            streetAddress: '',
            city: row.City,
            businessId: '',
            taxNumber: '',
            activityDescription: '',
            employeeCount: '',
            page: '',
            cleanedName: row.Cleaned_Name,
            normalizedCity: row.Normalized_City,
            discoveredWebsite: row.Discovered_Website,
            searchStatus: row.Search_Status as any,
            searchQuery: row.Search_Query,
            searchError: row.Search_Error,
            processingDate: row.Processing_Date
          });
        })
        .on('end', () => {
          console.log(`📖 Loaded ${companies.length} companies from progress file`);
          resolve(companies);
        })
        .on('error', reject);
    });
  }
} 