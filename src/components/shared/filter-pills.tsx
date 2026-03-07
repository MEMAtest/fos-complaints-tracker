import { X } from 'lucide-react';

export function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-400"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}
