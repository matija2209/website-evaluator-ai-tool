# Bizi.si Profile Scraper CLI

This CLI tool is a Playwright-based web scraper designed to automate the extraction of visible business data from individual Bizi.si company profile pages. It operates either on a single URL or on a batch of URLs provided via a CSV file.

## Features

- **Single URL or Batch Processing**: Pass a single profile URL, or a CSV containing multiple URLs.
- **Robust Field Extraction**: Pulls comprehensive company data including:
  - Company Name & Contact Info (Address, Phone, Email, Website)
  - Tax and Registration Details (Tax Number, Matična, SKIS, Dates)
  - TRR (Bank Account) Summaries (Open, Closed, Blocked accounts, Foreign accounts)
- **Automatic Output Directory**: Saves results in an `output/` directory by default. For CSV input, results are placed in a nested folder named after the input file (for example, `input/BIZI—Trgovina - ecommerce.csv` -> `output/bizi-trgovina-ecommerce/`).
- **CSV Output Mapping**: When using a CSV input, all original columns are preserved and the newly extracted data is appended as new columns.
- **Concurrency & Stealth**: Run multiple Playwright pages in parallel. The script uses random delays (2-5s) between requests and rotates your defined proxies (including authenticated proxies) to avoid rate limiting.
- **Batch Processing & Quality Control**: Automatically saves results incrementally in chunks (`--batchSize`). Validates data quality after every batch, pausing immediately if scraping degradation or blocking is detected.
- **Idempotency (Resume Scrapes)**: If the scraper is paused, simply run it again pointing to the same `--output` file. It will automatically detect and skip URLs that have already been scraped successfully.
- **Error Resiliency**: Gracefully handles page loading issues or extraction failures without stopping the entire run, unless failure rates exceed the quality threshold.

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
npm run scrape:bizi -- --url https://www.bizi.si/BIOTEH-D-O-O/
```

### 2. Batch Processing from a CSV

To process an entire list of profiles:

```bash
npm run scrape:bizi -- --input path/to/input.csv
```
*Note: The CLI will automatically scan the CSV for a column named `url`, `URL`, `profileUrl`, or similar to identify the source URLs.*

### Options & Flags

- `--input <path>`: Path to the input CSV file containing BIZI profile URLs.
- `--output <path>`: (Optional) Path for the generated output CSV. By default:
  - with `--input`: `output/<input-file-name>/bizi-profile-scrape-[timestamp].csv`
  - with `--url`: `output/bizi-profile-scrape-[timestamp].csv`
  Pointing this to an existing CSV will automatically skip previously scraped URLs.
- `--url <url>`: Scrape a single BIZI profile URL instead of reading from a CSV.
- `--concurrency <n>`: Set the number of parallel pages/browsers to run. Default is `3`.
- `--batchSize <n>`: Process URLs in batches of `n`. After each batch, data is saved to the CSV and quality is verified. Default is `50`.
- `--limit <n>`: Limit the number of CSV rows to process (useful for testing on large datasets).
- `--headful`: Launch a visible Chrome browser window instead of running headlessly (useful for debugging).
- `--proxies <list>`: Comma-separated list of proxies. Supported formats:
  - `http://host:port`
  - `http://user:pass@host:port`
  - `http://host:port|user|pass` (recommended for auth proxies)
  The scraper rotates between these proxies and your current machine (no proxy). You can set this via `.env` using either `SCRAPER_PROXIES` or `SCRAPER_PROXIES_AUTH`.

**Examples:**

Run a batch scrape with 5 parallel processes and output to a specific file:
```bash
npm run scrape:bizi -- --input list.csv --output results.csv --concurrency 5
```

Run a batch scrape while rotating multiple proxies:
```bash
npm run scrape:bizi-profiles -- --input list.csv --proxies "http://192.168.64.108:8080,http://192.168.64.105:8080"
```

Run a batch scrape with authenticated proxies:
```bash
npm run scrape:bizi -- --input "input/BIZI—Trgovina - ecommerce.csv" --proxies "http://95.217.200.105:3128|proxy_user|proxy_pass,http://23.88.102.236:3128|proxy_user2|proxy_pass2"
```

Test a large CSV by only processing the first 10 rows visibly:
```bash
npm run scrape:bizi-profiles -- --input massive-list.csv --limit 10 --headful
```

### Environment Variables (.env)

You can define your proxies in a `.env` file at the root of the project to avoid passing them via CLI each run:

```env
SCRAPER_PROXIES="http://192.168.64.108:8080,http://192.168.64.105:8080"
SCRAPER_PROXIES_AUTH="http://95.217.200.105:3128|proxy_user|proxy_pass,http://23.88.102.236:3128|proxy_user2|proxy_pass2"
```

### Testing Proxies

A dedicated CLI script is included to test your proxies and verify their public IPs:

```bash
# Tests the proxies defined in your .env file
npm run test-proxies

# Test specific proxies manually
npm run test-proxies -- --proxies "http://192.168.64.108:8080,http://192.168.64.105:8080"

# Test authenticated proxies manually
npm run test-proxies -- --proxies "http://95.217.200.105:3128|proxy_user|proxy_pass,http://23.88.102.236:3128|proxy_user2|proxy_pass2"
```

## Output Format

The output is a CSV file. If you provided an input CSV, the output will contain:
1. **All Original Columns** from your input file.
2. **Scraped Columns**: `companyName`, `address`, `phone`, `website`, `email`, `taxNumber`, `registrationNumber`, `vatLiable`, `skis`, `registrationDate`, `tsmediaActivity`, `openAccounts`, `openAccountsDetail`, `foreignAccounts`, `closedAccounts`, `blockedAccounts`.
3. **Status Columns**: 
   - `status`: `SUCCESS` or `FAILED`.
   - `error`: Contains error messages if the scrape failed.
   - `scrapedAt`: ISO timestamp of when the row was processed.
