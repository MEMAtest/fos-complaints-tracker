'use client';

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

interface ComparisonTableProps {
  firmA: FOSFirmComparisonData;
  firmB: FOSFirmComparisonData;
  split?: boolean;
}

function buildRows(firmA: FOSFirmComparisonData, firmB: FOSFirmComparisonData) {
  const topProductA = firmA.topProducts.length > 0 ? firmA.topProducts[0].product : 'N/A';
  const topProductB = firmB.topProducts.length > 0 ? firmB.topProducts[0].product : 'N/A';

  const yearsActiveA = firmA.yearBreakdown.length > 0
    ? `${firmA.yearBreakdown[0].year} - ${firmA.yearBreakdown[firmA.yearBreakdown.length - 1].year}`
    : 'N/A';
  const yearsActiveB = firmB.yearBreakdown.length > 0
    ? `${firmB.yearBreakdown[0].year} - ${firmB.yearBreakdown[firmB.yearBreakdown.length - 1].year}`
    : 'N/A';

  return {
    rows: [
      {
        label: 'Total Cases',
        valueA: formatNumber(firmA.totalCases),
        valueB: formatNumber(firmB.totalCases),
        betterSide: firmA.totalCases > firmB.totalCases ? 'a' as const : firmB.totalCases > firmA.totalCases ? 'b' as const : 'none' as const,
      },
      {
        label: 'Upheld Rate',
        valueA: formatPercent(firmA.upheldRate),
        valueB: formatPercent(firmB.upheldRate),
        betterSide: firmA.upheldRate < firmB.upheldRate ? 'a' as const : firmB.upheldRate < firmA.upheldRate ? 'b' as const : 'none' as const,
      },
      {
        label: 'Not Upheld Rate',
        valueA: formatPercent(firmA.notUpheldRate),
        valueB: formatPercent(firmB.notUpheldRate),
        betterSide: firmA.notUpheldRate > firmB.notUpheldRate ? 'a' as const : firmB.notUpheldRate > firmA.notUpheldRate ? 'b' as const : 'none' as const,
      },
      {
        label: 'Top Product',
        valueA: topProductA,
        valueB: topProductB,
        betterSide: 'none' as const,
      },
      {
        label: 'Years Active',
        valueA: yearsActiveA,
        valueB: yearsActiveB,
        betterSide: 'none' as const,
      },
    ],
  };
}

function SingleTable({ firm, rows }: { firm: FOSFirmComparisonData; rows: { label: string; value: string }[] }) {
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
            <TableCell className="font-medium text-slate-700">{row.label}</TableCell>
            <TableCell className="tabular-nums">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ComparisonTable({ firmA, firmB, split }: ComparisonTableProps) {
  const { rows } = buildRows(firmA, firmB);

  if (split) {
    const rowsA = rows.map((r) => ({ label: r.label, value: r.valueA }));
    const rowsB = rows.map((r) => ({ label: r.label, value: r.valueB }));

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{firmA.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleTable firm={firmA} rows={rowsA} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{firmB.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <SingleTable firm={firmB} rows={rowsB} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Metric</TableHead>
          <TableHead>{firmA.name}</TableHead>
          <TableHead>{firmB.name}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium text-slate-700">{row.label}</TableCell>
            <TableCell
              className={cn(
                'tabular-nums',
                row.betterSide === 'a' && 'font-semibold text-emerald-700'
              )}
            >
              {row.valueA}
            </TableCell>
            <TableCell
              className={cn(
                'tabular-nums',
                row.betterSide === 'b' && 'font-semibold text-emerald-700'
              )}
            >
              {row.valueB}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
