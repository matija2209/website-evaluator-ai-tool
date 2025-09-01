import { QueueService } from './queueService';
import { FileService } from './fileService';
import { WebsiteAnalysisJobData } from '../types/queue';
import { AnalyzeResponse } from '../types/api';

export class AnalysisService {
  private queueService: QueueService;

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  async startAnalysis(file: Express.Multer.File): Promise<AnalyzeResponse> {
    // Validate file
    if (!FileService.validateCsvFile(file)) {
      throw new Error('Invalid file type. Only CSV files are allowed.');
    }

    const jobData: WebsiteAnalysisJobData = {
      csvPath: file.path,
      originalName: file.originalname,
      uploadedAt: new Date().toISOString(),
    };

    // Add job to queue
    const job = await this.queueService.addAnalysisJob(jobData);

    return {
      jobId: job.id!,
      status: 'queued',
      message: 'Website analysis started',
      originalFileName: file.originalname,
      estimatedTime: '6-10 hours for full dataset'
    };
  }

  async removeJob(jobId: string): Promise<void> {
    await this.queueService.removeJob(jobId);
  }
}