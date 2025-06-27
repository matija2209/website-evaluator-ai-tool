# Phase 2: Website Discovery Module - Detailed Implementation Plan

## Step 2.1: Google Custom Search API Implementation (`googleSearch.ts`)

### **2.1.1: Dependencies & Setup**

#### **Install Required Packages**
```bash
pnpm add @googleapis/customsearch
pnpm add -D @types/node
```

#### **Configuration Structure (add to `config.ts`)**
```typescript
export const config = {
  google: {
    apiKey: 'YOUR_GOOGLE_API_KEY',
    customSearchEngineId: 'YOUR_CUSTOM_SEARCH_ENGINE_ID',
    maxResults: 10, // Google Custom Search API max per request
    rateLimitDelay: 100 // ms between requests (Google allows 100 queries/day free, 10k paid)
  },
  // ... existing config
}
```

#### **Environment Variables (.env)**
```
GOOGLE_API_KEY=your_api_key_here
GOOGLE_CSE_ID=your_custom_search_engine_id_here
```

---

### **2.1.2: Data Structures & Types**

#### **TypeScript Interfaces**
```typescript
interface SearchOptions {
  maxResultsToConsider?: number; // How many of the 10 results to actually process
  includeVariations?: boolean;   // Try alternative search queries if first fails
  strictMatching?: boolean;      // Use fuzzy matching or exact matching
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string; // Clean domain name
}

interface CompanySearchInput {
  companyName: string;
  city: string;
  country?: string; // Default: "Slovenia"
  businessActivity?: string; // Optional for enhanced search
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  searchQuery: string;
  totalResults: number;
  errorMessage?: string;
  searchVariationUsed?: string; // Which query variation worked
}
```

---

### **2.1.3: Filter Arrays (Static Data)**

#### **Directory Exclusion Lists**
```typescript
// Static arrays in constants file or config
export const EXCLUDED_DIRECTORIES = [
  'bizi.si',
  'zlatestrani.si',
  'poslovniseznam.si',
  'firme.si',
  'ajpes.si',
  'telefonski-imenik.si',
  'najdi.si'
  // Add more as discovered
];

export const EXCLUDED_SOCIAL_MEDIA = [
  'facebook.com',
  'linkedin.com',
  'instagram.com',
  'twitter.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com'
];

export const EXCLUDED_MARKETPLACES = [
  'amazon.com',
  'ebay.com',
  'mercator.si',
  'enaa.com'
];

// Combine all exclusions
export const ALL_EXCLUDED_DOMAINS = [
  ...EXCLUDED_DIRECTORIES,
  ...EXCLUDED_SOCIAL_MEDIA,
  ...EXCLUDED_MARKETPLACES
];
```

---

### **2.1.4: Core Search Functions**

#### **Main Search Function Structure**
```typescript
async function searchCompanyWebsite(
  companyData: CompanySearchInput,
  options: SearchOptions = {}
): Promise<SearchResponse>
```

**Function Responsibilities:**
1. Build search query using `buildSearchQuery()`
2. Execute Google Custom Search API call
3. Filter results using `filterSearchResults()`
4. Apply rate limiting
5. Handle errors and retries
6. Return structured response

#### **Query Building Function**
```typescript
function buildSearchQuery(
  companyData: CompanySearchInput,
  variation: 'default' | 'without_quotes' | 'with_activity' | 'name_only' = 'default'
): string
```

**Query Variations to Implement:**
1. **Default**: `"Company Name" City Slovenia`
2. **Without Quotes**: `Company Name City Slovenia`
3. **With Activity**: `"Company Name" City Slovenia [business activity]`
4. **Name Only**: `"Company Name" Slovenia`
5. **Clean Name**: Remove "d.o.o.", "d.d.", etc., then search

#### **Results Filtering Function**
```typescript
function filterSearchResults(
  results: SearchResult[],
  maxResults: number,
  companyName: string
): SearchResult[]
```

**Filtering Logic:**
1. Remove excluded domains
2. Validate URLs (HTTP/HTTPS, reachable)
3. Limit to `maxResults`
4. Sort by relevance (domain similarity to company name)

---

### **2.1.5: API Integration Details**

#### **Google Custom Search Setup Steps**
1. Create Custom Search Engine at https://cse.google.com/cse/create/new
2. Configure to search the entire web
3. Get the Search Engine ID (cx parameter)
4. Get Google API Key from Google Cloud Console
5. Enable Custom Search API

#### **API Call Implementation**
```typescript
async function executeGoogleSearch(
  query: string,
  apiKey: string,
  cx: string
): Promise<any>
```

**API Parameters to Use:**
- `q`: Search query
- `cx`: Custom Search Engine ID
- `auth`: API Key
- `num`: Number of results (max 10)
- `start`: Starting index for pagination (if needed)
- `lr`: Language restriction (lang_sl for Slovenian)
- `cr`: Country restriction (countrySI for Slovenia)

---

### **2.1.6: Error Handling & Rate Limiting**

#### **Error Categories to Handle**
1. **API Quota Exceeded**: Graceful degradation, retry after delay
2. **Invalid API Key/CSE ID**: Configuration error, fail fast
3. **Network Timeout**: Retry with exponential backoff
4. **No Results Found**: Try query variations
5. **Malformed Response**: Log and skip

#### **Rate Limiting Strategy**
- Implement delay between requests based on `config.google.rateLimitDelay`
- Track daily quota usage
- Exponential backoff on rate limit errors

#### **Retry Logic**
```typescript
async function searchWithRetry(
  companyData: CompanySearchInput,
  maxRetries: number = 3
): Promise<SearchResponse>
```

---

### **2.1.7: Dummy Best Match Function (Black Box)**

#### **Placeholder Implementation**
```typescript
function selectBestMatch(
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
  
  return results[0] || null;
}
```

---

### **2.1.8: Logging & Debugging**

#### **Logging Requirements**
1. **Search Queries**: Log exact query used for each search
2. **API Responses**: Log result count and any errors
3. **Filtering**: Log how many results were filtered out and why
4. **Rate Limits**: Track API usage
5. **Performance**: Log search duration

#### **Debug Mode Features**
- Option to save raw API responses to files
- Detailed console output for troubleshooting
- Search query variation testing

---

### **2.1.9: Testing Strategy**

#### **Unit Tests to Create**
1. **Query Building**: Test different company name formats
2. **Filtering**: Test exclusion lists work correctly
3. **Error Handling**: Mock API failures
4. **Rate Limiting**: Verify delays are applied

#### **Integration Tests**
1. **Live API Test**: Test with real API key (limited calls)
2. **End-to-End**: Test full search flow with sample companies

#### **Test Data Sets**
- Companies with common names
- Companies with special characters in names
- Companies with no web presence
- Companies with multiple websites

---

## **Implementation Checklist for Junior Developer**

### **Phase A: Setup & Configuration**
- [ ] Install `@googleapis/customsearch` package
- [ ] Create TypeScript interfaces in separate file
- [ ] Set up configuration structure in `config.ts`
- [ ] Create static exclusion arrays
- [ ] Set up environment variables

### **Phase B: Core Functions**
- [ ] Implement `buildSearchQuery()` with all variations
- [ ] Create `executeGoogleSearch()` API wrapper
- [ ] Build `filterSearchResults()` with exclusion logic
- [ ] Implement `selectBestMatch()` placeholder
- [ ] Create main `searchCompanyWebsite()` function

### **Phase C: Error Handling**
- [ ] Add retry logic with exponential backoff
- [ ] Implement rate limiting delays
- [ ] Create comprehensive error handling
- [ ] Add logging for debugging

### **Phase D: Testing**
- [ ] Create unit tests for each function
- [ ] Test with sample company data
- [ ] Verify API integration works
- [ ] Test error scenarios

### **Phase E: Integration**
- [ ] Export functions for use in main application
- [ ] Document API usage and configuration
- [ ] Create usage examples

---

## **Estimated Implementation Time**
- **Junior Developer**: 3-4 days
- **Testing & Refinement**: 1-2 days
- **Total**: 4-6 days

## **Dependencies on Other Modules**
- Requires configuration setup from Phase 1
- Will be consumed by Phase 5 (URL Validation)
- Integrates with the dummy "best match" function that will later use AI