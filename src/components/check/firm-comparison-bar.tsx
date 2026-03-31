'use client';

interface FirmComparisonBarProps {
  firmName: string;
  firmRate: number;
  productRate: number;
  overallRate: number;
}

export function FirmComparisonBar({ firmName, firmRate, productRate, overallRate }: FirmComparisonBarProps) {
  const bars: { label: string; rate: number; color: string }[] = [
    { label: firmName, rate: firmRate, color: '#6366f1' },
    { label: 'This product (all firms)', rate: productRate, color: '#f43f5e' },
    { label: 'FOS overall average', rate: overallRate, color: '#94a3b8' },
  ];

  return (
    <div>
      <p className="mb-3 text-xs font-medium text-slate-500">Firm vs sector comparison</p>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700">{bar.label}</span>
              <span className="font-semibold text-slate-900">{bar.rate.toFixed(1)}%</span>
            </div>
            <div className="mt-1 h-2.5 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(bar.rate, 100)}%`, backgroundColor: bar.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
