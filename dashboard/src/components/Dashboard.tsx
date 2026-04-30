import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { RunList } from './RunList';
import { RunDetails } from './RunDetails';
import { CompanyDetails } from './CompanyDetails';
import { LayoutDashboard, Database, Activity, Settings, Search, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const data = await api.getRuns();
      setRuns(data);
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to extract runId and domain from path for breadcrumbs
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentRunId = pathParts[0] === 'run' ? pathParts[1] : null;
  const currentDomain = pathParts[2] === 'company' ? pathParts[3] : null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Activity className="text-primary" />
            <span>AI Evaluator</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <Link 
            to="/"
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${location.pathname === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
          >
            <LayoutDashboard size={20} />
            <span>All Runs</span>
          </Link>
          
          <div className="mt-8 text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
            Recent Runs
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh]">
            {runs.slice(0, 10).map((run) => (
              <Link
                key={run.id}
                to={`/run/${run.id}`}
                className={`text-left p-3 rounded-lg text-sm transition-colors ${currentRunId === run.id && !currentDomain ? 'bg-muted font-medium' : 'hover:bg-muted/50'}`}
              >
                {run.id}
              </Link>
            ))}
          </div>
        </nav>
        
        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer">
            <Settings size={20} />
            <span>Settings</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b flex items-center justify-between px-8 bg-card/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2 text-xl font-semibold">
            {currentRunId ? (
              <>
                <Link to="/" className="hover:text-primary transition-colors">
                  Runs
                </Link>
                <ChevronRight size={18} className="text-muted-foreground" />
                <Link 
                  to={`/run/${currentRunId}`}
                  className={`hover:text-primary transition-colors ${!currentDomain ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {currentRunId}
                </Link>
                {currentDomain && (
                  <>
                    <ChevronRight size={18} className="text-muted-foreground" />
                    <span className="text-foreground">{currentDomain}</span>
                  </>
                )}
              </>
            ) : (
              'Pipeline Dashboard'
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Search websites..." 
                className="pl-10 pr-4 py-2 rounded-full bg-muted border-none focus:ring-2 focus:ring-primary w-64 text-sm"
              />
            </div>
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
              M
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <Routes>
            <Route path="/" element={<RunList runs={runs} onSelectRun={(id) => navigate(`/run/${id}`)} loading={loading} />} />
            <Route path="/run/:runId" element={<RunDetailsWrapper />} />
            <Route path="/run/:runId/company/:domain" element={<CompanyDetailsWrapper />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function RunDetailsWrapper() {
  const { runId } = useParams();
  const navigate = useNavigate();
  if (!runId) return null;
  return (
    <RunDetails 
      runId={runId} 
      onBack={() => navigate('/')} 
      onSelectCompany={(domain) => navigate(`/run/${runId}/company/${domain}`)}
    />
  );
}

function CompanyDetailsWrapper() {
  const { runId, domain } = useParams();
  const navigate = useNavigate();
  if (!runId || !domain) return null;
  return (
    <CompanyDetails 
      runId={runId} 
      domain={domain} 
      onBack={() => navigate(`/run/${runId}`)} 
    />
  );
}
