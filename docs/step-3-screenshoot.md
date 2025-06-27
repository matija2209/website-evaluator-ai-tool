## **Step 3: Screenshot Capture Module - Detailed Implementation Plan**

### **3.1 Module Structure & Dependencies**

**File: `src/screenshotCapture.ts`**

**Dependencies to add:**
```bash
pnpm add playwright csv-writer csv-parser
pnpm add -D @types/node
```

**Key Components:**
- `ScreenshotManager` class (main orchestrator)
- `BrowserPool` class (browser instance management)
- `ProgressTracker` class (CSV-based progress tracking)
- `ScreenshotProcessor` class (individual URL processing)

### **3.2 Progress Tracking System**

**CSV Structure (`processed_urls.csv`):**
```
URL,Status,Timestamp,Desktop_Screenshots_Count,Mobile_Screenshots_Count,Error_Message,Load_Time_MS,Retry_Count
```

**Status Values:**
- `SUCCESS` - All screenshots captured
- `FAILED` - Failed after retries
- `PROCESSING` - Currently being processed
- `SKIPPED` - Already processed successfully

### **3.3 Screenshot Strategy - Sectioned Approach**

**Desktop Sections (1920x1080 viewport):**
- Capture viewport-sized sections by scrolling
- Each section = 1080px height
- Overlap of 100px between sections to avoid cutting content
- File naming: `{domain}/desktop/section-{index}.jpeg`

**Mobile Sections (375x812 viewport - iPhone X):**
- Same sectioning approach
- Each section = 812px height
- 50px overlap for mobile
- File naming: `{domain}/mobile/section-{index}.jpeg`

### **3.4 Detailed Implementation Steps**

#### **Step 3.4.1: ProgressTracker Class**
```typescript
// Functions needed:
- loadProcessedUrls(): Promise<Map<string, ProcessedUrl>>
- markAsProcessing(url: string): Promise<void>
- markAsSuccess(url: string, metadata: SuccessMetadata): Promise<void>
- markAsFailed(url: string, error: string, retryCount: number): Promise<void>
- isAlreadyProcessed(url: string): boolean
- getFailedUrls(): string[]
```

#### **Step 3.4.2: BrowserPool Class**
```typescript
// Properties:
- browsers: Browser[] (pool of browser instances)
- availableBrowsers: Browser[]
- busyBrowsers: Set<Browser>
- maxConcurrency: number

// Methods:
- initialize(concurrency: number): Promise<void>
- getBrowser(): Promise<Browser>
- releaseBrowser(browser: Browser): void
- restartBrowser(browser: Browser): Promise<Browser>
- cleanup(): Promise<void>
```

#### **Step 3.4.3: ScreenshotProcessor Class**
```typescript
// Main method:
- processUrl(url: string, browser: Browser): Promise<ProcessResult>

// Sub-methods:
- createPage(browser: Browser): Promise<Page>
- navigateToUrl(page: Page, url: string): Promise<void>
- scrollAndCapture(page: Page, viewport: ViewportConfig): Promise<string[]>
- captureSection(page: Page, scrollY: number, sectionIndex: number): Promise<string>
- createFolderStructure(domain: string): Promise<void>
- cleanupPage(page: Page): Promise<void>
```

#### **Step 3.4.4: Scrolling & Capture Logic**

**Scroll Strategy:**
1. Set viewport size
2. Get total page height
3. Calculate number of sections needed
4. For each section:
   - Scroll to position
   - Wait for images/content to load (2-3 seconds)
   - Capture screenshot
   - Move to next section with overlap

**Section Calculation:**
- Desktop: `Math.ceil(totalHeight / 980)` sections (1080 - 100 overlap)
- Mobile: `Math.ceil(totalHeight / 762)` sections (812 - 50 overlap)

### **3.5 Error Handling & Retry Logic**

#### **Step 3.5.1: Error Categories**
- `NAVIGATION_ERROR` - Failed to load page
- `TIMEOUT_ERROR` - Page load timeout
- `SCREENSHOT_ERROR` - Failed to capture screenshot
- `BROWSER_CRASH` - Browser instance died
- `FILESYSTEM_ERROR` - Failed to save files

#### **Step 3.5.2: Retry Logic Flow**
```
1. Attempt URL processing
2. If error occurs:
   - Check retry count < 2
   - If BROWSER_CRASH: restart browser instance
   - Wait 5 seconds before retry
   - Increment retry count
   - Try again
3. If still fails: mark as FAILED in CSV
4. Continue with next URL
```

### **3.6 File Management**

#### **Step 3.6.1: Folder Structure**
```
/screenshots
  /{domain}/
    /desktop/
      section-1.jpeg
      section-2.jpeg
      ...
    /mobile/
      section-1.jpeg
      section-2.jpeg
      ...
```

#### **Step 3.6.2: Domain Processing**
- Extract domain from URL using `new URL(url).hostname`
- Replace invalid filename characters: `/, \, :, *, ?, ", <, >, |`
- Create nested folder structure before processing

### **3.7 Concurrency & Performance**

#### **Step 3.7.1: Parallel Processing**
- Default concurrency: 5 browser instances
- Process URLs in parallel batches
- Each browser handles one URL at a time
- Queue remaining URLs when all browsers busy

#### **Step 3.7.2: Memory Management**
- Close pages immediately after processing
- Restart browser every 50 URLs to prevent memory leaks
- Monitor browser process health

### **3.8 Main Function Implementation**

#### **Step 3.8.1: ScreenshotManager.processUrls()**
```typescript
// Flow:
1. Initialize ProgressTracker
2. Load already processed URLs
3. Filter out successful URLs
4. Initialize BrowserPool
5. Process URLs in parallel batches
6. Handle errors and retries
7. Generate summary report
8. Cleanup resources
```

#### **Step 3.8.2: Configuration Options**
```typescript
interface ScreenshotConfig {
  concurrency: number;           // Default: 5
  screenshotPath: string;        // Default: './screenshots'
  progressFile: string;          // Default: './processed_urls.csv'
  maxRetries: number;            // Default: 2
  pageTimeout: number;           // Default: 30000ms
  scrollDelay: number;           // Default: 2000ms
  jpegQuality: number;           // Default: 85
}
```

### **3.9 Implementation Order for Junior Developer**

**Day 1:**
1. Set up basic TypeScript interfaces and types
2. Implement ProgressTracker class with CSV operations
3. Create folder structure utilities
4. Test CSV reading/writing functionality

**Day 2:**
5. Implement BrowserPool class
6. Add browser lifecycle management
7. Test browser pool with simple navigation
8. Add browser restart logic

**Day 3:**
9. Implement ScreenshotProcessor class
10. Add basic navigation and single screenshot capture
11. Test with a few URLs manually
12. Debug any playwright issues

**Day 4:**
13. Implement sectioned screenshot logic
14. Add scrolling and overlap calculations
15. Test section capture with different page heights
16. Verify image quality and file sizes

**Day 5:**
17. Implement retry logic and error handling
18. Add concurrency management
19. Integrate all components in ScreenshotManager
20. Test with batch of 10-20 URLs

**Day 6:**
21. Performance testing and optimization
22. Add logging and progress reporting
23. Final testing with larger batch
24. Documentation and cleanup

### **3.10 Testing Strategy**

**Unit Tests:**
- Domain extraction and folder creation
- CSV progress tracking operations
- Section calculation logic

**Integration Tests:**
- Browser pool management
- Single URL processing end-to-end
- Error handling scenarios

**Load Tests:**
- 50+ URLs with various page types
- Memory usage monitoring
- Browser restart scenarios

---

### **3.11 Logging & Progress Tracking**

#### **Step 3.11.1: Console Logging Strategy**
```typescript
// Log levels to implement:
- INFO: General progress updates
- SUCCESS: Successful URL processing
- ERROR: Failed URLs with reasons
- WARN: Retries and recoverable issues
- DEBUG: Detailed browser operations (optional flag)
```

**Sample Console Output:**
```
[INFO] Starting screenshot capture for 150 URLs...
[INFO] Initialized 5 browser instances
[INFO] Progress: 15/150 (10%) - Processing: example.com
[SUCCESS] example.com: 4 desktop, 3 mobile sections captured (2.3s)
[WARN] blog.site.com: Retrying due to timeout (attempt 2/2)
[ERROR] broken-site.com: Failed after 2 attempts - Navigation timeout
[INFO] Batch complete: 142 success, 8 failed
```

#### **Step 3.11.2: Progress Bar Implementation**
```typescript
// Use a simple progress bar library or implement custom
// Requirements:
- Show: current/total URLs
- Show: percentage complete
- Show: estimated time remaining
- Show: current processing rate (URLs/min)
- Update in real-time as URLs complete
```

**Progress Bar Dependencies:**
```bash
pnpm add cli-progress
```

**Progress Bar Display:**
```
Processing URLs [████████████████████████████████████████] 142/150 | 94.7% | ETA: 2m 15s | 12.3 URLs/min
```

### **3.12 Blog Site Specific Optimizations**

#### **Step 3.12.1: Blog Site Considerations**
```typescript
// Blog-specific settings:
- Longer page load wait time (3-4 seconds vs 2 seconds)
- Handle common blog elements:
  - Comment sections (may load lazily)
  - Social media embeds
  - Image galleries
  - Related posts sections
- Scroll more slowly to allow content loading
```

#### **Step 3.12.2: Dynamic Content Handling**
```typescript
// Wait strategies for blog content:
1. Wait for network idle (no requests for 2 seconds)
2. Wait for specific blog elements to load
3. Additional 2-second buffer after scroll
4. Handle lazy-loaded images with intersection observer
```

### **3.13 Updated Implementation Details**

#### **Step 3.13.1: Enhanced ScreenshotProcessor**
```typescript
// Additional methods for blog handling:
- waitForBlogContent(page: Page): Promise<void>
- handleLazyImages(page: Page): Promise<void>
- checkForInfiniteScroll(page: Page): Promise<boolean>
- optimizeForBlogLayout(page: Page): Promise<void>
```

#### **Step 3.13.2: Blog-Optimized Scroll Logic**
```typescript
// Modified scrolling approach:
1. Scroll to position
2. Wait for network idle (2 seconds)
3. Wait for images to load (evaluate lazy loading)
4. Additional 1-second buffer
5. Capture screenshot
6. Check if more content loaded during scroll
```

### **3.14 Progress Tracking Integration**

#### **Step 3.14.1: ProgressManager Class**
```typescript
// Combines console logging + progress bar + CSV tracking
class ProgressManager {
  private progressBar: ProgressBar;
  private startTime: Date;
  private processedCount: number;
  private totalCount: number;
  
  // Methods:
  - initializeProgress(total: number): void
  - updateProgress(url: string, status: 'success' | 'failed'): void
  - logSuccess(url: string, metadata: any): void
  - logError(url: string, error: string, retryCount: number): void
  - logWarning(url: string, message: string): void
  - calculateETA(): string
  - generateFinalReport(): void
}
```

#### **Step 3.14.2: Real-time Progress Updates**
```typescript
// Progress bar updates:
- Increment on each URL completion
- Update ETA based on current processing rate
- Show current URL being processed
- Display success/failure counts
- Update every 500ms for smooth animation
```

### **3.15 Image Quality Settings**

#### **Step 3.15.1: JPEG Compression Settings**
```typescript
// Screenshot options for "good enough" quality:
const screenshotOptions = {
  type: 'jpeg',
  quality: 75,           // Good balance of quality/size
  fullPage: false,       // We're doing sections
  animations: 'disabled' // Consistent screenshots
};
```

#### **Step 3.15.2: Blog-Specific Image Handling**
```typescript
// Handle blog-specific visual elements:
- Disable animations for consistent screenshots
- Wait for web fonts to load
- Handle video embeds (screenshot placeholder)
- Manage popup/overlay elements (dismiss if possible)
```

### **3.16 Updated Implementation Order**

**Day 1-2:** (Foundation - no changes)
1-8. Same as before

**Day 3:** (Enhanced for blogs)
9. Implement ScreenshotProcessor with blog optimizations
10. Add blog-specific wait strategies
11. Test with actual blog sites
12. Tune timing parameters

**Day 4:** (Progress & Logging)
13. Implement ProgressManager class
14. Add console logging with different levels
15. Integrate progress bar
16. Test progress tracking with sample URLs

**Day 5:** (Sectioned Screenshots)
17. Implement sectioned screenshot logic with blog considerations
18. Add lazy loading detection
19. Test section capture with blog layouts
20. Verify image quality is acceptable

**Day 6:** (Integration & Testing)
21. Integrate all components
22. Add retry logic with progress updates
23. Test with 20-30 blog URLs
24. Performance testing and optimization

### **3.17 Testing with Blog Sites**

#### **Step 3.17.1: Test URL Categories**
```typescript
// Include these types for testing:
- WordPress blogs
- Medium articles
- Ghost blogs
- Static site generators (Gatsby, Hugo)
- News sites
- Personal blogs
```

#### **Step 3.17.2: Validation Criteria**
```typescript
// Success criteria:
- All major blog sections captured
- Text is readable in screenshots
- Images are visible (not placeholder boxes)
- No major content cut-offs between sections
- Load times reasonable (< 30 seconds per site)
```

### **3.18 Configuration Updates**

#### **Step 3.18.1: Blog-Optimized Config**
```typescript
interface ScreenshotConfig {
  concurrency: number;           // Default: 5
  screenshotPath: string;        // Default: './screenshots'
  progressFile: string;          // Default: './processed_urls.csv'
  maxRetries: number;            // Default: 2
  pageTimeout: number;           // Default: 45000ms (increased for blogs)
  scrollDelay: number;           // Default: 3000ms (increased for blogs)
  networkIdleTimeout: number;    // Default: 2000ms (new for blogs)
  jpegQuality: number;           // Default: 75
  enableProgressBar: boolean;    // Default: true
  logLevel: 'DEBUG' | 'INFO';    // Default: 'INFO'
}
```

### **3.19 Error Handling Updates**

#### **Step 3.19.1: Blog-Specific Error Handling**
```typescript
// Additional error cases:
- CONTENT_BLOCKED: Site blocks automation
- INFINITE_SCROLL: Never-ending content
- RESOURCE_TIMEOUT: Blog assets take too long
- POPUP_INTERFERENCE: Modals/popups block content
```

#### **Step 3.19.2: Enhanced Retry Logic**
```typescript
// Retry strategies:
1. First attempt: Standard approach
2. Second attempt: Disable images/CSS for speed
3. If still fails: Mark as failed with specific reason
4. Continue processing (don't stop entire batch)
```

This updated plan now includes blog-specific optimizations, progress tracking, and quality settings. The junior developer will have clear guidance on handling the unique challenges of blog sites while maintaining good user feedback through progress bars and logging.

Would you like me to elaborate on any of these additions or move forward with a different aspect of the implementation?