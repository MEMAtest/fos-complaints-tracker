'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FIRM_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];
const MAX_FIRMS = 5;

interface MultiFirmSelectorProps {
  firms: string[];
  selectedFirms: string[];
  onSelectedFirmsChange: (firms: string[]) => void;
  loading?: boolean;
}

function FirmDropdown({
  firms,
  selectedFirms,
  onSelect,
  onClose,
}: {
  firms: string[];
  selectedFirms: string[];
  onSelect: (firm: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const available = firms.filter(
    (f) => !selectedFirms.includes(f) && f.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={dropdownRef} className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 p-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search firms..."
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {available.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">No matching firms</p>
        ) : (
          available.slice(0, 30).map((firm) => (
            <button
              key={firm}
              onClick={() => {
                onSelect(firm);
                onClose();
              }}
              className="w-full rounded px-3 py-1.5 text-left text-sm text-slate-800 transition hover:bg-blue-50"
            >
              {firm}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function MultiFirmSelector({ firms, selectedFirms, onSelectedFirmsChange, loading }: MultiFirmSelectorProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const addFirm = useCallback(
    (firm: string) => {
      if (selectedFirms.length < MAX_FIRMS && !selectedFirms.includes(firm)) {
        onSelectedFirmsChange([...selectedFirms, firm]);
      }
    },
    [selectedFirms, onSelectedFirmsChange]
  );

  const removeFirm = useCallback(
    (firm: string) => {
      onSelectedFirmsChange(selectedFirms.filter((f) => f !== firm));
    },
    [selectedFirms, onSelectedFirmsChange]
  );

  return (
    <div className="relative">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Select firms to compare ({selectedFirms.length}/{MAX_FIRMS})
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {selectedFirms.map((firm, i) => (
          <span
            key={firm}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: FIRM_COLORS[i % FIRM_COLORS.length] }}
          >
            {firm}
            <button
              onClick={() => removeFirm(firm)}
              className="rounded-full p-0.5 transition hover:bg-white/20"
              aria-label={`Remove ${firm}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {selectedFirms.length < MAX_FIRMS && (
          <button
            onClick={() => setDropdownOpen(true)}
            disabled={loading || firms.length === 0}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs font-semibold transition',
              loading || firms.length === 0
                ? 'border-slate-200 text-slate-300'
                : 'border-slate-400 text-slate-600 hover:border-blue-400 hover:text-blue-600'
            )}
          >
            <Plus className="h-3 w-3" />
            Add firm
          </button>
        )}
      </div>

      {dropdownOpen && (
        <FirmDropdown
          firms={firms}
          selectedFirms={selectedFirms}
          onSelect={addFirm}
          onClose={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
