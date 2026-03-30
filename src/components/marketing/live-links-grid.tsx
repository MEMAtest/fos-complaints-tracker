import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageSnapshot } from '@/lib/marketing/types';

type LiveLinksGridProps = {
  links: HomepageSnapshot['featuredLinks'];
};

export function LiveLinksGrid({ links }: LiveLinksGridProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Jump into live pages</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Curated links into the highest-signal public analysis.</h2>
        </div>
        <Link href="/insights" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 transition hover:text-sky-950">
          Browse all public insights
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-[1.7rem] border border-slate-200 bg-white/94 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-sky-700">{link.tag}</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{link.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{link.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-sky-900">
              Open live page
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
