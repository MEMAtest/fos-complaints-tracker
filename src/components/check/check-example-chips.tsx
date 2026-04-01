'use client';

import { cn } from '@/lib/utils';

export type CheckExampleChip = {
  label: string;
  helper: string;
  product: string;
  rootCause?: string;
  firm?: string;
};

export function CheckExampleChips({
  chips,
  activeLabel,
  onSelect,
}: {
  chips: CheckExampleChip[];
  activeLabel?: string | null;
  onSelect: (chip: CheckExampleChip) => void;
}) {
  if (!chips.length) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Try a live example</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((chip, index) => {
          const active = chip.label === activeLabel;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onSelect(chip)}
              className={cn(
                'rounded-full border px-4 py-2 text-left text-sm transition',
                active
                  ? 'border-[#102a4e] bg-[#102a4e] text-white shadow-[0_14px_30px_rgba(16,42,78,0.22)]'
                  : index % 3 === 0
                    ? 'border-sky-200 bg-sky-50 text-slate-900 hover:border-sky-300'
                    : index % 3 === 1
                      ? 'border-amber-200 bg-amber-50 text-slate-900 hover:border-amber-300'
                      : 'border-violet-200 bg-violet-50 text-slate-900 hover:border-violet-300'
              )}
            >
              <span className="block font-semibold leading-5">{chip.label}</span>
              <span className={cn('mt-1 block text-xs leading-5', active ? 'text-white/75' : 'text-slate-500')}>
                {chip.helper}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
