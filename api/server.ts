import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { FileService } from './services/fileService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize directories
FileService.ensureUploadDirectory();
FileService.ensureRunsDirectory();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
registerRoutes(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Website Analyzer API running on port ${PORT}`);
  console.log(`📊 Redis connection: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
  console.log(`📁 Upload directory: ./uploads`);
  console.log(`📈 Results directory: ./runs`);
  console.log('');
  console.log('📡 Available endpoints:');
  console.log('  GET  /health        - Health check');
  console.log('  POST /analyze       - Start website analysis (upload CSV)');
  console.log('  GET  /jobs          - List all jobs');
  console.log('  GET  /jobs/:jobId   - Get job status');
  console.log('  DEL  /jobs/:jobId   - Delete job');
  console.log('  GET  /download/:runId - Download results CSV');
});