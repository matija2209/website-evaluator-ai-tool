import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const config = {
  google: {
    apiKey: process.env.GOOGLE_API_KEY!,
    customSearchEngineId: process.env.GOOGLE_CSE_ID!,
    maxResults: 10,
    rateLimitDelay: 100
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY!,
    model: 'gemini-2.5-flash'
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