# Bizi.si Profile Scraper CLI

This CLI tool is a Playwright-based web scraper designed to automate the extraction of visible business data from individual Bizi.si company profile pages. It operates either on a single URL or on a batch of URLs provided via a CSV file.

## Features

- **Single URL or Batch Processing**: Pass a single profile URL, or a CSV containing multiple URLs.
- **Robust Field Extraction**: Pulls comprehensive company data including:
  - Company Name & Contact Info (Address, Phone, Email, Website)
  - Tax and Registration Details (Tax Number, Matična, SKIS, Dates)
  - TRR (Bank Account) Summaries (Open, Closed, Blocked accounts, Foreign accounts)
- **Automatic Output Directory**: Saves results in an `output/` directory by default.
- **CSV Output Mapping**: When using a CSV input, all original columns are preserved and the newly extracted data is appended as new columns.
- **Concurrency Support**: Run multiple Playwright pages in parallel to speed up batch processing.
- **Error Resiliency**: Gracefully handles page loading issues or extraction failures without stopping the entire batch run.

## Prerequisites

- Node.js (v18+)
- Playwright Chromium browsers installed. If you haven't installed them yet, run:
  ```bash
  npx playwright install chromium
  ```

## Usage

You can run the scraper via `npm` or `pnpm` using the `scrape:bizi-profiles` script.

### 1. Scrape a Single URL

To quickly extract data from one specific Bizi profile:

```bash
npm run scrape:bizi-profiles -- --url https://www.bizi.si/BIOTEH-D-O-O/
```

### 2. Batch Processing from a CSV

To process an entire list of profiles:

```bash
npm run scrape:bizi-profiles -- --input path/to/input.csv
```
*Note: The CLI will automatically scan the CSV for a column named `url`, `URL`, `profileUrl`, or similar to identify the source URLs.*

### Options & Flags

- `--input <path>`: Path to the input CSV file containing BIZI profile URLs.
- `--output <path>`: (Optional) Path for the generated output CSV. Defaults to `output/bizi-profile-scrape-[timestamp].csv`.
- `--url <url>`: Scrape a single BIZI profile URL instead of reading from a CSV.
- `--concurrency <n>`: Set the number of parallel pages/browsers to run. Default is `3`.
- `--limit <n>`: Limit the number of CSV rows to process (useful for testing on large datasets).
- `--headful`: Launch a visible Chrome browser window instead of running headlessly (useful for debugging).

**Examples:**

Run a batch scrape with 5 parallel processes and output to a specific file:
```bash
npm run scrape:bizi-profiles -- --input list.csv --output results.csv --concurrency 5
```

Test a large CSV by only processing the first 10 rows visibly:
```bash
npm run scrape:bizi-profiles -- --input massive-list.csv --limit 10 --headful
```

## Output Format

The output is a CSV file. If you provided an input CSV, the output will contain:
1. **All Original Columns** from your input file.
2. **Scraped Columns**: `companyName`, `address`, `phone`, `website`, `email`, `taxNumber`, `registrationNumber`, `vatLiable`, `skis`, `registrationDate`, `tsmediaActivity`, `openAccounts`, `openAccountsDetail`, `foreignAccounts`, `closedAccounts`, `blockedAccounts`.
3. **Status Columns**: 
   - `status`: `SUCCESS` or `FAILED`.
   - `error`: Contains error messages if the scrape failed.
   - `scrapedAt`: ISO timestamp of when the row was processed.
