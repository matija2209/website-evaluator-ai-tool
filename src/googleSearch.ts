
/**
 * 🛑 RETIRED SERVICE
 * Google Custom Search JSON API is deprecated and scheduled for sunset on January 1, 2027.
 * Automated website discovery using this API has been retired from the core pipeline.
 */

export class GoogleSearchService {
  constructor() {
    console.warn('⚠️  GoogleSearchService is RETIRED. Automated discovery is disabled.');
  }

  async searchCompanyWebsite(_input?: any): Promise<any> {
    return {
      success: false,
      results: [],
      errorMessage: 'Google Custom Search discovery is RETIRED and disabled in this version. Please provide website URLs directly in the input CSV.'
    };
  }
}