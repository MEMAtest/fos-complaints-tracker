import { formatDate } from '@/lib/utils';
import type { HomepageMetric } from '@/lib/marketing/types';

type LiveProofStripProps = {
  metrics: HomepageMetric[];
  updatedAt: string | null;
};

export function LiveProofStrip({ metrics, updatedAt }: LiveProofStripProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Published Financial Ombudsman corpus
          </p>
          {updatedAt ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              Evidence through {formatDate(updatedAt)}
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, idx) => (
            <article
              key={metric.label}
              className={
                idx === 0
                  ? 'rounded-xl border border-[#0f1f4f]/15 bg-[#0f1f4f] px-4 py-3 text-white'
                  : 'rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-slate-950'
              }
            >
              <p className={idx === 0 ? 'text-[10px] uppercase tracking-[0.16em] text-white/65' : 'text-[10px] uppercase tracking-[0.16em] text-slate-500'}>
                {metric.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{metric.value}</p>
              <p className={idx === 0 ? 'mt-1 line-clamp-1 text-xs text-white/75' : 'mt-1 line-clamp-1 text-xs text-slate-600'}>
                {metric.helper}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
