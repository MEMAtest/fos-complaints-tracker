'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Search, AlertCircle, BookOpen, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useCheckEstimator } from '@/hooks/use-check-estimator';
import { RiskGauge } from '@/components/check/risk-gauge';
import { OutcomeBreakdown } from '@/components/check/outcome-breakdown';
import { ConfidenceBadge } from '@/components/check/confidence-badge';
import { FirmComparisonBar } from '@/components/check/firm-comparison-bar';

export function CheckEstimatorPage() {
  const { brief, firmOverlay, loading, error, options, optionsLoading, fetchEstimate } = useCheckEstimator();

  const [product, setProduct] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [firm, setFirm] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!product) return;
    setSubmitted(true);
    void fetchEstimate(product, rootCause || undefined, firm || undefined);
  }

  const risk = brief?.riskAssessment;
  const noData = submitted && !loading && !brief && error;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Complaint Outcome Estimator
        </h1>
        <p className="mt-3 text-base text-slate-600 md:text-lg">
          Instantly check FOS complaint upheld rates by product, root cause, and firm.
          <br className="hidden md:block" />
          Backed by 386,000+ historical decisions.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Product (required) */}
        <label htmlFor="check-product" className="block text-sm font-medium text-slate-700">
          Product / sector <span className="text-rose-500">*</span>
        </label>
        <select
          id="check-product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          disabled={optionsLoading}
          required
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        >
          <option value="">{optionsLoading ? 'Loading products...' : 'Select a product'}</option>
          {options?.products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Root Cause (optional) */}
        <label htmlFor="check-root-cause" className="mt-4 block text-sm font-medium text-slate-700">
          Root cause <span className="text-slate-400">(optional)</span>
        </label>
        <select
          id="check-root-cause"
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          disabled={optionsLoading}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
        >
          <option value="">Any root cause</option>
          {options?.rootCauses.map((rc) => (
            <option key={rc} value={rc}>{rc}</option>
          ))}
        </select>

        {/* Firm (optional text input) */}
        <label htmlFor="check-firm" className="mt-4 block text-sm font-medium text-slate-700">
          Firm name <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="check-firm"
          type="text"
          value={firm}
          onChange={(e) => setFirm(e.target.value)}
          placeholder="e.g. Barclays, Lloyds Banking Group"
          maxLength={200}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />

        <button
          type="submit"
          disabled={!product || loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f1f4f] px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-[#0c1940] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Check My Exposure
            </>
          )}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {brief && risk && (
        <div className="mt-10 space-y-6">
          {/* Risk Gauge + Confidence */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid items-center gap-6 md:grid-cols-2">
              <RiskGauge upheldRate={risk.upheldRate} riskLevel={risk.upholdRiskLevel} />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Not upheld rate</p>
                  <p className="mt-0.5 text-2xl font-semibold text-slate-900">{risk.notUpheldRate.toFixed(1)}%</p>
                </div>
                <ConfidenceBadge sampleSize={risk.sampleSize} />
              </div>
            </div>
          </div>

          {/* Outcome Breakdown */}
          {brief.outcomeDistribution && brief.outcomeDistribution.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <OutcomeBreakdown distribution={brief.outcomeDistribution} totalCases={risk.totalCases} />
            </div>
          )}

          {/* Firm Comparison */}
          {firmOverlay && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <FirmComparisonBar
                firmName={firmOverlay.firmName}
                firmRate={firmOverlay.upheldRate}
                productRate={risk.upheldRate}
                overallRate={risk.overallUpheldRate}
              />
              <p className="mt-2 text-xs text-slate-400">
                Based on {firmOverlay.totalCases.toLocaleString()} decision{firmOverlay.totalCases !== 1 ? 's' : ''} for this firm in this product area.
              </p>
            </div>
          )}

          {/* Firm not found notice */}
          {submitted && firm && !firmOverlay && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-sm text-slate-500">
                No FOS decisions found for &ldquo;{firm}&rdquo; in this product area.
              </p>
            </div>
          )}

          {/* Top Precedents */}
          {brief.keyPrecedents.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-900">Top precedents cited</p>
              </div>
              <ul className="space-y-2">
                {brief.keyPrecedents.slice(0, 5).map((p) => (
                  <li key={p.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{p.label}</span>
                    <span className="tabular-nums text-slate-500">{p.count.toLocaleString()} cases ({p.percentOfCases.toFixed(1)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What Wins / What Loses */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* What Wins */}
            {(brief.whatWins.length > 0 || brief.aiWhatWins) && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">What wins cases</p>
                </div>
                {brief.aiWhatWins && (
                  <p className="mb-3 text-sm leading-relaxed text-emerald-900">{brief.aiWhatWins}</p>
                )}
                {brief.whatWins.length > 0 && (
                  <ul className="space-y-1.5">
                    {brief.whatWins.slice(0, 5).map((t) => (
                      <li key={t.theme} className="flex items-start gap-2 text-sm text-emerald-800">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                        {t.theme}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* What Loses */}
            {(brief.whatLoses.length > 0 || brief.aiWhatLoses) && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ThumbsDown className="h-4 w-4 text-rose-600" />
                  <p className="text-sm font-semibold text-rose-800">What loses cases</p>
                </div>
                {brief.aiWhatLoses && (
                  <p className="mb-3 text-sm leading-relaxed text-rose-900">{brief.aiWhatLoses}</p>
                )}
                {brief.whatLoses.length > 0 && (
                  <ul className="space-y-1.5">
                    {brief.whatLoses.slice(0, 5).map((t) => (
                      <li key={t.theme} className="flex items-start gap-2 text-sm text-rose-800">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400" />
                        {t.theme}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-blue-900">
              Want the complete intelligence brief with AI guidance, sample cases, and recommended actions?
            </p>
            <Link
              href={`/advisor?product=${encodeURIComponent(product)}`}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
            >
              Get the full Advisor Brief
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
