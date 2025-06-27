// Company data from CSV input
export interface CompanyData {
  filterGroup: string;
  title: string;
  url: string;
  streetAddress: string;
  city: string;
  businessId: string;
  taxNumber: string;
  activityDescription: string;
  employeeCount: string;
  page: string;
}

// Search interfaces from step-2-custom-search.md
export interface SearchOptions {
  maxResultsToConsider?: number; // How many of the 10 results to actually process
  includeVariations?: boolean;   // Try alternative search queries if first fails
  strictMatching?: boolean;      // Use fuzzy matching or exact matching
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string; // Clean domain name
}

export interface CompanySearchInput {
  companyName: string;
  city: string;
  country?: string; // Default: "Slovenia"
  businessActivity?: string; // Optional for enhanced search
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  searchQuery: string;
  totalResults: number;
  errorMessage?: string;
  searchVariationUsed?: string; // Which query variation worked
}

// Processing status types
export type ProcessingStatus = 
  | 'PENDING'
  | 'WEBSITE_DISCOVERED'
  | 'NO_WEBSITE_FOUND'
  | 'SCREENSHOT_CAPTURED'
  | 'SCREENSHOT_FAILED'
  | 'ANALYSIS_COMPLETED'
  | 'ANALYSIS_FAILED';

// Company processing state
export interface CompanyProcessingState extends CompanyData {
  cleanedName: string;
  normalizedCity: string;
  discoveredWebsite?: string;
  searchStatus: ProcessingStatus;
  searchQuery?: string;
  searchError?: string;
  screenshotPaths?: {
    desktop: string[];
    mobile: string[];
  };
  analysisResults?: {
    desktopScore: number;
    mobileScore: number;
    combinedScore: number;
    sophisticationLevel: string;
    opportunityLevel: string;
    mobileIssues: string[];
    desktopIssues: string[];
    primaryRecommendations: string[];
    tokensUsed: number;
  };
  processingDate: string;
}

// Run management
export interface RunMetadata {
  runId: string;
  startTime: string;
  inputFile: string;
  totalCompanies: number;
  currentPhase: 'DISCOVERY' | 'SCREENSHOTS' | 'ANALYSIS' | 'COMPLETE';
  companiesProcessed: number;
  companiesWithWebsites: number;
  companiesWithScreenshots: number;
  companiesAnalyzed: number;
} 