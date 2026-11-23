import { ArrowRight } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { WritingQuillUnderline } from '@/components/brand/determination-quill-motion';
import type { HomepageSnapshot } from '@/lib/marketing/types';
import { GuidedDemoPanel } from './guided-demo-panel';

type HomepageHeroProps = {
  snapshot: HomepageSnapshot;
};

export function HomepageHero({ snapshot }: HomepageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-violet-200/60 bg-[radial-gradient(circle_at_top_left,rgba(249,168,212,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_32%),linear-gradient(180deg,#fbfbff_0%,#f2f5ff_58%,#fffaf7_100%)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 opacity-70" aria-hidden="true">
        <div className="absolute -bottom-16 -left-[8%] h-32 w-[62%] rotate-3 rounded-[50%] bg-gradient-to-r from-violet-200/70 via-fuchsia-100/60 to-transparent blur-sm" />
        <div className="absolute -bottom-14 right-[-8%] h-32 w-[66%] -rotate-3 rounded-[50%] bg-gradient-to-l from-indigo-200/70 via-orange-100/60 to-transparent blur-sm" />
      </div>
      <div className="relative mx-auto grid w-full max-w-7xl gap-7 px-4 pb-10 pt-7 md:px-8 md:pb-12 md:pt-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">{snapshot.hero.eyebrow}</p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-slate-950 md:text-5xl lg:text-[3.2rem]">
            {snapshot.hero.title}
          </h1>
          <WritingQuillUnderline className="mt-2" />
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 md:text-base md:leading-7">
            {snapshot.hero.dek}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <PublicTrackedLink
              href={snapshot.hero.primaryCta.href}
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_hero', cta: 'start_analysis' }}
              className="inline-flex items-center gap-2 rounded-full bg-violet-800 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(91,33,182,0.22)] transition hover:bg-violet-900"
            >
              {snapshot.hero.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </PublicTrackedLink>
            <PublicTrackedLink
              href={snapshot.hero.secondaryCta.href}
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_hero', cta: 'workspace_demo' }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:border-sky-300 hover:text-sky-900"
            >
              {snapshot.hero.secondaryCta.label}
            </PublicTrackedLink>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {snapshot.hero.trustPoints.map((point) => (
              <div
                key={point}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-3 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <GuidedDemoPanel steps={snapshot.demoSteps} updatedAt={snapshot.updatedAt} />
      </div>
    </section>
  );
}
