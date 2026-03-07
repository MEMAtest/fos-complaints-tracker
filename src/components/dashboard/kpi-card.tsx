'use client';

import { ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiCardProps {
  label: string;
  value: string | null;
  helper: string;
  accent: string;
  borderColor?: string;
  trendDirection?: 'up' | 'down';
  sparklineData?: { value: number }[];
  onClick?: () => void;
  loading?: boolean;
}

export function KpiCard({ label, value, helper, accent, borderColor, trendDirection, sparklineData, onClick, loading }: KpiCardProps) {
  const content = (
    <article
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
        onClick ? 'cursor-pointer transition hover:border-blue-300 hover:shadow-md' : ''
      }`}
      style={borderColor ? { borderTopColor: borderColor, borderTopWidth: '3px' } : undefined}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{value ?? '--'}</p>
            {trendDirection && (
              <span className={`flex items-center ${trendDirection === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trendDirection === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </span>
            )}
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="h-8 w-20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#06b6d4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">{loading ? '' : helper}</p>
    </article>
  );

  if (!onClick) return content;
  return (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}
