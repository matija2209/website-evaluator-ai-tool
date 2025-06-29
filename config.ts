import * as dotenv from 'dotenv';
import { ScreenshotConfig, ViewportConfig, BrowserPoolConfig } from './src/types';

// Load environment variables from .env file
dotenv.config();

export const config = {
  google: {
    apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
    customSearchEngineId: process.env.GOOGLE_CLOUD_API_KEY!,
    maxResults: 10,
    rateLimitDelay: 100
  },
  gemini: {
    apiKey: process.env.GOOGLE_CLOUD_API_KEY || '',
    model: 'gemini-2.0-flash-exp',
    rateLimitDelay: 500, // 2 requests per second
    maxRetries: 2,
    temperature: 0.1, // Low temperature for consistent results
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
};

// Screenshot capture configuration
export const screenshotConfig: ScreenshotConfig = {
  concurrency: 1,              // Conservative default - can be increased
  pageTimeout: 30000,          // 30 seconds timeout
  scrollDelay: 2000,           // 2 seconds for content loading
  jpegQuality: 75,             // Good enough for AI analysis
  maxRetries: 2,               // Try 3 times total (1 + 2 retries)
  disableImages: false,        // Keep images for better screenshots
  enableContentWait: true      // Wait for actual content to load
};

// Viewport configurations for desktop and mobile screenshots
export const viewportConfigs: ViewportConfig[] = [
  {
    name: 'desktop',
    width: 1920,
    height: 1080,
    sectionHeight: 1050,       // 1080 - 30px minimal overlap (97%+ unique content)
    overlap: 30
  },
  {
    name: 'mobile', 
    width: 375,
    height: 812,
    sectionHeight: 792,        // 812 - 20px minimal overlap (97.5%+ unique content)
    overlap: 20
  }
];

// Browser pool configuration
export const browserPoolConfig: BrowserPoolConfig = {
  maxBrowsers: 2,              // Maximum browser instances
  restartAfterPages: 50,       // Restart browser after 50 pages to prevent memory leaks
  launchTimeout: 30000         // Browser launch timeout
}; 