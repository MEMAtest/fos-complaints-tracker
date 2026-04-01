'use client';

interface ConfidenceBadgeProps {
  sampleSize: number;
}

type ConfidenceLevel = 'very_low' | 'low' | 'moderate' | 'high';

const LEVELS: { min: number; level: ConfidenceLevel; label: string; className: string; helper: string }[] = [
  { min: 200, level: 'high', label: 'High confidence', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', helper: 'A broad enough sample to treat the pattern as relatively stable.' },
  { min: 50, level: 'moderate', label: 'Moderate confidence', className: 'border-sky-200 bg-sky-50 text-sky-800', helper: 'Useful directional signal, but not deep enough to lean on alone.' },
  { min: 10, level: 'low', label: 'Low confidence', className: 'border-amber-200 bg-amber-50 text-amber-800', helper: 'Thin published history. Treat the signal cautiously.' },
  { min: 0, level: 'very_low', label: 'Very low confidence', className: 'border-slate-200 bg-slate-50 text-slate-700', helper: 'Very limited comparable history.' },
];

export function ConfidenceBadge({ sampleSize }: ConfidenceBadgeProps) {
  const conf = LEVELS.find((l) => sampleSize >= l.min) || LEVELS[LEVELS.length - 1];

  return (
    <div className={`rounded-[1.5rem] border p-4 ${conf.className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Confidence</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-lg font-semibold">{conf.label}</p>
        <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-semibold shadow-sm">
          {sampleSize.toLocaleString()} decisions
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 opacity-90">{conf.helper}</p>
    </div>
  );
}
