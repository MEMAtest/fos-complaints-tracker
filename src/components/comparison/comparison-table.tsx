'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FOSFirmComparisonData } from '@/lib/fos/types';
import { formatNumber, formatPercent, cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const FIRM_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];

interface ComparisonTableProps {
  firms: FOSFirmComparisonData[];
  split?: boolean;
}

interface MetricRow {
  label: string;
  explainer: string;
  values: string[];
  bestIndex: number; // -1 = no best
}

function buildMetricRows(firms: FOSFirmComparisonData[]): MetricRow[] {
  const topProducts = firms.map((f) =>
    f.topProducts.length > 0 ? f.topProducts[0].product : 'N/A'
  );
  const yearsActive = firms.map((f) =>
    f.yearBreakdown.length > 0
      ? `${f.yearBreakdown[0].year} - ${f.yearBreakdown[f.yearBreakdown.length - 1].year}`
      : 'N/A'
  );

  return [
    {
      label: 'Total Cases',
      explainer: 'Number of FOS decisions involving this firm.',
      values: firms.map((f) => formatNumber(f.totalCases)),
      bestIndex: firms.every((f) => f.totalCases === 0) ? -1 : firms.reduce((best, f, i) => (f.totalCases > firms[best].totalCases ? i : best), 0),
    },
    {
      label: 'Upheld Rate',
      explainer: '% of complaints upheld against the firm (lower = better for firm).',
      values: firms.map((f) => formatPercent(f.upheldRate)),
      bestIndex: firms.every((f) => f.totalCases === 0) ? -1 : firms.reduce((best, f, i) => (f.upheldRate < firms[best].upheldRate ? i : best), 0),
    },
    {
      label: 'Not Upheld Rate',
      explainer: '% not upheld (higher = better for firm).',
      values: firms.map((f) => formatPercent(f.notUpheldRate)),
      bestIndex: firms.every((f) => f.totalCases === 0) ? -1 : firms.reduce((best, f, i) => (f.notUpheldRate > firms[best].notUpheldRate ? i : best), 0),
    },
    {
      label: 'Top Product',
      explainer: 'Product category with the most complaints.',
      values: topProducts,
      bestIndex: -1,
    },
    {
      label: 'Years Active',
      explainer: 'Range of years with FOS decisions.',
      values: yearsActive,
      bestIndex: -1,
    },
  ];
}

function MetricLabel({ label, explainer }: { label: string; explainer: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-slate-400" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px] text-xs">
          {explainer}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function SingleTable({ firm, rows }: { firm: FOSFirmComparisonData; rows: { label: string; explainer: string; value: string }[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Metric</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium text-slate-700">
              <MetricLabel label={row.label} explainer={row.explainer} />
            </TableCell>
            <TableCell className="tabular-nums">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ComparisonTable({ firms, split }: ComparisonTableProps) {
  const metricRows = useMemo(() => buildMetricRows(firms), [firms]);

  if (split) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {firms.map((firm, i) => {
          const singleRows = metricRows.map((r) => ({
            label: r.label,
            explainer: r.explainer,
            value: r.values[i],
          }));
          return (
            <Card key={firm.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{firm.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <SingleTable firm={firm} rows={singleRows} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[160px]">Metric</TableHead>
          {firms.map((firm, i) => (
            <TableHead key={firm.name}>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length] }}
                />
                {firm.name}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {metricRows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium text-slate-700">
              <MetricLabel label={row.label} explainer={row.explainer} />
            </TableCell>
            {row.values.map((value, i) => (
              <TableCell
                key={`${row.label}-${i}`}
                className={cn(
                  'tabular-nums',
                  row.bestIndex === i && row.bestIndex >= 0 && 'font-semibold text-emerald-700'
                )}
              >
                {value}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
