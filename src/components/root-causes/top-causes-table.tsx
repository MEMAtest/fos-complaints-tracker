'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber, cn } from '@/lib/utils';
import type { FOSRootCauseTrend } from '@/lib/fos/types';

interface TopCausesTableProps {
  rootCauses: FOSRootCauseTrend[];
  onToggleTag?: (tag: string) => void;
  activeTags?: string[];
}

const MAX_ROWS = 12;

export function TopCausesTable({ rootCauses, onToggleTag, activeTags = [] }: TopCausesTableProps) {
  if (!rootCauses.length) {
    return <EmptyState label="No root cause trend data available." />;
  }

  const topCauses = rootCauses.slice(0, MAX_ROWS);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">Cause</TableHead>
          <TableHead className="text-right">Root Causes</TableHead>
          <TableHead className="w-[80px] text-right">Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {topCauses.map((cause, index) => {
          const sparkData = cause.trend
            .slice()
            .sort((a, b) => a.year - b.year)
            .map((t) => ({ value: t.count }));

          const isActive = activeTags.includes(cause.label);

          return (
            <TableRow
              key={`${cause.label}-${index}`}
              onClick={() => onToggleTag?.(cause.label)}
              className={cn(
                onToggleTag && 'cursor-pointer transition-colors hover:bg-slate-50',
                isActive && 'bg-blue-50 hover:bg-blue-100'
              )}
            >
              <TableCell className="max-w-[200px] truncate text-sm font-medium text-slate-800">
                {cause.label}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums text-slate-700">
                {formatNumber(cause.count)}
              </TableCell>
              <TableCell className="text-right">
                {sparkData.length > 1 ? (
                  <div className="ml-auto h-[24px] w-[60px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">--</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
