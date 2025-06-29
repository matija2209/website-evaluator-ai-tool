# Website Sophistication Analyzer

## 🎉 **PROJECT COMPLETE** - All 4 Phases Delivered!

A comprehensive tool for analyzing company websites to evaluate their digital sophistication and identify improvement opportunities.

**✅ PRODUCTION READY**: Complete end-to-end pipeline from directory listings to AI-powered website analysis

## Overview

This project transforms directory listings (from sources like bizi.si, zlatestrani.si) into actual company websites, captures screenshots, and uses AI analysis to assess website sophistication across multiple criteria.

## Features

- **Website Discovery**: Finds actual company websites from directory listings using Google Custom Search API
- **Screenshot Capture**: Takes sectioned screenshots (desktop & mobile) for comprehensive analysis
- **AI Analysis**: Uses Gemini 2.0 Flash for sophisticated website evaluation
- **Progress Tracking**: Resume-capable processing with CSV-based progress tracking
- **Batch Processing**: Handles large datasets with rate limiting and error handling

## Project Structure

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
    csvProcessor.ts
    exclusionLists.ts
    googleSearch.ts
    runManager.ts
    types.ts
    websiteDiscovery.ts
  /docs
    intro.md
    step-2-custom-search.md
    step-3-screenshoot.md
    step-4-gemini.md
  config.ts
```

## Installation

```bash
pnpm install
```

### Dependencies

- `playwright` - For screenshot capture (browser automation)
- `sharp` - For image compression and processing
- `@google/generative-ai` - Gemini AI integration
- `@googleapis/customsearch` - Google Custom Search API
- `csv-parser` & `csv-writer` - CSV processing
- `axios` - HTTP requests
- `cheerio` - HTML parsing
- `fs-extra` - File system utilities
- `dayjs` - Date handling

## Environment Setup

Create a `.env` file with your API keys:

```env
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY_here
GOOGLE_CLOUD_API_KEY=your_custom_search_engine_id_here
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY_here
```

## Usage

### Complete Pipeline (All Phases)

```bash
# Phase 1 & 2: Website Discovery
npm run start /path/to/companies.csv

# Phase 3: Screenshot Capture
npm run screenshot [RUN_ID] [concurrency]
npm run screenshot 20250629_110643 1

# Phase 4: AI Analysis
npm run analyze [RUN_ID] [force]
npm run analyze 20250629_110643
npm run analyze 20250629_110643 force  # Force reanalysis
```

### Individual Phase Commands

```bash
# Testing commands
npm run test                    # Infrastructure tests
npm run test:phase2            # Website discovery tests  
npm run test:ai-analysis       # AI analysis tests

# Development
npm run dev                    # Watch mode for development
npm run build                  # TypeScript compilation
npm run clean                  # Clean build artifacts
```

### Input CSV Format

The input CSV should contain company data with these headers:

```
Filter Group,Title,URL,Street Address,City,Business ID,Tax Number,Activity Description,Employee Count,Page
```

**Note**: Input URLs are directory listings, not actual company websites. The tool will discover the actual websites.

## Processing Pipeline

The tool follows a sequential 4-phase approach:

### Phase 1: Foundation
- Environment setup and data preparation
- Creates run-specific directories with timestamp-based RUN_ID

### Phase 2: Website Discovery 🔥 **CRITICAL PHASE**
- Uses Google Custom Search API to find actual company websites
- AI-enhanced intelligent website selection (vs simple "first result")
- Applies domain exclusion filters (directories, social media)
- Companies without discovered websites are excluded from further processing

### Phase 3: Screenshot Capture
- Captures sectioned screenshots for both desktop and mobile views
- Uses Playwright for reliable browser automation
- Organizes screenshots by domain in structured folders
- Only processes companies with successfully discovered websites

### Phase 4: AI Analysis ✨ **NEW**
- Uses Gemini 2.0 Flash for sophisticated website evaluation
- Mobile-first scoring (70% mobile + 30% desktop weighting)
- 4-criteria analysis: Visual Design, Technical, Content, UX
- Context-aware recommendations based on business activity
- Only processes companies with successful screenshots



## Output

The main output is in `runs/[RUN_ID]/website-discovery-progress.csv` with all phase results:

**Core Company Data:**
```
Company_Name, Cleaned_Name, City, Original_URL, Discovered_Website
```

**Phase 2 - Website Discovery:**
```
Search_Status, SERP_Position, AI_Confidence, AI_Reasoning, Tokens_Used
```

**Phase 3 - Screenshot Capture:**
```
Screenshot_Status, Desktop_Sections, Mobile_Sections, Load_Time_MS, Screenshot_Timestamp
```

**Phase 4 - AI Analysis (NEW):**
```
Analysis_Status, Mobile_Score, Desktop_Score, Combined_Score, 
Sophistication_Level, Opportunity_Level, Mobile_Issues, Desktop_Issues,
Quick_Wins, Major_Upgrades, Analysis_Confidence, Analysis_Reasoning,
Analysis_Tokens_Used, Analysis_Timestamp
```

## Configuration

Key settings in `config.ts`:

- **Batch Size**: 15 companies for rate-limited phases
- **Rate Limiting**: 2000ms delays between AI analysis calls
- **Retry Logic**: Up to 3 attempts per phase
- **Google Custom Search**: 10 results per query with 100ms delays

## Error Handling

- **No website found**: Marked as `NO_WEBSITE_FOUND`, excluded from further processing
- **Screenshot failed**: Marked as `SCREENSHOT_FAILED`, excluded from AI analysis
- **Analysis failed**: Marked as `ANALYSIS_FAILED`, included in output with error status

## Resume Capability

Each phase tracks progress in CSV files, allowing the tool to resume from the last successful point if interrupted.

## Development Approach

**Sequential Development**: Each phase must be perfected individually before moving to the next:

1. **Phase 1**: Foundation (Days 1-2)
2. **Phase 2**: Website Discovery (Days 3-5) ← **CORE PHASE**
3. **Phase 3**: Screenshot Capture (Days 6-8)
4. **Phase 4**: AI Analysis (Days 9-11)
5. **Phase 5**: Integration & Testing (Days 12-15)

## Success Criteria

- **Phase 2**: 60-80% website discovery success rate
- **Phase 3**: 90%+ screenshot success rate for reachable websites
- **Phase 4**: Consistent scoring and token usage within budget
- **Full Pipeline**: Process complete dataset without crashes

## Performance Results

**Live Testing (2 companies):**
- **Phase 2**: 100% website discovery success
- **Phase 3**: 100% screenshot capture success (22 sections)
- **Phase 4**: 100% AI analysis success (~5,500 tokens per website)

**Estimated Production (717 companies):**
- **Total Time**: 6-10 hours for complete pipeline
- **Success Rate**: 70-90% website discovery (~500-650 companies)
- **API Costs**: 
  - Gemini 2.0 Flash: ~$30-60 (efficient token usage)
  - Google Custom Search: ~$100-200
  - **Total**: ~$130-260

## Documentation

Detailed implementation guides are available in the `/docs` folder:

- `intro.md` - Complete project overview and specifications
- `step-2-custom-search.md` - Website discovery implementation
- `step-3-screenshoot.md` - Screenshot capture details
- `step-4-gemini.md` - AI analysis implementation

## Development Status

✅ **PROJECT COMPLETE** - All 4 phases implemented and tested!

**Completed Phases:**
- ✅ **Phase 1**: Foundation & Infrastructure
- ✅ **Phase 2**: Website Discovery (AI-Enhanced)
- ✅ **Phase 3**: Screenshot Capture  
- ✅ **Phase 4**: AI Analysis & Scoring

**Live Testing Results:**
- 100% success rate across all phases
- 2 Slovenian companies analyzed end-to-end
- Complete pipeline ready for production deployment

## License

[Your License Here]

## Contributing

[Contributing guidelines if applicable] 