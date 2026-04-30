import { Request, Response, NextFunction } from 'express';
import { FileService } from '../services/fileService';
import fs from 'fs-extra';
import path from 'path';
import csv from 'csv-parser';

export const dashboardController = {
  async listRuns(req: Request, res: Response, next: NextFunction) {
    try {
      const runs = await FileService.listRuns();
      const runsWithMetadata = await Promise.all(
        runs.map(async (runId) => {
          try {
            const metadata = await FileService.getRunMetadata(runId);
            return {
              id: runId,
              ...metadata
            };
          } catch (e) {
            return { id: runId, timestamp: runId, error: 'Metadata corrupted' };
          }
        })
      );
      res.json(runsWithMetadata);
    } catch (error) {
      next(error);
    }
  },

  async getRunDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId } = req.params;
      let metadata;
      try {
        metadata = await FileService.getRunMetadata(runId);
      } catch (e) {
        metadata = { id: runId, timestamp: runId };
      }
      
      // Get basic stats from the CSV
      const csvPath = await FileService.getResultsCsvPath(runId);
      if (!csvPath) {
        return res.json({ ...metadata, stats: { total: 0, completed: 0 } });
      }

      const results = await parseCsv(csvPath);
      
      const stats = {
        total: results.length,
        completed: results.filter((r: any) => r.Search_Status === 'COMPLETED' || r.Search_Status === 'SUCCESS').length,
        withWebsite: results.filter((r: any) => r.Discovered_Website).length,
        avgMobileScore: calculateAvg(results, 'Mobile_Score'),
        avgDesktopScore: calculateAvg(results, 'Desktop_Score')
      };

      res.json({ ...metadata, stats });
    } catch (error) {
      next(error);
    }
  },

  async getTechSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId } = req.params;
      const techDir = path.join(process.cwd(), 'runs', runId, 'tech_analysis');
      
      if (!await fs.pathExists(techDir)) {
        return res.json({ totalSites: 0, technologies: [], categories: [] });
      }

      const files = await fs.readdir(techDir);
      const techCounts: Record<string, { count: number, categories: string[] }> = {};
      const categoryCounts: Record<string, number> = {};
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readJson(path.join(techDir, file));
            const siteCategories = new Set<string>();
            
            for (const [name, info] of Object.entries(data)) {
              const categories = (info as any).categories || [];
              
              if (!techCounts[name]) {
                techCounts[name] = { count: 0, categories };
              }
              techCounts[name].count++;

              categories.forEach((cat: string) => {
                siteCategories.add(cat);
              });
            }

            siteCategories.forEach((cat: string) => {
              categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
          } catch (e) {
            // Skip corrupted files
          }
        }
      }

      const sortedTech = Object.entries(techCounts)
        .map(([name, info]) => ({ name, ...info }))
        .sort((a, b) => b.count - a.count);

      const sortedCategories = Object.entries(categoryCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        totalSites: files.length,
        technologies: sortedTech,
        categories: sortedCategories
      });
    } catch (error) {
      next(error);
    }
  },

  async getRunFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId } = req.params;
      const files = await FileService.listRunFiles(runId);
      res.json(files);
    } catch (error) {
      next(error);
    }
  },

  async getRunResults(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId } = req.params;
      const { file } = req.query;
      
      let csvPath: string | null = null;
      if (file && typeof file === 'string') {
        csvPath = await FileService.getRunFilePath(runId, file);
      } else {
        csvPath = await FileService.getResultsCsvPath(runId);
      }
      
      if (!csvPath) {
        return res.status(404).json({ error: 'Run results not found' });
      }

      const results = await parseCsv(csvPath);
      
      // Enrich with tech analysis if available
      const enrichedResults = await Promise.all(results.map(async (row: any) => {
        const websiteUrl = row.Discovered_Website || row.website || row.URL || row.finalUrl;
        const domain = extractDomain(websiteUrl);
        if (domain) {
          const techPath = path.join(process.cwd(), 'runs', runId, 'tech_analysis', `${domain}.json`);
          if (await fs.pathExists(techPath)) {
            try {
              const techData = await fs.readJson(techPath);
              // techData is a map of { techName: { version, categories } }
              return { ...row, technologies: Object.keys(techData).map(name => ({ name, ...techData[name] })) };
            } catch (e) {
              return row;
            }
          }
        }
        return row;
      }));

      res.json(enrichedResults);
    } catch (error) {
      next(error);
    }
  },

  async getScreenshot(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId, domain, filename } = req.params;
      const filePath = FileService.getScreenshotPath(runId, domain, filename);
      if (await fs.pathExists(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).send('Screenshot not found');
      }
    } catch (error) {
      next(error);
    }
  },

  async getCompanyDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const { runId, domain } = req.params;
      
      // 1. Get basic info from results CSV
      const mainCsvPath = await FileService.getResultsCsvPath(runId);
      let companyData: any = null;
      
      if (mainCsvPath) {
        companyData = await findInCsv(mainCsvPath, domain);
      }

      if (!companyData) {
        // Try searching in other CSVs if not found in main results
        const files = await FileService.listRunFiles(runId);
        for (const file of files) {
          if (file.endsWith('.csv') && file !== 'output.csv' && file !== 'website-discovery-progress.csv') {
            const filePath = await FileService.getRunFilePath(runId, file);
            if (filePath) {
              companyData = await findInCsv(filePath, domain);
              if (companyData) break;
            }
          }
        }
      }

      if (!companyData) {
        return res.status(404).json({ error: 'Company not found in any run files' });
      }

      // 2. Enrich with Tech Analysis
      const techPath = path.join(process.cwd(), 'runs', runId, 'tech_analysis', `${domain}.json`);
      let technologies = [];
      if (await fs.pathExists(techPath)) {
        try {
          const techData = await fs.readJson(techPath);
          technologies = Object.entries(techData).map(([name, info]: [string, any]) => ({
            name,
            version: info.version,
            categories: info.categories || []
          }));
        } catch (e) {
          console.error(`Error reading tech analysis for ${domain}:`, e);
        }
      }

      // 3. Enrich with SEO Results
      const seoPath = path.join(process.cwd(), 'runs', runId, 'seo-results.csv');
      let seoData = null;
      if (await fs.pathExists(seoPath)) {
        seoData = await findInCsv(seoPath, domain);
      }

      // 4. Get Screenshots
      const screenshotsBaseDir = path.join(process.cwd(), 'runs', runId, 'screenshots', domain);
      const screenshots: any = { desktop: [], mobile: [] };
      
      if (await fs.pathExists(screenshotsBaseDir)) {
        const types = ['desktop', 'mobile'];
        for (const type of types) {
          const typeDir = path.join(screenshotsBaseDir, type);
          if (await fs.pathExists(typeDir)) {
            const files = await fs.readdir(typeDir);
            screenshots[type] = files
              .filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png'))
              .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
              });
          }
        }
      }

      res.json({
        ...companyData,
        technologies,
        seo: seoData,
        screenshots
      });
    } catch (error) {
      next(error);
    }
  }
};

async function findInCsv(filePath: string, domain: string): Promise<any | null> {
  console.log(`🔍 Searching for ${domain} in ${path.basename(filePath)}...`);
  return new Promise((resolve, reject) => {
    let found = false;
    const fileStream = fs.createReadStream(filePath);
    let stream: any;
    stream = fileStream.pipe(csv());
    
    stream.on('data', (data: any) => {
      if (found) return;
      const rowDomain = extractDomain(data.Discovered_Website || data.website || data.URL || data.finalUrl || data.targetUrl);
      if (rowDomain === domain) {
        found = true;
        console.log(`✅ Found ${domain} in ${path.basename(filePath)}`);
        
        // Normalize keys
        const normalized: any = { ...data };
        if (data.website && !data.Discovered_Website) normalized.Discovered_Website = data.website;
        if (data.Actual_Website && !data.Discovered_Website) normalized.Discovered_Website = data.Actual_Website;
        if (data.Company_Name && !normalized.Company_Name) normalized.Company_Name = data.Company_Name;
        if (data.Title && !normalized.Company_Name) normalized.Company_Name = data.Title;
        if (!normalized.Company_Name && normalized.Discovered_Website) {
          normalized.Company_Name = extractDomain(normalized.Discovered_Website);
        }

        stream.destroy();
        resolve(normalized);
      }
    });

    stream.on('end', () => {
      if (!found) {
        console.log(`❌ Not found in ${path.basename(filePath)}`);
        resolve(null);
      }
    });

    stream.on('error', (err: any) => {
      if (!found) {
        console.error(`Error reading ${filePath}:`, err);
        reject(err);
      }
    });
  });
}

async function parseCsv(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: any) => {
        // Normalize keys
        const normalized: any = { ...data };
        
        // Map common variations to standard keys
        if (data.website && !data.Discovered_Website) normalized.Discovered_Website = data.website;
        if (data.Actual_Website && !data.Discovered_Website) normalized.Discovered_Website = data.Actual_Website;
        
        if (data.Company_Name && !normalized.Company_Name) normalized.Company_Name = data.Company_Name;
        if (data.Title && !normalized.Company_Name) normalized.Company_Name = data.Title;
        if (!normalized.Company_Name && normalized.Discovered_Website) {
          normalized.Company_Name = extractDomain(normalized.Discovered_Website);
        }

        results.push(normalized);
      })
      .on('end', () => resolve(results))
      .on('error', (error: any) => reject(error));
  });
}

function calculateAvg(results: any[], key: string): number {
  const values = results
    .map(r => parseFloat(r[key]))
    .filter(v => !isNaN(v));
  
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return null;
  }
}
