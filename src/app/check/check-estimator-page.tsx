'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, AlertCircle, BookOpen, Loader2, Search, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCheckEstimator } from '@/hooks/use-check-estimator';
import { PublicIllustration } from '@/components/illustrations/public-illustration';
import { CheckExampleChip, CheckExampleChips } from '@/components/check/check-example-chips';
import { CheckExplainerGrid } from '@/components/check/check-explainer-grid';
import { CheckResultsSummary } from '@/components/check/check-results-summary';
import { ConfidenceBadge } from '@/components/check/confidence-badge';
import { FirmComparisonBar } from '@/components/check/firm-comparison-bar';
import { OutcomeBreakdown } from '@/components/check/outcome-breakdown';
import { RiskGauge } from '@/components/check/risk-gauge';

type CheckEstimatorPageProps = {
  liveStats: {
    publishedDecisions: string;
    publicPages: string;
    upheldRate: string;
    latestYear: string;
    featuredLinks: Array<{ title: string; href: string }>;
  };
};

const PREFERRED_PRODUCTS = [
  'Banking and credit',
  'Banking and Payments',
  'Payment protection insurance (PPI)',
  'Mortgage and home finance',
  'Insurance',
  'Consumer Credit',
];

const PREFERRED_ROOT_CAUSES = [
  'Delay in claim handling',
  'Fraud Or Scam Concern',
  'Administration Or Processing Error',
  'Service Quality / Customer Service',
  'Incorrect charges / fees',
];

const PREFERRED_FIRMS = ['Barclays', 'Lloyds Bank PLC', 'Bank of Scotland Plc'];

function matchPreferred(options: string[], preferred: string[]): string | undefined {
  return preferred
    .map((candidate) => options.find((option) => option.toLowerCase() === candidate.toLowerCase()))
    .find(Boolean);
}

function buildExampleChips(options: { products: string[]; rootCauses: string[] } | null): CheckExampleChip[] {
  if (!options?.products.length) return [];

  const products = [
    ...PREFERRED_PRODUCTS.map((candidate) => options.products.find((option) => option.toLowerCase() === candidate.toLowerCase())).filter(Boolean) as string[],
    ...options.products,
  ].filter((value, index, array) => array.indexOf(value) === index);

  const rootCause = matchPreferred(options.rootCauses, PREFERRED_ROOT_CAUSES);
  const secondaryRootCause = options.rootCauses.find((option) => option !== rootCause) || rootCause;

  const draft: CheckExampleChip[] = [
    {
      label: products[0] ? `${products[0]} signal` : 'Banking signal',
      helper: rootCause ? `${rootCause} · public signal only` : 'Public signal only',
      product: products[0] || options.products[0],
      rootCause,
    },
    {
      label: products[1] ? `${products[1]} at Barclays` : 'Barclays overlay',
      helper: 'Product view with a firm overlay',
      product: products[1] || products[0] || options.products[0],
      firm: PREFERRED_FIRMS[0],
      rootCause: secondaryRootCause,
    },
    {
      label: products[2] ? `${products[2]} depth` : 'Complaint depth',
      helper: secondaryRootCause ? `${secondaryRootCause} context` : 'Comparable pattern view',
      product: products[2] || products[0] || options.products[0],
      rootCause: secondaryRootCause,
      firm: PREFERRED_FIRMS[1],
    },
    {
      label: products[3] ? `${products[3]} snapshot` : 'Published snapshot',
      helper: 'Start with the public estimate, then move deeper',
      product: products[3] || products[0] || options.products[0],
      firm: PREFERRED_FIRMS[2],
    },
  ];

  return draft.filter((chip, index, array) => {
    const fingerprint = `${chip.product}__${chip.rootCause || ''}__${chip.firm || ''}`;
    return array.findIndex((candidate) => `${candidate.product}__${candidate.rootCause || ''}__${candidate.firm || ''}` === fingerprint) === index;
  });
}

export function CheckEstimatorPage({ liveStats }: CheckEstimatorPageProps) {
  const { brief, firmOverlay, loading, error, options, optionsLoading, fetchEstimate } = useCheckEstimator();

  const [product, setProduct] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [firm, setFirm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const exampleChips = useMemo(() => buildExampleChips(options), [options]);
  const activeExampleLabel = useMemo(
    () =>
      exampleChips.find(
        (chip) => chip.product === product && (chip.rootCause || '') === rootCause && (chip.firm || '') === firm
      )?.label || null,
    [exampleChips, firm, product, rootCause]
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    setSubmitted(true);
    void fetchEstimate(product, rootCause || undefined, firm || undefined);
  }

  function handleExampleSelect(chip: CheckExampleChip) {
    setProduct(chip.product);
    setRootCause(chip.rootCause || '');
    setFirm(chip.firm || '');
    setSubmitted(true);
    void fetchEstimate(chip.product, chip.rootCause, chip.firm);
  }

  const risk = brief?.riskAssessment;
  const fullAdvisorHref = product
    ? `/advisor?product=${encodeURIComponent(product)}${rootCause ? `&rootCause=${encodeURIComponent(rootCause)}` : ''}`
    : '/advisor';

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#fcfbf7_0%,#f4f8ff_54%,#eef4ff_100%)]">
        <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_24%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 md:px-8 md:py-16 xl:grid-cols-[0.92fr_1.08fr] xl:items-center">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">Public estimator</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl md:leading-[0.98]">
              Complaint Outcome Estimator
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
              Check the live upheld-rate signal for a complaint context in seconds. Start with product and root cause,
              then overlay a firm where you have one.
            </p>
            <div className="mt-8 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-200 bg-white/92 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Published decisions</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{liveStats.publishedDecisions}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Live public corpus behind the estimate.</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)] p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current upheld rate</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{liveStats.upheldRate}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">A live read on how the published corpus is resolving today.</p>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3 text-sm text-slate-600">
              {[
                'Public first: search the signal before you open the workspace',
                'Sample size shown alongside every estimate',
                'Firm overlay where published decisions exist',
              ].map((item) => (
                <span key={item} className="inline-flex rounded-full border border-slate-200 bg-white/88 px-4 py-2 shadow-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <PublicIllustration variant="estimator" className="rounded-[2.3rem] bg-[linear-gradient(180deg,#fffdf8_0%,#f3f7ff_100%)]" />
            <div className="absolute -bottom-4 left-4 right-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.14)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Public insight pages</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{liveStats.publicPages}</p>
                <p className="mt-2 text-xs leading-5 text-slate-600">The estimator sits on the same live public analysis layer as years, firms, products, and themes.</p>
              </div>
              <div className="rounded-[1.5rem] border border-[#102a4e] bg-[#102a4e] p-4 text-white shadow-[0_24px_60px_rgba(16,42,78,0.24)]">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Latest year in focus</p>
                <p className="mt-2 text-xl font-semibold tracking-tight">{liveStats.latestYear}</p>
                <p className="mt-2 text-xs leading-5 text-white/72">Use the estimator for fast exposure checks, then step into the deeper public analysis if you need context.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-6 w-full max-w-7xl px-4 md:px-8">
        <section className="relative z-10 grid gap-6 rounded-[2.3rem] border border-slate-200 bg-white/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.14)] md:p-8 xl:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Guided estimate
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              Start with the complaint context that matters.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Product is required. Root cause and firm are optional, but they sharpen the signal when published decisions exist.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,#fffefb_0%,#f8fbff_100%)] p-5 shadow-sm md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="check-product" className="block text-sm font-medium text-slate-700">
                    Product / sector <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="check-product"
                    value={product}
                    onChange={(event) => setProduct(event.target.value)}
                    disabled={optionsLoading}
                    required
                    className="mt-2 block w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    <option value="">{optionsLoading ? 'Loading products...' : 'Select a product'}</option>
                    {options?.products.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">This anchors the estimate in the right slice of the published FOS corpus.</p>
                </div>

                <div>
                  <label htmlFor="check-root-cause" className="block text-sm font-medium text-slate-700">
                    Root cause <span className="text-slate-400">(optional)</span>
                  </label>
                  <select
                    id="check-root-cause"
                    value={rootCause}
                    onChange={(event) => setRootCause(event.target.value)}
                    disabled={optionsLoading}
                    className="mt-2 block w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  >
                    <option value="">Any root cause</option>
                    {options?.rootCauses.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Use this when you want a narrower complaint-theme or operational pattern.</p>
                </div>

                <div>
                  <label htmlFor="check-firm" className="block text-sm font-medium text-slate-700">
                    Firm name <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="check-firm"
                    type="text"
                    value={firm}
                    onChange={(event) => setFirm(event.target.value)}
                    placeholder="e.g. Barclays, Lloyds Bank PLC"
                    maxLength={200}
                    className="mt-2 block w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-500">If the published corpus has enough matching decisions, you will see a firm overlay against the wider product context.</p>
                </div>
              </div>

              <CheckExampleChips chips={exampleChips} activeLabel={activeExampleLabel} onSelect={handleExampleSelect} />

              <button
                type="submit"
                disabled={!product || loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#102a4e] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(16,42,78,0.22)] transition hover:bg-[#0d2240] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysing published decisions...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Estimate likely uphold exposure
                  </>
                )}
              </button>
            </form>
          </div>

          <CheckExplainerGrid />
        </section>
      </div>

      {error ? (
        <div className="mx-auto mt-8 w-full max-w-7xl px-4 md:px-8">
          <div className="flex items-start gap-3 rounded-[1.6rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Estimate unavailable</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {loading && !brief ? (
        <div className="mx-auto mt-8 w-full max-w-7xl px-4 md:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="animate-pulse rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-3 w-24 rounded-full bg-slate-200" />
                <div className="mt-4 h-10 w-36 rounded-full bg-slate-200" />
                <div className="mt-6 h-24 rounded-[1.2rem] bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {brief && risk ? (
        <div className="mx-auto mt-10 flex w-full max-w-7xl flex-col gap-8 px-4 md:px-8">
          <CheckResultsSummary
            upheldRate={risk.upheldRate}
            upholdRiskLevel={risk.upholdRiskLevel}
            sampleSize={risk.sampleSize}
            overallUpheldRate={risk.overallUpheldRate}
            firmName={firmOverlay?.firmName}
            firmRate={firmOverlay?.upheldRate ?? null}
          />

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-6">
              <RiskGauge upheldRate={risk.upheldRate} upholdRiskLevel={risk.upholdRiskLevel} />
              {brief.outcomeDistribution && brief.outcomeDistribution.length > 0 ? (
                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <OutcomeBreakdown distribution={brief.outcomeDistribution} totalCases={risk.totalCases} />
                </div>
              ) : null}
            </div>
            <div className="grid gap-6">
              <ConfidenceBadge sampleSize={risk.sampleSize} />
              <section className="rounded-[1.9rem] border border-[#102a4e] bg-[#102a4e] p-6 text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">How to read this</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">Use the estimate as fast complaint context, not as the final decision.</h3>
                <ul className="mt-5 grid gap-3 text-sm leading-6 text-white/75">
                  <li className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3">The upheld rate shows how similar published complaints resolved in the current corpus.</li>
                  <li className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3">Sample size tells you how much decision history is behind the signal.</li>
                  <li className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3">The firm overlay only appears when the published data is deep enough in that product context.</li>
                </ul>
              </section>
              {firmOverlay ? (
                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <FirmComparisonBar
                    firmName={firmOverlay.firmName}
                    firmRate={firmOverlay.upheldRate}
                    productRate={risk.upheldRate}
                    overallRate={risk.overallUpheldRate}
                  />
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Based on {firmOverlay.totalCases.toLocaleString()} published decision{firmOverlay.totalCases !== 1 ? 's' : ''} for this firm in the selected product context.
                  </p>
                </div>
              ) : submitted && firm && !loading ? (
                <div className="rounded-[1.9rem] border border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-600 shadow-sm">
                  No published firm overlay was found for “{firm}” in this product slice. The wider product estimate is still shown above.
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {brief.keyPrecedents.length > 0 ? (
              <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-900">Top precedents cited</p>
                </div>
                <div className="grid gap-3">
                  {brief.keyPrecedents.slice(0, 5).map((precedent) => (
                    <div key={precedent.label} className="rounded-[1.2rem] border border-slate-200 bg-[#fbfcfe] px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-900">{precedent.label}</span>
                        <span className="font-semibold text-slate-950">{precedent.count.toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{precedent.percentOfCases.toFixed(1)}% of comparable published decisions.</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Public analysis links</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Keep moving through the public intelligence layer</h3>
              <div className="mt-5 grid gap-3">
                {liveStats.featuredLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded-[1.2rem] border border-slate-200 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] px-4 py-3 transition hover:border-amber-300">
                    <p className="font-semibold text-slate-950">{link.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Open a live public analysis page from the same corpus.</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            {(brief.whatWins.length > 0 || brief.aiWhatWins) ? (
              <div className="rounded-[1.9rem] border border-emerald-200 bg-[linear-gradient(180deg,#effcf6_0%,#ffffff_100%)] p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-900">What tends to win cases</p>
                </div>
                {brief.aiWhatWins ? <p className="mb-4 text-sm leading-7 text-emerald-950">{brief.aiWhatWins}</p> : null}
                {brief.whatWins.length > 0 ? (
                  <ul className="grid gap-3">
                    {brief.whatWins.slice(0, 5).map((theme) => (
                      <li key={theme.theme} className="rounded-[1.2rem] border border-emerald-200/70 bg-white/90 px-4 py-3 text-sm leading-6 text-emerald-900">
                        {theme.theme}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {(brief.whatLoses.length > 0 || brief.aiWhatLoses) ? (
              <div className="rounded-[1.9rem] border border-rose-200 bg-[linear-gradient(180deg,#fff0f3_0%,#ffffff_100%)] p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-rose-600" />
                  <p className="text-sm font-semibold text-rose-900">What tends to lose cases</p>
                </div>
                {brief.aiWhatLoses ? <p className="mb-4 text-sm leading-7 text-rose-950">{brief.aiWhatLoses}</p> : null}
                {brief.whatLoses.length > 0 ? (
                  <ul className="grid gap-3">
                    {brief.whatLoses.slice(0, 5).map((theme) => (
                      <li key={theme.theme} className="rounded-[1.2rem] border border-rose-200/70 bg-white/90 px-4 py-3 text-sm leading-6 text-rose-900">
                        {theme.theme}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-[#102a4e] bg-[#08162f] text-white shadow-[0_32px_90px_rgba(0,0,0,0.22)]">
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_0.9fr] md:p-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Next step</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">Move from a fast public estimate into the full complaint intelligence layer.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72">
                  Use the estimator to check likely exposure quickly, then open the full advisor brief for deeper narrative guidance or move into the workspace when the complaint needs handling depth.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={fullAdvisorHref} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                    Get the full Advisor Brief
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/workspace" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12">
                    Open workspace
                  </Link>
                </div>
              </div>
              <PublicIllustration variant="workflow" className="border-white/10 bg-[linear-gradient(180deg,#fffef9_0%,#eef5ff_100%)] shadow-none" />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
