import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/dashboard';

export const api = {
  getRuns: async () => {
    const response = await axios.get(`${API_BASE_URL}/runs`);
    return response.data;
  },
  getRunDetails: async (runId: string) => {
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}`);
    return response.data;
  },
  getRunResults: async (runId: string, filename?: string) => {
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}/results`, {
      params: { file: filename }
    });
    return response.data;
  },
  getRunFiles: async (runId: string) => {
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}/files`);
    return response.data;
  },
  getTechSummary: async (runId: string) => {
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}/tech-summary`);
    return response.data;
  },
  getCompanyDetails: async (runId: string, domain: string) => {
    const response = await axios.get(`${API_BASE_URL}/runs/${runId}/company/${domain}`);
    return response.data;
  },
  getScreenshotUrl: (runId: string, domain: string, filename: string) => {
    return `${API_BASE_URL}/runs/${runId}/screenshots/${domain}/${filename}`;
  }
};
