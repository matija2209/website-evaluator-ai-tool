import { QueueService } from './queueService';
import { JobStatusResponse, JobsListResponse } from '../types/api';

export class JobStatusService {
  private queueService: QueueService;

  constructor() {
    this.queueService = QueueService.getInstance();
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse | null> {
    const job = await this.queueService.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    return {
      jobId,
      status: state as any,
      progress: typeof progress === 'number' ? progress : 0,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn || undefined,
      finishedOn: job.finishedOn || undefined,
      createdAt: job.timestamp,
    };
  }

  async getAllJobsStatus(): Promise<JobsListResponse> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queueService.getWaitingJobs(),
      this.queueService.getActiveJobs(),
      this.queueService.getCompletedJobs(),
      this.queueService.getFailedJobs(),
    ]);

    return {
      summary: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      jobs: {
        waiting: waiting.map(j => ({ id: j.id!, data: j.data })),
        active: active.map(j => ({ id: j.id!, progress: j.progress || 0, data: j.data })),
        completed: completed.slice(0, 5).map(j => ({
          id: j.id!,
          result: j.returnvalue,
          finishedOn: j.finishedOn || 0
        })),
        failed: failed.slice(0, 5).map(j => ({
          id: j.id!,
          error: j.failedReason || 'Unknown error',
          failedOn: j.finishedOn || 0
        })),
      }
    };
  }
}