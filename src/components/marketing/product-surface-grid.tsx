import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageSurface } from '@/lib/marketing/types';

const accentClasses = [
  'from-sky-50 to-white',
  'from-amber-50 to-white',
  'from-emerald-50 to-white',
  'from-indigo-50 to-white',
] as const;

type ProductSurfaceGridProps = {
  surfaces: HomepageSurface[];
};

export function ProductSurfaceGrid({ surfaces }: ProductSurfaceGridProps) {
  return (
    <section id="platform" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Platform surfaces</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">Four connected surfaces, one complaint intelligence stack.</h2>
        </div>
        <p className="max-w-2xl text-sm leading-7 text-slate-600">
          The homepage should explain the product without falling into a generic features grid. These tiles show the main surfaces and how they fit together.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {surfaces.map((surface, index) => (
          <article
            key={surface.key}
            className={`group overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br ${accentClasses[index % accentClasses.length]} p-6 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_28px_70px_rgba(15,23,42,0.10)] md:p-7`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{surface.eyebrow}</p>
              <div className="rounded-full border border-slate-200/80 bg-white/88 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                {surface.metric}
              </div>
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{surface.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{surface.body}</p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
              {surface.bullets.map((bullet) => (
                <li key={bullet} className="rounded-[1.15rem] border border-slate-200/80 bg-white/86 px-4 py-3">
                  {bullet}
                </li>
              ))}
            </ul>
            <Link href={surface.href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-sky-900">
              Open surface
              <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
