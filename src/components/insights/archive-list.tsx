'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PublicStatusBanner } from '@/components/public/public-status-banner';
import { DecisionVolumeTable } from '@/components/insights/decision-volume-visual';
import type { InsightArchiveItem, PublicDataStatus } from '@/lib/insights/types';
import { formatNumber } from '@/lib/utils';

const archiveLabels = {
  years: 'years',
  firms: 'firms',
  products: 'products',
  types: 'themes',
  'year-products': 'year and product analyses',
  'firm-products': 'firm and product analyses',
};

export function InsightArchiveList({ title, description, items, status, placeholder, variant }: {
  title: string;
  description: string;
  items: InsightArchiveItem[];
  status?: PublicDataStatus;
  placeholder: string;
  variant: keyof typeof archiveLabels;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? items.filter((item) => `${item.title} ${item.summary} ${item.highlight}`.toLowerCase().includes(normalized))
      : items;
  }, [items, query]);

  const collection = archiveLabels[variant];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-8 md:py-7">
      <PublicStatusBanner status={status || { mode: 'live', message: null }} />
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50 p-4 shadow-sm sm:p-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-64 sm:max-w-lg">
            <label htmlFor="archive-search" className="mb-1 block text-sm font-semibold text-slate-800">Search {collection}</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input id="archive-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder}
                className="min-h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-violet-700" />
            </div>
          </div>
          <p role="status" className="py-2 text-sm text-slate-600">{formatNumber(filtered.length)} {collection}{query.trim() ? ' match' : ' available'}</p>
        </div>
      </section>
      <section aria-label={`Published ${collection}`}>
        <DecisionVolumeTable items={filtered} collection={collection} pageSize={12} />
        {variant === 'types' && (
          <p className="mt-2 text-xs leading-5 text-slate-600">Source: published Financial Ombudsman Service decisions. Themes overlap and each published theme requires at least 100 tagged decisions.</p>
        )}
      </section>
    </div>
  );
}
