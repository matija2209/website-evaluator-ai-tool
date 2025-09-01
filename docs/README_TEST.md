# Testing Phase 2: Website Discovery

## Prerequisites

Before running the test, you need to set up API credentials:

### 1. Create `.env` file

Create a `.env` file in the project root with these variables:

```bash
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY_here
GOOGLE_CLOUD_API_KEY=your_custom_search_engine_id_here
GOOGLE_CLOUD_API_KEY=your_GOOGLE_CLOUD_API_KEY_here
```

### 2. Get Google Custom Search API Keys

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the "Custom Search API"
4. Create API credentials (API key)
5. Create a Custom Search Engine at [CSE Control Panel](https://cse.google.com/)
6. Get the CSE ID from your custom search engine

### 3. Get Gemini API Key (optional for Phase 2 test)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Generate an API key for Gemini
3. Add it to your `.env` file

## Running the Test

Once you have the API keys configured:

```bash
# Run the Phase 2 test
npx ts-node test-phase2.ts
```

## Test Data

The test will process these 3 companies:
1. **BIOTEH d.o.o.** (Radomlje) - Proizvodnja pesticidov
2. **VARESI d.o.o.** (Ljubljana) - Trgovina na debelo z obdelovalnimi stroji  
3. **AKA PCB d.o.o.** (Lesce) - Proizvodnja elektronskih komponent

## Expected Results

Phase 2 should discover actual company websites by:
1. Searching Google for each company using multiple query variations
2. Filtering out excluded domains (directories, social media, etc.)
3. Selecting the best matching website
4. Creating a timestamped run directory with progress files

The test will output:
- Run ID and directory
- Success/failure statistics
- Discovered websites for each company
- Any errors encountered

## Troubleshooting

- **API quota exceeded**: Google Custom Search has daily limits
- **API key invalid**: Check your credentials in `.env`
- **No results found**: Companies might not have websites or search variations need adjustment 