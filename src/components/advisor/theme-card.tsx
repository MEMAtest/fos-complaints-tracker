'use client';

import { FOSAdvisorThemeExtract } from '@/lib/fos/types';

interface ThemeCardProps {
  title: string;
  aiNarrative: string | null;
  themes: FOSAdvisorThemeExtract[];
  variant: 'wins' | 'loses';
}

export function ThemeCard({ title, aiNarrative, themes, variant }: ThemeCardProps) {
  const isWins = variant === 'wins';
  const borderColor = isWins ? 'border-emerald-200' : 'border-rose-200';
  const headerBg = isWins ? 'bg-emerald-50' : 'bg-rose-50';
  const headerText = isWins ? 'text-emerald-800' : 'text-rose-800';
  const dotColor = isWins ? 'bg-emerald-400' : 'bg-rose-400';

  return (
    <div className={`rounded-2xl border ${borderColor} bg-white overflow-hidden`}>
      <div className={`${headerBg} px-4 py-3`}>
        <h3 className={`text-sm font-semibold ${headerText}`}>{title}</h3>
      </div>

      <div className="p-4">
        {/* AI narrative block */}
        {aiNarrative && (
          <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">AI Analysis</p>
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{aiNarrative}</div>
          </div>
        )}

        {/* Structured themes list */}
        {themes.length > 0 ? (
          <ul className="space-y-2">
            {themes.map((theme, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
                <span className="text-sm text-slate-700">{theme.theme}</span>
              </li>
            ))}
          </ul>
        ) : !aiNarrative ? (
          <p className="text-center text-sm text-slate-400">No theme data available.</p>
        ) : null}
      </div>
    </div>
  );
}
