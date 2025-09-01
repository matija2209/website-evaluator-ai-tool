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