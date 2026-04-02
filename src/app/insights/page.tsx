import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { PublicIllustration } from '@/components/illustrations/public-illustration';
import { PublicStatusBanner } from '@/components/public/public-status-banner';
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

const HERO_TONES = [
  'border-sky-200 bg-[linear-gradient(180deg,#f2f9ff_0%,#ffffff_100%)]',
  'border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)]',
  'border-violet-200 bg-[linear-gradient(180deg,#f7f2ff_0%,#ffffff_100%)]',
  'border-slate-200 bg-white',
] as const;

export default async function InsightsHomePage() {
  const landing = await getInsightsLandingData();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <PublicStatusBanner status={landing.status} />
      <section className="overflow-hidden rounded-[2.4rem] border border-slate-200/70 bg-[linear-gradient(140deg,#fffdf7_0%,#f4f8ff_50%,#ecf3ff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
        <div className="grid gap-8 p-6 md:grid-cols-[1.05fr_0.95fr] md:p-10 xl:grid-cols-[0.96fr_1.04fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-sky-700">{landing.hero.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[0.98]">
              {landing.hero.title}
            </h1>
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
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {landing.metrics.slice(0, 2).map((metric, index) => (
                <article key={metric.label} className={index === 0 ? 'rounded-[1.6rem] border border-sky-200 bg-white/92 p-5 shadow-sm' : 'rounded-[1.6rem] border border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)] p-5 shadow-sm'}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                  {metric.helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p> : null}
                </article>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <PublicIllustration variant="insight" className="rounded-[2.1rem]" />
            <div className="grid gap-4 md:grid-cols-2">
              {landing.metrics.slice(2).map((metric, index) => (
                <article key={metric.label} className={index === 0 ? 'rounded-[1.6rem] border border-violet-200 bg-[linear-gradient(180deg,#f7f2ff_0%,#ffffff_100%)] p-5 shadow-sm' : 'rounded-[1.6rem] border border-[#102a4e] bg-[#102a4e] p-5 text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]'}>
                  <p className={index === 0 ? 'text-[11px] uppercase tracking-[0.18em] text-slate-500' : 'text-[11px] uppercase tracking-[0.18em] text-white/55'}>{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                  {metric.helper ? <p className={index === 0 ? 'mt-2 text-sm leading-6 text-slate-600' : 'mt-2 text-sm leading-6 text-white/72'}>{metric.helper}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {landing.featured.map((item, index) => (
          <Link key={item.href} href={item.href} className={`rounded-[1.8rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${HERO_TONES[index % HERO_TONES.length]}`}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Featured page</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              Open page
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-5">
        {landing.collections.map((collection, index) => (
          <article key={collection.href} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/92 shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
              <div className={index % 2 === 0 ? 'border-b border-slate-200 bg-[linear-gradient(180deg,#fffdf7_0%,#f8fbff_100%)] p-6 md:p-8 xl:border-b-0 xl:border-r' : 'border-b border-slate-200 bg-[linear-gradient(180deg,#f2f9ff_0%,#ffffff_100%)] p-6 md:p-8 xl:border-b-0 xl:border-r'}>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Collection</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{collection.title}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{collection.description}</p>
                <div className="mt-6 max-w-sm">
                  <PublicIllustration variant={index % 3 === 0 ? 'archive' : index % 3 === 1 ? 'firm' : 'reporting'} className="border-0 shadow-none" />
                </div>
                <Link href={collection.href} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c1940]">
                  Open archive
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8 xl:grid-cols-3">
                {collection.items.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-[1.4rem] border border-slate-200 bg-[#fbfcfe] p-4 transition hover:border-sky-200 hover:bg-sky-50/60">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700">{item.highlight}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
