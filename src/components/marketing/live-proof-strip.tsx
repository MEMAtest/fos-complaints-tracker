import { formatDate } from '@/lib/utils';
import type { HomepageMetric } from '@/lib/marketing/types';

type LiveProofStripProps = {
  metrics: HomepageMetric[];
  updatedAt: string | null;
};

export function LiveProofStrip({ metrics, updatedAt }: LiveProofStripProps) {
  const [primary, ...secondary] = metrics;

  return (
    <section className="mx-auto -mt-10 w-full max-w-7xl px-4 pb-10 md:-mt-14 md:px-8 md:pb-14">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white/96 shadow-[0_32px_90px_rgba(15,23,42,0.12)]">
        <div className="absolute right-0 top-0 h-28 w-56 rounded-full bg-sky-100 blur-3xl" />
        <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-slate-200/80 p-6 md:p-8 lg:border-b-0 lg:border-r">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live platform pulse</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 md:text-[2.25rem]">
              A homepage that shows the product through live data, not generic claims.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              Live corpus coverage, public insight depth, and current complaint context are visible immediately. The page should feel like a live product front door, not a static marketing shell.
            </p>
            {primary ? (
              <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,#f9fcff_0%,#eef5ff_100%)] p-5 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{primary.label}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{primary.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{primary.helper}</p>
              </div>
            ) : null}
            <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {updatedAt ? `Last updated ${formatDate(updatedAt)}` : 'Live data surface'}
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="rounded-[1.7rem] border border-slate-200 bg-[#0f1f4f] p-4 text-white shadow-[0_26px_80px_rgba(15,31,79,0.20)] md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Platform health dashboard</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight">Real-time platform pulse.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
                  Live now
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {secondary.map((metric) => (
                  <article key={metric.label} className="rounded-[1.3rem] border border-white/10 bg-white/7 p-4 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                    <p className="mt-2 text-xs leading-5 text-white/65">{metric.helper}</p>
                  </article>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.35rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Live platform access</p>
                  <p className="mt-2 text-sm font-semibold leading-6">Public insights, comparison views, workspace complaint handling, and board-ready outputs all sit on the same intelligence stack.</p>
                  <div className="mt-4 grid gap-2 text-xs text-white/65 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Public insights</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Firm comparison</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Complaints workspace</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Board reporting</div>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Transaction filter tool</p>
                  <div className="mt-3 grid gap-2 text-xs text-white/75">
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Live data page</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Firm comparison</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Board pack builder</div>
                    <div className="rounded-xl border border-white/10 bg-white/6 px-3 py-2">Case status</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
