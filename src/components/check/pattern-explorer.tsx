'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { FOSAdvisorThemeExtract } from '@/lib/fos/types';
import { cn } from '@/lib/utils';

type PatternSide = 'wins' | 'loses';

function splitSynthesis(value: string | null): string[] {
  if (!value) return [];
  const decimalSafe = value.replace(/(\d)\.(\d)/g, '$1__DECIMAL__$2');
  return (decimalSafe.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [decimalSafe])
    .map((sentence) => sentence.replace(/__DECIMAL__/g, '.').trim())
    .filter((sentence) => sentence.length > 24);
}

function buildPatterns(themes: FOSAdvisorThemeExtract[], synthesis: string | null): string[] {
  const candidates = [...themes.map((theme) => theme.theme), ...splitSynthesis(synthesis)];
  return candidates.filter((candidate, index) => {
    const normalized = candidate.toLowerCase().replace(/\W+/g, ' ').trim();
    return candidates.findIndex((other) => other.toLowerCase().replace(/\W+/g, ' ').trim() === normalized) === index;
  });
}

export function PatternExplorer({
  wins,
  loses,
  winsSynthesis,
  losesSynthesis,
}: {
  wins: FOSAdvisorThemeExtract[];
  loses: FOSAdvisorThemeExtract[];
  winsSynthesis: string | null;
  losesSynthesis: string | null;
}) {
  const [active, setActive] = useState<PatternSide>(wins.length > 0 || winsSynthesis ? 'wins' : 'loses');
  const patterns = useMemo(
    () => ({
      wins: buildPatterns(wins, winsSynthesis),
      loses: buildPatterns(loses, losesSynthesis),
    }),
    [loses, losesSynthesis, wins, winsSynthesis]
  );

  const isWin = active === 'wins';
  const activePatterns = patterns[active];
  const fullSynthesis = isWin ? winsSynthesis : losesSynthesis;
  const Icon = isWin ? CheckCircle2 : AlertTriangle;

  return (
    <section className="overflow-hidden rounded-[1.9rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-5 md:flex md:items-end md:justify-between md:gap-6 md:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Decision patterns</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">What strengthens or weakens a complaint</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Switch views to scan the strongest themes. Open the full synthesis only when you need the detail.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-[1rem] bg-slate-100 p-1 md:mt-0 md:min-w-[340px]" role="tablist" aria-label="Decision pattern view">
          <button
            type="button"
            role="tab"
            aria-selected={isWin}
            onClick={() => setActive('wins')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              isWin ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/70'
            )}
          >
            <ThumbsUp className="h-4 w-4" />
            Strengthens
            <span className={cn('rounded-full px-2 py-0.5 text-xs', isWin ? 'bg-white/16' : 'bg-white')}>{patterns.wins.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isWin}
            onClick={() => setActive('loses')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
              !isWin ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white/70'
            )}
          >
            <ThumbsDown className="h-4 w-4" />
            Weakens
            <span className={cn('rounded-full px-2 py-0.5 text-xs', !isWin ? 'bg-white/16' : 'bg-white')}>{patterns.loses.length}</span>
          </button>
        </div>
      </div>

      <div className={cn('p-5 md:p-6', isWin ? 'bg-emerald-50/55' : 'bg-rose-50/55')} role="tabpanel">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activePatterns.slice(0, 6).map((pattern, index) => (
            <article key={`${active}-${pattern}`} className="flex gap-3 rounded-[1.2rem] border border-white/80 bg-white p-4 shadow-sm">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', isWin ? 'text-emerald-700' : 'text-rose-700')}>Pattern {index + 1}</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{pattern}</p>
              </div>
            </article>
          ))}
        </div>

        {fullSynthesis ? (
          <details className="group mt-4 rounded-[1.2rem] border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
              Read the full analysis
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-200 px-4 py-4 text-sm leading-7 text-slate-700">{fullSynthesis}</div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
