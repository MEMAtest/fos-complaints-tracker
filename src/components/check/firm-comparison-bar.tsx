'use client';

interface FirmComparisonBarProps {
  firmName: string;
  firmRate: number;
  productRate: number;
  overallRate: number;
  sourceScope?: 'product_root_cause' | 'product_only';
}

export function FirmComparisonBar({ firmName, firmRate, productRate, overallRate, sourceScope = 'product_only' }: FirmComparisonBarProps) {
  const bars: { label: string; rate: number; color: string; helper: string }[] = [
    {
      label: firmName,
      rate: firmRate,
      color: '#2563eb',
      helper:
        sourceScope === 'product_root_cause'
          ? 'Firm-specific rate in the selected product and root-cause slice'
          : 'Firm-specific rate in the wider product slice',
    },
    { label: 'Selected product', rate: productRate, color: '#7c3aed', helper: 'Comparable product context across all firms' },
    { label: 'FOS overall average', rate: overallRate, color: '#f59e0b', helper: 'Published corpus-wide context' },
  ];

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Firm vs sector comparison</p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">How the named firm compares with the wider context</h3>
      <div className="mt-5 space-y-4">
        {bars.map((bar) => (
          <div key={bar.label} className="rounded-[1.35rem] border border-slate-200 bg-[#fbfcfe] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{bar.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{bar.helper}</p>
              </div>
              <span className="text-lg font-semibold tracking-tight text-slate-950">{bar.rate.toFixed(1)}%</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
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
