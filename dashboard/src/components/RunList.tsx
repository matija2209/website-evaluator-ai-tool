import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronRight, Clock, Database } from "lucide-react";

interface RunListProps {
  runs: any[];
  onSelectRun: (id: string) => void;
  loading: boolean;
}

export function RunList({ runs, onSelectRun, loading }: RunListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-32 bg-muted rounded-t-lg" />
            <CardContent className="p-4 space-y-2">
              <div className="h-4 bg-muted w-3/4" />
              <div className="h-3 bg-muted w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analysis Runs</h2>
          <p className="text-muted-foreground mt-1">Browse all historical website analysis pipelines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {runs.map((run) => (
          <Card 
            key={run.id} 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-muted-foreground/10"
            onClick={() => onSelectRun(run.id)}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Database size={20} />
                </div>
                <Badge variant="secondary" className="font-mono">
                  {run.id}
                </Badge>
              </div>
              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                {formatRunId(run.id)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar size={14} />
                {run.timestamp || 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Completed</span>
                </div>
                <ChevronRight className="group-hover:translate-x-1 transition-transform" size={16} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatRunId(id: string) {
  if (id === '20260429_103124') return 'Slovenian E-commerce Batch';
  if (id.includes('_')) {
    const [date, time] = id.split('_');
    return `Batch ${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)} ${time.slice(0, 2)}:${time.slice(2, 4)}`;
  }
  return id;
}
