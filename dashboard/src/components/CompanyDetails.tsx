import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  ArrowLeft, 
  Globe, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Monitor, 
  Smartphone, 
  Shield, 
  ExternalLink,
  Code,
  Search,
  Image as ImageIcon,
  Calendar,
  Layers,
  MapPin,
  Mail,
  Phone,
  BarChart4
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';

interface CompanyDetailsProps {
  runId: string;
  domain: string;
  onBack: () => void;
}

export function CompanyDetails({ runId, domain, onBack }: CompanyDetailsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tech' | 'seo' | 'screenshots'>('overview');
  const [screenshotType, setScreenshotType] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    loadData();
  }, [runId, domain]);

  const loadData = async () => {
    try {
      setLoading(true);
      const companyData = await api.getCompanyDetails(runId, domain);
      setData(companyData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground animate-pulse">Aggregating company data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="size-12 text-destructive" />
        <p className="text-xl font-semibold">{error || 'Company not found'}</p>
        <button onClick={onBack} className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Results
        </button>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10';
    return 'text-destructive bg-destructive/10';
  };

  const getLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'EXCELLENT': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';
      case 'GOOD': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'AVERAGE': return 'bg-amber-500/20 text-amber-500 border-amber-500/50';
      case 'POOR': return 'bg-destructive/20 text-destructive border-destructive/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to run results
          </button>
          
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Globe size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{data.Company_Name || data.companyName || domain}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <a 
                  href={data.Discovered_Website || `https://${domain}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary flex items-center gap-1 transition-colors"
                >
                  {domain}
                  <ExternalLink size={14} />
                </a>
                {data.City && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {data.City}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center min-w-[100px] ${getScoreColor(parseInt(String(data.Combined_Score || 0)))}`}>
            <span className="text-2xl font-bold">{data.Combined_Score || 'N/A'}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Overall Score</span>
          </div>
          {data.Sophistication_Level && (
            <div className={`px-4 py-2 rounded-xl border font-semibold text-sm ${getLevelColor(String(data.Sophistication_Level))}`}>
              {data.Sophistication_Level}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        {[
          { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
          { id: 'tech', icon: Code, label: 'Tech Stack' },
          { id: 'seo', icon: Search, label: 'SEO & Meta' },
          { id: 'screenshots', icon: ImageIcon, label: 'Screenshots' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid gap-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: AI Analysis */}
            <div className="lg:col-span-2 space-y-8">
              <Card className="overflow-hidden border-none shadow-lg bg-card/50 backdrop-blur-sm">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Zap className="text-amber-500" size={20} />
                      AI Sophistication Analysis
                    </CardTitle>
                    {data.Design_Era && (
                      <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                        Era: {data.Design_Era.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {data.Analysis_Reasoning && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 italic text-sm leading-relaxed">
                      "{data.Analysis_Reasoning}"
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-emerald-500">
                        <CheckCircle2 size={18} />
                        Quick Wins
                      </h3>
                      <ul className="space-y-2">
                        {typeof data.Quick_Wins === 'string' && data.Quick_Wins.trim() ? (
                          data.Quick_Wins.split(';').filter(Boolean).map((win: string, i: number) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-primary font-bold">•</span>
                              {win.trim()}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground italic">No quick wins identified</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-blue-500">
                        <Zap size={18} />
                        Major Upgrades
                      </h3>
                      <ul className="space-y-2">
                        {typeof data.Major_Upgrades === 'string' && data.Major_Upgrades.trim() ? (
                          data.Major_Upgrades.split(';').filter(Boolean).map((up: string, i: number) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-primary font-bold">•</span>
                              {up.trim()}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground italic">No major upgrades identified</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-destructive/80">
                        <Smartphone size={18} />
                        Mobile Issues
                      </h3>
                      <ul className="space-y-2">
                        {typeof data.Mobile_Issues === 'string' && data.Mobile_Issues.trim() ? (
                          data.Mobile_Issues.split(';').filter(Boolean).map((issue: string, i: number) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-destructive font-bold">•</span>
                              {issue.trim()}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground italic">No mobile issues found</li>
                        )}
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center gap-2 text-destructive/80">
                        <Monitor size={18} />
                        Desktop Issues
                      </h3>
                      <ul className="space-y-2">
                        {typeof data.Desktop_Issues === 'string' && data.Desktop_Issues.trim() ? (
                          data.Desktop_Issues.split(';').filter(Boolean).map((issue: string, i: number) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-destructive font-bold">•</span>
                              {issue.trim()}
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground italic">No desktop issues found</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bizi Info if available */}
              {data.Activity_Description && (
                <Card className="border-none shadow-md bg-card/30">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company Registry Info</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Activity</span>
                      <p className="font-medium">{data.Activity_Description}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Tax Number</span>
                      <p className="font-medium">{data.Tax_Number || data.taxNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Employee Count</span>
                      <p className="font-medium">{data.Employee_Count}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Contact</span>
                      <div className="flex flex-col gap-1 mt-1">
                        {data.email && <span className="flex items-center gap-2"><Mail size={12} /> {data.email}</span>}
                        {data.phone && <span className="flex items-center gap-2"><Phone size={12} /> {data.phone}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Mini Stats */}
            <div className="space-y-6">
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Performance Scores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1"><Smartphone size={12} /> Mobile</span>
                      <span>{data.Mobile_Score || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${data.Mobile_Score || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1"><Monitor size={12} /> Desktop</span>
                      <span>{data.Desktop_Score || 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${data.Desktop_Score || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t text-[10px] text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Analysis Confidence:</span>
                      <span className="font-medium text-foreground">{data.Analysis_Confidence}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tokens Used:</span>
                      <span className="font-medium text-foreground">{data.Analysis_Tokens_Used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Analyzed At:</span>
                      <span className="font-medium text-foreground">{data.Analysis_Timestamp && !isNaN(new Date(data.Analysis_Timestamp).getTime()) ? new Date(data.Analysis_Timestamp).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Tech Preview */}
              <Card className="border-none shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Stack Preview
                    <button onClick={() => setActiveTab('tech')} className="text-[10px] text-primary hover:underline">View All</button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {data.technologies?.slice(0, 8).map((tech: any) => (
                      <Badge key={tech.name} variant="secondary" className="text-[10px] px-2 py-0">
                        {tech.name}
                      </Badge>
                    ))}
                    {!data.technologies?.length && <p className="text-xs text-muted-foreground italic">No technologies detected</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tech' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="text-primary" />
                Technology Stack
              </h2>
              <Badge variant="outline" className="text-muted-foreground">
                {data.technologies?.length || 0} Technologies Detected
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.technologies?.map((tech: any) => (
                <Card key={tech.name} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{tech.name}</span>
                      {tech.version && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">v{tech.version}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {tech.categories?.map((cat: string) => (
                        <span key={cat} className="text-[9px] uppercase tracking-wider text-primary font-bold">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!data.technologies?.length && (
                <div className="col-span-full p-12 text-center text-muted-foreground">
                  <Shield size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No technologies were detected for this website.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Search className="text-primary" />
              SEO & Metadata
            </h2>

            {data.seo ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">Core Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Page Title</span>
                      <p className="p-3 bg-muted/30 rounded-lg text-sm font-medium border">
                        {data.seo.pageTitle || 'No title found'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">Meta Description</span>
                      <p className="p-3 bg-muted/30 rounded-lg text-sm leading-relaxed border">
                        {data.seo.metaDescription || 'No description found'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {data.seo.scrapedAt && !isNaN(new Date(data.seo.scrapedAt).getTime()) ? new Date(data.seo.scrapedAt).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">JSON-LD Structured Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.seo.jsonLd && data.seo.jsonLd !== 'false' ? (
                      <pre className="p-4 bg-slate-950 text-slate-300 rounded-lg text-[10px] overflow-auto max-h-[400px] font-mono">
                        {(() => {
                          try {
                            return JSON.stringify(JSON.parse(data.seo.jsonLd), null, 2);
                          } catch (e) {
                            return data.seo.jsonLd;
                          }
                        })()}
                      </pre>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground italic border rounded-lg">
                        No structured data found on this page.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Extracted Text Content</CardTitle>
                    <CardDescription>First 5,000 characters of visible page text</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-muted/20 rounded-lg text-xs leading-loose text-muted-foreground h-[300px] overflow-y-auto whitespace-pre-wrap">
                      {data.seo.textContent || 'No text content available'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p>No SEO data was collected for this website.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'screenshots' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <ImageIcon className="text-primary" />
                Website Screenshots
              </h2>
              
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setScreenshotType('desktop')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    screenshotType === 'desktop' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Monitor size={14} /> Desktop
                </button>
                <button
                  onClick={() => setScreenshotType('mobile')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    screenshotType === 'mobile' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  <Smartphone size={14} /> Mobile
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.screenshots?.[screenshotType]?.length > 0 ? (
                data.screenshots[screenshotType].map((filename: string, index: number) => (
                  <Card key={filename} className="overflow-hidden border-none shadow-md group">
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      <img 
                        src={api.getScreenshotUrl(runId, domain, `${screenshotType}/${filename}`)} 
                        alt={`Section ${index + 1}`}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold text-white">
                        SECTION {index + 1}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full p-24 text-center text-muted-foreground">
                  <ImageIcon size={64} className="mx-auto mb-4 opacity-10" />
                  <p>No {screenshotType} screenshots available for this site.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
