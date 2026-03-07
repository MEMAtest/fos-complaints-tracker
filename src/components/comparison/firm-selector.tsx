'use client';

interface FirmSelectorProps {
  label: string;
  value: string;
  firms: string[];
  onSelect: (firm: string) => void;
}

export function FirmSelector({ label, value, firms, onSelect }: FirmSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onSelect(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Select a firm...</option>
        {firms.map((firm) => (
          <option key={firm} value={firm}>
            {firm}
          </option>
        ))}
      </select>
    </div>
  );
}
