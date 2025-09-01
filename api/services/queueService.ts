import { Queue } from 'bullmq';
import { redisConnection, queueConfig } from '../config/redis';
import { WebsiteAnalysisJobData, WebsiteAnalysisJobResult } from '../types/queue';

export class QueueService {
  private static instance: QueueService;
  private queue: Queue<WebsiteAnalysisJobData, WebsiteAnalysisJobResult>;

  private constructor() {
    this.queue = new Queue('website-analysis', {
      connection: redisConnection,
      ...queueConfig,
    });
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  async addAnalysisJob(data: WebsiteAnalysisJobData) {
    return await this.queue.add('process-websites', data, {
      removeOnComplete: queueConfig.removeOnComplete,
      removeOnFail: queueConfig.removeOnFail,
    });
  }

  async getJob(jobId: string) {
    return await this.queue.getJob(jobId);
  }

  async getWaitingJobs() {
    return await this.queue.getWaiting();
  }

  async getActiveJobs() {
    return await this.queue.getActive();
  }

  async getCompletedJobs() {
    return await this.queue.getCompleted();
  }

  async getFailedJobs() {
    return await this.queue.getFailed();
  }

  async removeJob(jobId: string) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    await job.remove();
  }

  getQueue() {
    return this.queue;
  }
}