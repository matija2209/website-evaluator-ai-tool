export interface WebsiteAnalysisJobData {
  csvPath: string;
  originalName: string;
  uploadedAt: string;
}

export interface WebsiteAnalysisJobResult {
  runId: string;
  stats: {
    totalCompanies: number;
    websitesDiscovered: number;
  };
  completedAt: string;
  phases: {
    websiteDiscovery: 'completed' | 'failed';
    screenshotCapture: 'completed' | 'failed';
    aiAnalysis: 'completed' | 'failed';
  };
}