import { Express } from 'express';
import { healthRoutes } from './health';
import { analysisRoutes } from './analysis';
import { jobsRoutes } from './jobs';
import { downloadRoutes } from './downloads';

export const registerRoutes = (app: Express) => {
  app.use('/health', healthRoutes);
  app.use('/analyze', analysisRoutes);
  app.use('/jobs', jobsRoutes);
  app.use('/status', jobsRoutes); // Alias for backwards compatibility
  app.use('/download', downloadRoutes);
};