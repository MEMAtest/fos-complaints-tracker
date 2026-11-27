'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { formatNumber, formatPercent, cn } from '@/lib/utils';
import { Download, LayoutGrid, Table2 } from 'lucide-react';

const FIRM_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#059669', '#e11d48'];

interface ComparisonTableProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
  onSelectMetric?: (metric: { label: string; insight: string; values: Array<{ firm: string; value: string }> }) => void;
}

interface MetricRow {
  label: string;
  values: string[];
  percents?: number[];
  diffLabel: string;
  diffTone: 'good' | 'warn' | 'neutral';
  insight: string;
  bestIndex: number;
}

function buildMetricRows(firms: FOSFirmComparisonData[]): MetricRow[] {
  const f0 = firms[0];
  const f1 = firms[1];

  const upheldDiff = f0 && f1 ? f1.upheldRate - f0.upheldRate : null;
  const notUpheldDiff = f0 && f1 ? f1.notUpheldRate - f0.notUpheldRate : null;
  const casesDiff = f0 && f1 ? f1.totalCases - f0.totalCases : null;
  const maxCases = Math.max(1, ...firms.map((f) => f.totalCases));

  const topProducts = firms.map((f) =>
    f.topProducts.length > 0
      ? `${f.topProducts[0].product} (${formatPercent(f.topProducts[0].upheldRate)})`
      : 'N/A'
  );

  const yearsActive = firms.map((f) =>
    f.yearBreakdown.length > 0
      ? `${f.yearBreakdown[0].year}–${f.yearBreakdown[f.yearBreakdown.length - 1].year}`
      : 'N/A'
  );

  return [
    {
      label: 'Upheld rate',
      values: firms.map((f) => formatPercent(f.upheldRate)),
      percents: firms.map((f) => Math.min(100, Math.max(0, f.upheldRate))),
      diffLabel: upheldDiff == null ? '—' : `${upheldDiff > 0 ? '+' : ''}${upheldDiff.toFixed(1)} pp`,
      diffTone: upheldDiff == null ? 'neutral' : Math.abs(upheldDiff) < 2 ? 'neutral' : upheldDiff < 0 ? 'good' : 'warn',
      insight:
        f0 && f1
          ? Math.abs(upheldDiff || 0) < 2
            ? 'Broadly aligned upheld rates across both firms.'
            : `${f0.upheldRate > f1.upheldRate ? f0.name : f1.name} has a higher upheld rate by ${Math.abs(upheldDiff || 0).toFixed(1)} pp.`
          : 'Published Ombudsman upheld rate.',
      bestIndex: firms.every((f) => f.totalCases === 0) ? -1 : firms.reduce((best, f, i) => (f.upheldRate < firms[best].upheldRate ? i : best), 0),
    },
    {
      label: 'Not upheld rate',
      values: firms.map((f) => formatPercent(f.notUpheldRate)),
      percents: firms.map((f) => Math.min(100, Math.max(0, f.notUpheldRate))),
      diffLabel: notUpheldDiff == null ? '—' : `${notUpheldDiff > 0 ? '+' : ''}${notUpheldDiff.toFixed(1)} pp`,
      diffTone: notUpheldDiff == null ? 'neutral' : Math.abs(notUpheldDiff) < 2 ? 'neutral' : notUpheldDiff > 0 ? 'good' : 'warn',
      insight:
        f0 && f1
          ? `${f1.notUpheldRate > f0.notUpheldRate ? f1.name : f0.name} resolves a higher share as not upheld.`
          : 'Share of published decisions not upheld.',
      bestIndex: firms.every((f) => f.totalCases === 0) ? -1 : firms.reduce((best, f, i) => (f.notUpheldRate > firms[best].notUpheldRate ? i : best), 0),
    },
    {
      label: 'Total cases',
      values: firms.map((f) => formatNumber(f.totalCases)),
      percents: firms.map((f) => Math.round((f.totalCases / maxCases) * 100)),
      diffLabel: casesDiff == null ? '—' : `${casesDiff > 0 ? '+' : ''}${formatNumber(casesDiff)}`,
      diffTone: 'neutral',
      insight:
        f0 && f1
          ? `${f0.totalCases >= f1.totalCases ? f0.name : f1.name} has ${formatNumber(Math.abs(casesDiff || 0))} more published decisions.`
          : 'Total published decisions in scope.',
      bestIndex: -1,
    },
    {
      label: 'Largest product (upheld)',
      values: topProducts,
      diffLabel: '—',
      diffTone: 'neutral',
      insight:
        f0?.topProducts[0] && f1?.topProducts[0]
          ? f0.topProducts[0].product === f1.topProducts[0].product
            ? `${f0.topProducts[0].product} is the largest product for both firms.`
            : 'Different primary product concentrations.'
          : 'Primary product category by volume.',
      bestIndex: -1,
    },
    {
      label: 'Years active',
      values: yearsActive,
      diffLabel: '—',
      diffTone: 'neutral',
      insight: 'Decision date span across the published FOS corpus.',
      bestIndex: -1,
    },
  ];
}

export function ComparisonTable({ firms, onSelectMetric }: ComparisonTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const metricRows = useMemo(() => buildMetricRows(firms), [firms]);

  const handleExportCsv = () => {
    const header = ['Metric', ...firms.map((f) => f.name), 'Difference', 'Insight'];
    const lines = [
      header.join(','),
      ...metricRows.map((row) =>
        [row.label, ...row.values, row.diffLabel, row.insight]
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regcomplaints-firm-comparison.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-[#08162f]">Key Metrics Comparison</h2>
          <p className="text-xs text-slate-500">Click any row for breakdown details or export directly to CSV.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition',
                viewMode === 'table' ? 'bg-white text-[#0f1f4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition',
                viewMode === 'cards' ? 'bg-white text-[#0f1f4f] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Cards
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {metricRows.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() =>
                onSelectMetric?.({
                  label: row.label,
                  insight: row.insight,
                  values: firms.map((f, idx) => ({ firm: f.name, value: row.values[idx] })),
                })
              }
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-left transition hover:border-[#0f1f4f]/30 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#08162f]">{row.label}</span>
                {row.diffLabel !== '—' && (
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {row.diffLabel}
                  </span>
                )}
              </div>
              <div className="mt-2.5 space-y-1.5">
                {firms.map((firm, i) => (
                  <div key={firm.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 truncate text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length] }} />
                      <span className="truncate">{firm.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{row.values[i]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] leading-4 text-slate-500">{row.insight}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-[170px] text-xs font-semibold text-slate-600">Metric</TableHead>
                {firms.map((firm, i) => (
                  <TableHead key={firm.name} className="text-xs font-semibold text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length] }} />
                      <span className="max-w-[180px] truncate">{firm.name}</span>
                    </span>
                  </TableHead>
                ))}
                {firms.length === 2 && <TableHead className="w-[100px] text-xs font-semibold text-slate-600">Difference</TableHead>}
                <TableHead className="text-xs font-semibold text-slate-600">Insight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricRows.map((row) => (
                <TableRow
                  key={row.label}
                  onClick={() =>
                    onSelectMetric?.({
                      label: row.label,
                      insight: row.insight,
                      values: firms.map((f, idx) => ({ firm: f.name, value: row.values[idx] })),
                    })
                  }
                  className={cn(onSelectMetric && 'cursor-pointer hover:bg-slate-50/90')}
                >
                  <TableCell className="text-xs font-semibold text-[#08162f]">{row.label}</TableCell>
                  {row.values.map((value, i) => (
                    <TableCell key={`${row.label}-${i}`} className="tabular-nums">
                      <div className="space-y-1">
                        <span className={cn('text-xs font-semibold', row.bestIndex === i && row.bestIndex >= 0 ? 'text-emerald-700' : 'text-slate-900')}>
                          {value}
                        </span>
                        {row.percents && (
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${row.percents[i]}%`,
                                backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length],
                                opacity: 0.75,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  {firms.length === 2 && (
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                          row.diffTone === 'good'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.diffTone === 'warn'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {row.diffLabel}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="max-w-[260px] text-xs text-slate-600">{row.insight}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
