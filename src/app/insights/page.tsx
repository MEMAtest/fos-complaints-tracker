import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { getInsightsLandingData } from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export const metadata: Metadata = {
  title: 'FOS Insights | Public Ombudsman Complaint Analysis',
  description: 'Public SEO-friendly Financial Ombudsman complaint analysis by year, firm, product, and complaint theme.',
  alternates: { canonical: absoluteUrl('/insights') },
  openGraph: {
    title: 'FOS Insights',
    description: 'Public SEO-friendly Financial Ombudsman complaint analysis by year, firm, product, and complaint theme.',
    url: absoluteUrl('/insights'),
    type: 'website',
  },
};

export default async function InsightsHomePage() {
  const landing = await getInsightsLandingData();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <section className="overflow-hidden rounded-[2.3rem] border border-slate-200/70 bg-[linear-gradient(140deg,#ffffff_0%,#f4f8ff_42%,#e5f2ff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
        <div className="grid gap-8 p-6 md:grid-cols-[1.25fr_0.75fr] md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-700">{landing.hero.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">{landing.hero.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{landing.hero.dek}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/insights/years" className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c1940]">
                Browse annual analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/comparison" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-sky-300 hover:text-sky-900">
                Open the comparison workspace
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            {landing.metrics.map((metric) => (
              <article key={metric.label} className="rounded-[1.6rem] border border-slate-200 bg-white/85 p-5 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                {metric.helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {landing.featured.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-[1.7rem] border border-slate-200 bg-white/92 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Featured page</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-5">
        {landing.collections.map((collection) => (
          <article key={collection.href} className="rounded-[1.9rem] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Collection</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{collection.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{collection.description}</p>
              </div>
              <Link href={collection.href} className="text-sm font-semibold text-sky-700 hover:text-sky-900">
                Open archive
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {collection.items.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 transition hover:border-sky-200 hover:bg-sky-50/70">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700">{item.highlight}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
