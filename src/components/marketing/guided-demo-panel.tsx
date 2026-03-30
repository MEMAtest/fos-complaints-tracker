'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HomepageDemoStep } from '@/lib/marketing/types';

type GuidedDemoPanelProps = {
  steps: HomepageDemoStep[];
};

const toneClasses: Record<NonNullable<HomepageDemoStep['previewRows'][number]['tone']>, string> = {
  neutral: 'border-slate-200 bg-white text-slate-700',
  accent: 'border-sky-200 bg-sky-50 text-sky-900',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export function GuidedDemoPanel({ steps }: GuidedDemoPanelProps) {
  const [activeKey, setActiveKey] = useState(steps[0]?.key ?? 'search');
  const activeIndex = useMemo(() => Math.max(steps.findIndex((step) => step.key === activeKey), 0), [activeKey, steps]);
  const activeStep = steps[activeIndex] || steps[0];

  useEffect(() => {
    if (steps.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveKey((current) => {
        const currentIndex = steps.findIndex((step) => step.key === current);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % steps.length : 0;
        return steps[nextIndex].key;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [steps]);

  if (!activeStep) return null;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(238,246,255,0.94))] shadow-[0_35px_90px_rgba(15,23,42,0.16)]">
      <div className="border-b border-slate-200/80 px-5 py-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Guided platform view</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">See how people move through the product.</h2>
          </div>
          <div className="hidden rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 md:block">
            Live paths
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {steps.map((step) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveKey(step.key)}
              className={cn(
                'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition',
                step.key === activeStep.key
                  ? 'bg-[#0f1f4f] text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
              )}
            >
              {step.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1.05fr_0.95fr] md:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-sky-700">{activeStep.eyebrow}</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{activeStep.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{activeStep.caption}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {activeStep.metrics.map((metric) => (
              <div key={metric.label} className="rounded-[1.4rem] border border-slate-200 bg-white/88 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p>
              </div>
            ))}
          </div>

          <ul className="grid gap-3 text-sm leading-6 text-slate-600">
            {activeStep.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white/78 px-4 py-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-[1.8rem] border border-slate-200/80 bg-[#0b1738] p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Interactive demo</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">{activeStep.label}</p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
              {activeStep.key}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/6 p-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#13214d] px-3 py-2 text-sm text-white/70">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              {activeStep.label === 'Search' ? 'Search firms, products, themes' : activeStep.label === 'Compare' ? 'Compare live complaint footprints' : activeStep.label === 'Work' ? 'Complaint workspace summary' : 'Board pack generation preview'}
            </div>
            <div className="mt-3 space-y-3">
              {activeStep.previewRows.map((row) => (
                <div
                  key={`${activeStep.key}-${row.label}`}
                  className={cn(
                    'rounded-[1.1rem] border px-4 py-3 transition duration-300',
                    toneClasses[row.tone || 'neutral']
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] opacity-70">{row.label}</p>
                  <p className="mt-2 text-sm font-semibold leading-6">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          <Link
            href={activeStep.href}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            {activeStep.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
