import { Request, Response, NextFunction } from 'express';
import { JobStatusService } from '../services/jobStatusService';
import { AnalysisService } from '../services/analysisService';
import { JobStatusResponse, JobsListResponse, ApiError } from '../types/api';

export const jobsController = {
  async getJobStatus(req: Request, res: Response<JobStatusResponse | ApiError>, next: NextFunction) {
    try {
      const jobId = req.params.jobId;
      
      if (!jobId) {
        return res.status(400).json({ 
          error: 'Job ID is required' 
        });
      }

      const jobStatusService = new JobStatusService();
      const status = await jobStatusService.getJobStatus(jobId);

      if (!status) {
        return res.status(404).json({ 
          error: 'Job not found' 
        });
      }

      res.json(status);
    } catch (error) {
      next(error);
    }
  },

  async listJobs(req: Request, res: Response<JobsListResponse | ApiError>, next: NextFunction) {
    try {
      const jobStatusService = new JobStatusService();
      const jobs = await jobStatusService.getAllJobsStatus();

      res.json(jobs);
    } catch (error) {
      next(error);
    }
  },

  async deleteJob(req: Request, res: Response<{ message: string } | ApiError>, next: NextFunction) {
    try {
      const jobId = req.params.jobId;
      
      if (!jobId) {
        return res.status(400).json({ 
          error: 'Job ID is required' 
        });
      }

      const analysisService = new AnalysisService();
      await analysisService.removeJob(jobId);

      res.json({ 
        message: 'Job deleted successfully' 
      });
    } catch (error) {
      if (error.message === 'Job not found') {
        return res.status(404).json({ 
          error: 'Job not found' 
        });
      }
      next(error);
    }
  }
};