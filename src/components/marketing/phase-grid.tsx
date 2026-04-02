import { ArrowRight, ClipboardList, Files, Search, Workflow } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { PublicIllustration } from '@/components/illustrations/public-illustration';
import { cn } from '@/lib/utils';
import type { HomepageStoryStep } from '@/lib/marketing/types';

type PhaseGridProps = {
  steps: HomepageStoryStep[];
};

const toneClasses = [
  'border-[#17355b] bg-[#17355b] text-white',
  'border-slate-200 bg-white text-slate-950',
  'border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#edf3ff_100%)] text-slate-950',
  'border-[#102a4e] bg-[#102a4e] text-white',
] as const;

const surfaceIcons = [Search, Workflow, ClipboardList, Files] as const;
const illustrationByStep = {
  explore: 'insight',
  transition: 'firm',
  work: 'workflow',
  report: 'reporting',
} as const;

function illustrationVariantForStep(stepKey: HomepageStoryStep['key']) {
  return illustrationByStep[stepKey as keyof typeof illustrationByStep] || 'insight';
}

export function PhaseGrid({ steps }: PhaseGridProps) {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Platform path</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
          Move from public complaint signal to operational workflow and reporting without losing the thread.
        </h2>
        <p className="mt-4 text-base leading-8 text-slate-600">
          The structure below is intentionally simple. It shows the platform in four connected phases, closer to how users actually move through the product.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = surfaceIcons[index % surfaceIcons.length];
          const dark = index === 0 || index === 3;
          return (
            <article
              key={step.key}
              className={cn('relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_32px_90px_rgba(15,23,42,0.12)] md:p-8', toneClasses[index % toneClasses.length])}
            >
              <div className="absolute right-0 top-0 h-32 w-36 rounded-full bg-white/8 blur-2xl" />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className={cn('text-[11px] uppercase tracking-[0.18em]', dark ? 'text-white/58' : 'text-slate-500')}>
                      {step.stage}
                    </p>
                    <div className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', dark ? 'border-white/12 bg-white/8 text-white/78' : 'border-slate-200 bg-white text-slate-600')}>
                      {step.accentMetric}
                    </div>
                  </div>
                  <h3 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight leading-[1.02]">{step.title}</h3>
                  <p className={cn('mt-4 max-w-xl text-sm leading-7', dark ? 'text-white/72' : 'text-slate-600')}>
                    {step.body}
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
                  <div className="grid gap-3 text-sm leading-6">
                    {step.bullets.map((bullet) => (
                      <div key={bullet} className={cn('rounded-[1.2rem] border px-4 py-3', dark ? 'border-white/10 bg-white/7 text-white/78' : 'border-slate-200 bg-white/90 text-slate-600')}>
                        {bullet}
                      </div>
                    ))}
                  </div>

                  <div className={cn('rounded-[1.5rem] border p-4', dark ? 'border-white/10 bg-white/8' : 'border-slate-200 bg-white/88')}>
                    <div className="grid gap-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', dark ? 'bg-white text-[#17355b]' : 'bg-[#17355b] text-white')}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', dark ? 'border-white/12 bg-white/8 text-white/72' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                          {step.accentMetric}
                        </div>
                      </div>
                      <PublicIllustration
                        variant={illustrationVariantForStep(step.key)}
                        className={cn(
                          'aspect-[16/10] rounded-[1.35rem] shadow-none',
                          dark ? 'border-white/12 bg-[linear-gradient(180deg,#fffef9_0%,#edf4ff_100%)]' : 'border-slate-200'
                        )}
                      />
                    </div>
                    <div className="mt-4 grid gap-2">
                      <div className={cn('rounded-xl border px-3 py-2 text-xs', dark ? 'border-white/10 bg-white/8 text-white/72' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                        Connected view of analysis, handling, and reporting.
                      </div>
                    </div>
                  </div>
                </div>

                <PublicTrackedLink
                  href={step.href}
                  eventName="public_cta_clicked"
                  eventProps={{ source: 'homepage_phase_grid', cta: step.key }}
                  className={cn('inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition', dark ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-[#0f1f4f] text-white hover:bg-[#0c1940]')}
                >
                  {step.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </PublicTrackedLink>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
