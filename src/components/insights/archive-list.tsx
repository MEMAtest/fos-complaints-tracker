'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { InsightArchiveItem } from '@/lib/insights/types';
import { formatDate, formatNumber, formatPercent } from '@/lib/utils';

export function InsightArchiveList({
  title,
  description,
  items,
  placeholder,
}: {
  title: string;
  description: string;
  items: InsightArchiveItem[];
  placeholder: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.highlight}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [items, query]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <section className="grid gap-5 rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:grid-cols-[1.35fr_0.85fr] md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-700">Public archive</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{description}</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-4">
          <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Search archive</label>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">{formatNumber(filtered.length)} pages currently match the current filter.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-[1.6rem] border border-slate-200 bg-white/92 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">{item.highlight}</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 transition group-hover:text-sky-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Decisions</p>
                <p className="mt-1 font-semibold text-slate-900">{formatNumber(item.totalCases)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Upheld</p>
                <p className="mt-1 font-semibold text-slate-900">{item.upheldRate == null ? 'n/a' : formatPercent(item.upheldRate)}</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              {item.latestDecisionDate ? `Latest published decision ${formatDate(item.latestDecisionDate)}` : 'Latest decision date unavailable'}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
