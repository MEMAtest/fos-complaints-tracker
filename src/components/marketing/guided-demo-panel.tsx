'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Files,
  GitCompare,
  Pause,
  Play,
  Search,
} from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { trackPublicEvent } from '@/lib/analytics/public-events';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { HomepageDemoStep } from '@/lib/marketing/types';

type GuidedDemoPanelProps = {
  steps: HomepageDemoStep[];
  updatedAt?: string | null;
};

const stepIcons: Record<HomepageDemoStep['key'], typeof Search> = {
  search: Search,
  compare: GitCompare,
  work: ClipboardList,
  report: Files,
};

function SearchPreview({ step }: { step: HomepageDemoStep }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 text-violet-600" />
        <span className="text-xs font-medium text-slate-700">Search firms, products, years or themes</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {step.metrics.map((metric, index) => (
          <article key={metric.label} className={cn('rounded-xl border p-3', index === 0 ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white')}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{metric.value}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{metric.helper}</p>
          </article>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {step.previewRows.slice(0, 3).map((row, index) => (
          <div key={row.label} className={cn('flex items-center gap-3 py-2', index > 0 && 'border-t border-slate-100')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">{row.label}</p>
              <p className="truncate text-xs font-semibold text-slate-800">{row.value}</p>
            </div>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparePreview({ step }: { step: HomepageDemoStep }) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {step.previewRows.slice(0, 2).map((row) => (
          <article key={row.label} className="rounded-xl border border-violet-200 bg-white p-3 shadow-sm">
            <GitCompare className="mb-2 h-4 w-4 text-violet-700" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-900">{row.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{row.value}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function WorkPreview({ step }: { step: HomepageDemoStep }) {
  const stages = ['Complaint received', 'Evidence linked', 'Review in progress', 'Response approved'];
  return (
    <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Complaint workspace</p>
            <p className="text-xs font-semibold text-slate-900">Complaint RC-10482</p>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-800">In review</span>
        </div>
        <div className="mt-2 grid gap-1">
          {stages.map((stage, index) => (
            <div key={stage} className={cn('flex items-center gap-2 rounded-lg px-2 py-2', index === 2 && 'bg-teal-50')}>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[9px]', index < 2 ? 'border-teal-500 bg-teal-500 text-white' : index === 2 ? 'border-teal-500 bg-white text-teal-700' : 'border-slate-300 bg-slate-50 text-slate-400')}>
                {index < 2 ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="text-[10px] font-medium text-slate-700">{stage}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        {step.metrics.map((metric, index) => (
          <div key={metric.label} className={cn('rounded-xl border p-3', index === 0 ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white')}>
            <p className="text-[8px] uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-[9px] leading-4 text-slate-500">{metric.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportPreview({ step }: { step: HomepageDemoStep }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_0.9fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-violet-600">Board pack preview</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">Complaints intelligence</p>
          </div>
          <Files className="h-5 w-5 text-violet-600" />
        </div>
        <div className="mt-3 flex h-24 items-end gap-2 rounded-lg bg-gradient-to-b from-violet-50 to-white px-3 pb-2">
          {[34, 48, 43, 61, 76, 84].map((height, index) => (
            <div key={index} className="flex-1 rounded-t bg-gradient-to-t from-violet-600 to-violet-300" style={{ height: `${height}%` }} />
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-4/5 rounded-full bg-slate-200" />
          <div className="h-2 w-3/5 rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="grid gap-2">
        {step.metrics.map((metric, index) => (
          <div key={metric.label} className={cn('flex items-center gap-3 rounded-xl border p-3', index === 0 ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#102a4e] text-white">
              {index === 0 ? <Files className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
              <p className="truncate text-xs font-semibold text-slate-900">{metric.value}</p>
              <p className="truncate text-[9px] text-slate-500">{metric.helper}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlidePreview({ step }: { step: HomepageDemoStep }) {
  if (step.key === 'search') return <SearchPreview step={step} />;
  if (step.key === 'compare') return <ComparePreview step={step} />;
  if (step.key === 'work') return <WorkPreview step={step} />;
  return <ReportPreview step={step} />;
}

export function GuidedDemoPanel({ steps, updatedAt }: GuidedDemoPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeStep = steps[activeIndex] || steps[0];

  const goTo = useCallback((index: number, source = 'tab') => {
    if (!steps.length) return;
    const normalized = (index + steps.length) % steps.length;
    setActiveIndex(normalized);
    trackPublicEvent('homepage_demo_tab_selected', { step: steps[normalized].key, source });
  }, [steps]);

  const goNext = useCallback(() => goTo(activeIndex + 1, 'next'), [activeIndex, goTo]);
  const goPrevious = useCallback(() => goTo(activeIndex - 1, 'previous'), [activeIndex, goTo]);

  useEffect(() => {
    if (paused || steps.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(goNext, 6500);
    return () => window.clearTimeout(timer);
  }, [goNext, paused, steps.length]);

  const liveDate = useMemo(() => updatedAt ? formatDate(updatedAt) : null, [updatedAt]);
  if (!activeStep) return null;
  const ActiveIcon = stepIcons[activeStep.key];

  return (
    <section
      className="relative"
      aria-roledescription="carousel"
      aria-label="What firms can do with RegComplaints"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Firm tasks">
          {steps.map((step, index) => {
            const Icon = stepIcons[step.key];
            return (
              <button
                key={step.key}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => goTo(index)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                  index === activeIndex
                    ? 'border-violet-700 bg-violet-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white/90 text-slate-600 hover:border-violet-300 hover:text-violet-900'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {step.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {liveDate ? <span className="hidden text-[10px] font-medium text-slate-500 sm:inline">Live evidence through {liveDate}</span> : null}
          <button type="button" onClick={() => setPaused((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600" aria-label={paused ? 'Play carousel' : 'Pause carousel'}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-[#263b6b] bg-[#102a4e] p-3 shadow-[0_28px_80px_rgba(38,49,112,0.24)]">
        <div key={activeStep.key} className="rc-carousel-slide grid overflow-hidden rounded-[1.45rem] bg-white lg:grid-cols-[0.72fr_1.28fr]" role="tabpanel" aria-live="polite">
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#111f4c_0%,#273c7a_60%,#5b36b6_130%)] p-5 text-white">
            <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/12">
                  <ActiveIcon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/75">{activeIndex + 1} of {steps.length}</span>
              </div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">{activeStep.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight md:text-2xl">{activeStep.title}</h2>
              <p className="mt-3 text-xs leading-5 text-white/72">{activeStep.caption}</p>
              <ul className="mt-4 grid gap-2">
                {activeStep.bullets.slice(0, 2).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[11px] leading-5 text-white/82">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-400 text-[#102a4e]"><Check className="h-2.5 w-2.5" /></span>
                    {bullet}
                  </li>
                ))}
              </ul>
              <PublicTrackedLink href={activeStep.href} eventName="public_cta_clicked" eventProps={{ source: 'homepage_capability_carousel', cta: activeStep.key }} className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#102a4e] transition hover:bg-violet-50">
                {activeStep.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </PublicTrackedLink>
            </div>
          </div>
          <div className="relative bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_32%),linear-gradient(180deg,#faf9ff_0%,#eef3ff_100%)] p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="mt-0.5 text-xs font-semibold text-slate-900">{activeStep.label}</p>
              </div>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-800">
                {activeStep.key === 'search' || activeStep.key === 'compare' ? 'Published FOS evidence' : 'Example workflow'}
              </span>
            </div>
            <SlidePreview step={activeStep} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={goPrevious} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-violet-300" aria-label="Previous capability"><ChevronLeft className="h-4 w-4" /></button>
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {steps.map((step, index) => <span key={step.key} className={cn('h-1 rounded-full transition', index === activeIndex ? 'bg-violet-600' : 'bg-slate-200')} />)}
        </div>
        <button type="button" onClick={goNext} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-violet-300" aria-label="Next capability"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </section>
  );
}
