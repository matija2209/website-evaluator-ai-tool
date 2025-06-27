import fs from 'fs-extra';
import path from 'path';
import dayjs from 'dayjs';
import { RunMetadata } from './types';
import { config } from '../config';

export class RunManager {
  
  /**
   * Generate timestamp-based RUN_ID in format YYYYMMDD_HHMMSS
   */
  static generateRunId(): string {
    return dayjs().format('YYYYMMDD_HHmmss');
  }

  /**
   * Create run directory structure and copy input file
   */
  static async initializeRun(inputCsvPath: string): Promise<{ runId: string; runDir: string }> {
    const runId = this.generateRunId();
    const runDir = path.join(config.paths.runsDirectory, runId);
    
    // Create directory structure
    await fs.ensureDir(runDir);
    await fs.ensureDir(path.join(runDir, config.paths.screenshotsSubdir));
    
    // Copy input CSV to run directory
    const inputFileName = path.basename(inputCsvPath);
    const runInputPath = path.join(runDir, 'input.csv');
    await fs.copy(inputCsvPath, runInputPath);
    
    console.log(`🚀 Initialized run ${runId} in ${runDir}`);
    console.log(`📂 Directory structure created`);
    console.log(`📁 Screenshots directory: ${path.join(runDir, config.paths.screenshotsSubdir)}`);
    console.log(`📄 Input file copied to: ${runInputPath}`);
    
    return { runId, runDir };
  }

  /**
   * Save run metadata
   */
  static async saveRunMetadata(runDir: string, metadata: RunMetadata): Promise<void> {
    const metadataPath = path.join(runDir, 'run-metadata.json');
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    console.log(`💾 Run metadata saved to ${metadataPath}`);
  }

  /**
   * Load run metadata
   */
  static async loadRunMetadata(runDir: string): Promise<RunMetadata | null> {
    const metadataPath = path.join(runDir, 'run-metadata.json');
    
    if (!await fs.pathExists(metadataPath)) {
      return null;
    }
    
    return await fs.readJson(metadataPath);
  }

  /**
   * Update run metadata with current progress
   */
  static async updateRunProgress(
    runDir: string, 
    updates: Partial<RunMetadata>
  ): Promise<void> {
    const existing = await this.loadRunMetadata(runDir);
    if (!existing) {
      throw new Error(`No metadata found for run in ${runDir}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveRunMetadata(runDir, updated);
  }

  /**
   * Create domain-specific screenshot directories
   */
  static async createScreenshotDirectories(runDir: string, domain: string): Promise<{
    desktopDir: string;
    mobileDir: string;
  }> {
    const screenshotsDir = path.join(runDir, config.paths.screenshotsSubdir);
    const domainDir = path.join(screenshotsDir, domain);
    const desktopDir = path.join(domainDir, 'desktop');
    const mobileDir = path.join(domainDir, 'mobile');
    
    await fs.ensureDir(desktopDir);
    await fs.ensureDir(mobileDir);
    
    return { desktopDir, mobileDir };
  }

  /**
   * List all existing runs
   */
  static async listRuns(): Promise<string[]> {
    const runsDir = config.paths.runsDirectory;
    
    if (!await fs.pathExists(runsDir)) {
      return [];
    }
    
    const entries = await fs.readdir(runsDir);
    const runs: string[] = [];
    
    for (const entry of entries) {
      const entryPath = path.join(runsDir, entry);
      const stat = await fs.stat(entryPath);
      
      if (stat.isDirectory() && entry.match(/^\d{8}_\d{6}$/)) {
        runs.push(entry);
      }
    }
    
    return runs.sort();
  }

  /**
   * Get run directory path from run ID
   */
  static getRunDirectory(runId: string): string {
    return path.join(config.paths.runsDirectory, runId);
  }

  /**
   * Check if run exists
   */
  static async runExists(runId: string): Promise<boolean> {
    const runDir = this.getRunDirectory(runId);
    return await fs.pathExists(runDir);
  }

  /**
   * Clean up old runs (keep only latest N runs)
   */
  static async cleanupOldRuns(keepCount: number = 10): Promise<void> {
    const runs = await this.listRuns();
    
    if (runs.length <= keepCount) {
      return;
    }
    
    const toDelete = runs.slice(0, runs.length - keepCount);
    console.log(`🧹 Cleaning up ${toDelete.length} old runs (keeping latest ${keepCount})`);
    
    for (const runId of toDelete) {
      const runDir = this.getRunDirectory(runId);
      await fs.remove(runDir);
      console.log(`🗑️  Deleted run ${runId}`);
    }
  }

  /**
   * Get run summary information
   */
  static async getRunSummary(runId: string): Promise<{
    runId: string;
    metadata: RunMetadata | null;
    hasWebsiteDiscovery: boolean;
    hasScreenshots: boolean;
    hasFinalOutput: boolean;
  }> {
    const runDir = this.getRunDirectory(runId);
    const metadata = await this.loadRunMetadata(runDir);
    
    const hasWebsiteDiscovery = await fs.pathExists(path.join(runDir, 'website-discovery-progress.csv'));
    const hasScreenshots = await fs.pathExists(path.join(runDir, 'screenshot-progress.csv'));
    const hasFinalOutput = await fs.pathExists(path.join(runDir, 'output.csv'));
    
    return {
      runId,
      metadata,
      hasWebsiteDiscovery,
      hasScreenshots,
      hasFinalOutput
    };
  }
} 