'use client';

import { FileText } from 'lucide-react';

interface ExecutiveSummaryProps {
  summary: string;
}

export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  return (
    <div className="rounded-xl border-l-4 border-amber-500 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">Executive Summary</h3>
      </div>
      <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {summary}
      </div>
    </div>
  );
}
