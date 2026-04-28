# How to Convert Your CLI Tool to a Production API with Zero Code Changes

I was working on a website analysis tool that processed large datasets through a command-line interface when a client asked for API access. The CLI worked perfectly - it could analyze hundreds of companies, capture screenshots, and run AI analysis - but they needed to integrate it into their web platform.

Rather than rewriting the entire application, I discovered a clean approach that wraps existing CLI logic with a production-ready API layer. This method preserves 100% of your original code while adding enterprise-grade capabilities like background job processing, progress tracking, and file uploads. Here's the exact implementation process I developed.

## Understanding the Wrapper Approach

The key insight is treating your CLI as a black box that the API orchestrates, rather than trying to refactor internal logic. Your existing CLI handles the complex business operations, while the API layer manages HTTP requests, file uploads, and job coordination.

This separation means your core functionality remains unchanged and testable, while the API provides the interface your applications need. Let's start with the basic wrapper implementation.

## Setting Up the Express Foundation

First, create a dedicated API directory structure that keeps your original source code untouched:

```typescript
// File: api/types/api.ts
export interface AnalyzeRequest {
  file?: Express.Multer.File;
}

export interface AnalyzeResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
  originalFileName: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: string;
  progress: number;
  result?: any;
  failedReason?: string;
}
```

These TypeScript interfaces establish clear contracts between your API and consumers. The `AnalyzeRequest` handles file uploads, while `JobStatusResponse` provides real-time progress updates for long-running operations.

Next, implement the basic Express server structure:

```typescript
// File: api/server.ts
import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

registerRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
```

This creates a minimal Express foundation with proper error handling and CORS support. The `registerRoutes` function will connect your API endpoints to the underlying CLI functionality.

## Implementing Clean Route Architecture

Rather than cramming everything into a single file, organize your API using the controller pattern:

```typescript
// File: api/routes/analysis.ts
import { Router } from 'express';
import { analysisController } from '../controllers/analysisController';
import { uploadMiddleware } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/', uploadMiddleware.single('csv'), analysisController.startAnalysis);

export { router as analysisRoutes };
```

The route definition stays clean and focused, delegating business logic to controllers. The `uploadMiddleware` handles file processing, while the controller manages the interaction with your CLI.

Now implement the controller that bridges HTTP requests to your CLI commands:

```typescript
// File: api/controllers/analysisController.ts
import { Request, Response, NextFunction } from 'express';
import { AnalysisService } from '../services/analysisService';
import { AnalyzeResponse, ApiError } from '../types/api';

export const analysisController = {
  async startAnalysis(req: Request, res: Response<AnalyzeResponse | ApiError>, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: 'CSV file is required' 
        });
      }

      const analysisService = new AnalysisService();
      const result = await analysisService.startAnalysis(req.file);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
```

The controller handles HTTP-specific concerns like request validation and response formatting, while delegating the actual work to services. This keeps your API logic testable and maintains clear separation of responsibilities.

## Connecting to Your Existing CLI

The service layer is where the magic happens - this is where you invoke your existing CLI commands without modifying them:

```typescript
// File: api/services/analysisService.ts
import { spawn } from 'child_process';
import { AnalyzeResponse } from '../types/api';

export class AnalysisService {
  async startAnalysis(file: Express.Multer.File): Promise<AnalyzeResponse> {
    // Generate unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start your existing CLI process
    this.executeCliCommand(file.path, jobId);

    return {
      jobId,
      status: 'processing',
      message: 'Analysis started',
      originalFileName: file.originalname
    };
  }

  private executeCliCommand(csvPath: string, jobId: string) {
    const childProcess = spawn('npm', ['run', 'start', csvPath], {
      stdio: 'inherit',
      detached: true
    });

    childProcess.unref(); // Allow parent to exit independently
    
    // Store process reference for status tracking
    this.trackProcess(jobId, childProcess);
  }

  private trackProcess(jobId: string, process: any) {
    // Implementation depends on your needs
    // Could store in memory, database, or file system
  }
}
```

This approach launches your existing CLI as a child process, allowing the API to return immediately while your analysis runs in the background. The `spawn` method gives you full control over the CLI execution without requiring any changes to your original code.

The key benefit is that your CLI continues working exactly as before - all the complex logic for website discovery, screenshot capture, and AI analysis remains untouched. The API simply orchestrates when and how these processes run.

## Adding Redis Queue Processing (Optional Extension)

For production applications with multiple concurrent requests or long-running jobs, extend your API with Redis-based job queues:

```bash
# Install queue dependencies
pnpm install bullmq ioredis
```

Create a queue service that manages background jobs:

```typescript
// File: api/services/queueService.ts
import { Queue } from 'bullmq';

export class QueueService {
  private queue: Queue;

  constructor() {
    this.queue = new Queue('website-analysis', {
      connection: {
        host: 'localhost',
        port: 6379,
      },
    });
  }

  async addAnalysisJob(data: { csvPath: string; originalName: string }) {
    return await this.queue.add('process-websites', data, {
      removeOnComplete: 10,
      removeOnFail: 5,
    });
  }

  async getJob(jobId: string) {
    return await this.queue.getJob(jobId);
  }
}
```

The queue service abstracts Redis complexity while providing reliable job processing. Jobs are persisted, can be retried on failure, and provide real-time progress updates.

Implement a background worker that executes your CLI commands:

```typescript
// File: api/worker.ts
import { Worker } from 'bullmq';
import { spawn } from 'child_process';

const worker = new Worker('website-analysis', async (job) => {
  const { csvPath, originalName } = job.data;
  
  console.log(`Starting analysis for ${originalName}`);
  
  return new Promise((resolve, reject) => {
    const childProcess = spawn('npm', ['run', 'start', csvPath], {
      stdio: 'pipe'
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, message: 'Analysis completed' });
      } else {
        reject(new Error(`CLI process failed with code ${code}`));
      }
    });

    // Update job progress based on CLI output
    childProcess.stdout.on('data', (data) => {
      // Parse CLI output for progress indicators
      job.updateProgress(this.parseProgress(data.toString()));
    });
  });
}, {
  connection: { host: 'localhost', port: 6379 }
});
```

The worker runs as a separate process, pulling jobs from Redis and executing your CLI commands. This provides horizontal scalability - you can run multiple workers across different machines to handle increased load.

## Production Deployment with Docker

Package everything for production deployment:

```yaml
# File: compose.yml
version: '3.8'

services:
  redis:
    image: redis:8.2.1-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    command: ["npm", "run", "api"]

  worker:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    command: ["npm", "run", "worker"]
```

This Docker setup provides a complete production environment with Redis persistence, automatic restarts, and separate API and worker services. Your CLI logic runs inside containers while maintaining all its original functionality.

The Dockerfile builds both the API server and worker from the same codebase:

```dockerfile
# File: Dockerfile
FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN mkdir -p /app/runs /app/uploads

EXPOSE 3000
```

This approach means you deploy once and get both HTTP API access and reliable background processing for your existing CLI functionality.

## Making API Calls

With everything set up, your API provides clean endpoints for integration:

```bash
# Start analysis
curl -X POST http://localhost:3000/analyze \
  -F "csv=@companies.csv"

# Check job status
curl http://localhost:3000/jobs/job_123

# Download results
curl http://localhost:3000/download/run_456 -o results.csv
```

The API handles file uploads, manages job queues, and provides progress tracking while your original CLI does all the heavy lifting. Client applications get professional API access without you rewriting proven business logic.

## Conclusion

Converting a CLI tool to a production API doesn't require rewriting your core functionality. By implementing a clean wrapper architecture with Express.js routes, controllers, and services, you preserve your existing logic while adding enterprise capabilities.

The optional Redis extension provides job queues, progress tracking, and horizontal scalability for production workloads. Docker packaging ensures consistent deployment across environments.

This approach gave me API access to complex website analysis functionality in days rather than weeks, and the same pattern works for any CLI application. You keep your battle-tested business logic while gaining the flexibility of web service integration.

Let me know in the comments if you have questions about implementing this pattern, and subscribe for more practical development guides.

Thanks, Matija