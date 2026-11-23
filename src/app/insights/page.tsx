import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PublicStatusBanner } from '@/components/public/public-status-banner';
import { DecisionVolumeChart } from '@/components/insights/decision-volume-visual';
import { CollectionBrowser } from '@/components/insights/collection-browser';
import { getInsightsLandingData } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'FOS Insights | Public Ombudsman Complaint Analysis',
  description: 'Public SEO-friendly Financial Ombudsman complaint analysis by year, firm, product, complaint theme, and curated cross-sections.',
  alternates: { canonical: absoluteUrl('/insights') },
  openGraph: {
    title: 'FOS Insights',
    description: 'Public SEO-friendly Financial Ombudsman complaint analysis by year, firm, product, complaint theme, and curated cross-sections.',
    url: absoluteUrl('/insights'),
    type: 'website',
  },
};

export default async function InsightsHomePage() {
  const landing = await getInsightsLandingData();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-8 md:py-7">
      <PublicStatusBanner status={landing.status} />
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50 p-4 shadow-sm sm:p-6">
        <div className="grid items-start gap-4 lg:grid-cols-[0.85fr_1.15fr] lg:gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-700">{landing.hero.eyebrow}</p>
            <h1 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {landing.hero.title}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{landing.hero.dek}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="#browse-evidence" className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800">
                Browse collections
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/comparison" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-violet-300">
                Compare firms
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {landing.metrics.map((metric) => (
                <article key={metric.label} className="rounded-lg border border-violet-100 bg-white px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-600">{metric.label}</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-950">{metric.value}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <DecisionVolumeChart
              items={landing.yearTrend}
              latestDecisionDate={landing.lastUpdated}
            />
          </div>
        </div>
      </section>

      <CollectionBrowser collections={landing.collections} yearTrend={landing.yearTrend} themeRanking={landing.themeRanking} />
    </div>
  );
}
