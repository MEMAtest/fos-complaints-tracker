'use client';

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

interface ComparisonTableProps {
  firmA: FOSFirmComparisonData;
  firmB: FOSFirmComparisonData;
}

export function ComparisonTable({ firmA, firmB }: ComparisonTableProps) {
  const topProductA = firmA.topProducts.length > 0 ? firmA.topProducts[0].product : 'N/A';
  const topProductB = firmB.topProducts.length > 0 ? firmB.topProducts[0].product : 'N/A';

  const yearsActiveA = firmA.yearBreakdown.length > 0
    ? `${firmA.yearBreakdown[0].year} - ${firmA.yearBreakdown[firmA.yearBreakdown.length - 1].year}`
    : 'N/A';
  const yearsActiveB = firmB.yearBreakdown.length > 0
    ? `${firmB.yearBreakdown[0].year} - ${firmB.yearBreakdown[firmB.yearBreakdown.length - 1].year}`
    : 'N/A';

  const rows: {
    label: string;
    valueA: string;
    valueB: string;
    betterSide: 'a' | 'b' | 'none';
  }[] = [
    {
      label: 'Total Cases',
      valueA: formatNumber(firmA.totalCases),
      valueB: formatNumber(firmB.totalCases),
      betterSide: firmA.totalCases > firmB.totalCases ? 'a' : firmB.totalCases > firmA.totalCases ? 'b' : 'none',
    },
    {
      label: 'Upheld Rate',
      valueA: formatPercent(firmA.upheldRate),
      valueB: formatPercent(firmB.upheldRate),
      // Lower upheld rate is better for the firm
      betterSide: firmA.upheldRate < firmB.upheldRate ? 'a' : firmB.upheldRate < firmA.upheldRate ? 'b' : 'none',
    },
    {
      label: 'Not Upheld Rate',
      valueA: formatPercent(firmA.notUpheldRate),
      valueB: formatPercent(firmB.notUpheldRate),
      // Higher not-upheld rate is better for the firm
      betterSide: firmA.notUpheldRate > firmB.notUpheldRate ? 'a' : firmB.notUpheldRate > firmA.notUpheldRate ? 'b' : 'none',
    },
    {
      label: 'Top Product',
      valueA: topProductA,
      valueB: topProductB,
      betterSide: 'none',
    },
    {
      label: 'Years Active',
      valueA: yearsActiveA,
      valueB: yearsActiveB,
      betterSide: 'none',
    },
  ];

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
