'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { FOSOutcomeDistribution, FOSOutcome } from '@/lib/fos/types';
import { OUTCOME_LABELS, OUTCOME_COLORS } from '@/lib/fos/constants';
import { EmptyState } from '@/components/shared/empty-state';
import { formatNumber } from '@/lib/utils';

interface OutcomeDonutProps {
  outcomes: FOSOutcomeDistribution[];
  activeOutcome: FOSOutcome | null;
  onToggleOutcome: (outcome: FOSOutcome) => void;
}

export function OutcomeDonut({ outcomes, activeOutcome, onToggleOutcome }: OutcomeDonutProps) {
  if (outcomes.length === 0) {
    return <EmptyState label="No outcomes under current filters." />;
  }

  const total = outcomes.reduce((sum, o) => sum + o.count, 0);
  const data = outcomes.map((o) => ({
    name: OUTCOME_LABELS[o.outcome],
    value: o.count,
    outcome: o.outcome,
    fill: OUTCOME_COLORS[o.outcome],
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[200px] w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              onClick={(_d, index) => {
                if (typeof index === 'number' && data[index]) {
                  onToggleOutcome(data[index].outcome);
                }
              }}
              cursor="pointer"
            >
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.fill}
                  opacity={activeOutcome && activeOutcome !== entry.outcome ? 0.3 : 1}
                  stroke={activeOutcome === entry.outcome ? entry.fill : 'transparent'}
                  strokeWidth={activeOutcome === entry.outcome ? 3 : 0}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown) => formatNumber(Number(value))}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-900">{formatNumber(total)}</p>
            <p className="text-[10px] text-slate-500">Total</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
          return (
            <button
              key={entry.outcome}
              onClick={() => onToggleOutcome(entry.outcome)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                activeOutcome === entry.outcome ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-blue-200'
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
              {entry.name} ({pct}%)
            </button>
          );
        })}
      </div>
    </div>
  );
}
