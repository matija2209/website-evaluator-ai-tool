import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types/api';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response<ApiError>,
  next: NextFunction
) => {
  console.error('API Error:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
  });

  // Handle multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      details: 'Maximum file size is 10MB'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files',
      details: 'Only one file is allowed'
    });
  }

  // Handle custom validation errors
  if (error.message.includes('Only CSV files are allowed')) {
    return res.status(400).json({
      error: 'Invalid file type',
      details: error.message
    });
  }

  // Handle queue/redis errors
  if (error.message.includes('Redis') || error.message.includes('Connection')) {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      details: 'Queue service is not available'
    });
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
};

export const notFoundHandler = (req: Request, res: Response<ApiError>) => {
  res.status(404).json({
    error: 'Not found',
    details: `Route ${req.method} ${req.path} not found`
  });
};