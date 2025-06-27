import { customsearch_v1 } from '@googleapis/customsearch';
import { google } from 'googleapis';
import { 
  SearchOptions, 
  SearchResult, 
  CompanySearchInput, 
  SearchResponse 
} from './types';
import { ALL_EXCLUDED_DOMAINS } from './exclusionLists';
import { config } from '../config';

export class GoogleSearchService {
  private customSearch: customsearch_v1.Customsearch;

  constructor() {
    this.customSearch = google.customsearch('v1');
  }

  /**
   * Build search query using different variations
   */
  private buildSearchQuery(
    companyData: CompanySearchInput,
    variation: 'default' | 'without_quotes' | 'with_activity' | 'name_only' | 'clean_name' = 'default'
  ): string {
    const { companyName, city, country = 'Slovenia', businessActivity } = companyData;
    
    switch (variation) {
      case 'default':
        return `"${companyName}" ${city} ${country}`;
      
      case 'without_quotes':
        return `${companyName} ${city} ${country}`;
      
      case 'with_activity':
        return `"${companyName}" ${city} ${country} ${businessActivity || ''}`.trim();
      
      case 'name_only':
        return `"${companyName}" ${country}`;
      
      case 'clean_name':
        // Remove common business suffixes for cleaner search
        const cleanName = companyName
          .replace(/\bd\.o\.o\.?\b/gi, '')
          .replace(/\bd\.d\.?\b/gi, '')
          .replace(/\bs\.p\.?\b/gi, '')
          .replace(/\bj\.p\.?\b/gi, '')
          .replace(/\bv\.d\.?\b/gi, '')
          .replace(/\,\s*$/, '')
          .trim();
        return `"${cleanName}" ${city} ${country}`;
      
      default:
        return `"${companyName}" ${city} ${country}`;
    }
  }

  /**
   * Execute Google Custom Search API call
   */
  private async executeGoogleSearch(
    query: string,
    apiKey: string,
    cx: string
  ): Promise<any> {
    try {
      const response = await this.customSearch.cse.list({
        key: apiKey,  // Use 'key' instead of 'auth' for API key authentication
        cx: cx,
        q: query,
        num: config.google.maxResults,
        lr: 'lang_sl', // Language restriction for Slovenian
        cr: 'countrySI' // Country restriction for Slovenia
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Google Search API error: ${error.message}`);
    }
  }

  /**
   * Filter search results to remove excluded domains
   */
  private filterSearchResults(
    results: any[],
    maxResults: number,
    companyName: string
  ): SearchResult[] {
    if (!results || results.length === 0) {
      return [];
    }

    return results
      .map(item => ({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
        displayLink: item.displayLink || new URL(item.link).hostname
      }))
      .filter(result => {
        // Check if domain is in exclusion list
        const domain = result.displayLink.toLowerCase();
        return !ALL_EXCLUDED_DOMAINS.some(excluded => 
          domain.includes(excluded.toLowerCase())
        );
      })
      .filter(result => {
        // Validate URL format
        try {
          const url = new URL(result.link);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      })
      .slice(0, maxResults); // Limit results
  }

  /**
   * Placeholder best match selection function (to be replaced with AI)
   */
  private selectBestMatch(
    results: SearchResult[],
    companyData: CompanySearchInput
  ): SearchResult | null {
    // TODO: This will be replaced with AI-powered matching
    // For now, return first valid result or null
    
    if (results.length === 0) return null;
    
    // Simple placeholder logic:
    // 1. Prefer results with company name in domain
    // 2. Prefer HTTPS over HTTP
    // 3. Return first result otherwise
    
    const companyNameLower = companyData.companyName.toLowerCase();
    
    // Look for company name in domain
    const domainMatch = results.find(result => {
      const domain = result.displayLink.toLowerCase();
      return domain.includes(companyNameLower.replace(/\s+/g, ''));
    });
    
    if (domainMatch) return domainMatch;
    
    // Prefer HTTPS
    const httpsResult = results.find(result => 
      result.link.startsWith('https://')
    );
    
    if (httpsResult) return httpsResult;
    
    return results[0] || null;
  }

  /**
   * Search with retry logic and exponential backoff
   */
  private async searchWithRetry(
    companyData: CompanySearchInput,
    maxRetries: number = 3
  ): Promise<SearchResponse> {
    const variations: Array<'default' | 'without_quotes' | 'with_activity' | 'name_only' | 'clean_name'> = [
      'default',
      'without_quotes', 
      'clean_name',
      'with_activity',
      'name_only'
    ];

    let lastError: Error | null = null;

    for (const variation of variations) {
      const query = this.buildSearchQuery(companyData, variation);
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔍 Searching (${variation}, attempt ${attempt}): ${query}`);
          
          const searchData = await this.executeGoogleSearch(
            query,
            config.google.apiKey,
            config.google.customSearchEngineId
          );

          const rawResults = searchData.items || [];
          const filteredResults = this.filterSearchResults(
            rawResults,
            config.google.maxResults,
            companyData.companyName
          );

          console.log(`📊 Found ${rawResults.length} raw results, ${filteredResults.length} after filtering`);

          if (filteredResults.length > 0) {
            return {
              success: true,
              results: filteredResults,
              searchQuery: query,
              totalResults: searchData.searchInformation?.totalResults || 0,
              searchVariationUsed: variation
            };
          }

          // If no results with this variation, try next variation
          break;

        } catch (error: any) {
          lastError = error;
          console.log(`❌ Search attempt ${attempt} failed: ${error.message}`);
          
          // Rate limit handling
          if (error.message.includes('quota') || error.message.includes('rate')) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`⏳ Rate limited, waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // For other errors, don't retry this variation
            break;
          }
        }

        // Rate limiting delay between requests
        await new Promise(resolve => setTimeout(resolve, config.google.rateLimitDelay));
      }
    }

    // All variations and retries failed
    return {
      success: false,
      results: [],
      searchQuery: this.buildSearchQuery(companyData, 'default'),
      totalResults: 0,
      errorMessage: lastError?.message || 'No results found with any search variation'
    };
  }

  /**
   * Main search function
   */
  async searchCompanyWebsite(
    companyData: CompanySearchInput,
    options: SearchOptions = {}
  ): Promise<SearchResponse> {
    const {
      maxResultsToConsider = config.google.maxResults,
      includeVariations = true,
      strictMatching = false
    } = options;

    try {
      console.log(`🔎 Starting search for: ${companyData.companyName} in ${companyData.city}`);
      
      const searchResponse = await this.searchWithRetry(companyData, config.processing.maxRetries);
      
      if (!searchResponse.success || searchResponse.results.length === 0) {
        console.log(`❌ No website found for ${companyData.companyName}`);
        return searchResponse;
      }

      // Select best match (placeholder implementation)
      const bestMatch = this.selectBestMatch(searchResponse.results, companyData);
      
      if (bestMatch) {
        console.log(`✅ Found website for ${companyData.companyName}: ${bestMatch.link}`);
        // Return only the best match
        return {
          ...searchResponse,
          results: [bestMatch]
        };
      } else {
        console.log(`❌ No suitable match found for ${companyData.companyName}`);
        return {
          ...searchResponse,
          success: false,
          results: [],
          errorMessage: 'No suitable website match found'
        };
      }

    } catch (error: any) {
      console.error(`💥 Search error for ${companyData.companyName}:`, error.message);
      return {
        success: false,
        results: [],
        searchQuery: this.buildSearchQuery(companyData, 'default'),
        totalResults: 0,
        errorMessage: error.message
      };
    }
  }
} 