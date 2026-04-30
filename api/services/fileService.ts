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

  static async listRuns(): Promise<string[]> {
    const runsDir = await this.ensureRunsDirectory();
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a)); // Newest first
  }

  static async getRunMetadata(runId: string): Promise<any> {
    const metadataPath = path.join('./runs', runId, 'run-metadata.json');
    if (await fs.pathExists(metadataPath)) {
      return await fs.readJson(metadataPath);
    }
    return { runId, timestamp: runId };
  }

  static async fileExists(filePath: string): Promise<boolean> {
    return await fs.pathExists(filePath);
  }

  static async getResultsCsvPath(runId: string): Promise<string | null> {
    const runDir = path.join('./runs', runId);
    
    if (!await this.fileExists(runDir)) {
      return null;
    }

    // List of possible CSV result files in order of preference
    const possibleFiles = [
      'output.csv',
      'seo-results.csv',
      'website-discovery-progress.csv'
    ];

    for (const file of possibleFiles) {
      const filePath = path.join(runDir, file);
      if (await this.fileExists(filePath)) {
        return filePath;
      }
    }

    return null;
  }

  static async listRunFiles(runId: string): Promise<string[]> {
    const runDir = path.join('./runs', runId);
    if (!await this.fileExists(runDir)) {
      return [];
    }
    const files = await fs.readdir(runDir);
    return files.filter(f => f.endsWith('.csv'));
  }

  static async getRunFilePath(runId: string, filename: string): Promise<string | null> {
    const filePath = path.join('./runs', runId, filename);
    if (await this.fileExists(filePath)) {
      return filePath;
    }
    return null;
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

  static getScreenshotPath(runId: string, domain: string, filename: string): string {
    return path.join(process.cwd(), 'runs', runId, 'screenshots', domain, filename);
  }
}