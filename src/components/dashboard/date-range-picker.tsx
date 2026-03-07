'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CalendarDays, X } from 'lucide-react';

interface DateRangePickerProps {
  activeYears: number[];
  onYearsChange: (years: number[]) => void;
}

export function DateRangePicker({ activeYears, onYearsChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Derive display label from activeYears
  const label = useMemo(() => {
    if (activeYears.length === 0) return 'All years';
    const sorted = [...activeYears].sort((a, b) => a - b);
    if (sorted.length === 1) return String(sorted[0]);
    return `${sorted[0]} \u2013 ${sorted[sorted.length - 1]}`;
  }, [activeYears]);

  const deriveYears = useCallback((start: string, end: string): number[] => {
    if (!start || !end) return [];
    const startYear = new Date(start).getFullYear();
    const endYear = new Date(end).getFullYear();
    if (startYear > endYear) return [];
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, []);

  const handleApply = () => {
    const years = deriveYears(startDate, endDate);
    onYearsChange(years);
    setOpen(false);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onYearsChange([]);
    setOpen(false);
  };

  const canApply = startDate && endDate && new Date(startDate) <= new Date(endDate);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      >
        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
        {label}
        {activeYears.length > 0 && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">
            Date range
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">End date</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]"
              />
            </div>

            {canApply && (
              <p className="text-xs text-slate-500">
                Years included:{' '}
                <span className="font-medium text-slate-700">
                  {deriveYears(startDate, endDate).join(', ')}
                </span>
              </p>
            )}

            {startDate && endDate && new Date(startDate) > new Date(endDate) && (
              <p className="text-xs text-red-500">Start date must be before end date</p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleApply}
              disabled={!canApply}
              className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply
            </button>
            <button
              onClick={handleClear}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
