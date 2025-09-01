export interface AnalyzeRequest {
  file?: Express.Multer.File;
}

export interface AnalyzeResponse {
  jobId: string;
  status: 'queued';
  message: string;
  originalFileName: string;
  estimatedTime: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  data: any;
  result?: any;
  failedReason?: string;
  processedOn?: number;
  finishedOn?: number;
  createdAt: number;
}

export interface JobSummary {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface JobsListResponse {
  summary: JobSummary;
  jobs: {
    waiting: Array<{ id: string; data: any }>;
    active: Array<{ id: string; progress: number; data: any }>;
    completed: Array<{ id: string; result: any; finishedOn: number }>;
    failed: Array<{ id: string; error: string; failedOn: number }>;
  };
}

export interface ApiError {
  error: string;
  details?: string;
}

export interface HealthResponse {
  status: 'healthy';
  timestamp: string;
  version: string;
}