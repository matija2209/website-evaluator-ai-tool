import { ConnectionOptions } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection: ConnectionOptions = {
  host: REDIS_URL.includes('://') ? new URL(REDIS_URL).hostname : REDIS_URL.split(':')[0],
  port: REDIS_URL.includes('://') ? parseInt(new URL(REDIS_URL).port) || 6379 : parseInt(REDIS_URL.split(':')[1]) || 6379,
};

export const queueConfig = {
  removeOnComplete: 10, // Keep last 10 completed jobs
  removeOnFail: 5,      // Keep last 5 failed jobs
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
};