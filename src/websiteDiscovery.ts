import { GoogleSearchService } from './googleSearch';
import { CsvProcessor } from './csvProcessor';
import { RunManager } from './runManager';
import { 
  CompanyProcessingState, 
  CompanySearchInput, 
  RunMetadata,
  ProcessingStatus 
} from './types';
import { config } from '../config';

export class WebsiteDiscoveryService {
  private searchService: GoogleSearchService;

  constructor() {
    this.searchService = new GoogleSearchService();
  }

  /**
   * Convert CompanyProcessingState to CompanySearchInput
   */
  private prepareSearchInput(company: CompanyProcessingState): CompanySearchInput {
    return {
      companyName: company.cleanedName,
      city: company.normalizedCity,
      country: 'Slovenia',
      businessActivity: company.activityDescription
    };
  }

  /**
   * Process a single company for website discovery with AI validation
   */
  private async processCompany(company: CompanyProcessingState): Promise<CompanyProcessingState> {
    console.log(`\n🏢 Processing: ${company.title} (${company.cleanedName})`);
    
    try {
      const searchInput = this.prepareSearchInput(company);
      console.log(`🔍 Google Search: "${searchInput.companyName}" ${searchInput.city} ${searchInput.country}`);
      
      const searchResponse = await this.searchService.searchCompanyWebsite(searchInput);

      if (searchResponse.success && searchResponse.results.length > 0) {
        const bestResult = searchResponse.results[0];
        
        // Enhanced logging with AI validation data
        if (searchResponse.serpPosition) {
          console.log(`✅ Success: ${bestResult.link} (SERP position: ${searchResponse.serpPosition}/${searchResponse.totalResults || 'N/A'})`);
        } else {
          console.log(`✅ Success: ${bestResult.link}`);
        }
        
        return {
          ...company,
          discoveredWebsite: bestResult.link,
          searchStatus: 'WEBSITE_DISCOVERED',
          searchQuery: searchResponse.searchQuery,
          serpPosition: searchResponse.serpPosition,
          aiValidation: searchResponse.aiValidation,
          processingDate: new Date().toISOString()
        };
      } else {
        console.log(`❌ No suitable website found`);
        return {
          ...company,
          searchStatus: 'NO_WEBSITE_FOUND',
          searchQuery: searchResponse.searchQuery,
          searchError: searchResponse.errorMessage,
          processingDate: new Date().toISOString()
        };
      }

    } catch (error: any) {
      console.error(`❌ Error processing ${company.title}:`, error.message);
      
      return {
        ...company,
        searchStatus: 'NO_WEBSITE_FOUND',
        searchError: error.message,
        processingDate: new Date().toISOString()
      };
    }
  }

  /**
   * Process multiple companies in batches with rate limiting
   */
  async discoverWebsitesForCompanies(
    companies: CompanyProcessingState[],
    runDir: string,
    onProgress?: (processed: number, total: number, company: CompanyProcessingState) => void
  ): Promise<CompanyProcessingState[]> {
    
    console.log(`\n🚀 Starting website discovery for ${companies.length} companies`);
    console.log(`📊 Processing with ${config.google.rateLimitDelay}ms delay between requests`);
    console.log(`🔄 Max ${config.processing.maxRetries} retries per company\n`);

    const processedCompanies: CompanyProcessingState[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      
      console.log(`\n📈 Progress: ${i + 1}/${companies.length} (${Math.round((i + 1) / companies.length * 100)}%)`);
      
      const processed = await this.processCompany(company);
      processedCompanies.push(processed);

      if (processed.searchStatus === 'WEBSITE_DISCOVERED') {
        successCount++;
        console.log(`✅ Success! Found: ${processed.discoveredWebsite}`);
      } else {
        failureCount++;
        console.log(`❌ Failed: ${processed.searchError || 'No website found'}`);
      }

      // Call progress callback if provided
      if (onProgress) {
        onProgress(i + 1, companies.length, processed);
      }

      // Save progress periodically (every 10 companies)
      if ((i + 1) % 10 === 0 || i === companies.length - 1) {
        await CsvProcessor.writeWebsiteDiscoveryProgress(runDir, processedCompanies);
        console.log(`💾 Progress saved (${i + 1}/${companies.length} processed)`);
      }

      // Rate limiting delay (except for last item)
      if (i < companies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, config.google.rateLimitDelay));
      }
    }

    // Final statistics
    const successRate = Math.round((successCount / companies.length) * 100);
    console.log(`\n📊 Website Discovery Complete!`);
    console.log(`✅ Success: ${successCount}/${companies.length} (${successRate}%)`);
    console.log(`❌ Failed: ${failureCount}/${companies.length} (${Math.round((failureCount / companies.length) * 100)}%)`);

    return processedCompanies;
  }

  /**
   * Resume website discovery from existing progress
   */
  async resumeWebsiteDiscovery(
    runDir: string,
    allCompanies: CompanyProcessingState[],
    onProgress?: (processed: number, total: number, company: CompanyProcessingState) => void
  ): Promise<CompanyProcessingState[]> {
    
    console.log(`🔄 Checking for existing website discovery progress...`);
    
    const existingProgress = await CsvProcessor.readWebsiteDiscoveryProgress(runDir);
    
    if (existingProgress.length === 0) {
      console.log(`📝 No existing progress found, starting fresh discovery`);
      return await this.discoverWebsitesForCompanies(allCompanies, runDir, onProgress);
    }

    console.log(`📖 Found existing progress for ${existingProgress.length} companies`);
    
    // Create a map of existing progress
    const progressMap = new Map<string, CompanyProcessingState>();
    existingProgress.forEach(company => {
      progressMap.set(company.title, company);
    });

    // Merge existing progress with all companies
    const mergedCompanies = allCompanies.map(company => {
      const existing = progressMap.get(company.title);
      if (existing && existing.searchStatus !== 'PENDING') {
        return existing;
      }
      return company;
    });

    // Find companies that still need processing
    const pendingCompanies = mergedCompanies.filter(company => 
      company.searchStatus === 'PENDING'
    );

    if (pendingCompanies.length === 0) {
      console.log(`✅ All companies already processed, no work needed`);
      return mergedCompanies;
    }

    console.log(`⏭️  Resuming discovery for ${pendingCompanies.length} pending companies`);
    
    // Process remaining companies
    const newlyProcessed = await this.discoverWebsitesForCompanies(
      pendingCompanies, 
      runDir, 
      onProgress
    );

    // Merge results
    const finalResults = mergedCompanies.map(company => {
      if (company.searchStatus === 'PENDING') {
        const processed = newlyProcessed.find(p => p.title === company.title);
        return processed || company;
      }
      return company;
    });

    return finalResults;
  }

  /**
   * Get companies that have discovered websites (ready for next phase)
   */
  static getCompaniesWithWebsites(companies: CompanyProcessingState[]): CompanyProcessingState[] {
    return companies.filter(company => 
      company.searchStatus === 'WEBSITE_DISCOVERED' && company.discoveredWebsite
    );
  }

  /**
   * Get discovery statistics
   */
  static getDiscoveryStats(companies: CompanyProcessingState[]): {
    total: number;
    discovered: number;
    failed: number;
    pending: number;
    successRate: number;
  } {
    const total = companies.length;
    const discovered = companies.filter(c => c.searchStatus === 'WEBSITE_DISCOVERED').length;
    const failed = companies.filter(c => c.searchStatus === 'NO_WEBSITE_FOUND').length;
    const pending = companies.filter(c => c.searchStatus === 'PENDING').length;
    const successRate = total > 0 ? Math.round((discovered / total) * 100) : 0;

    return {
      total,
      discovered,
      failed,
      pending,
      successRate
    };
  }

  /**
   * Run the complete website discovery phase
   */
  async runDiscoveryPhase(
    inputCsvPath: string,
    runDir?: string
  ): Promise<{
    runId: string;
    runDir: string;
    companies: CompanyProcessingState[];
    stats: ReturnType<typeof WebsiteDiscoveryService.getDiscoveryStats>;
  }> {
    
    console.log(`\n🎯 Phase 2: Website Discovery - THE CORE PHASE`);
    console.log(`📂 Input CSV: ${inputCsvPath}`);

    // Initialize run if not provided
    let finalRunDir: string;
    let runId: string;
    
    if (!runDir) {
      const runInfo = await RunManager.initializeRun(inputCsvPath);
      runId = runInfo.runId;
      finalRunDir = runInfo.runDir;
    } else {
      // Extract run ID from run directory
      finalRunDir = runDir;
      runId = finalRunDir.split('/').pop() || 'unknown';
    }

    // Read and prepare companies
    const rawCompanies = await CsvProcessor.readCompaniesFromCsv(inputCsvPath);
    const companies = rawCompanies.map(company => 
      CsvProcessor.prepareCompanyForProcessing(company)
    );

    // Create and save run metadata
    const metadata: RunMetadata = {
      runId,
      startTime: new Date().toISOString(),
      inputFile: inputCsvPath,
      totalCompanies: companies.length,
      currentPhase: 'DISCOVERY',
      companiesProcessed: 0,
      companiesWithWebsites: 0,
      companiesWithScreenshots: 0,
      companiesAnalyzed: 0
    };
    
    await RunManager.saveRunMetadata(finalRunDir, metadata);

    // Progress tracking
    const onProgress = async (processed: number, total: number, company: CompanyProcessingState) => {
      const withWebsites = WebsiteDiscoveryService.getCompaniesWithWebsites(
        await CsvProcessor.readWebsiteDiscoveryProgress(finalRunDir)
      ).length;
      
      await RunManager.updateRunProgress(finalRunDir, {
        companiesProcessed: processed,
        companiesWithWebsites: withWebsites
      });
    };

    // Run discovery (with resume support)
    const processedCompanies = await this.resumeWebsiteDiscovery(
      finalRunDir,
      companies,
      onProgress
    );

    // Get final statistics
    const stats = WebsiteDiscoveryService.getDiscoveryStats(processedCompanies);
    
    // Update final metadata
    await RunManager.updateRunProgress(finalRunDir, {
      companiesProcessed: stats.total,
      companiesWithWebsites: stats.discovered,
      currentPhase: stats.discovered > 0 ? 'SCREENSHOTS' : 'COMPLETE'
    });

    // Save final progress
    await CsvProcessor.writeWebsiteDiscoveryProgress(finalRunDir, processedCompanies);

    console.log(`\n🎉 Phase 2 Complete!`);
    console.log(`📊 Final Stats:`);
    console.log(`   Total companies: ${stats.total}`);
    console.log(`   Websites discovered: ${stats.discovered} (${stats.successRate}%)`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Ready for Phase 3: ${stats.discovered} companies`);

    return {
      runId,
      runDir: finalRunDir,
      companies: processedCompanies,
      stats
    };
  }
} 