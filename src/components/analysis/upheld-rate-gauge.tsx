'use client';

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatPercent } from '@/lib/utils';

interface UpheldRateGaugeProps {
  upheldRate: number;
  target?: number;
  label?: string;
  color?: string;
}

export function UpheldRateGauge({ upheldRate, target = 50, label = 'Upheld rate', color }: UpheldRateGaugeProps) {
  const clamped = Math.min(Math.max(upheldRate, 0), 100);
  const remaining = 100 - clamped;

  const data = [
    { name: 'Upheld', value: clamped },
    { name: 'Remaining', value: remaining },
  ];

  /* ---- determine color based on target proximity ---- */
  const isAboveTarget = clamped >= target;
  const fillColor = color || (isAboveTarget ? '#06b6d4' : '#f59e0b');

  return (
    <div className="relative h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={70}
            outerRadius={100}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={fillColor} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* ---- center label ---- */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ top: '-10%' }}>
        <div className="text-center">
          <p className="text-3xl font-semibold tracking-tight text-slate-900">
            {formatPercent(clamped)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {label} {target !== 50 ? `(target ${formatPercent(target)})` : ''}
          </p>
        </div>
      </div>

      {/* ---- target marker tick ---- */}
      {target > 0 && target < 100 && (
        <div
          className="absolute bottom-[15%] left-1/2 h-[4px] w-[2px] -translate-x-1/2 bg-slate-900"
          style={{
            transform: `rotate(${180 - (target / 100) * 180}deg)`,
            transformOrigin: 'center 0',
          }}
        />
      )}
    </div>
  );
}
