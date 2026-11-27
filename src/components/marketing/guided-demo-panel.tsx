'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { trackPublicEvent } from '@/lib/analytics/public-events';
import { formatDate, cn } from '@/lib/utils';
import type { HomepageDemoStep } from '@/lib/marketing/types';

type GuidedDemoPanelProps = {
  steps: HomepageDemoStep[];
  updatedAt?: string | null;
};

type InspectPayload = {
  title: string;
  eyebrow: string;
  summary: string;
  href: string;
  ctaLabel: string;
} | null;

const stepIcons: Record<HomepageDemoStep['key'], typeof Search> = {
  search: Search,
  compare: GitCompare,
  work: ClipboardList,
  report: Files,
};

function parsePercentFromText(text: string, fallback: number): number {
  const match = text.match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : fallback;
}

function SearchPreview({
  step,
  onInspect,
}: {
  step: HomepageDemoStep;
  onInspect: (p: InspectPayload) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-[#0f1f4f]" />
        <span className="text-xs font-medium text-slate-700">Search firms, products, years or themes</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {step.metrics.map((metric, index) => (
          <button
            key={metric.label}
            type="button"
            onClick={() =>
              onInspect({
                eyebrow: 'Published Corpus Signal',
                title: `${metric.label}: ${metric.value}`,
                summary: metric.helper,
                href: step.href,
                ctaLabel: step.actionLabel,
              })
            }
            className={cn(
              'rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-sm',
              index === 0 ? 'border-[#0f1f4f]/20 bg-[#f1f5fc]' : 'border-slate-200 bg-white'
            )}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-[#08162f]">{metric.value}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{metric.helper}</p>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
        {step.previewRows.slice(0, 3).map((row, index) => (
          <button
            key={row.label}
            type="button"
            onClick={() =>
              onInspect({
                eyebrow: row.label,
                title: row.value,
                summary: 'Explore the underlying Financial Ombudsman decisions, firm breakdowns, and year-on-year upheld rates in the public Evidence Explorer.',
                href: step.href,
                ctaLabel: step.actionLabel,
              })
            }
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50',
              index > 0 && 'border-t border-slate-100'
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0f1f4f]/10 text-[#0f1f4f]">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-400">{row.label}</p>
              <p className="truncate text-xs font-semibold text-slate-800">{row.value}</p>
            </div>
            <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ComparePreview({
  step,
  onInspect,
}: {
  step: HomepageDemoStep;
  onInspect: (p: InspectPayload) => void;
}) {
  const r0 = step.previewRows[0];
  const r1 = step.previewRows[1];
  const up0 = r0 ? parsePercentFromText(r0.value, 18.4) : 18.4;
  const up1 = r1 ? parsePercentFromText(r1.value, 28.6) : 28.6;

  const chartData = [
    {
      name: r0 ? r0.label.slice(0, 16) : 'Firm A',
      Upheld: up0,
      'Not upheld': Number((100 - up0).toFixed(1)),
    },
    {
      name: r1 ? r1.label.slice(0, 16) : 'Sector Benchmark',
      Upheld: up1,
      'Not upheld': Number((100 - up1).toFixed(1)),
    },
  ];

  return (
    <div className="grid gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {step.previewRows.slice(0, 2).map((row, idx) => (
          <button
            key={row.label}
            type="button"
            onClick={() =>
              onInspect({
                eyebrow: 'Firm Comparison Benchmark',
                title: row.label,
                summary: `${row.value} Open the interactive Firm Comparison dashboard to compare upheld rates, product radars, and multi-year trends side-by-side.`,
                href: step.href,
                ctaLabel: step.actionLabel,
              })
            }
            className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0f1f4f]/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', idx === 0 ? 'bg-blue-600' : 'bg-violet-600')} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Click to inspect</span>
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold text-[#08162f]">{row.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{row.value}</p>
          </button>
        ))}
      </div>

      {/* Real Recharts Comparison Visual — fills the right panel cleanly with zero whitespace */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[#08162f]">Upheld vs Not Upheld Benchmark (%)</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            Delta: {Math.abs(up1 - up0).toFixed(1)} pp
          </span>
        </div>
        <div className="h-[145px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={6} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: unknown) => `${Number(value).toFixed(1)}%`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
              />
              <Bar dataKey="Upheld" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={34} />
              <Bar dataKey="Not upheld" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function WorkPreview({
  step,
  onInspect,
}: {
  step: HomepageDemoStep;
  onInspect: (p: InspectPayload) => void;
}) {
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
            <button
              key={stage}
              type="button"
              onClick={() =>
                onInspect({
                  eyebrow: `Workflow Stage ${index + 1} of 4`,
                  title: stage,
                  summary: 'Every complaint record tracks SLA deadlines, linked FOS precedents, evidence uploads, and sign-off history in one auditable workspace.',
                  href: step.href,
                  ctaLabel: step.actionLabel,
                })
              }
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50',
                index === 2 && 'bg-teal-50'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border text-[9px]',
                  index < 2
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : index === 2
                      ? 'border-teal-500 bg-white text-teal-700'
                      : 'border-slate-300 bg-slate-50 text-slate-400'
                )}
              >
                {index < 2 ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className="text-[11px] font-medium text-slate-700">{stage}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        {step.metrics.map((metric, index) => (
          <button
            key={metric.label}
            type="button"
            onClick={() =>
              onInspect({
                eyebrow: 'Workspace Metric',
                title: `${metric.label}: ${metric.value}`,
                summary: metric.helper,
                href: step.href,
                ctaLabel: step.actionLabel,
              })
            }
            className={cn(
              'rounded-xl border p-3 text-left transition hover:border-[#0f1f4f]/30 hover:shadow-sm',
              index === 0 ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-white'
            )}
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-900">{metric.value}</p>
            <p className="mt-1 text-[9px] leading-4 text-slate-500">{metric.helper}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportPreview({
  step,
  onInspect,
}: {
  step: HomepageDemoStep;
  onInspect: (p: InspectPayload) => void;
}) {
  const reportData = [
    { q: 'Q1', upheld: 29 },
    { q: 'Q2', upheld: 33 },
    { q: 'Q3', upheld: 31 },
    { q: 'Q4', upheld: 36 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#0f1f4f]">Board pack preview</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">Quarterly uphold trend</p>
          </div>
          <Files className="h-4 w-4 text-[#0f1f4f]" />
        </div>
        <div className="mt-2 h-[125px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reportData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="q" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 50]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: unknown) => `${v}%`} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
              <Bar dataKey="upheld" fill="#0f1f4f" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-2">
        {step.metrics.map((metric, index) => (
          <button
            key={metric.label}
            type="button"
            onClick={() =>
              onInspect({
                eyebrow: 'Board Pack Deliverable',
                title: `${metric.label}: ${metric.value}`,
                summary: metric.helper,
                href: step.href,
                ctaLabel: step.actionLabel,
              })
            }
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[#0f1f4f]/30 hover:shadow-sm',
              index === 0 ? 'border-[#0f1f4f]/20 bg-[#f1f5fc]' : 'border-slate-200 bg-white'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0f1f4f] text-[#f5daa3]">
              {index === 0 ? <Files className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
              <p className="truncate text-xs font-semibold text-slate-900">{metric.value}</p>
              <p className="truncate text-[9px] text-slate-500">{metric.helper}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SlidePreview({
  step,
  onInspect,
}: {
  step: HomepageDemoStep;
  onInspect: (p: InspectPayload) => void;
}) {
  if (step.key === 'search') return <SearchPreview step={step} onInspect={onInspect} />;
  if (step.key === 'compare') return <ComparePreview step={step} onInspect={onInspect} />;
  if (step.key === 'work') return <WorkPreview step={step} onInspect={onInspect} />;
  return <ReportPreview step={step} onInspect={onInspect} />;
}

export function GuidedDemoPanel({ steps, updatedAt }: GuidedDemoPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inspectModal, setInspectModal] = useState<InspectPayload>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const activeStep = steps[activeIndex] || steps[0];

  const closeInspect = useCallback(() => setInspectModal(null), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (inspectModal && !dialog.open) dialog.showModal();
    else if (!inspectModal && dialog.open) dialog.close();
  }, [inspectModal]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      dialog.returnValue = '';
      closeInspect();
    };
    dialog.addEventListener('close', onClose);
    const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => { pressedOutside = isOutside(e); };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };
    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
    }
    return () => {
      dialog.removeEventListener('close', onClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      }
    };
  }, [closeInspect]);

  const goTo = useCallback((index: number, source = 'tab') => {
    if (!steps.length) return;
    const normalized = (index + steps.length) % steps.length;
    setActiveIndex(normalized);
    trackPublicEvent('homepage_demo_tab_selected', { step: steps[normalized].key, source });
  }, [steps]);

  const goNext = useCallback(() => goTo(activeIndex + 1, 'next'), [activeIndex, goTo]);
  const goPrevious = useCallback(() => goTo(activeIndex - 1, 'previous'), [activeIndex, goTo]);

  useEffect(() => {
    if (paused || inspectModal || steps.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(goNext, 6500);
    return () => window.clearTimeout(timer);
  }, [goNext, inspectModal, paused, steps.length]);

  const liveDate = useMemo(() => (updatedAt ? formatDate(updatedAt) : null), [updatedAt]);
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
                    ? 'border-[#0f1f4f] bg-[#0f1f4f] text-white shadow-sm'
                    : 'border-slate-200 bg-white/95 text-slate-600 hover:border-[#0f1f4f]/30 hover:text-[#0f1f4f]'
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
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
            aria-label={paused ? 'Play carousel' : 'Pause carousel'}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-[#263b6b] bg-[#08162f] p-3 shadow-[0_24px_64px_rgba(8,22,47,0.20)]">
        <div
          key={activeStep.key}
          className="rc-carousel-slide grid overflow-hidden rounded-[1.45rem] bg-white lg:grid-cols-[0.72fr_1.28fr]"
          role="tabpanel"
          aria-live="polite"
        >
          <div className="relative overflow-hidden bg-[linear-gradient(155deg,#08162f_0%,#0f1f4f_65%,#1c3678_120%)] p-5 text-white">
            <div className="relative flex h-full flex-col">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12 text-[#f5daa3]">
                  <ActiveIcon className="h-4 w-4" />
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  {activeIndex + 1} of {steps.length}
                </span>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">{activeStep.eyebrow}</p>
              <h2 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight md:text-2xl">{activeStep.title}</h2>
              <p className="mt-2.5 text-xs leading-5 text-white/75">{activeStep.caption}</p>
              <ul className="mt-3.5 grid gap-2">
                {activeStep.bullets.slice(0, 2).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[11px] leading-5 text-white/85">
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e2b12f] text-[#08162f]">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
              <PublicTrackedLink
                href={activeStep.href}
                eventName="public_cta_clicked"
                eventProps={{ source: 'homepage_capability_carousel', cta: activeStep.key }}
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#08162f] transition hover:bg-[#f5daa3]"
              >
                {activeStep.actionLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </PublicTrackedLink>
            </div>
          </div>

          <div className="relative bg-[#f8faff] p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#08162f]">{activeStep.label}</p>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10px] font-semibold text-teal-800">
                {activeStep.key === 'search' || activeStep.key === 'compare' ? 'Published FOS evidence' : 'Interactive workflow'}
              </span>
            </div>
            <SlidePreview step={activeStep} onInspect={setInspectModal} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={goPrevious}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[#0f1f4f]/30"
          aria-label="Previous capability"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden="true">
          {steps.map((step, index) => (
            <span key={step.key} className={cn('h-1 rounded-full transition', index === activeIndex ? 'bg-[#0f1f4f]' : 'bg-slate-200')} />
          ))}
        </div>
        <button
          type="button"
          onClick={goNext}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-[#0f1f4f]/30"
          aria-label="Next capability"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        className="rc-native-dialog w-[min(480px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
      >
        {inspectModal && (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-5 py-4 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">{inspectModal.eyebrow}</p>
                <h1 className="mt-1 text-lg font-semibold">{inspectModal.title}</h1>
              </div>
              <button
                type="button"
                onClick={closeInspect}
                aria-label="Close preview modal"
                className="rounded-lg p-1.5 text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-slate-600">{inspectModal.summary}</p>
              <div className="mt-4 flex justify-end">
                <PublicTrackedLink
                  href={inspectModal.href}
                  onClick={closeInspect}
                  eventName="public_cta_clicked"
                  eventProps={{ source: 'homepage_demo_inspect_modal', cta: inspectModal.title }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0f1f4f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#08162f]"
                >
                  {inspectModal.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </PublicTrackedLink>
              </div>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
