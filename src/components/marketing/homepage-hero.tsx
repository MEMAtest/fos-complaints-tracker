import { ArrowRight } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import type { HomepageSnapshot } from '@/lib/marketing/types';
import { GuidedDemoPanel } from './guided-demo-panel';

type HomepageHeroProps = {
  snapshot: HomepageSnapshot;
};

export function HomepageHero({ snapshot }: HomepageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/60 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,31,79,0.10),transparent_26%),linear-gradient(180deg,#f6f9ff_0%,#eef4ff_55%,#f7fbff_100%)]">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8 xl:grid-cols-[0.88fr_1.12fr] xl:items-center">
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">{snapshot.hero.eyebrow}</p>
          <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-slate-950 md:text-4xl xl:text-[2.95rem]">
            {snapshot.hero.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 md:text-base md:leading-7">
            {snapshot.hero.dek}
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <PublicTrackedLink
              href={snapshot.hero.primaryCta.href}
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_hero', cta: 'start_analysis' }}
              className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
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
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
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
