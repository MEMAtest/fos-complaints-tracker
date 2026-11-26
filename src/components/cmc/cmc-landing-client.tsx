'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { WritingQuillUnderline } from '@/components/brand/determination-quill-motion';
import { RegComplaintsMark } from '@/components/brand/regcomplaints-brand';
import { cn } from '@/lib/utils';

type WorkspaceTabKey = 'intel' | 'evidence' | 'claims' | 'referral';

const WORKSPACE_TABS: Array<{
  key: WorkspaceTabKey;
  label: string;
  eyebrow: string;
  metricA: { label: string; value: string };
  metricB: { label: string; value: string };
  rows: Array<{ title: string; detail: string; badge: string; tone: 'ok' | 'warn' | 'info' }>;
  footnote: string;
}> = [
  {
    key: 'intel',
    label: 'FOS intelligence',
    eyebrow: 'Published corpus research',
    metricA: { label: 'Published FOS corpus', value: '395,692' },
    metricB: { label: 'Active research lens', value: 'Affordability & Delays' },
    rows: [
      {
        title: 'Affordability checks at origination',
        detail: "Review the lender's assessment against comparable published decisions.",
        badge: 'Research',
        tone: 'info',
      },
      {
        title: 'Insurance claim-delay & TPA bottlenecks',
        detail: 'Cross-check home & travel delay outcomes highlighted by FCA & FOS.',
        badge: 'FCA focus',
        tone: 'warn',
      },
      {
        title: 'Final response & jurisdiction window',
        detail: 'Verify 6-month referral limits and DISP eligibility before filing.',
        badge: 'Verify',
        tone: 'warn',
      },
    ],
    footnote: 'Historical patterns inform pre-referral research; they do not predict individual outcomes.',
  },
  {
    key: 'evidence',
    label: 'Evidence review',
    eyebrow: 'Case file completeness',
    metricA: { label: 'Checklist status', value: '2 / 4 complete' },
    metricB: { label: 'Review flag', value: 'Evidence gaps' },
    rows: [
      {
        title: 'Customer authority & engagement terms',
        detail: 'Signed authority to act and fee disclosure recorded on file.',
        badge: 'Recorded',
        tone: 'ok',
      },
      {
        title: 'Policy wording / credit agreement',
        detail: 'Original contract terms attached for merits comparison.',
        badge: 'Recorded',
        tone: 'ok',
      },
      {
        title: 'Income, expenditure & loss chronology',
        detail: 'Request bank statements or storm/travel receipts before referral.',
        badge: 'Missing',
        tone: 'warn',
      },
    ],
    footnote: 'Keep correspondence, timelines, and reviewer notes connected in one audit trail.',
  },
  {
    key: 'claims',
    label: 'Claims handling (FCA)',
    eyebrow: 'FCA & FOS joint expectations',
    metricA: { label: 'Supervisory focus', value: 'Home & Travel GI' },
    metricB: { label: 'Duty standard', value: 'Consumer Duty' },
    rows: [
      {
        title: 'Keep claims moving without bottlenecks',
        detail: 'Track stage aging and eliminate avoidable handling delays.',
        badge: 'Priority',
        tone: 'warn',
      },
      {
        title: 'Third-party & delegated authority oversight',
        detail: 'Own loss-adjuster, repairer, and TPA delays — responsibility stays in-house.',
        badge: 'Governance',
        tone: 'info',
      },
      {
        title: 'Cash settlements & vulnerable customers',
        detail: 'Evidence fair value, storm-damage scrutiny, and proactive customer updates.',
        badge: 'Evidence',
        tone: 'ok',
      },
    ],
    footnote: 'Aligned to FCA & FOS joint claims-handling findings (home, travel & general insurance).',
  },
  {
    key: 'referral',
    label: 'Referral review',
    eyebrow: 'Pre-FOS sign-off',
    metricA: { label: 'Max representative fee', value: '£260' },
    metricB: { label: 'Human sign-off', value: 'Required' },
    rows: [
      {
        title: 'CMCOB 2.1.7R arguable basis documented',
        detail: 'Case-specific facts weighed against Ombudsman approach and guidance.',
        badge: 'Review',
        tone: 'info',
      },
      {
        title: 'Qualifying settlement & reduced-fee check',
        detail: 'Assess £80 reduced-fee eligibility and proactive resolution options.',
        badge: '£80 / £260',
        tone: 'ok',
      },
      {
        title: 'Reviewer rationale & audit record',
        detail: 'Human decision recorded — no automated rejection thresholds.',
        badge: 'Sign-off',
        tone: 'warn',
      },
    ],
    footnote: 'No automated rejection or recommendation. The representative retains full responsibility.',
  },
];

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: 'Research comparable decisions',
    body: 'Filter 395,692+ published FOS rulings by firm, product, year, and root-cause theme before drafting representations.',
    cta: 'Explore live intelligence',
    href: '/insights',
    badge: 'Live now',
    live: true,
  },
  {
    icon: BarChart3,
    title: 'Benchmark historical outcomes',
    body: 'Check sector and firm upheld rates alongside sample sizes to ground merits discussions without treating stats as predictions.',
    cta: 'Open outcome estimator',
    href: '/check',
    badge: 'Live now',
    live: true,
  },
  {
    icon: ShieldCheck,
    title: 'FCA claims-handling oversight',
    body: 'Track claim-delay uphold hotspots, third-party administrator bottlenecks, and cash-settlement disputes flagged by the FCA & FOS.',
    cta: 'View delay-in-handling data',
    href: '/insights/type/delay-in-claim-handling',
    badge: 'FCA focus',
    live: true,
  },
  {
    icon: ClipboardCheck,
    title: 'Structured merits & CMCOB review',
    body: 'Document the arguable basis (CMCOB 2.1.7R), evidence completeness (CMCOB 2.1.8G), deadlines, and human sign-off in one record.',
    cta: 'Open readiness checklist',
    modal: 'readiness' as const,
    badge: 'Interactive tool',
    live: true,
  },
  {
    icon: Calculator,
    title: 'Model 2026/27 FOS fee impact',
    body: 'Quantify annual savings from avoiding unnecessary £260 or £80 chargeable referrals while protecting valid customer claims.',
    cta: 'Launch fee calculator',
    modal: 'calculator' as const,
    badge: 'Interactive tool',
    live: true,
  },
  {
    icon: BriefcaseBusiness,
    title: 'Connected workspace & board packs',
    body: 'Keep case files, correspondence, TPA escalations, and leadership reporting on the same intelligence layer — no CRM rip-and-replace.',
    cta: 'Open management workspace',
    href: '/workspace',
    badge: 'Live workspace',
    live: true,
  },
] as const;

const PRACTICE_AREAS = [
  { label: 'Home & Travel Insurance Claims', href: '/insights/product/insurance' },
  { label: 'Claim-Handling Delays', href: '/insights/type/delay-in-claim-handling' },
  { label: 'Irresponsible Lending', href: '/insights/type/affordability-assessment-failure' },
  { label: 'APP Fraud & Scams', href: '/insights/type/fraud-or-scam-concern' },
  { label: 'Banking & Payments', href: '/insights/product/banking-and-payments' },
  { label: 'Pensions & SIPPs', href: '/insights/product/pensions-and-annuities' },
  { label: 'Mortgages', href: '/insights/product/mortgages' },
  { label: 'Motor Finance*', href: '/insights/products' },
];

const READINESS_CHECKS = [
  {
    id: 'fca-moving',
    group: 'FCA Claims Handling',
    title: 'Keep claims moving without avoidable bottlenecks',
    detail: 'Stage-aging alerts catch stalled home, travel, or general insurance claims before they escalate to FOS.',
  },
  {
    id: 'fca-updates',
    group: 'FCA Claims Handling',
    title: 'Provide clear, timely updates & support vulnerable customers',
    detail: 'Proactive status milestones and Consumer Duty vulnerability flags are logged throughout the claim lifecycle.',
  },
  {
    id: 'fca-tpa',
    group: 'FCA Claims Handling',
    title: 'Maintain active governance over outsourced third parties (TPAs)',
    detail: 'Loss adjusters, repairers, and delegated authorities are monitored with firm-owned SLA accountability.',
  },
  {
    id: 'fca-fair',
    group: 'FCA Claims Handling',
    title: 'Evidence fair treatment on storm claims & cash settlements',
    detail: 'Decision rationales and payout controls are audited end-to-end, not only at final settlement.',
  },
  {
    id: 'cmcob-basis',
    group: 'CMCOB 2.1 (CMCs)',
    title: 'CMCOB 2.1.7R — Arguable basis verified pre-referral',
    detail: 'Each claim is assessed on its own facts against published FOS guidance before incurring a £260/£80 case fee.',
  },
  {
    id: 'cmcob-merits',
    group: 'CMCOB 2.1 (CMCs)',
    title: 'CMCOB 2.1.8G — Merits, evidence & jurisdiction confirmed',
    detail: 'Supporting records, final response dates, and comparable decisions are reviewed and attached before filing.',
  },
  {
    id: 'cmcob-human',
    group: 'CMCOB 2.1 (CMCs)',
    title: 'Customer interests & human oversight preserved',
    detail: 'Historical statistics inform research only — never used as automated rejection thresholds.',
  },
] as const;

const FAQS = [
  {
    q: 'Does RegComplaints predict whether an individual claim will succeed?',
    a: 'No. RegComplaints provides published Ombudsman precedent context, upheld-rate benchmarks, and structured review workflows — never automated rejections or individual predictions. Every claim must be assessed on its own facts.',
  },
  {
    q: 'How does this help with the FCA & FOS insurance claims-handling review?',
    a: 'The FCA and FOS highlighted four core expectations: keep claims moving, provide clear and timely updates, own third-party/TPA oversight, and evidence fair treatment throughout (including storm damage and cash settlements). RegComplaints exposes live claim-delay and insurer uphold hotspots and connects them to auditable case-handling and board reporting.',
  },
  {
    q: 'How do 2026/27 FOS professional representative case fees work?',
    a: 'Under the 2026/27 FOS charging structure, professional representatives face a £260 standard case fee (reduced to £80 in qualifying improved-outcome or proactive-settlement circumstances), subject to a £2,000 annual fee allowance. Use our interactive calculator modal to model scenarios.',
  },
  {
    q: 'Do we need to replace our existing CRM or claims management system?',
    a: 'No. RegComplaints operates as an intelligence and pre-referral review layer alongside your existing CRM, case-management software, or insurer claims platform.',
  },
  {
    q: 'Is RegComplaints endorsed by the FCA or the Financial Ombudsman Service?',
    a: 'No. RegComplaints is an independent MEMA Consultants platform built on published Financial Ombudsman decision data. It supports regulatory judgement and does not replace legal or compliance advice.',
  },
];

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    // Progressive-enhancement light-dismiss fallback for browsers without <dialog closedby="any"> (e.g. Safari)
    const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;
    let pressedOutside = false;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
      pressedOutside = false;
    };

    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      }
    };
  }, [onClose]);

  return ref;
}

export function CmcLandingClient({ workspaceHref }: { workspaceHref: string }) {
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>('intel');
  const [activeModal, setActiveModal] = useState<'calculator' | 'readiness' | 'demo' | null>(null);

  // Calculator state
  const [casesPerMonth, setCasesPerMonth] = useState(5);
  const [feePerCase, setFeePerCase] = useState<260 | 80>(260);
  const [monthlySub, setMonthlySub] = useState(299);
  const [allowanceExhausted, setAllowanceExhausted] = useState(true);

  // Readiness checklist state
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({
    'fca-moving': true,
    'cmcob-basis': true,
  });

  // Demo form state
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [demoName, setDemoName] = useState('');
  const [demoCompany, setDemoCompany] = useState('');
  const [demoRole, setDemoRole] = useState('CMC / Professional Representative');
  const [demoEmail, setDemoEmail] = useState('');
  const [demoVolume, setDemoVolume] = useState('50–250');

  const calcTitleId = useId();
  const readinessTitleId = useId();
  const demoTitleId = useId();

  const closeModal = useCallback(() => setActiveModal(null), []);
  const closeCalc = useCallback(() => setActiveModal((curr) => (curr === 'calculator' ? null : curr)), []);
  const closeReadiness = useCallback(() => setActiveModal((curr) => (curr === 'readiness' ? null : curr)), []);
  const closeDemo = useCallback(() => setActiveModal((curr) => (curr === 'demo' ? null : curr)), []);
  const calcDialogRef = useNativeDialog(activeModal === 'calculator', closeCalc);
  const readinessDialogRef = useNativeDialog(activeModal === 'readiness', closeReadiness);
  const demoDialogRef = useNativeDialog(activeModal === 'demo', closeDemo);

  const currentTab = useMemo(
    () => WORKSPACE_TABS.find((t) => t.key === activeTab) || WORKSPACE_TABS[0],
    [activeTab]
  );

  const calcResult = useMemo(() => {
    const rawAnnual = casesPerMonth * feePerCase * 12;
    const grossSavings = allowanceExhausted ? rawAnnual : Math.max(0, rawAnnual - 2000);
    const annualSub = Math.max(0, monthlySub) * 12;
    const netSavings = grossSavings - annualSub;
    return { grossSavings, netSavings, annualSub };
  }, [casesPerMonth, feePerCase, monthlySub, allowanceExhausted]);

  const readinessScore = useMemo(() => {
    const done = READINESS_CHECKS.filter((c) => checkedIds[c.id]).length;
    return { done, total: READINESS_CHECKS.length, pct: Math.round((done / READINESS_CHECKS.length) * 100) };
  }, [checkedIds]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-[#f6f8fc] text-slate-950">
      {/* 1. COMPACT ABOVE-THE-FOLD HERO + INTERACTIVE 4-TAB PREVIEW */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(226,177,47,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,31,79,0.12),transparent_30%),linear-gradient(180deg,#f7f9fd_0%,#edf3fc_55%,#f7fafe_100%)]">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-8 xl:grid-cols-[0.9fr_1.1fr] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0f1f4f]/15 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0f1f4f] shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#c9971a]" aria-hidden="true" />
              CMCs, Claims Solicitors &amp; Claims-Handling Teams
            </div>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-[#08162f] md:text-4xl xl:text-[2.85rem]">
              Stronger claims. Better evidence. <span className="text-[#0f1f4f]">Defensible claims handling.</span>
            </h1>
            <WritingQuillUnderline className="mt-2" />
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 md:text-base md:leading-7">
              Put published Financial Ombudsman intelligence to work before you pursue a claim or escalate a file — combining pre-referral CMC merits review (CMCOB 2.1) with FCA &amp; FOS insurance claims-handling oversight.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDemoSubmitted(false);
                  setActiveModal('demo');
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#08162f]"
              >
                Book a personalised demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('calculator')}
                className="inline-flex items-center gap-2 rounded-full border border-[#c9971a]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[#08162f] shadow-sm transition hover:border-[#c9971a] hover:bg-[#fffdf7]"
              >
                <Calculator className="h-4 w-4 text-[#c9971a]" aria-hidden="true" />
                Calculate FOS fee savings
              </button>
              <button
                type="button"
                onClick={() => setActiveModal('readiness')}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-[#0f1f4f]/40 hover:text-[#08162f]"
              >
                <ClipboardCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
                FCA &amp; CMCOB self-check
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#e2b12f]" />
                395,692+ published FOS decisions
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-600" />
                2026/27 £260 / £80 fee modelling
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Built by MEMA regulatory specialists
              </span>
            </div>
          </div>

          {/* Interactive 4-Tab Claims Workspace Preview */}
          <div className="rounded-[1.6rem] border border-[#1d315c] bg-[#08162f] p-2.5 shadow-[0_24px_70px_rgba(8,22,47,0.22)]">
            <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#f6f9fe]">
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <RegComplaintsMark width={22} height={22} tone="light" />
                  <span className="text-xs font-semibold text-[#08162f]">Claims &amp; Pre-Referral Workspace</span>
                </div>
                <span className="rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                  Interactive preview
                </span>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Claims intelligence workflow preview">
                  {WORKSPACE_TABS.map((tab) => {
                    const selected = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                          selected
                            ? 'bg-[#0f1f4f] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {currentTab.eyebrow}
                    </p>
                    <span className="text-[11px] font-semibold text-[#0f1f4f]">Illustrative case RC-0142</span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{currentTab.metricA.label}</p>
                      <p className="mt-0.5 text-lg font-semibold text-[#08162f]">{currentTab.metricA.value}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{currentTab.metricB.label}</p>
                      <p className="mt-0.5 text-base font-semibold text-[#08162f]">{currentTab.metricB.value}</p>
                    </div>
                  </div>

                  <div className="mt-3 divide-y divide-slate-100">
                    {currentTab.rows.map((row) => (
                      <div key={row.title} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900">{row.title}</p>
                          <p className="text-[11px] text-slate-500">{row.detail}</p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                            row.tone === 'ok'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : row.tone === 'warn'
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-sky-50 text-sky-900 border border-sky-200'
                          )}
                        >
                          {row.badge}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    {currentTab.footnote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. COMPACT 4-METRIC PROOF BAR + FCA CLAIMS HANDLING SPOTLIGHT */}
      <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Published Ombudsman decisions', value: '395,692', sub: '14-year searchable UK corpus', dark: true },
            { label: 'Public insight pages', value: '366', sub: 'Years, firms, products & root causes', dark: false },
            { label: '2026/27 Representative fee', value: '£260 / £80', sub: 'Standard vs qualifying reduced fee*', dark: false },
            { label: 'FCA & FOS GI priority', value: 'Claims Handling', sub: 'Delays, TPAs & Consumer Duty', dark: false },
          ].map((stat) => (
            <article
              key={stat.label}
              className={cn(
                'rounded-2xl border px-4 py-3.5 shadow-sm',
                stat.dark
                  ? 'border-[#0f1f4f] bg-[#0f1f4f] text-white'
                  : 'border-slate-200 bg-white text-slate-950'
              )}
            >
              <p className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', stat.dark ? 'text-[#f5daa3]' : 'text-slate-500')}>
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className={cn('mt-0.5 text-xs', stat.dark ? 'text-white/75' : 'text-slate-600')}>{stat.sub}</p>
            </article>
          ))}
        </div>

        {/* FCA Insurance Claims Handling Spotlight Strip */}
        <div className="mt-4 rounded-2xl border border-[#0f1f4f]/15 bg-[#08162f] p-5 text-white shadow-sm md:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">
                FCA &amp; FOS Joint Claims-Handling Scrutiny · Home, Travel &amp; General Insurance
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
                Firms can outsource claims handling, but they cannot outsource regulatory responsibility.
              </h2>
              <p className="mt-1.5 text-xs leading-6 text-white/75 md:text-sm">
                Following targeted home and travel insurance reviews, the FCA and FOS called on firms to eliminate avoidable delays, improve updates for vulnerable customers, tighten oversight of third-party administrators (loss adjusters &amp; repairers), and evidence fair treatment on storm claims and cash settlements.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('readiness')}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#e2b12f] px-4 py-2 text-xs font-semibold text-[#08162f] transition hover:bg-[#f5daa3]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Run 7-point self-check
              </button>
              <a
                href="https://www.fca.org.uk/news/news-stories/insurance-firms-called-improve-claims-handling"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                Read FCA release
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: '01', title: 'Keep claims moving', body: 'Spot high-uphold delay patterns early and remove handoff bottlenecks.' },
              { step: '02', title: 'Clear, timely updates', body: 'Keep customers informed during vulnerable moments under Consumer Duty.' },
              { step: '03', title: 'Own third-party oversight', body: 'Monitor loss adjusters, repairers & TPAs with auditable SLA governance.' },
              { step: '04', title: 'Evidence fair treatment', body: 'Document storm-damage & cash-settlement controls across the full lifecycle.' },
            ].map((pillar) => (
              <div key={pillar.step} className="rounded-xl border border-white/10 bg-white/6 p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#e2b12f]">{pillar.step}</span>
                  <h3 className="text-sm font-semibold text-white">{pillar.title}</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-white/70">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. COMPACT 6-CARD CAPABILITIES GRID */}
      <section className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Built for claims teams &amp; CMCs
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#08162f] md:text-3xl">
              Spend less time researching. Make every merits review count.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal('calculator')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f1f4f] underline decoration-[#e2b12f] decoration-2 underline-offset-4 hover:text-sky-900 md:text-sm"
          >
            Model £260 / £80 FOS fee savings
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <article
                key={cap.title}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f1f4f] text-[#f5daa3]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {cap.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[#08162f]">{cap.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">{cap.body}</p>
                </div>

                <div className="mt-3.5 pt-2">
                  {'href' in cap ? (
                    <PublicTrackedLink
                      href={cap.href}
                      eventName="public_cta_clicked"
                      eventProps={{ source: 'cmc_capabilities', cta: cap.title }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f1f4f] hover:text-sky-800"
                    >
                      {cap.cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </PublicTrackedLink>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveModal(cap.modal)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f1f4f] hover:text-sky-800"
                    >
                      {cap.cta}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. COMPACT 2-COLUMN REGULATORY FIT (CMCOB 2.1 + SECTORS) & FAQ ACCORDION */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-10 pt-5 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* Left: CMCOB 2.1 + Live Practice Area Shortcuts */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Regulatory fit · CMCOB 2.1
                </p>
                <a
                  href="https://handbook.fca.org.uk/handbook/cmcob2/cmcob2s1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f1f4f] hover:text-sky-800"
                >
                  FCA CMCOB 2.1
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-[#08162f]">
                Support defensible pre-referral &amp; merits governance.
              </h2>

              <div className="mt-3.5 space-y-2.5">
                {[
                  {
                    rule: 'CMCOB 2.1.7R · Arguable basis',
                    text: "Support your firm's assessment of whether a claim has an arguable basis before it is made or pursued.",
                  },
                  {
                    rule: 'CMCOB 2.1.8G · Merits & evidence',
                    text: 'Investigate case-specific merits using published Ombudsman guidance and comparable decisions as supplementary research.',
                  },
                  {
                    rule: 'Customer interests · Human oversight',
                    text: 'Keep fair treatment and access to redress central — historical upheld rates are never automatic rejection thresholds.',
                  },
                ].map((item) => (
                  <div key={item.rule} className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-[#08162f]">{item.rule}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Jump directly into live FOS evidence by practice area
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRACTICE_AREAS.map((area) => (
                  <PublicTrackedLink
                    key={area.label}
                    href={area.href}
                    eventName="public_cta_clicked"
                    eventProps={{ source: 'cmc_practice_chips', cta: area.label }}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-[#0f1f4f]/40 hover:bg-white hover:text-[#08162f]"
                  >
                    {area.label}
                  </PublicTrackedLink>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                *Motor finance subject to applicable redress framework and referral eligibility.
              </p>
            </div>
          </div>

          {/* Right: Native <details> FAQ Accordion (non-exclusive, accessible, smooth progressive enhancement) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Key questions
            </p>
            <h2 className="mt-1.5 text-xl font-semibold text-[#08162f]">
              What claims teams &amp; compliance leaders ask.
            </h2>

            <div className="rc-accordion mt-3 divide-y divide-slate-200/80">
              {FAQS.map((faq, idx) => (
                <details key={faq.q} open={idx === 0} className="group py-3">
                  <summary className="rc-accordion-summary flex cursor-pointer list-none items-center gap-2.5 text-sm font-semibold text-[#08162f] hover:text-sky-900">
                    <span className="flex-1">{faq.q}</span>
                  </summary>
                  <p className="mt-2 pl-5 text-xs leading-6 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== MODAL 1: 2026/27 FOS FEE CALCULATOR ==================== */}
      <dialog
        ref={calcDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby={calcTitleId}
        className="rc-native-dialog w-[min(580px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">
              2026/27 FOS Charging Structure
            </p>
            <h1 id={calcTitleId} className="mt-1 text-xl font-semibold">
              Representative Fee &amp; Savings Calculator
            </h1>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close fee calculator"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label htmlFor="cmc-cases" className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Avoidable chargeable referrals per month</span>
              <output htmlFor="cmc-cases" className="text-base font-bold text-[#0f1f4f]">
                {casesPerMonth} / month
              </output>
            </label>
            <input
              id="cmc-cases"
              type="range"
              min={0}
              max={50}
              value={casesPerMonth}
              autoFocus
              onChange={(e) => setCasesPerMonth(Number(e.target.value))}
              className="mt-2 w-full accent-[#0f1f4f]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cmc-fee-tier" className="block text-xs font-semibold text-slate-800">
                Applicable FOS case fee
              </label>
              <select
                id="cmc-fee-tier"
                value={feePerCase}
                onChange={(e) => setFeePerCase(Number(e.target.value) as 260 | 80)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value={260}>£260 — standard fee</option>
                <option value={80}>£80 — qualifying reduced fee</option>
              </select>
            </div>

            <div>
              <label htmlFor="cmc-sub" className="block text-xs font-semibold text-slate-800">
                Illustrative monthly subscription (£)
              </label>
              <input
                id="cmc-sub"
                type="number"
                min={0}
                max={100000}
                value={monthlySub}
                onChange={(e) => setMonthlySub(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={allowanceExhausted}
              onChange={(e) => setAllowanceExhausted(e.target.checked)}
              className="h-4 w-4 rounded accent-[#0f1f4f]"
            />
            <span>Assume £2,000 annual FOS representative fee allowance is already exhausted</span>
          </label>

          <div className="rounded-2xl bg-[#08162f] p-4 text-white" aria-live="polite">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#f5daa3]">
              Illustrative annual gross fee savings
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-white">
              {GBP.format(calcResult.grossSavings)}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5 text-xs">
              <span className="text-white/75">Illustrative annual net after subscription ({GBP.format(calcResult.annualSub)}/yr)</span>
              <span className="font-bold text-[#e2b12f]">{GBP.format(calcResult.netSavings)}</span>
            </div>
          </div>

          <p className="text-[11px] leading-5 text-slate-500">
            Scenario modelling only. Source:{' '}
            <a
              href="https://www.financial-ombudsman.org.uk/businesses/resolving-complaint/case-fees"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-800"
            >
              Financial Ombudsman Service case fees
            </a>
            . Appropriate referrals in the customer&apos;s interest should never be discouraged merely to save fees.
          </p>
        </div>
      </dialog>

      {/* ==================== MODAL 2: FCA CLAIMS HANDLING & CMCOB 2.1 SELF-CHECK ==================== */}
      <dialog
        ref={readinessDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby={readinessTitleId}
        className="rc-native-dialog w-[min(640px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">
              Interactive Regulatory Self-Check
            </p>
            <h1 id={readinessTitleId} className="mt-1 text-xl font-semibold">
              FCA Claims Handling &amp; CMCOB 2.1 Readiness
            </h1>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close readiness self-check"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[#08162f]">
                Controls evidenced: {readinessScore.done} of {readinessScore.total}
              </p>
              <p className="text-[11px] text-slate-500">
                Tick each control your team can actively evidence to an FCA supervisor or FOS adjudicator.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#0f1f4f] px-3 py-1 text-sm font-bold text-[#f5daa3]">
              {readinessScore.pct}%
            </span>
          </div>

          <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {READINESS_CHECKS.map((item, idx) => {
              const checked = Boolean(checkedIds[item.id]);
              return (
                <label
                  key={item.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                    checked
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    autoFocus={idx === 0}
                    onChange={() => toggleCheck(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#0f1f4f]"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {item.group}
                      </span>
                      <span className="text-xs font-semibold text-[#08162f]">{item.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.detail}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <PublicTrackedLink
              href="/insights/type/delay-in-claim-handling"
              onClick={closeModal}
              eventName="public_cta_clicked"
              eventProps={{ source: 'cmc_readiness_modal', cta: 'delay_in_claim_handling' }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f1f4f] hover:text-sky-800"
            >
              <Scale className="h-3.5 w-3.5" aria-hidden="true" />
              Inspect live claim-delay FOS decisions
            </PublicTrackedLink>
            <button
              type="button"
              onClick={() => {
                setDemoSubmitted(false);
                setActiveModal('demo');
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0f1f4f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#08162f]"
            >
              Discuss gaps with MEMA
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </dialog>

      {/* ==================== MODAL 3: BOOK PERSONALISED DEMO ==================== */}
      <dialog
        ref={demoDialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby={demoTitleId}
        className="rc-native-dialog w-[min(560px,calc(100%-24px))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#08162f] px-6 py-4 text-white">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e2b12f]">
              Founding Customer Programme
            </p>
            <h1 id={demoTitleId} className="mt-1 text-xl font-semibold">
              Book a Claims Intelligence Walkthrough
            </h1>
          </div>
          <button
            type="button"
            onClick={closeModal}
            aria-label="Close demo request"
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          className="space-y-3.5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setDemoSubmitted(true);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cmc-demo-name" className="block text-xs font-semibold text-slate-800">
                Your name
              </label>
              <input
                id="cmc-demo-name"
                type="text"
                required
                autoFocus
                autoComplete="name"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                placeholder="Jane Smith"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cmc-demo-company" className="block text-xs font-semibold text-slate-800">
                Firm / Organisation
              </label>
              <input
                id="cmc-demo-company"
                type="text"
                required
                autoComplete="organization"
                value={demoCompany}
                onChange={(e) => setDemoCompany(e.target.value)}
                placeholder="Firm name"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="cmc-demo-email" className="block text-xs font-semibold text-slate-800">
                Business email
              </label>
              <input
                id="cmc-demo-email"
                type="email"
                required
                autoComplete="email"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                placeholder="name@firm.co.uk"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="cmc-demo-role" className="block text-xs font-semibold text-slate-800">
                Team profile
              </label>
              <select
                id="cmc-demo-role"
                value={demoRole}
                onChange={(e) => setDemoRole(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option>CMC / Professional Representative</option>
                <option>Financial Claims Law Firm</option>
                <option>Insurer / TPA Claims Handling</option>
                <option>Compliance / MLRO / Board</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="cmc-demo-volume" className="block text-xs font-semibold text-slate-800">
              Monthly claims / complaints reviewed
            </label>
            <select
              id="cmc-demo-volume"
              value={demoVolume}
              onChange={(e) => setDemoVolume(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option>Under 50</option>
              <option>50–250</option>
              <option>251–1,000</option>
              <option>Over 1,000</option>
            </select>
          </div>

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#08162f]"
          >
            Prepare walkthrough brief
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {demoSubmitted ? (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Walkthrough brief prepared for {demoName || 'your team'} ({demoCompany || demoRole} · {demoVolume}/mo).
                </p>
                <p className="mt-1 text-emerald-900/80">
                  Email{' '}
                  <a
                    href={`mailto:contact@memaconsultants.com?subject=${encodeURIComponent(`RegComplaints CMC & Claims Handling Demo — ${demoCompany || demoRole}`)}&body=${encodeURIComponent(`Name: ${demoName}\nFirm: ${demoCompany}\nRole: ${demoRole}\nMonthly volume: ${demoVolume}\nEmail: ${demoEmail}`)}`}
                    className="font-semibold underline"
                  >
                    contact@memaconsultants.com
                  </a>{' '}
                  or jump directly into the{' '}
                  <PublicTrackedLink href={workspaceHref} onClick={closeModal} className="font-semibold underline">
                    live RegComplaints workspace
                  </PublicTrackedLink>
                  . Do not include customer personal data.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              No customer case data should be entered. Built independently by MEMA Consultants.
            </p>
          )}
        </form>
      </dialog>
    </div>
  );
}
