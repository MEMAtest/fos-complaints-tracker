'use client';

interface ConfidenceBadgeProps {
  sampleSize: number;
}

type ConfidenceLevel = 'very_low' | 'low' | 'moderate' | 'high';

const LEVELS: { min: number; level: ConfidenceLevel; label: string; className: string }[] = [
  { min: 200, level: 'high', label: 'High confidence', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { min: 50, level: 'moderate', label: 'Moderate confidence', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  { min: 10, level: 'low', label: 'Low confidence', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  { min: 0, level: 'very_low', label: 'Very low confidence', className: 'bg-slate-50 text-slate-600 border-slate-200' },
];

export function ConfidenceBadge({ sampleSize }: ConfidenceBadgeProps) {
  const conf = LEVELS.find((l) => sampleSize >= l.min) || LEVELS[LEVELS.length - 1];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${conf.className}`}>
      <span className="tabular-nums">{sampleSize.toLocaleString()}</span> decisions
      <span className="text-[10px] opacity-70">&middot;</span>
      {conf.label}
    </span>
  );
}
