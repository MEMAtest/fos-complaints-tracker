import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageSnapshot } from '@/lib/marketing/types';
import { GuidedDemoPanel } from './guided-demo-panel';

type HomepageHeroProps = {
  snapshot: HomepageSnapshot;
};

export function HomepageHero({ snapshot }: HomepageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/50 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,31,79,0.12),transparent_26%),linear-gradient(180deg,#f6f9ff_0%,#eef4ff_46%,#f7fbff_100%)]">
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#f7fbff]" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-10 md:px-8 md:pb-20 md:pt-14 xl:grid-cols-[0.82fr_1.18fr] xl:items-center">
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-700">{snapshot.hero.eyebrow}</p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[0.94] tracking-[-0.05em] text-slate-950 md:text-6xl xl:text-[4.9rem]">
            {snapshot.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
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

          <div className="mt-8 grid gap-3 md:max-w-xl">
            {snapshot.hero.trustPoints.map((point) => (
              <div key={point} className="inline-flex w-fit items-center gap-3 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <GuidedDemoPanel steps={snapshot.demoSteps} />
      </div>
    </section>
  );
}
