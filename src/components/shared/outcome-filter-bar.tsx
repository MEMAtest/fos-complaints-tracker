'use client';

import { cn } from '@/lib/utils';
import { FOSOutcome } from '@/lib/fos/types';

interface OutcomeFilterBarProps {
  activeOutcomes: FOSOutcome[];
  onToggleOutcome: (outcome: FOSOutcome) => void;
}

const OUTCOME_OPTIONS: { value: FOSOutcome; label: string; activeClass: string }[] = [
  { value: 'upheld', label: 'Upheld', activeClass: 'border-rose-300 bg-rose-100 text-rose-800' },
  { value: 'not_upheld', label: 'Not Upheld', activeClass: 'border-emerald-300 bg-emerald-100 text-emerald-800' },
  { value: 'partially_upheld', label: 'Partially Upheld', activeClass: 'border-amber-300 bg-amber-100 text-amber-800' },
  { value: 'settled', label: 'Settled', activeClass: 'border-blue-300 bg-blue-100 text-blue-800' },
];

export function OutcomeFilterBar({ activeOutcomes, onToggleOutcome }: OutcomeFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Outcome:</span>
      {OUTCOME_OPTIONS.map(({ value, label, activeClass }) => (
        <button
          key={value}
          onClick={() => onToggleOutcome(value)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold transition',
            activeOutcomes.includes(value)
              ? activeClass
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
