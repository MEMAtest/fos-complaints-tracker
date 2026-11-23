'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { InsightArchiveItem } from '@/lib/insights/types';
import { formatDate, formatNumber, formatPercent } from '@/lib/utils';

function sortItems(items: InsightArchiveItem[], sort: 'volume' | 'upheld') {
  return [...items].sort((a, b) => {
    if (sort === 'upheld') {
      const upheldDiff = (b.upheldRate ?? -1) - (a.upheldRate ?? -1);
      if (upheldDiff !== 0) return upheldDiff;
    }
    return b.totalCases - a.totalCases || a.title.localeCompare(b.title);
  });
}

export function DecisionVolumeChart({ items, latestDecisionDate }: { items: InsightArchiveItem[]; latestDecisionDate: string | null }) {
  const years = useMemo(() => [...items].sort((a, b) => Number(a.entityKey) - Number(b.entityKey)), [items]);
  const [selectedHref, setSelectedHref] = useState<string | null>(null);
  const selected = years.find((item) => item.href === selectedHref) ?? years[years.length - 1];
  const maximum = Math.max(1, ...years.map((item) => item.totalCases));

  return (
    <section aria-labelledby="decision-volume-heading" className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800">Published FOS decisions</p>
          <h2 id="decision-volume-heading" className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Decision volume by year</h2>
        </div>
        {selected ? <p className="text-right text-sm text-slate-600"><strong className="text-slate-950">{selected.title}</strong><br />{formatNumber(selected.totalCases)} decisions</p> : null}
      </div>

      {years.length ? <>
        <div role="group" aria-label={`Published decision volume by year. Showing all ${years.length} qualifying annual analysis pages. Select a year, then open its analysis.`} className="mt-5">
          <div className="grid grid-cols-7 gap-x-1 gap-y-3 border-b border-slate-200 px-1 pb-3 xl:grid-cols-[repeat(14,minmax(0,1fr))]">
          {years.map((item) => {
            const active = selected?.href === item.href;
            const height = Math.max(8, (item.totalCases / maximum) * 92);
            return <button
              key={item.href}
              type="button"
              onClick={() => setSelectedHref(item.href)}
              aria-label={`${item.title}: ${formatNumber(item.totalCases)} published decisions${item.upheldRate == null ? '' : `, ${formatPercent(item.upheldRate)} upheld`}. Select this year to reveal its analysis link.`}
              aria-pressed={active}
              className="group flex h-32 w-full min-w-0 flex-col items-center justify-end gap-2 rounded-t-lg px-0.5 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"
            >
              <span className="sr-only">{formatNumber(item.totalCases)} decisions</span>
              <span aria-hidden="true" className="flex h-24 w-full items-end"><span className={`w-full max-w-12 rounded-t-md transition-colors ${active ? 'bg-[#0f1f4f]' : 'bg-sky-300 group-hover:bg-sky-500'}`} style={{ height: `${height}%` }} /></span>
              <span className={`text-[10px] leading-none xl:hidden ${active ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>{item.title.slice(-2)}</span>
              <span className={`hidden text-[10px] leading-none xl:inline ${active ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>{item.title}</span>
            </button>;
          })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>All qualifying year pages; each requires at least 100 decisions. The newest year may be partial.</span>
          {latestDecisionDate ? <span>Latest decision date in corpus: {formatDate(latestDecisionDate)}</span> : null}
        </div>
        {selected ? <Link href={selected.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-900 underline decoration-sky-300 underline-offset-4 hover:text-sky-700">
          Open {selected.title} analysis <span aria-hidden="true">→</span>
        </Link> : null}
        <Link href="/insights/years" className="ml-4 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-sky-800">View all years</Link>
      </> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Annual decision totals are unavailable while published year data is unavailable.</p>}
    </section>
  );
}

export function DecisionVolumeTable({ items, limit, pageSize, collection = 'themes' }: {
  items: InsightArchiveItem[];
  limit?: number;
  pageSize?: number;
  collection?: string;
}) {
  const [sort, setSort] = useState<'volume' | 'upheld'>('volume');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sorted = sortItems(items, sort).slice(0, limit ?? visibleCount);
  const sortLabel = sort === 'volume' ? 'decision volume' : 'upheld rate';
  const maxCases = Math.max(1, ...items.map((item) => item.totalCases));
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
      <p className="text-xs font-medium text-slate-600">{limit ? `Preview · ${sorted.length} ${collection} sorted by ${sortLabel}` : `Showing ${sorted.length} of ${items.length}`}</p>
      <div role="group" className="flex flex-wrap items-center gap-1" aria-label={`Sort ${collection}`}>
        <button type="button" onClick={() => setSort('volume')} aria-pressed={sort === 'volume'} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === 'volume' ? 'bg-[#0f1f4f] text-white' : 'text-slate-600 hover:bg-white'}`}>Most decisions</button>
        <button type="button" onClick={() => setSort('upheld')} aria-pressed={sort === 'upheld'} className={`rounded-full px-3 py-1.5 text-xs font-medium ${sort === 'upheld' ? 'bg-[#0f1f4f] text-white' : 'text-slate-600 hover:bg-white'}`}>Highest upheld</button>
      </div>
    </div>
    {sorted.length ? <div className="divide-y divide-slate-200">
      {sorted.map((item) => <Link key={item.href} href={item.href} className="group grid grid-cols-2 items-center gap-x-3 gap-y-1 px-3 py-2.5 outline-offset-[-2px] transition hover:bg-violet-50 focus-visible:bg-violet-50 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] sm:gap-x-4 sm:px-4">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <span className="break-words text-sm font-semibold text-slate-950 group-hover:text-violet-900 group-hover:underline">{item.title}</span>
          <div className="mt-1 h-1 max-w-80 overflow-hidden rounded-full bg-violet-100" aria-hidden="true"><div className="h-full rounded-full bg-violet-600" style={{ width: `${(item.totalCases / maxCases) * 100}%` }} /></div>
        </div>
        <span className="text-xs text-slate-600 sm:text-right"><strong className="mr-1 text-sm tabular-nums text-slate-950 sm:mr-0 sm:block">{formatNumber(item.totalCases)}</strong> decisions</span>
        <span className="text-right text-xs text-slate-600"><strong className="mr-1 text-sm tabular-nums text-slate-950 sm:mr-0 sm:block">{item.upheldRate == null ? 'n/a' : formatPercent(item.upheldRate)}</strong> upheld</span>
        <span className="hidden text-violet-700 sm:inline" aria-hidden="true">→</span>
      </Link>)}
    </div> : <p className="p-4 text-sm text-slate-600">No matching results.</p>}
    {pageSize && sorted.length < items.length ? (
      <div className="border-t border-slate-200 px-3 py-2">
        <button type="button" className="rounded-md px-2 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50" onClick={() => setVisibleCount(sorted.length + pageSize)}>
          Show {Math.min(pageSize, items.length - sorted.length)} more
        </button>
      </div>
    ) : null}
  </div>;
}
