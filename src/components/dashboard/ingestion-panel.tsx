'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FOSIngestionStatus, FOSDataQuality } from '@/lib/fos/types';
import { formatNumber, formatDateTime } from '@/lib/utils';

interface IngestionPanelProps {
  ingestion: FOSIngestionStatus | null;
  dataQuality: FOSDataQuality | null;
  loading: boolean;
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function IngestionPanel({ ingestion, dataQuality, loading }: IngestionPanelProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Ingestion and quality</CardTitle>
        <CardDescription>Pipeline health, data freshness, and quality checks.</CardDescription>
      </CardHeader>
      <CardContent>
        {ingestion ? (
          <>
            <div className="flex items-center gap-3">
              <StatusBadge status={ingestion.status} />
              <span className="text-xs text-slate-500">Source: {ingestion.source}</span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <QualityRow
                label="Last successful run"
                value={ingestion.lastSuccessAt ? formatDateTime(ingestion.lastSuccessAt) : 'n/a'}
              />
              <QualityRow
                label="Windows progress"
                value={
                  ingestion.windowsDone != null && ingestion.windowsTotal != null
                    ? `${ingestion.windowsDone}/${ingestion.windowsTotal}`
                    : 'n/a'
                }
              />
              <QualityRow
                label="Failed windows"
                value={ingestion.failedWindows != null ? String(ingestion.failedWindows) : 'n/a'}
              />
              {dataQuality && (
                <>
                  <QualityRow label="Missing decision date" value={formatNumber(dataQuality.missingDecisionDate)} />
                  <QualityRow label="Unknown outcome rows" value={formatNumber(dataQuality.missingOutcome)} />
                  <QualityRow label="Cases with reasoning text" value={formatNumber(dataQuality.withReasoningText)} />
                </>
              )}
            </dl>
          </>
        ) : (
          <EmptyState label={loading ? 'Loading ingestion diagnostics...' : 'No diagnostics available.'} />
        )}
      </CardContent>
    </Card>
  );
}
