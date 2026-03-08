'use client';

import { cn } from '@/lib/utils';

interface YearFilterBarProps {
  availableYears: number[];
  activeYears: number[];
  onToggleYear: (year: number) => void;
  onSelectAll: (years: number[]) => void;
  onClearYears: () => void;
  accentColor?: 'blue' | 'teal' | 'purple';
}

const ACCENT_STYLES = {
  blue: {
    active: 'border-blue-300 bg-blue-100 text-blue-800',
    hover: 'hover:border-blue-200',
  },
  teal: {
    active: 'border-teal-300 bg-teal-100 text-teal-800',
    hover: 'hover:border-teal-200',
  },
  purple: {
    active: 'border-purple-300 bg-purple-100 text-purple-800',
    hover: 'hover:border-purple-200',
  },
} as const;

export function YearFilterBar({
  availableYears,
  activeYears,
  onToggleYear,
  onSelectAll,
  onClearYears,
  accentColor = 'blue',
}: YearFilterBarProps) {
  if (availableYears.length === 0) return null;

  const accent = ACCENT_STYLES[accentColor];
  const allSelected = activeYears.length === availableYears.length && availableYears.length > 0;
  const noneSelected = activeYears.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => {
          if (noneSelected || !allSelected) {
            onSelectAll(availableYears);
          } else {
            onClearYears();
          }
        }}
        className={cn(
          'rounded-full border px-3 py-1 text-xs font-semibold transition',
          allSelected
            ? accent.active
            : 'border-slate-300 bg-white text-slate-700',
          accent.hover
        )}
      >
        All
      </button>
      {availableYears.map((year) => (
        <button
          key={year}
          onClick={() => onToggleYear(year)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-semibold transition',
            activeYears.includes(year)
              ? accent.active
              : 'border-slate-300 bg-white text-slate-700',
            accent.hover
          )}
        >
          {year}
        </button>
      ))}
    </div>
  );
}
