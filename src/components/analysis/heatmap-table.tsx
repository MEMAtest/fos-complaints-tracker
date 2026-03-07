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
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSYearProductOutcomeCell } from '@/lib/fos/types';
import { cn, formatPercent, formatNumber, truncate, clamp } from '@/lib/utils';

interface HeatmapTableProps {
  yearProductOutcome: FOSYearProductOutcomeCell[];
  activeYears: number[];
  activeProducts: string[];
  onToggleYear: (year: number) => void;
  onToggleProduct: (product: string) => void;
}

export function HeatmapTable({
  yearProductOutcome,
  activeYears,
  activeProducts,
  onToggleYear,
  onToggleProduct,
}: HeatmapTableProps) {
  /* ---- derive unique years (last 8) and top 6 products ---- */
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const row of yearProductOutcome) set.add(row.year);
    return Array.from(set)
      .sort((a, b) => a - b)
      .slice(-8)
      .reverse();
  }, [yearProductOutcome]);

  const products = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of yearProductOutcome) {
      totals.set(row.product, (totals.get(row.product) || 0) + row.total);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([product]) => product);
  }, [yearProductOutcome]);

  /* ---- fast lookup by "year::product" ---- */
  const lookup = useMemo(() => {
    const map = new Map<string, { total: number; upheldRate: number }>();
    for (const row of yearProductOutcome) {
      map.set(`${row.year}::${row.product}`, {
        total: row.total,
        upheldRate: row.upheldRate,
      });
    }
    return map;
  }, [yearProductOutcome]);

  /* ---- product upheld-rate leaderboard ---- */
  const leaderboard = useMemo(() => {
    const grouped = new Map<string, { product: string; total: number; upheld: number }>();
    for (const row of yearProductOutcome) {
      const existing = grouped.get(row.product) || { product: row.product, total: 0, upheld: 0 };
      existing.total += row.total;
      existing.upheld += row.upheld;
      grouped.set(row.product, existing);
    }
    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        upheldRate: item.total ? (item.upheld / item.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total || a.product.localeCompare(b.product))
      .slice(0, 8);
  }, [yearProductOutcome]);

  if (years.length === 0 || products.length === 0) {
    return <EmptyState label="No heatmap data under current filters." />;
  }

  return (
    <div className="space-y-6">
      {/* ---- heatmap table ---- */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px] text-xs uppercase tracking-wider">Year</TableHead>
              {products.map((product) => (
                <TableHead key={product} className="text-center">
                  <button
                    onClick={() => onToggleProduct(product)}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[11px] transition',
                      activeProducts.includes(product)
                        ? 'border-blue-300 bg-blue-100 text-blue-800'
                        : 'border-slate-200 text-slate-600 hover:border-blue-200'
                    )}
                  >
                    {truncate(product, 18)}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((year) => (
              <TableRow key={year}>
                <TableCell>
                  <button
                    onClick={() => onToggleYear(year)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                      activeYears.includes(year)
                        ? 'border-teal-300 bg-teal-100 text-teal-800'
                        : 'border-slate-200 text-slate-700 hover:border-teal-200'
                    )}
                  >
                    {year}
                  </button>
                </TableCell>
                {products.map((product) => {
                  const cell = lookup.get(`${year}::${product}`);
                  const intensity = cell
                    ? clamp(Math.round((cell.upheldRate / 100) * 100), 0, 100)
                    : 0;
                  return (
                    <TableCell key={`${year}::${product}`} className="text-center">
                      <button
                        onClick={() => {
                          onToggleYear(year);
                          onToggleProduct(product);
                        }}
                        className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-blue-300"
                        style={{
                          backgroundColor: cell
                            ? `rgba(14,165,233,${Math.max(0.12, intensity / 140)})`
                            : undefined,
                        }}
                      >
                        {cell ? formatPercent(cell.upheldRate) : '--'}
                      </button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ---- product upheld-rate leaderboard ---- */}
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
          Product upheld-rate leaderboard
        </p>
        <div className="mt-2 space-y-2">
          {leaderboard.map((item) => {
            const width = clamp(Math.round((item.upheldRate / 100) * 100), 0, 100);
            return (
              <button
                key={item.product}
                onClick={() => onToggleProduct(item.product)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition',
                  activeProducts.includes(item.product)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="line-clamp-1 text-xs font-medium text-slate-800">
                    {item.product}
                  </span>
                  <span className="text-xs text-slate-600">
                    {formatPercent(item.upheldRate)} | {formatNumber(item.total)} cases
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </button>
            );
          })}
          {leaderboard.length === 0 && (
            <EmptyState label="No product leaderboard under this scope." />
          )}
        </div>
      </div>
    </div>
  );
}
