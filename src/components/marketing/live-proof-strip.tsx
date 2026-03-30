import { formatDate } from '@/lib/utils';
import type { HomepageMetric } from '@/lib/marketing/types';

type LiveProofStripProps = {
  metrics: HomepageMetric[];
  updatedAt: string | null;
};

export function LiveProofStrip({ metrics, updatedAt }: LiveProofStripProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live platform proof</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">A homepage that shows the product through live coverage, not generic claims.</h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            {updatedAt ? `Last updated ${formatDate(updatedAt)}` : 'Live data surface'}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{metric.helper}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
