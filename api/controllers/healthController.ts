import { Request, Response } from 'express';
import { HealthResponse } from '../types/api';

export const healthController = {
  async checkHealth(req: Request, res: Response<HealthResponse>) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }
};