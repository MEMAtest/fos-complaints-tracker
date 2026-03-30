import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageSnapshot } from '@/lib/marketing/types';
import { GuidedDemoPanel } from './guided-demo-panel';

type HomepageHeroProps = {
  snapshot: HomepageSnapshot;
};

export function HomepageHero({ snapshot }: HomepageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/60">
      <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_30%),radial-gradient(circle_at_25%_35%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(15,31,79,0.12),transparent_28%),linear-gradient(180deg,#f7fbff_0%,#eef5ff_44%,#f9fbff_100%)]" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 md:px-8 md:py-16 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-sky-700">{snapshot.hero.eyebrow}</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-semibold tracking-[-0.04em] text-slate-950 md:text-6xl xl:text-7xl">
            {snapshot.hero.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
            {snapshot.hero.dek}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={snapshot.hero.primaryCta.href}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
            >
              {snapshot.hero.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={snapshot.hero.secondaryCta.href}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:border-sky-300 hover:text-sky-900"
            >
              {snapshot.hero.secondaryCta.label}
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:max-w-2xl">
            {snapshot.liveProof.slice(0, 2).map((metric) => (
              <article key={metric.label} className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-4 shadow-sm backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p>
              </article>
            ))}
          </div>
        </div>

        <GuidedDemoPanel steps={snapshot.demoSteps} />
      </div>
    </section>
  );
}
