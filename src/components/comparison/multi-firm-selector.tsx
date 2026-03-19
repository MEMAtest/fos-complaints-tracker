'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FIRM_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];
const MAX_FIRMS = 5;

export interface FirmSearchResult {
  firm: string;
  totalCases: number;
  latestDecisionDate: string | null;
}

interface MultiFirmSelectorProps {
  results: FirmSearchResult[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedFirms: string[];
  onSelectedFirmsChange: (firms: string[]) => void;
  loading?: boolean;
}

export function MultiFirmSelector({
  results,
  searchQuery,
  onSearchQueryChange,
  selectedFirms,
  onSelectedFirmsChange,
  loading,
}: MultiFirmSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    inputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function addFirm(firm: string) {
    if (selectedFirms.length >= MAX_FIRMS || selectedFirms.includes(firm)) return;
    onSelectedFirmsChange([...selectedFirms, firm]);
    onSearchQueryChange('');
    setDropdownOpen(false);
  }

  function removeFirm(firm: string) {
    onSelectedFirmsChange(selectedFirms.filter((value) => value !== firm));
  }

  const availableResults = results.filter((result) => !selectedFirms.includes(result.firm));

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Select firms to compare ({selectedFirms.length}/{MAX_FIRMS})
        </label>
        <p className="text-xs text-slate-500">Search the full firm index, then compare up to five firms.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selectedFirms.map((firm, index) => (
          <span
            key={firm}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: FIRM_COLORS[index % FIRM_COLORS.length] }}
          >
            {firm}
            <button onClick={() => removeFirm(firm)} className="rounded-full p-0.5 transition hover:bg-white/20" aria-label={`Remove ${firm}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {selectedFirms.length < MAX_FIRMS && (
          <button
            onClick={() => setDropdownOpen(true)}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs font-semibold transition',
              loading ? 'border-slate-200 text-slate-300' : 'border-slate-400 text-slate-600 hover:border-blue-400 hover:text-blue-600'
            )}
          >
            <Plus className="h-3 w-3" />
            Add firm
          </button>
        )}
      </div>

      {dropdownOpen ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(28rem,92vw)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search firms across the full dataset"
              className="w-full border-0 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-100">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Searching firms…</div>
            ) : availableResults.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">No matching firms found.</div>
            ) : (
              availableResults.map((result) => (
                <button
                  key={result.firm}
                  onClick={() => addFirm(result.firm)}
                  className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{result.firm}</p>
                    <p className="text-xs text-slate-500">
                      {result.totalCases.toLocaleString('en-GB')} cases
                      {result.latestDecisionDate ? ` · latest decision ${result.latestDecisionDate}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">Select</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
