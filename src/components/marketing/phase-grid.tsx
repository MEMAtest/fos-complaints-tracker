import { ArrowRight, ClipboardList, Files, Search, Workflow } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { cn } from '@/lib/utils';
import type { HomepageStoryStep } from '@/lib/marketing/types';

type PhaseGridProps = {
  steps: HomepageStoryStep[];
};

const surfaceIcons = [Search, Workflow, ClipboardList, Files] as const;

export function PhaseGrid({ steps }: PhaseGridProps) {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">How it works</p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            Move from public complaint signal to operational workflow and reporting without losing the thread.
          </h2>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = surfaceIcons[index % surfaceIcons.length];
          const dark = index === 0 || index === 3;
          return (
            <article
              key={step.key}
              className={cn(
                'flex flex-col justify-between rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                dark
                  ? 'border-[#102a4e] bg-[#0f1f4f] text-white'
                  : 'border-slate-200 bg-white text-slate-950'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      dark ? 'bg-white/12 text-white' : 'bg-[#0f1f4f] text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      dark ? 'border-white/15 bg-white/10 text-white/80' : 'border-slate-200 bg-slate-50 text-slate-600'
                    )}
                  >
                    {step.stage}
                  </span>
                </div>

                <h3 className="mt-3.5 text-base font-semibold leading-snug tracking-tight">{step.title}</h3>
                <p className={cn('mt-2 text-xs leading-5', dark ? 'text-white/72' : 'text-slate-600')}>
                  {step.body}
                </p>

                <ul className="mt-3 space-y-1.5">
                  {step.bullets.slice(0, 2).map((bullet) => (
                    <li
                      key={bullet}
                      className={cn(
                        'flex items-start gap-2 text-xs leading-5',
                        dark ? 'text-white/80' : 'text-slate-600'
                      )}
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dark ? 'bg-[#e2b12f]' : 'bg-sky-600')} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <PublicTrackedLink
                href={step.href}
                eventName="public_cta_clicked"
                eventProps={{ source: 'homepage_phase_grid', cta: step.key }}
                className={cn(
                  'mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  dark
                    ? 'bg-white text-slate-950 hover:bg-slate-100'
                    : 'bg-[#0f1f4f] text-white hover:bg-[#0c1940]'
                )}
              >
                {step.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </PublicTrackedLink>
            </article>
          );
        })}
      </div>
    </section>
  );
}
