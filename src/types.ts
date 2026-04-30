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
  [key: string]: any;
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
  aiValidatedResult?: SearchResult;
  serpPosition?: number; // 1-based SERP position of selected result
  aiValidation?: AIValidationResult; // AI validation data
}

// AI Validation interfaces
export interface AIValidationResult {
  selectedResultIndex: number | null; // 0-based SERP position, null if no suitable result
  confidence: number; // 0-1 confidence score
  reasoning: string; // AI explanation for the selection
  isMatch: boolean; // Whether any result is suitable
  tokensUsed: number; // Token cost tracking
  multipleValidFound: boolean; // Multiple good matches detected
}

export interface AIValidationRequest {
  companyName: string;
  location: string;
  businessActivity?: string;
  searchResults: SearchResult[]; // From Google Search
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
  aiValidation?: AIValidationResult;
  serpPosition?: number; // 1-based position of selected result
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

// Screenshot capture interfaces
export interface ScreenshotConfig {
  concurrency: number;           // Default: 1
  pageTimeout: number;           // Default: 30000ms
  scrollDelay: number;           // Default: 2000ms
  jpegQuality: number;           // Default: 75
  maxRetries: number;            // Default: 2
  disableImages: boolean;        // Default: false (for faster loading)
  enableContentWait: boolean;    // Default: true (wait for content to load)
}

export interface ScreenshotResult {
  url: string;
  domain: string;
  companyName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  desktopSections: number;
  mobileSections: number;
  loadTimeMs: number;
  errorMessage?: string;
  retryCount: number;
  timestamp: string;
  pagePreparation?: PagePreparationResult;
  screenshotPaths: {
    desktop: string[];
    mobile: string[];
  };
}

export interface ViewportConfig {
  name: 'desktop' | 'mobile';
  width: number;
  height: number;
  sectionHeight: number;
  overlap: number;
}

export interface BrowserPoolConfig {
  maxBrowsers: number;
  restartAfterPages: number;
  launchTimeout: number;
}

export type ConsentOutcome =
  | 'accepted_extension_or_preexisting'
  | 'accepted_fallback'
  | 'skipped_unsafe'
  | 'not_detected';

export type ConsentMethod =
  | 'extension'
  | 'preexisting_storage_state'
  | 'fallback'
  | 'none';

export type PopupOutcome =
  | 'closed'
  | 'skipped_unsafe'
  | 'not_detected';

export type PopupMethod =
  | 'fallback'
  | 'none';

export interface PagePreparationResult {
  consentOutcome: ConsentOutcome;
  consentMethod: ConsentMethod;
  popupOutcome: PopupOutcome;
  popupMethod: PopupMethod;
  details: string[];
  reason?: string;
  frameUrl?: string;
}

export interface ConsentHandlingConfig {
  locale: string;
  acceptLanguage: string;
  extensionPath?: string;
  cacheDirectory: string;
  settleTimeoutMs: number;
  disableExtension: boolean;
  disableFallback: boolean;
  disablePopupCloser: boolean;
}

// Extended CSV data structure for screenshot progress
export interface ScreenshotProgressData {
  Company_Name: string;
  Cleaned_Name: string;
  City: string;
  Normalized_City: string;
  Original_URL: string;
  Discovered_Website: string;
  Search_Status: string;
  Search_Query: string;
  Search_Error: string;
  SERP_Position: string;
  AI_Confidence: string;
  AI_Reasoning: string;
  Tokens_Used: string;
  Multiple_Valid_Found: string;
  Processing_Date: string;
  // New screenshot columns
  Screenshot_Status: string;
  Desktop_Sections: string;
  Mobile_Sections: string;
  Screenshot_Error: string;
  Load_Time_MS: string;
  Screenshot_Retry_Count: string;
  Screenshot_Timestamp: string;
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

// Wappalyzer detection interfaces
export interface WappalyzerTechnology {
  version: string;
  confidence: number;
  categories: string[];
  groups: string[];
}

export interface WappalyzerResult {
  [url: string]: {
    [techName: string]: WappalyzerTechnology;
  };
}
// Super Scraper interfaces
export interface SuperScrapeConfig {
  phases: string[]; // ['seo', 'tech', 'screenshot']
  concurrency: number;
  runId: string;
  outputDir: string;
  maxRetries: number;
}

export interface SuperScrapeResult {
  url: string;
  domain: string;
  companyName: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
  pagePreparation?: PagePreparationResult;
  seo?: {
    title: string;
    metaDescription: string;
    h1: string[];
    wordCount: number;
    jsonLdFound: boolean;
    fullText?: string;
    error?: string;
  };
  tech?: {
    technologies: Array<{
      name: string;
      version: string | null;
      categories: string[];
    }>;
    error?: string;
  };
  screenshots?: {
    desktopPaths: string[];
    mobilePaths: string[];
    error?: string;
  };
  error?: string;
  loadTimeMs: number;
  timestamp: string;
}
