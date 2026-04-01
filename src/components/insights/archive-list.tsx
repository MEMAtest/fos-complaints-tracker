'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PublicIllustration } from '@/components/illustrations/public-illustration';
import type { InsightArchiveItem } from '@/lib/insights/types';
import { formatDate, formatNumber, formatPercent } from '@/lib/utils';

const ILLUSTRATION_BY_VARIANT = {
  years: 'insight',
  firms: 'firm',
  products: 'archive',
  types: 'workflow',
  'year-products': 'reporting',
  'firm-products': 'firm',
} as const;

export function InsightArchiveList({
  title,
  description,
  items,
  placeholder,
  variant,
}: {
  title: string;
  description: string;
  items: InsightArchiveItem[];
  placeholder: string;
  variant: keyof typeof ILLUSTRATION_BY_VARIANT;
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
      <section className="overflow-hidden rounded-[2.2rem] border border-slate-200/70 bg-[linear-gradient(140deg,#fffdf7_0%,#f5f8ff_52%,#edf3ff_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="grid gap-5 p-6 md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-700">Public archive</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{description}</p>
            <div className="mt-6 max-w-sm">
              <PublicIllustration variant={ILLUSTRATION_BY_VARIANT[variant]} className="border-0 shadow-none" />
            </div>
          </div>
          <div className="grid gap-4 content-start">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <label className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Search archive</label>
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-3 shadow-sm">
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
            <div className="rounded-[1.75rem] border border-[#102a4e] bg-[#102a4e] p-5 text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Archive signal</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{formatNumber(items.length)} pages</p>
              <p className="mt-2 text-sm leading-6 text-white/72">Browse live analysis pages with structured metrics, ranked views, and representative decisions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={index % 3 === 0
              ? 'group rounded-[1.7rem] border border-sky-200 bg-[linear-gradient(180deg,#f3f9ff_0%,#ffffff_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)]'
              : index % 3 === 1
                ? 'group rounded-[1.7rem] border border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)]'
                : 'group rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.10)]'}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">{item.highlight}</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 transition group-hover:text-sky-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-[1.3rem] border border-slate-200 bg-white/92 p-3 text-sm shadow-sm">
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
