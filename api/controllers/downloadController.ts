import { Request, Response, NextFunction } from 'express';
import { FileService } from '../services/fileService';
import { ApiError } from '../types/api';

export const downloadController = {
  async downloadResults(req: Request, res: Response, next: NextFunction) {
    try {
      const runId = req.params.runId;
      
      if (!runId) {
        return res.status(400).json({ 
          error: 'Run ID is required' 
        } as ApiError);
      }

      const csvPath = await FileService.getResultsCsvPath(runId);

      if (!csvPath) {
        return res.status(404).json({ 
          error: 'Results not found',
          details: 'Run results or CSV file not found'
        } as ApiError);
      }

      // Set download headers
      const filename = `website-analysis-${runId}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv');

      // Stream the file
      res.download(csvPath, filename, (error) => {
        if (error) {
          console.error('Download error:', error);
          if (!res.headersSent) {
            res.status(500).json({
              error: 'Download failed',
              details: error.message
            } as ApiError);
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
};