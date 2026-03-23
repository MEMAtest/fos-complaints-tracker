'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, Loader2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FOSDashboardFilters } from '@/lib/fos/types';
import { useSubsetSynthesis } from '@/hooks/use-fos-analysis';

interface SubsetAnalysisPanelProps {
  filters: FOSDashboardFilters;
  totalCases: number;
}

/** Strip any HTML tags from AI-generated text as defense-in-depth. */
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export function SubsetAnalysisPanel({ filters, totalCases }: SubsetAnalysisPanelProps) {
  const { synthesis, loading, error, fetchSynthesis, reset } = useSubsetSynthesis();
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    setTriggered(false);
    reset();
  }, [filters, reset]);

  const handleAnalyse = useCallback(() => {
    setTriggered(true);
    void fetchSynthesis(filters);
  }, [filters, fetchSynthesis]);

  if (!triggered) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <p className="max-w-md text-center text-sm text-slate-600">
          Use the filters above to scope a subset, then click below to generate an AI-powered deep analysis of <strong>why</strong> these decisions went the way they did.
        </p>
        <button
          onClick={handleAnalyse}
          disabled={totalCases < 5}
          className="flex items-center gap-2 rounded-full border border-teal-400 bg-teal-50 px-5 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Brain className="h-4 w-4" />
          Analyse This Subset
          {totalCases > 0 && <span className="text-teal-600">({totalCases.toLocaleString()} decisions)</span>}
        </button>
        {totalCases > 0 && totalCases < 5 && (
          <p className="flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3 w-3" />
            At least 5 decisions are needed for meaningful analysis.
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <p className="text-sm text-slate-600">
          Analysing {totalCases.toLocaleString()} decisions with AI...
        </p>
        <p className="text-xs text-slate-500">This typically takes 5-10 seconds.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-700">{error}</p>
        <button
          onClick={handleAnalyse}
          className="mt-2 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:border-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!synthesis) return null;

  const rootCauseData = synthesis.rootCauses.map((rc) => ({
    name: rc.label.length > 25 ? rc.label.slice(0, 22) + '...' : rc.label,
    fullName: rc.label,
    count: rc.count,
    upheldRate: rc.upheldRate,
  }));

  const precedentData = synthesis.precedents.map((p) => ({
    name: p.label.length > 20 ? p.label.slice(0, 17) + '...' : p.label,
    fullName: p.label,
    count: p.count,
    percent: p.percentOfCases,
  }));

  return (
    <div className="space-y-6">
      {/* AI narrative */}
      <div className="rounded-xl border-l-4 border-teal-500 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-900">AI Deep Analysis</h3>
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
            {synthesis.totalCases.toLocaleString()} decisions · {synthesis.upheldRate.toFixed(1)}% upheld
          </span>
        </div>
        <div className="prose prose-sm prose-slate max-w-none">
          {synthesis.narrative.split('\n').map((line, i) => {
            const trimmed = sanitizeText(line.trim());
            if (!trimmed) return null;
            if (trimmed.startsWith('## ')) {
              return (
                <h4 key={i} className="mb-2 mt-5 text-base font-semibold text-slate-900">
                  {trimmed.replace(/^## /, '')}
                </h4>
              );
            }
            return (
              <p key={i} className="mb-2 text-sm leading-relaxed text-slate-700">
                {trimmed}
              </p>
            );
          })}
        </div>
      </div>

      {/* Pattern charts */}
      {(rootCauseData.length > 0 || precedentData.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {rootCauseData.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Top Root Causes (upheld rate %)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rootCauseData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={130} className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${Number(value || 0).toFixed(1)}% upheld (${Number((props?.payload as { count?: number } | undefined)?.count || 0)} cases)`,
                      String((props?.payload as { fullName?: string } | undefined)?.fullName || ''),
                    ]}
                  />
                  <Bar dataKey="upheldRate" radius={[0, 4, 4, 0]}>
                    {rootCauseData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.upheldRate > 50 ? '#f43f5e' : entry.upheldRate > 35 ? '#f59e0b' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {precedentData.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Top Precedents Cited (case count)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={precedentData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" width={110} className="text-xs" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${Number(value || 0)} cases (${Number((props?.payload as { percent?: number } | undefined)?.percent || 0).toFixed(1)}%)`,
                      String((props?.payload as { fullName?: string } | undefined)?.fullName || ''),
                    ]}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
