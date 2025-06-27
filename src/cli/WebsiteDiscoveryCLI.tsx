import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { WebsiteDiscoveryService } from '../websiteDiscovery';
import { CompanyProcessingState } from '../types';
import { ProgressBar } from './components/ProgressBar';
import { CompanyCard } from './components/CompanyCard';
import { StatsPanel } from './components/StatsPanel';
import { Header } from './components/Header';

interface Props {
  inputCsvPath: string;
  runDir?: string;
}

export const WebsiteDiscoveryCLI: React.FC<Props> = ({ inputCsvPath, runDir }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [companies, setCompanies] = useState<CompanyProcessingState[]>([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentCompany, setCurrentCompany] = useState<CompanyProcessingState | null>(null);
  const [stats, setStats] = useState({
    discovered: 0,
    failed: 0,
    pending: 0,
    successRate: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<{ runId: string; runDir: string } | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    startDiscovery();
  }, []);

  const startDiscovery = async () => {
    try {
      setIsRunning(true);
      setStartTime(new Date());
      
      const discoveryService = new WebsiteDiscoveryService();
      
      const result = await discoveryService.runDiscoveryPhase(
        inputCsvPath,
        runDir,
        (processedCount: number, totalCount: number, company: CompanyProcessingState) => {
          setProcessed(processedCount);
          setTotal(totalCount);
          setCurrentCompany(company);
          
          // Update stats
          const newStats = WebsiteDiscoveryService.getDiscoveryStats(
            companies.slice(0, processedCount).concat(company)
          );
          setStats(newStats);
        }
      );

      setRunInfo({ runId: result.runId, runDir: result.runDir });
      setCompanies(result.companies);
      setStats(result.stats);
      setIsRunning(false);
      
    } catch (err: any) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  const calculateETA = (): string => {
    if (!startTime || processed === 0 || !isRunning) return 'N/A';
    
    const elapsedMs = Date.now() - startTime.getTime();
    const avgTimePerCompany = elapsedMs / processed;
    const remainingCompanies = total - processed;
    const etaMs = remainingCompanies * avgTimePerCompany;
    
    const minutes = Math.floor(etaMs / 60000);
    const seconds = Math.floor((etaMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const calculateProcessingRate = (): string => {
    if (!startTime || processed === 0) return '0.0';
    
    const elapsedMinutes = (Date.now() - startTime.getTime()) / 60000;
    const rate = processed / elapsedMinutes;
    
    return rate.toFixed(1);
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Website Discovery - Error" />
        <Box borderStyle="round" borderColor="red" padding={1} marginTop={1}>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Website Discovery" />
      
      {runInfo && (
        <Box marginTop={1} padding={1} borderStyle="round" borderColor="blue">
          <Text color="blue">📁 Run ID: {runInfo.runId}</Text>
          <Newline />
          <Text color="blue">📂 Output: {runInfo.runDir}</Text>
        </Box>
      )}

      <StatsPanel
        stats={stats}
        total={total}
        eta={calculateETA()}
        rate={calculateProcessingRate()}
        startTime={startTime}
      />

      <ProgressBar
        current={processed}
        total={total}
        isComplete={!isRunning && processed === total}
      />

      {currentCompany && isRunning && (
        <CompanyCard
          company={currentCompany}
          isProcessing={isRunning}
          position={processed}
          total={total}
        />
      )}

      {!isRunning && processed === total && total > 0 && (
        <Box marginTop={1} padding={1} borderStyle="round" borderColor="green">
          <Text color="green">🎉 Website Discovery Complete!</Text>
          <Newline />
          <Text color="green">✅ Ready for Phase 3: {stats.discovered} companies with websites</Text>
        </Box>
      )}
    </Box>
  );
}; 