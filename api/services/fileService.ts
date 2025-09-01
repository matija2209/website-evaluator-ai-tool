import fs from 'fs-extra';
import path from 'path';

export class FileService {
  static async ensureUploadDirectory(): Promise<string> {
    const uploadDir = './uploads';
    await fs.ensureDir(uploadDir);
    return uploadDir;
  }

  static async ensureRunsDirectory(): Promise<string> {
    const runsDir = './runs';
    await fs.ensureDir(runsDir);
    return runsDir;
  }

  static async fileExists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  static async getResultsCsvPath(runId: string): Promise<string | null> {
    const runDir = path.join('./runs', runId);
    
    if (!await this.fileExists(runDir)) {
      return null;
    }

    const outputCsvPath = path.join(runDir, 'website-discovery-progress.csv');
    
    if (!await this.fileExists(outputCsvPath)) {
      return null;
    }

    return outputCsvPath;
  }

  static async validateCsvFile(file: Express.Multer.File): Promise<boolean> {
    if (!file) {
      return false;
    }

    const isValidMimeType = file.mimetype === 'text/csv';
    const isValidExtension = file.originalname.endsWith('.csv');
    
    return isValidMimeType || isValidExtension;
  }

  static generateFilename(originalName: string): string {
    const timestamp = Date.now();
    return `${timestamp}-${originalName}`;
  }

  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (await this.fileExists(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }
}