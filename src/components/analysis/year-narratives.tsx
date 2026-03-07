'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSYearNarrative } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

interface YearNarrativesProps {
  yearNarratives: FOSYearNarrative[];
  activeYears: number[];
  onToggleYear: (year: number) => void;
}

export function YearNarratives({ yearNarratives, activeYears, onToggleYear }: YearNarrativesProps) {
  if (yearNarratives.length === 0) {
    return <EmptyState label="No narrative insights for this filter combination." />;
  }

  return (
    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
      {yearNarratives.map((item) => (
        <Card key={`narrative-${item.year}`} className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{item.headline}</h3>
              <button
                onClick={() => onToggleYear(item.year)}
                className="shrink-0"
              >
                <Badge
                  variant={activeYears.includes(item.year) ? 'default' : 'outline'}
                  className="text-[11px]"
                >
                  {item.year}
                </Badge>
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">{item.detail}</p>
            <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
              <span>{formatNumber(item.total)} cases</span>
              <span>Upheld {formatPercent(item.upheldRate)}</span>
              {item.changeVsPrior != null && (
                <span className={item.changeVsPrior > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {item.changeVsPrior > 0 ? '+' : ''}{formatNumber(item.changeVsPrior)} vs prior
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
