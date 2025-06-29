# Website Sophistication Analyzer

## 🎉 **PROJECT COMPLETE** - All 4 Phases Delivered!

A comprehensive tool for analyzing company websites to evaluate their digital sophistication and identify improvement opportunities.

**✅ PRODUCTION READY**: Complete end-to-end pipeline from directory listings to AI-powered website analysis

## Overview

This project transforms directory listings (from sources like bizi.si, zlatestrani.si) into actual company websites, captures screenshots, and uses AI analysis to assess website sophistication across multiple criteria.

## Features

- **Website Discovery**: Finds actual company websites from directory listings using Google Custom Search API
- **Screenshot Capture**: Takes sectioned screenshots (desktop & mobile) for comprehensive analysis
- **AI Analysis**: Uses Gemini 2.5 Flash for sophisticated website evaluation
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

- `puppeteer` - For screenshot capture
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

```bash
npm run start /path/to/companies.csv
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
- Applies domain exclusion filters (directories, social media)
- Companies without discovered websites are excluded from further processing

### Phase 3: Screenshot Capture
- Captures sectioned screenshots for both desktop and mobile views
- Organizes screenshots by domain in structured folders
- Only processes companies with successfully discovered websites

### Phase 4: AI Analysis
- Uses Gemini 2.5 Flash for sophisticated website evaluation
- Analyzes mobile (70%) and desktop (30%) screenshots
- Generates scores across 4 criteria with recommendations
- Only processes companies with successful screenshots

## Output

Results are saved as `runs/[RUN_ID]/output.csv` with columns:

```
Timestamp,Company_Name,Original_URL,Actual_Website,Search_Status,Desktop_Score,Mobile_Score,Combined_Score,Sophistication_Level,Opportunity_Level,Mobile_Issues,Desktop_Issues,Primary_Recommendations,Desktop_Screenshot_Path,Mobile_Screenshot_Path,Analysis_Date,Tokens_Used
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

## Estimated Performance

- **Production Run**: 8-12 hours for 717 companies
- **Success Rate**: ~60% website discovery (~430 companies)
- **API Costs**: 
  - Gemini 1.5 Flash: ~$50-100
  - Google Custom Search: ~$100-200

## Documentation

Detailed implementation guides are available in the `/docs` folder:

- `intro.md` - Complete project overview and specifications
- `step-2-custom-search.md` - Website discovery implementation
- `step-3-screenshoot.md` - Screenshot capture details
- `step-4-gemini.md` - AI analysis implementation

## Development Status

Currently in Phase 1 development. The project follows a strict sequential development approach where each phase must be completed and tested before proceeding to the next.

## License

[Your License Here]

## Contributing

[Contributing guidelines if applicable] 