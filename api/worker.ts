import { Worker } from 'bullmq';
import { redisConnection } from './config/redis';
import { WebsiteAnalysisJobData, WebsiteAnalysisJobResult } from './types/queue';
import { WebsiteDiscoveryService } from '../src/websiteDiscovery';
import { runScreenshotCapture } from '../src/screenshotCapture';
import { runWebsiteAnalysis } from '../src/websiteAnalysisRunner';
import dotenv from 'dotenv';

dotenv.config();

// BullMQ Worker
const worker = new Worker<WebsiteAnalysisJobData, WebsiteAnalysisJobResult>(
  'website-analysis',
  async (job) => {
    const { csvPath, originalName } = job.data;
    
    console.log(`🚀 Starting website analysis job ${job.id} for ${originalName}`);
    
    try {
      // Update progress
      await job.updateProgress(10);
      
      // Phase 2: Website Discovery
      console.log('📊 Phase 2: Website Discovery starting...');
      const discovery = new WebsiteDiscoveryService();
      const { runId, stats } = await discovery.runDiscoveryPhase(csvPath);
      
      await job.updateProgress(40);
      console.log(`✅ Phase 2 complete: ${stats.websitesDiscovered}/${stats.totalCompanies} websites discovered`);
      
      // Phase 3: Screenshot Capture
      console.log('📸 Phase 3: Screenshot Capture starting...');
      await runScreenshotCapture(runId, 1);
      
      await job.updateProgress(70);
      console.log('✅ Phase 3 complete: Screenshots captured');
      
      // Phase 4: AI Analysis
      console.log('🤖 Phase 4: AI Analysis starting...');
      await runWebsiteAnalysis(runId);
      
      await job.updateProgress(100);
      console.log('✅ Phase 4 complete: AI analysis finished');
      
      return {
        runId,
        stats,
        completedAt: new Date().toISOString(),
        phases: {
          websiteDiscovery: 'completed',
          screenshotCapture: 'completed', 
          aiAnalysis: 'completed'
        }
      };
      
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one job at a time due to resource intensity
  }
);

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
  console.log(`📊 Result:`, job.returnvalue);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('💥 Worker error:', err);
});

worker.on('stalled', (jobId) => {
  console.warn(`⚠️  Job ${jobId} stalled`);
});

console.log('🔧 Website Analysis Worker started');
console.log(`📊 Redis connection: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
console.log('⏳ Waiting for jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Gracefully shutting down worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Gracefully shutting down worker...');
  await worker.close();
  process.exit(0);
});