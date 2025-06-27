## ✅ **Website Sophistication Analyzer

### **Phase 1: Project Setup & Data Preparation**

#### **Step 1.1: Environment Setup**

* Initialize with:

  ```bash
  pnpm init
  pnpm add puppeteer csv-parser csv-writer axios cheerio fs-extra dayjs
  pnpm add -D typescript ts-node @types/node @types/csv-parser @types/puppeteer
  npx tsc --init
  ```
* Suggested folder structure:

  ```
  /project-root
    /runs
      /[RUN_ID]/
        /screenshots
          /{domain}/
            /desktop
              section-1.jpeg
              section-2.jpeg
            /mobile
              section-1.jpeg
              section-2.jpeg
        input.csv
        website-discovery-progress.csv
        screenshot-progress.csv
        output.csv
    /src
      main.ts
      types.ts
      csvProcessor.ts
      runManager.ts
      websiteDiscovery.ts
      screenshotCapture.ts
      analyzeWebsite.ts
      utils.ts
    config.ts
    .env
    tsconfig.json
  ```

#### **Step 1.2: Data Preparation**

* **Input file headers (ACTUAL CSV format):**

  ```
  Filter Group,Title,URL,Street Address,City,Business ID,Tax Number,Activity Description,Employee Count,Page
  ```

* **CRITICAL**: Input URLs are directory listings (bizi.si, zlatestrani.si, etc.) - NOT actual company websites
* **Processing approach**: Clean `Title` (remove d.o.o., trim), normalize city names
* **RUN_ID format**: Timestamp-based `YYYYMMDD_HHMMSS` (e.g., `20241201_143022`)

---

### **🔥 Phase 2: Website Discovery Module - THE CORE PHASE**

**This is the most critical phase** - transforms directory listings into actual company websites.

**Input**: Companies with with this data (Filter Group,Title,URL,Street Address,City,Business ID,Tax Number,Activity Description,Employee Count,Page)
**Output**: Companies with discovered websites OR marked as NO_WEBSITE_FOUND
**Processing rule**: If no website found → STOP processing that company

Detailed implementation in @docs/step-2-custom-search.md

**Key components:**
- Google Custom Search API integration
- Multiple search query variations per company
- Domain exclusion filtering (directories, social media)
- Rate limiting and error handling
- "Best match" selection (placeholder for now)

---

### **Phase 3: Screenshot Capture Module**

**Prerequisites**: Must complete Phase 2 (only process companies WITH discovered websites)

Detailed implementation in @docs/step-3-screenshoot.md

**Key features:**
- Sectioned screenshot approach (desktop & mobile)
- Browser pool management for parallel processing
- Progress tracking with CSV-based resume capability
- Domain-based folder structure: `/screenshots/{domain}/desktop|mobile/section-{N}.jpeg`

---

### **Phase 4: AI Analysis Module (`analyzeWebsite.ts`)**

**Prerequisites**: Must complete Phase 3 (only analyze companies WITH screenshots)

Detailed implementation in @docs/step-4-gemini.md

**Key features:**
- Dual analysis: Mobile-first (70%) + Desktop (30%)
- Gemini 2.5 Flash integration with token tracking
- Sophisticated scoring across 4 criteria
- Context-aware recommendations based on company activity

---

### **🚨 CRITICAL: Sequential Development Approach**

**MUST develop phases sequentially - perfect each phase individually before moving to next:**

1. **Phase 1**: Foundation (Days 1-2)
2. **Phase 2**: Website Discovery (Days 3-5) ← CORE PHASE
3. **Phase 3**: Screenshot Capture (Days 6-8)
4. **Phase 4**: AI Analysis (Days 9-11)
5. **Phase 5**: Integration & Testing (Days 12-15)

**No parallel development** - each phase depends completely on the previous phase working correctly.

---

### **Phase 5: Error Handling & Processing Flow**

#### **Step 5.1: Processing Pipeline**

```
Input CSV (717 companies with bizi.si URLs)
    ↓
Phase 2: Website Discovery
    ↓
Filter: Keep only companies WITH websites
    ↓
Phase 3: Screenshot Capture  
    ↓
Filter: Keep only companies WITH screenshots
    ↓
Phase 4: AI Analysis
    ↓
Final Output CSV
```

#### **Step 5.2: Error Categories & Handling**

* **Phase 2 - No website found**: Mark as `NO_WEBSITE_FOUND`, exclude from further processing
* **Phase 3 - Screenshot failed**: Mark as `SCREENSHOT_FAILED`, exclude from Phase 4
* **Phase 4 - Analysis failed**: Mark as `ANALYSIS_FAILED`, include in output with error status
* **Resume capability**: Each phase tracks progress, can resume from last successful point

---

### **Phase 6: Data Output**

#### **Step 6.1: Output CSV Structure**

* Save as: `runs/[RUN_ID]/output.csv`
* Columns:

  ```
  Timestamp,Company_Name,Original_URL,Actual_Website,Search_Status,Desktop_Score,Mobile_Score,Combined_Score,Sophistication_Level,Opportunity_Level,Mobile_Issues,Desktop_Issues,Primary_Recommendations,Desktop_Screenshot_Path,Mobile_Screenshot_Path,Analysis_Date,Tokens_Used
  ```
* Include `Timestamp` (ISO string) for each row
* Include relative paths to screenshot folders

#### **Step 6.2: Batch Processing Strategy**

* **Sequential processing**: One company through all phases before next
* **Batch size**: 15 companies for Phase 3/4 (rate limiting)
* **Delay between calls**: 2000ms for AI analysis
* **Retry logic**: Up to 3 times per phase
* **Progress tracking**: CSV-based progress files for each phase
* **Resume support**: Detect partial runs and continue from last completed company

---

### **Phase 7: Configuration & Environment**

#### **`.env` Configuration**

```env
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_CSE_ID=your_custom_search_engine_id_here
GEMINI_API_KEY=your_gemini_api_key_here
```

#### **`config.ts`**

```ts
export const config = {
  google: {
    apiKey: process.env.GOOGLE_API_KEY!,
    customSearchEngineId: process.env.GOOGLE_CSE_ID!,
    maxResults: 10,
    rateLimitDelay: 100
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
    model: 'gemini-1.5-flash'
  },
  processing: {
    batchSize: 15,
    delayBetweenRequests: 2000,
    maxRetries: 3
  },
  paths: {
    runsDirectory: './runs',
    screenshotsSubdir: 'screenshots'
  }
}
```

#### **CLI Tool (`main.ts`)**

* Accepts input CSV path: `npm run start /path/to/companies.csv`
* Generates timestamp-based `RUN_ID`
* Progress logging:
  * Phase completion status
  * Company count and success rates
  * Current processing status
  * Estimated time remaining per phase
* Comprehensive error reporting

---

### **Phase 8: Testing Strategy & Quality Assurance**

#### **Phase-by-Phase Testing**

* **Phase 1**: Environment setup, CSV reading, folder creation
* **Phase 2**: Website discovery with 5-10 sample companies, validate exclusion filters
* **Phase 3**: Screenshot capture with discovered websites, verify sectioning logic
* **Phase 4**: AI analysis with captured screenshots, validate scoring consistency
* **Phase 5**: End-to-end pipeline with 10+ companies

#### **Success Criteria per Phase**

* **Phase 2**: 60-80% website discovery success rate from sample data
* **Phase 3**: 90%+ screenshot success rate for reachable websites
* **Phase 4**: Consistent scoring, token usage within budget
* **Phase 5**: Complete pipeline processes full dataset without crashes

---

### **Estimated Timeline & Resources**

* **Sequential Development**: 12-15 days total
  * **Phase 1** (Foundation): 2 days
  * **Phase 2** (Website Discovery): 3 days ← CRITICAL
  * **Phase 3** (Screenshots): 3 days  
  * **Phase 4** (AI Analysis): 3 days
  * **Phase 5** (Integration): 2-3 days
  * **Testing & Refinement**: 1-2 days

* **Full Production Run**: 8-12 hours for 717 companies
  * Assumes 60% website discovery success rate (~430 companies)
  * Rate-limited by Google Custom Search and Gemini APIs

* **API Costs**:
  * **Gemini 1.5 Flash**: ~$50-100 for full dataset
  * **Google Custom Search**: Depends on success rate, potentially $100-200 for 717 searches

---

## ✅ **Implementation Checklist**

### **Ready to Start When:**
- [ ] All API keys obtained and configured
- [ ] Sample CSV data confirmed (with bizi.si URLs)
- [ ] Development environment set up
- [ ] Clear understanding that Phase 2 is the make-or-break phase

### **Phase Completion Gates:**
- [ ] **Phase 1**: Can read CSV, create runs, basic infrastructure works
- [ ] **Phase 2**: Successfully discovers websites for sample companies 
- [ ] **Phase 3**: Captures sectioned screenshots for discovered websites
- [ ] **Phase 4**: Generates AI analysis with proper scoring
- [ ] **Phase 5**: Full pipeline processes 10+ companies end-to-end

### **Production Ready When:**
- [ ] All phases tested individually
- [ ] Error handling validated
- [ ] Resume functionality works
- [ ] Full dataset test run completed successfully

---

**The success of this entire project hinges on Phase 2 (Website Discovery). If we can't reliably find company websites from the directory listings, the rest of the pipeline is irrelevant.**
