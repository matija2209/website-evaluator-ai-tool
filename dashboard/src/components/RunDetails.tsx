import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronLeft, 
  ExternalLink, 
  Globe, 
  Smartphone, 
  Monitor, 
  ShieldCheck, 
  Code,
  Layout,
  Search,
  Filter
} from "lucide-react";

interface RunDetailsProps {
  runId: string;
  onBack: () => void;
  onSelectCompany: (domain: string) => void;
}

export function RunDetails({ runId, onBack, onSelectCompany }: RunDetailsProps) {
  const [results, setResults] = useState<any[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [techSummary, setTechSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'tech' | 'categories'>('tech');
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, [runId]);

  useEffect(() => {
    if (selectedFile) {
      loadResults(selectedFile);
    }
  }, [selectedFile]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [meta, files, tech] = await Promise.all([
        api.getRunDetails(runId),
        api.getRunFiles(runId),
        api.getTechSummary(runId)
      ]);
      setMetadata(meta);
      setAvailableFiles(files);
      setTechSummary(tech);
      
      // Select best file by default
      const defaultFile = files.find(f => f === 'output.csv') || 
                          files.find(f => f === 'seo-results.csv') || 
                          files.find(f => f === 'website-discovery-progress.csv') || 
                          files[0];
      
      if (defaultFile) {
        setSelectedFile(defaultFile);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load run details:', error);
      setLoading(false);
    }
  };

  const loadResults = async (filename: string) => {
    try {
      setLoadingResults(true);
      const data = await api.getRunResults(runId, filename);
      setResults(data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setLoadingResults(false);
      setLoading(false);
    }
  };

  const toggleTechFilter = (techName: string) => {
    setSelectedTechs(prev => 
      prev.includes(techName) 
        ? prev.filter(t => t !== techName) 
        : [...prev, techName]
    );
  };

  const toggleCategoryFilter = (catName: string) => {
    setSelectedCategories(prev => 
      prev.includes(catName) 
        ? prev.filter(c => c !== catName) 
        : [...prev, catName]
    );
  };

  const filteredResults = results.filter(r => {
    const searchStr = filter.toLowerCase();
    const matchesSearch = Object.values(r).some(val => String(val).toLowerCase().includes(searchStr));
    
    const matchesTech = selectedTechs.length === 0 || 
                       selectedTechs.every(tech => r.technologies?.some((t: any) => t.name === tech));
    
    const matchesCategory = selectedCategories.length === 0 ||
                           selectedCategories.every(cat => r.technologies?.some((t: any) => t.categories?.includes(cat)));
    
    return matchesSearch && matchesTech && matchesCategory;
  });

  const columns = results.length > 0 ? Object.keys(results[0]).filter(k => k !== 'technologies') : [];

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted w-1/4 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="h-96 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onBack}>
          <ChevronLeft size={20} />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Run Details</h2>
          <p className="text-muted-foreground">{runId}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Companies" 
          value={metadata?.stats?.total || 0} 
          icon={<Globe className="text-blue-500" />} 
        />
        <StatCard 
          title="Tech Detected" 
          value={techSummary?.totalSites || 0} 
          suffix={`/ ${metadata?.stats?.total || 0} sites`}
          icon={<Code className="text-emerald-500" />} 
        />
        <StatCard 
          title="Avg Mobile Score" 
          value={Math.round(metadata?.stats?.avgMobileScore || 0)} 
          suffix="/ 100"
          icon={<Smartphone className="text-purple-500" />} 
        />
        <StatCard 
          title="Avg Desktop Score" 
          value={Math.round(metadata?.stats?.avgDesktopScore || 0)} 
          suffix="/ 100"
          icon={<Monitor className="text-orange-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Top Technologies & Categories */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-muted-foreground/10">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-tighter">
                  <Layout size={14} className="text-primary" />
                  Stack Insights
                </CardTitle>
              </div>
              <div className="flex bg-muted/50 p-0.5 rounded-md">
                <button 
                  onClick={() => setSidebarTab('tech')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-sm transition-all ${sidebarTab === 'tech' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  TOOLS
                </button>
                <button 
                  onClick={() => setSidebarTab('categories')}
                  className={`flex-1 py-1 text-[10px] font-bold rounded-sm transition-all ${sidebarTab === 'categories' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
                >
                  CATEGORIES
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-4 max-h-[600px] overflow-y-auto">
              {sidebarTab === 'tech' ? (
                <div className="space-y-0.5">
                  {techSummary?.technologies?.slice(0, 30).map((tech: any) => {
                    const percentage = Math.round((tech.count / techSummary.totalSites) * 100);
                    return (
                      <button
                        key={tech.name}
                        onClick={() => toggleTechFilter(tech.name)}
                        className={`w-full group relative p-2 rounded-md text-[11px] transition-all hover:bg-muted ${
                          selectedTechs.includes(tech.name) 
                            ? 'bg-primary/10 text-primary font-bold border border-primary/20' 
                            : 'text-muted-foreground border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <span className="truncate pr-2">{tech.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] opacity-60">{percentage}%</span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-muted/50">
                              {tech.count}
                            </Badge>
                          </div>
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 bg-primary/5 rounded-l-md" style={{ width: `${percentage}%` }} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {techSummary?.categories?.map((cat: any) => {
                    const percentage = Math.round((cat.count / techSummary.totalSites) * 100);
                    return (
                      <button
                        key={cat.name}
                        onClick={() => toggleCategoryFilter(cat.name)}
                        className={`w-full group relative p-2 rounded-md text-[11px] transition-all hover:bg-muted ${
                          selectedCategories.includes(cat.name) 
                            ? 'bg-primary/10 text-primary font-bold border border-primary/20' 
                            : 'text-muted-foreground border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <span className="truncate pr-2">{cat.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] opacity-60">{percentage}%</span>
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-muted/50">
                              {cat.count}
                            </Badge>
                          </div>
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 bg-emerald-500/5 rounded-l-md" style={{ width: `${percentage}%` }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          
          {(selectedTechs.length > 0 || selectedCategories.length > 0) && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-[10px] h-8 gap-2"
              onClick={() => { setSelectedTechs([]); setSelectedCategories([]); }}
            >
              Clear All Filters
            </Button>
          )}
        </div>

        {/* Main Table Content */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-muted-foreground/10 shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CardTitle>Results View</CardTitle>
                  <select 
                    value={selectedFile}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="bg-background border rounded-md px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                  >
                    {availableFiles.map(file => (
                      <option key={file} value={file}>{file}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search in data..." 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-md bg-background border text-xs focus:ring-1 focus:ring-primary outline-none w-48"
                    />
                  </div>
                  <Badge variant="outline">{filteredResults.length} records</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className={`max-h-[700px] overflow-auto transition-opacity ${loadingResults ? 'opacity-50' : 'opacity-100'}`}>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="min-w-[200px]">Entity</TableHead>
                      <TableHead>Target URL</TableHead>
                      {columns.includes('status') && <TableHead>Status</TableHead>}
                      {columns.includes('error') && <TableHead>Error Details</TableHead>}
                      {(columns.includes('Mobile_Score') || columns.includes('Desktop_Score')) && (
                        <TableHead className="text-center">Scores</TableHead>
                      )}
                      {columns.includes('Design_Era') && <TableHead>Design</TableHead>}
                      <TableHead>Technologies</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((row, idx) => {
                      const company = row.Company_Name || row.Title || row.companyName || 'Unknown';
                      const url = row.Discovered_Website || row.website || row.URL || row.finalUrl;
                      const status = row.status || row.Search_Status || row.Screenshot_Status || row.Analysis_Status;
                      const error = row.error || row.failedReason;

                      return (
                        <TableRow key={idx} className="hover:bg-muted/30 transition-colors group/row">
                          <TableCell className="font-medium">
                            <button 
                              onClick={() => {
                                const domain = extractDomainFromUrl(url);
                                if (domain) onSelectCompany(domain);
                              }}
                              className="flex flex-col text-left hover:text-primary transition-colors cursor-pointer group"
                            >
                              <span className="truncate max-w-[250px] font-bold group-hover:underline" title={company}>{company}</span>
                              {row.City && <span className="text-[10px] text-muted-foreground">{row.City}</span>}
                            </button>
                          </TableCell>
                          <TableCell>
                            {url ? (
                              <a 
                                href={url.startsWith('http') ? url : `https://${url}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 truncate max-w-[180px] text-[11px]"
                              >
                                <Globe size={11} />
                                {url.replace(/^https?:\/\//, '')}
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-[10px] italic">No URL</span>
                            )}
                          </TableCell>
                          {columns.includes('status') && (
                            <TableCell>
                              <StatusBadge status={status} />
                            </TableCell>
                          )}
                          {columns.includes('error') && (
                            <TableCell>
                              {error ? (
                                <span className="text-[10px] text-red-500 font-mono truncate block max-w-[150px]" title={error}>
                                  {error}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">-</span>
                              )}
                            </TableCell>
                          )}
                          {(columns.includes('Mobile_Score') || columns.includes('Desktop_Score')) && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <ScoreBadge score={row.Mobile_Score} />
                                <ScoreBadge score={row.Desktop_Score} />
                              </div>
                            </TableCell>
                          )}
                          {columns.includes('Design_Era') && (
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[9px] px-1 py-0 uppercase whitespace-nowrap">
                                {row.Design_Era || 'N/A'}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {row.technologies?.slice(0, 3).map((tech: any, i: number) => (
                                <Badge 
                                  key={i} 
                                  variant="secondary" 
                                  className={`text-[9px] px-1 py-0 h-4 bg-muted/50 cursor-pointer hover:bg-primary/20 ${selectedTechs.includes(tech.name) ? 'bg-primary/20 ring-1 ring-primary/30' : ''}`}
                                  onClick={() => toggleTechFilter(tech.name)}
                                >
                                  {tech.name}
                                </Badge>
                              ))}
                              {(row.technologies?.length > 3) && (
                                <span className="text-[9px] text-muted-foreground">+{row.technologies.length - 3}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary"
                                onClick={() => {
                                  const domain = extractDomainFromUrl(url);
                                  if (domain) onSelectCompany(domain);
                                }}
                              >
                                <Layout size={12} />
                                Details
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild title="Open Website">
                                <a href={url} target="_blank" rel="noreferrer">
                                  <ExternalLink size={12} />
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredResults.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    <Search size={40} className="mx-auto mb-4 opacity-20" />
                    <p>No records found matching your filters.</p>
                    <Button variant="link" onClick={() => { setFilter(''); setSelectedTechs([]); }} className="text-xs">
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, suffix = '' }: any) {
  return (
    <Card className="border-muted-foreground/10 overflow-hidden group hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground font-medium">{suffix}</p>
            </div>
          </div>
          <div className="size-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:scale-110 transition-transform">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  
  const s = status.toUpperCase();
  let color = "bg-muted text-muted-foreground";
  
  if (s === 'SUCCESS' || s === 'COMPLETED') color = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  else if (s === 'FAILED' || s === 'ERROR') color = "bg-red-500/10 text-red-600 border-red-500/20";
  else if (s === 'PARTIAL') color = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  else if (s === 'IN_PROGRESS' || s === 'PENDING') color = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";

  return (
    <Badge className={`text-[9px] px-1.5 py-0 h-4 border ${color}`} variant="outline">
      {s}
    </Badge>
  );
}

function ScoreBadge({ score }: { score: any }) {
  const s = parseInt(score);
  if (isNaN(s)) return <span className="text-muted-foreground">-</span>;
  
  let color = "bg-red-500/10 text-red-600 border-red-500/20";
  if (s >= 80) color = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  else if (s >= 60) color = "bg-blue-500/10 text-blue-600 border-blue-500/20";
  else if (s >= 40) color = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
  
  return (
    <Badge className={`font-bold ${color}`} variant="outline">
      {s}
    </Badge>
  );
}

function extractDomainFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return null;
  }
}
