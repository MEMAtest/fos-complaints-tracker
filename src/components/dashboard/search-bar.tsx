'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  queryDraft: string;
  onQueryDraftChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  summaryLine: string;
  loading: boolean;
  loadingStatusText: string | null;
  loadingProgressPct: number | null;
  lastLoadMs: number | null;
  metaLine?: string | null;
}

export function SearchBar({
  queryDraft,
  onQueryDraftChange,
  onApply,
  onClear,
  summaryLine,
  loading,
  loadingStatusText,
  loadingProgressPct,
  lastLoadMs,
  metaLine,
}: SearchBarProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={queryDraft}
            onChange={(e) => onQueryDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onApply(); }}
            placeholder="Case reference, firm, product, precedent, reasoning keyword..."
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
          />
        </div>
        <Button onClick={onApply} size="sm" className="rounded-lg bg-blue-600 text-white hover:bg-blue-700">
          Apply search
        </Button>
        <Button onClick={onClear} variant="outline" size="sm" className="rounded-lg">
          Clear filters
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">
          {summaryLine || 'Loading dashboard snapshot...'}
        </span>
        {loading && loadingStatusText && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{loadingStatusText}</span>
        )}
        {loading && loadingProgressPct != null && (
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-blue-100">
              <span className="block h-full bg-blue-500" style={{ width: `${loadingProgressPct}%` }} />
            </span>
            {loadingProgressPct}%
          </span>
        )}
        {!loading && lastLoadMs != null && (
          <span className="text-xs text-slate-500">
            Last refresh: {(lastLoadMs / 1000).toFixed(1)}s
            {metaLine ? ` · ${metaLine}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
