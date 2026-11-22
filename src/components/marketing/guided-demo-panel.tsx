'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, ClipboardList, Files, GitCompare, Search } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { trackPublicEvent } from '@/lib/analytics/public-events';
import { cn } from '@/lib/utils';
import type { HomepageDemoStep } from '@/lib/marketing/types';

type GuidedDemoPanelProps = {
  steps: HomepageDemoStep[];
};

const chartBarsByStep: Record<HomepageDemoStep['key'], number[]> = {
  search: [32, 45, 54, 63, 72, 68, 79],
  compare: [64, 58, 70, 75, 66, 82, 88],
  work: [28, 36, 48, 59, 57, 71, 83],
  report: [44, 52, 61, 69, 72, 78, 84],
};

const chartLabelsByStep: Record<HomepageDemoStep['key'], string> = {
  search: 'Public insight activity',
  compare: 'Comparison signal',
  work: 'Complaint workflow',
  report: 'Reporting output',
};

const accentClasses: Record<HomepageDemoStep['key'], string> = {
  search: 'from-sky-500 to-cyan-400',
  compare: 'from-amber-400 to-orange-400',
  work: 'from-emerald-500 to-teal-400',
  report: 'from-blue-500 to-indigo-400',
};

const sideIcons: Record<HomepageDemoStep['key'], typeof Search> = {
  search: Search,
  compare: GitCompare,
  work: ClipboardList,
  report: Files,
};

function buildPath(values: number[]): string {
  const width = 420;
  const height = 100;
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - value * 0.85;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function GuidedDemoPanel({ steps }: GuidedDemoPanelProps) {
  const [activeKey, setActiveKey] = useState(steps[0]?.key ?? 'search');
  const activeStep = useMemo(() => steps.find((step) => step.key === activeKey) || steps[0], [activeKey, steps]);

  useEffect(() => {
    if (steps.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveKey((current) => {
        const currentIndex = steps.findIndex((step) => step.key === current);
        return steps[(currentIndex + 1) % steps.length]?.key || steps[0].key;
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [steps]);

  if (!activeStep) return null;

  const bars = chartBarsByStep[activeStep.key];
  const Icon = sideIcons[activeStep.key];
  const chartPath = buildPath(bars);

  return (
    <div className="relative">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {steps.map((step) => (
            <button
              key={step.key}
              type="button"
              onClick={() => {
                setActiveKey(step.key);
                trackPublicEvent('homepage_demo_tab_selected', {
                  step: step.key,
                });
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition',
                step.key === activeStep.key
                  ? 'bg-[#0f1f4f] text-white shadow-sm'
                  : 'border border-slate-200 bg-white/90 text-slate-600 hover:border-slate-300 hover:text-slate-950'
              )}
            >
              {step.label}
            </button>
          ))}
        </div>

        <PublicTrackedLink
          href={activeStep.href}
          eventName="public_cta_clicked"
          eventProps={{ source: 'homepage_guided_demo', cta: activeStep.key }}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0f1f4f] shadow-sm transition hover:border-sky-300 hover:text-sky-900"
        >
          {activeStep.actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </PublicTrackedLink>
      </div>

      <div className="relative overflow-hidden rounded-[1.75rem] border border-[#24345f] bg-[#14224f] p-2.5 shadow-[0_24px_70px_rgba(15,31,79,0.22)]">
        <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#eef4ff]">
          <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {activeStep.eyebrow}
            </div>
          </div>

          <div className="grid grid-cols-[54px_1fr]">
            <div className="flex flex-col items-center gap-2.5 border-r border-white/10 bg-[#13214d] px-2 py-3.5 text-white/70">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              {([
                ['search', Search],
                ['compare', GitCompare],
                ['work', ClipboardList],
                ['report', Files],
              ] as const).map(([key, SidebarIcon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveKey(key)}
                  aria-label={`Preview ${key}`}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 transition',
                    SidebarIcon === Icon ? 'bg-white text-[#14224f]' : 'bg-white/6 text-white/65 hover:bg-white/15'
                  )}
                >
                  <SidebarIcon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="bg-[linear-gradient(180deg,#f6fbff_0%,#ebf2ff_100%)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950 md:text-xl">{activeStep.title}</h2>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-slate-600">{activeStep.caption}</p>
                </div>
                <span className={cn('rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white', accentClasses[activeStep.key])}>
                  {activeStep.label}
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {activeStep.metrics.map((metric, index) => (
                  <article
                    key={metric.label}
                    className={cn('rounded-xl border px-3 py-2.5 shadow-sm', index === 0 ? 'border-sky-200 bg-white' : 'border-slate-200 bg-white/85')}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-slate-950">{metric.value}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{metric.helper}</p>
                  </article>
                ))}
              </div>

              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">{chartLabelsByStep[activeStep.key]}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">7-point view</p>
                  </div>
                  <svg viewBox="0 0 420 110" className="mt-2 h-24 w-full">
                    <defs>
                      <linearGradient id={`chart-gradient-${activeStep.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={activeStep.key === 'compare' ? '#f59e0b' : activeStep.key === 'work' ? '#10b981' : '#0ea5e9'} stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M 0 102 H 420" stroke="#dbe6f4" strokeWidth="1" />
                    <path d="M 0 68 H 420" stroke="#e4edf8" strokeWidth="1" />
                    <path d="M 0 34 H 420" stroke="#e4edf8" strokeWidth="1" />
                    <path d={`${chartPath} L 420 110 L 0 110 Z`} fill={`url(#chart-gradient-${activeStep.key})`} stroke="none" />
                    <path d={chartPath} fill="none" stroke={activeStep.key === 'compare' ? '#d97706' : activeStep.key === 'work' ? '#059669' : '#0284c7'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                    {bars.map((value, index) => {
                      const x = (420 / Math.max(bars.length - 1, 1)) * index;
                      const y = 100 - value * 0.85;
                      return (
                        <circle
                          key={`${activeStep.key}-${index}`}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#ffffff"
                          stroke={activeStep.key === 'compare' ? '#d97706' : activeStep.key === 'work' ? '#059669' : '#0284c7'}
                          strokeWidth="2.5"
                        />
                      );
                    })}
                  </svg>
                </div>

                <div className="grid gap-2">
                  {activeStep.previewRows.slice(0, 2).map((row) => (
                    <div key={`${activeStep.key}-${row.label}`} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{row.label}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-900">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
