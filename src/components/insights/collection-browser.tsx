'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DecisionVolumeTable } from '@/components/insights/decision-volume-visual';
import type { InsightLandingData } from '@/lib/insights/types';

const collectionLabels: Record<string, string> = {
  '/insights/years': 'Years',
  '/insights/firms': 'Firms',
  '/insights/products': 'Products',
  '/insights/types': 'Themes',
  '/insights/year-products': 'Year + Product',
  '/insights/firm-products': 'Firm + Product',
};

export function CollectionBrowser({ collections, yearTrend, themeRanking }: Pick<InsightLandingData, 'collections' | 'yearTrend' | 'themeRanking'>) {
  const [activeHref, setActiveHref] = useState('/insights/firms');
  const selected = collections.find(({ href }) => href === activeHref) ?? collections[0];
  if (!selected) return null;

  const items = selected.href === '/insights/types' ? themeRanking
    : selected.href === '/insights/years' ? yearTrend : selected.items;
  const label = collectionLabels[selected.href] ?? selected.title;

  return (
    <section id="browse-evidence" aria-labelledby="browse-evidence-title" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 id="browse-evidence-title" className="text-2xl font-semibold text-slate-950">Browse the evidence</h2>
      <p className="mt-1 text-sm text-slate-600">Choose a collection, sort the results, then open any row.</p>
      <div role="group" aria-label="Evidence collections" className="mt-3 flex flex-wrap gap-1.5">
        {collections.map(({ href, title }) => (
          <button
            key={href}
            type="button"
            aria-pressed={selected.href === href}
            onClick={() => setActiveHref(href)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected.href === href ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:text-violet-900'}`}
          >
            {collectionLabels[href] ?? title}
          </button>
        ))}
      </div>
      <div className="mb-2 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-semibold text-slate-950">{selected.title}</h3>
        <Link href={selected.href} className="inline-flex items-center gap-1.5 py-1 text-sm font-semibold text-violet-800 underline-offset-4 hover:underline">
          View {label.toLowerCase()} archive <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <DecisionVolumeTable key={selected.href} items={items} limit={6} collection={selected.href.endsWith('-products') ? 'cross-sections' : label.toLowerCase()} />
    </section>
  );
}
