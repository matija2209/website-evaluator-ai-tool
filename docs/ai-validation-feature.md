# AI-Powered Website Validation Feature

## Overview

The Website Evaluator AI now includes **AI-powered website validation** using Google's Gemini 2.0 Flash model. Instead of simply taking the first search result, the system now intelligently analyzes all Google search results and selects the most appropriate official company website.

## Key Features

### 🤖 **AI-Powered Selection**
- **Gemini 2.0 Flash Integration**: Uses Google's latest AI model for intelligent decision making
- **Structured Analysis**: AI evaluates each search result against specific criteria
- **Confidence Scoring**: Provides 0-100% confidence rating for each selection
- **Reasoning Explanation**: AI explains why it selected a particular result

### 📊 **Enhanced SERP Analysis**
- **Position Tracking**: Records which SERP position was selected (1-10)
- **Multiple Candidate Detection**: Identifies when multiple valid options exist
- **Quality Filtering**: Avoids news sites, directories, job boards, and social media

### 💰 **Cost Management**
- **Token Tracking**: Monitors AI API usage and costs
- **Rate Limiting**: 2 requests per second (500ms delay) to manage costs
- **Efficient Prompting**: Optimized prompts to minimize token usage

## How It Works

### 1. **Google Search Phase**
```
🔍 Google Search: "Company Name" City Slovenia → 10 results
```

### 2. **AI Validation Phase**
```
🤖 AI Validation: Analyzing 10 search results for "Company Name"
```

The AI receives:
- Company name, location, and business activity
- All 10 search results with titles, URLs, and descriptions
- Clear validation criteria (prefer official sites, avoid directories)

### 3. **Selection & Logging**
```
🤖 AI Validation: Company → Result #3 (confidence: 85%) [TOKENS: 150]
✅ Selected: https://company.si (SERP position: 4/10)
💡 Reasoning: Official company domain with matching business description
```

## Configuration

### Environment Variables

Add to your `.env` file:
```bash
# Existing variables
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY
GOOGLE_CLOUD_API_KEY=your_custom_search_engine_id

# New: Required for AI validation
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY
```

### AI Configuration

Located in `config.ts`:
```typescript
gemini: {
  apiKey: process.env.GOOGLE_CLOUD_API_KEY || '',
  model: 'gemini-2.5-flash-lite-preview-06-17',
  rateLimitDelay: 500, // 2 requests per second
  maxRetries: 2,
  temperature: 0.1, // Low temperature for consistent results
}
```

## Usage

### Running Tests

Test the AI validation system:
```bash
pnpm run test:ai
```

### Full Pipeline

The AI validation automatically integrates with existing workflows:
```bash
pnpm run start:csv
```

## Output Data

### Enhanced Progress Tracking

The CSV progress file now includes AI validation columns:

| Column | Description |
|--------|-------------|
| `SERP_Position` | Which search result position was selected (1-10) |
| `AI_Confidence` | AI confidence score (0.0-1.0) |
| `AI_Reasoning` | AI explanation for the selection |
| `Tokens_Used` | Number of tokens consumed for this validation |
| `Multiple_Valid_Found` | Whether AI found multiple good candidates |

### Example Output
```csv
Company_Name,Discovered_Website,SERP_Position,AI_Confidence,AI_Reasoning,Tokens_Used
"Petrol d.d.",https://petrol.si,1,0.95,"Official company domain with clear business description",142
"ABC Company",https://abc-si.com,3,0.82,"Company domain matches name, third result selected over directories",156
```

## AI Validation Criteria

### ✅ **Preferred Results**
- Official company domains (company name in URL)
- Business descriptions matching company activity
- Corporate websites with company information
- Professional business websites

### ❌ **Avoided Results**
- News articles about the company
- Business directories (Yellow Pages, etc.)
- Job boards and recruitment sites
- Social media profiles (LinkedIn, Facebook, etc.)
- Review sites (Google Reviews, Yelp, etc.)
- Competitor websites
- Generic industry portals

## Error Handling

### Fallback Strategy
If AI validation fails:
1. **Logs the error** with token count (if partial failure)
2. **Falls back** to original simple logic
3. **Continues processing** without interruption
4. **Marks results** with low confidence score

### Common Scenarios
- **No suitable results**: AI returns `null`, logs reasoning
- **Multiple valid options**: AI selects best, notes multiple found
- **API timeout/error**: Falls back to simple matching logic

## Performance & Costs

### Token Usage
- **Typical usage**: 100-200 tokens per company
- **Cost estimate**: ~$0.007-0.015 per company (based on Gemini pricing)
- **Rate limiting**: Maximum 2 requests per second

### Processing Time
- **Added latency**: ~500-1000ms per company (mostly rate limiting)
- **Batch processing**: Automatically handles rate limits
- **Progress saving**: Every 10 companies processed

## Monitoring

### Console Output
```
🏢 Processing: Company Name (Clean Name)
🔍 Google Search: "Company Name" City Slovenia → 8 results
🤖 AI Validation: Analyzing 8 search results for "Company Name"
🪙 Tokens used: 145
🤖 AI Validation: Company Name → Result #2 (confidence: 88%) [TOKENS: 145]
✅ Selected: https://company.si (SERP position: 3/8)
💡 Reasoning: Official domain with matching business activity description
```

### Progress Tracking
```
📈 Progress: 25/100 (25%)
✅ Success! Found: https://company.si
💾 Progress saved (25/100 processed)
```

## Troubleshooting

### Missing API Key
```
❌ Missing required environment variables:
   - GOOGLE_CLOUD_API_KEY: ✓
   - GOOGLE_CLOUD_API_KEY: ✓  
   - GOOGLE_CLOUD_API_KEY: ❌
```

### Rate Limiting
```
⏱️  Rate limiting: waiting 500ms
```

### AI Validation Failure
```
❌ AI validation failed, falling back to simple logic: API timeout
```

## Technical Architecture

### New Components
- `src/aiValidationService.ts` - Core AI validation logic
- Enhanced types in `src/types.ts`
- Updated `src/googleSearch.ts` with AI integration
- Enhanced logging in `src/websiteDiscovery.ts`

### Integration Points
1. **GoogleSearchService** calls AI validation after getting search results
2. **AIValidationService** analyzes results and returns selection + metadata
3. **WebsiteDiscoveryService** logs results and saves progress with AI data
4. **CsvProcessor** exports enhanced data with AI validation columns

## Future Enhancements

### Planned Features
- **Custom validation rules** per industry type
- **Batch AI processing** for better rate limit utilization  
- **Confidence threshold settings** for quality control
- **A/B testing framework** to compare AI vs simple selection

### Optimization Opportunities
- **Prompt engineering** to reduce token usage
- **Result caching** for common company patterns
- **Parallel processing** within rate limits 