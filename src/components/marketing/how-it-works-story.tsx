'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HomepageStoryStep } from '@/lib/marketing/types';

type HowItWorksStoryProps = {
  steps: HomepageStoryStep[];
};

export function HowItWorksStory({ steps }: HowItWorksStoryProps) {
  const [activeKey, setActiveKey] = useState(steps[0]?.key ?? 'explore');
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveKey(visible.target.id.replace('how-', ''));
        }
      },
      { threshold: [0.35, 0.6], rootMargin: '-10% 0px -20% 0px' }
    );

    steps.forEach((step) => {
      const element = refs.current[step.key];
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [steps]);

  const activeStep = useMemo(
    () => steps.find((step) => step.key === activeKey) || steps[0],
    [activeKey, steps]
  );

  if (!activeStep) return null;

  return (
    <section id="how-it-works" className="border-y border-slate-200/70 bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_28%,#f7fbff_100%)] py-16 md:py-20">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">How users move through it</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Explore the signal, understand the pattern, work the complaint, report the outcome.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            The page should make the product flow obvious. Each stage below updates the sticky panel as you scroll, so the story stays connected to the product surface.
          </p>

          <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Stage {activeStep.stage}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{activeStep.title}</h3>
              </div>
              <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
                {activeStep.accentMetric}
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">{activeStep.body}</p>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
              {activeStep.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 rounded-[1.15rem] border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Link href={activeStep.href} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 transition hover:text-sky-950">
              Open this stage
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          {steps.map((step) => {
            const isActive = step.key === activeStep.key;
            return (
              <article
                key={step.key}
                id={`how-${step.key}`}
                ref={(node) => {
                  refs.current[step.key] = node;
                }}
                className={cn(
                  'rounded-[2rem] border p-6 shadow-sm transition md:p-8',
                  isActive
                    ? 'border-sky-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.10)]'
                    : 'border-slate-200 bg-white/78'
                )}
                onMouseEnter={() => setActiveKey(step.key)}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', isActive ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-600')}>
                    Step {step.stage}
                  </div>
                  <div className="rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {step.accentMetric}
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{step.title}</h3>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{step.body}</p>
                <ul className="mt-5 grid gap-3 md:grid-cols-1 xl:grid-cols-2">
                  {step.bullets.map((bullet) => (
                    <li key={bullet} className="rounded-[1.15rem] border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm leading-6 text-slate-600">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
