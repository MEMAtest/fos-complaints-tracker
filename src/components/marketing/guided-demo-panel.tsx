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
  const height = 120;
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - value;
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
    <div className="relative min-h-[38rem]">
      <div className="mb-4 flex flex-wrap gap-2 xl:justify-end">
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
              'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition',
              step.key === activeStep.key
                ? 'bg-[#0f1f4f] text-white shadow-sm'
                : 'border border-slate-200 bg-white/90 text-slate-600 hover:border-slate-300 hover:text-slate-950'
            )}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-[700px] pt-2 xl:ml-auto">
        <div className="absolute inset-x-16 top-16 h-40 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute right-2 top-6 h-24 w-24 rounded-full bg-blue-500/15 blur-3xl" />

        <div className="relative ml-auto rounded-[2.6rem] border border-[#24345f] bg-[#14224f] p-4 shadow-[0_40px_120px_rgba(15,31,79,0.28)]">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#eef4ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {activeStep.eyebrow}
              </div>
            </div>

            <div className="grid min-h-[23rem] grid-cols-[78px_1fr] md:min-h-[26rem]">
              <div className="flex flex-col items-center gap-4 border-r border-white/10 bg-[#13214d] px-3 py-5 text-white/70">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <BarChart3 className="h-5 w-5" />
                </div>
                {[Search, GitCompare, ClipboardList, Files].map((SidebarIcon, index) => (
                  <div key={index} className={cn('flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8', SidebarIcon === Icon ? 'bg-white text-[#14224f]' : 'bg-white/6 text-white/65')}>
                    <SidebarIcon className="h-4.5 w-4.5" />
                  </div>
                ))}
              </div>

              <div className="relative bg-[linear-gradient(180deg,#f6fbff_0%,#ebf2ff_100%)] p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{activeStep.label}</p>
                    <h2 className="mt-2 max-w-md text-2xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">{activeStep.title}</h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">{activeStep.caption}</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {chartLabelsByStep[activeStep.key]}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {activeStep.metrics.map((metric, index) => (
                    <article key={metric.label} className={cn('rounded-[1.35rem] border p-4 shadow-sm', index === 0 ? 'border-sky-200 bg-white' : 'border-slate-200 bg-white/84')}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{metric.helper}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Live panel</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{activeStep.previewRows[0]?.value || activeStep.actionLabel}</p>
                    </div>
                    <div className={cn('rounded-full bg-gradient-to-r px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white', accentClasses[activeStep.key])}>
                      {activeStep.label}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[1.35rem] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#eef4ff_100%)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-950">{chartLabelsByStep[activeStep.key]}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">7-point view</p>
                      </div>
                      <svg viewBox="0 0 420 140" className="mt-4 h-36 w-full">
                        <defs>
                          <linearGradient id={`chart-gradient-${activeStep.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={activeStep.key === 'compare' ? '#f59e0b' : activeStep.key === 'work' ? '#10b981' : '#0ea5e9'} stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M 0 128 H 420" stroke="#dbe6f4" strokeWidth="1" />
                        <path d="M 0 96 H 420" stroke="#e4edf8" strokeWidth="1" />
                        <path d="M 0 64 H 420" stroke="#e4edf8" strokeWidth="1" />
                        <path d="M 0 32 H 420" stroke="#e4edf8" strokeWidth="1" />
                        <path d={`${chartPath} L 420 140 L 0 140 Z`} fill={`url(#chart-gradient-${activeStep.key})`} stroke="none" />
                        <path d={chartPath} fill="none" stroke={activeStep.key === 'compare' ? '#d97706' : activeStep.key === 'work' ? '#059669' : '#0284c7'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                        {bars.map((value, index) => {
                          const x = (420 / Math.max(bars.length - 1, 1)) * index;
                          const y = 120 - value;
                          return <circle key={`${activeStep.key}-${index}`} cx={x} cy={y} r="4.8" fill="#ffffff" stroke={activeStep.key === 'compare' ? '#d97706' : activeStep.key === 'work' ? '#059669' : '#0284c7'} strokeWidth="3" />;
                        })}
                      </svg>
                    </div>

                    <div className="grid gap-3">
                      {activeStep.previewRows.slice(1).map((row) => (
                        <div key={`${activeStep.key}-${row.label}`} className="rounded-[1.2rem] border border-slate-200 bg-[#f8fbff] px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{row.label}</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -left-3 top-10 hidden w-56 rotate-[-4deg] rounded-[1.7rem] border border-slate-200 bg-white/95 p-4 shadow-[0_22px_70px_rgba(15,23,42,0.14)] md:block xl:-left-14">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Live insight</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{activeStep.previewRows[0]?.value}</p>
          <div className="mt-4 h-1.5 rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full bg-gradient-to-r', accentClasses[activeStep.key])} style={{ width: `${58 + activeStep.metrics.length * 10}%` }} />
          </div>
        </div>

        <div className="absolute -right-2 bottom-12 hidden w-56 rotate-[4deg] rounded-[1.7rem] border border-[#24345f] bg-[#12204a] p-4 text-white shadow-[0_24px_80px_rgba(15,31,79,0.24)] md:block xl:-right-10">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Action</p>
          <p className="mt-2 text-sm font-semibold leading-6">{activeStep.actionLabel}</p>
          <p className="mt-3 text-xs leading-5 text-white/65">{activeStep.bullets[0]}</p>
          <PublicTrackedLink href={activeStep.href} eventName="public_cta_clicked" eventProps={{ source: 'homepage_guided_demo', cta: activeStep.key }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-100">
            Open path
            <ArrowRight className="h-3.5 w-3.5" />
          </PublicTrackedLink>
        </div>

        <div className="pointer-events-none absolute inset-x-20 bottom-1 h-8 rounded-full bg-slate-900/12 blur-2xl" />
      </div>
    </div>
  );
}
