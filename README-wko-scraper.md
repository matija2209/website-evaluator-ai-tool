# WKO Firmen A-Z Profile Scraper CLI

This CLI tool is a Playwright-based scraper for company profile pages on `https://firmen.wko.at/`. It follows the same single-URL-or-batch pattern as the existing `bizi` scraper, but the schema is tuned to the sectioned WKO profile layout.

## What It Extracts

- Core contact block from `#company-info`
- Optional about/notice content from `#ueber-uns`
- Product text from `#produkte`
- Firm master data from `#firmendaten`
- Trade permissions from `#berechtigungen`
- Awards/certifications from `#auszeichnungen`
- Additional locations from `#standorte`
- Disclosure data from `#offenlegung`
- Page classification for active profiles, inactive/help pages, and explicit access-denied responses

Variable sections are stored as JSON strings in CSV columns so we do not lose detail when the profile shape changes.

## Live Selector Notes

These selectors were collected from live WKO profile pages on April 29, 2026 via Playwright DOM inspection. A Chrome DevTools MCP inspector was requested, but no such MCP tool was available in this session, so the selectors here are based on live rendered DOM analysis.

### Core profile

- Company wrapper: `section#company-info.company-info`
- Company name: `#company-info h1[itemprop="name"]`
- Category pills: `#company-info .category-pill`
- Phone: `#company-info [itemprop="telephone"]`
- Email: `#company-info [itemprop="email"]`
- Website: `#company-info [itemprop="url"]` or `#company-info a[data-gtm-event="kontaktinfo-web-click"]`
- Street: `#company-info [itemprop="streetAddress"]`
- Postal code: `#company-info [itemprop="postalCode"]`
- Locality: `#company-info [itemprop="addressLocality"]`
- Route link: `#company-info a[href*="maps.google.com"]`

### Optional sections observed

- About/notice: `section#ueber-uns.about-us`
- Products: `section#produkte.products`
- Firm data: `section#firmendaten.company-data`
- Permissions: `section#berechtigungen.permissions`
- Awards: `section#auszeichnungen.award`
- Locations: `section#standorte.company-locations`
- Disclosure: `section#offenlegung.obligations`

### Structured sub-selectors

- Firm data rows: `#firmendaten .company-data-list-item`
- Firm data labels/values: `dt` + `dd`
- Permission cards: `#berechtigungen .card`
- Permission summary lines: `.card-body-container p`
- Permission hidden detail pairs: `.card [hidden] dt` + `.card [hidden] dd`
- Award cards: `#auszeichnungen .card`
- Location groups: `#standorte .accordion-item`
- Location links: `#standorte .accordion-body a`
- Disclosure accordion: `#offenlegung .accordion-item`
- Disclosure detail pairs: `#offenlegung .accordion-body dt` + `dd`

### Cookie banner selectors

- Single-content consent: `button.set-single-cookie`
- All-cookies consent: `button.set-cookie-all`

## Page Variants Observed

- Active profile: has `#company-info` and usually `h1.detail-heading`
- Inactive profile: title includes `Fehler - Keine aktive Gewerbeberechtigung`
- Help page: title starts with `WKO Firmen A-Z & Lehrbetriebsübersicht`
- Access denied page: body or heading contains `Access Denied` plus the WKO/Netscaler signature metadata

The scraper records this in the `pageState` column:

- `active_profile`
- `inactive_profile`
- `help_page`
- `access_denied`
- `unknown`

## Usage

```bash
pnpm scrape:wko -- --url "https://firmen.wko.at/brix-zaun-tor-gmbh/burgenland/?firmaid=67b2745d-c586-4503-a33d-54bb166f6bde"
```

```bash
pnpm scrape:wko -- --input path/to/input.csv
```

```bash
pnpm scrape:wko -- --input path/to/input.csv --proxies "http://192.168.64.108:8080,http://192.168.64.105:8080"
```

```bash
pnpm scrape:wko -- --input path/to/input.csv --proxies "http://95.217.200.105:3128|proxy_user|proxy_pass,http://23.88.102.236:3128|proxy_user2|proxy_pass2"
```

## Options

- `--input <path>`: CSV file containing WKO profile URLs
- `--output <path>`: Output CSV path. Defaults to `output/wko-profile-scrape-[timestamp].csv`
- `--url <url>`: Scrape one WKO profile URL
- `--concurrency <n>`: Parallel pages, default `3`
- `--batchSize <n>`: Batch size before writing and quality-checking, default `50`
- `--limit <n>`: Limit number of input rows
- `--proxies <list>`: Comma-separated proxies. Supported formats:
  - `http://host:port`
  - `http://user:pass@host:port`
  - `http://host:port|user|pass` (recommended for auth proxies)
- `--headful`: Launch visible Chrome for debugging

You can also define proxies via `.env`:

```env
SCRAPER_PROXIES="http://192.168.64.108:8080,http://192.168.64.105:8080"
SCRAPER_PROXIES_AUTH="http://95.217.200.105:3128|proxy_user|proxy_pass,http://23.88.102.236:3128|proxy_user2|proxy_pass2"
```

## Retry Behavior

- The scraper retries only `access_denied` responses.
- Before scraping, configured proxies are preflight-tested and only healthy proxies are kept.
- Retry order is conservative: one pass through `[local machine, ...healthy proxies]`.
- Each retry uses a fresh browser context.
- Rows that still end in `access_denied` are written as `FAILED`, not `SUCCESS`, so they remain eligible for reruns.

## Output Highlights

Common flat columns:

- `companyName`
- `phone`
- `email`
- `website`
- `streetAddress`
- `postalCode`
- `locality`
- `fullAddress`
- `routeUrl`
- `registeredFirmName`
- `registryNumber`
- `court`
- `gln`
- `uidNumber`

JSON columns for variable sections:

- `categoryPillsJson`
- `sectionHeadingsJson`
- `otherSectionsJson`
- `firmDataJson`
- `permissionsJson`
- `awardsJson`
- `locationsJson`
- `disclosureJson`

Tracking columns:

- `failureCategory`: currently `ACCESS_DENIED` when the retry pool is exhausted on a blocked page
- `attemptCount`: how many tries were used for that row
- `proxyUsed`: the proxy used on the final attempt, or empty when the final attempt used the local machine

## Example

```bash
pnpm scrape:wko -- --input input.csv --output output/wko-results.csv --concurrency 4
```
