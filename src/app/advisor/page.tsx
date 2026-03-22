'use client';

import { useState } from 'react';
import { ExpandableCard } from '@/components/shared/expandable-card';
import { SkeletonCard } from '@/components/shared/skeleton-card';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { useCaseDetail } from '@/hooks/use-fos-dashboard';
import { useFosAdvisor } from '@/hooks/use-fos-advisor';
import { AdvisorInputForm } from '@/components/advisor/advisor-input-form';
import { RiskAssessmentCard } from '@/components/advisor/risk-assessment-card';
import { PrecedentList } from '@/components/advisor/precedent-list';
import { RootCausePatterns } from '@/components/advisor/root-cause-patterns';
import { ThemeCard } from '@/components/advisor/theme-card';
import { ActionChecklist } from '@/components/advisor/action-checklist';
import { ExecutiveSummary } from '@/components/advisor/executive-summary';
import { OutcomeDonutChart } from '@/components/advisor/outcome-donut-chart';
import { YearTrendChart } from '@/components/advisor/year-trend-chart';
import { PrecedentBarChart } from '@/components/advisor/precedent-bar-chart';
import { DecisionsBrowser } from '@/components/advisor/decisions-browser';
import { formatDate } from '@/lib/utils';

export default function AdvisorPage() {
  const { brief, loading, error, options, optionsLoading, fetchBrief } = useFosAdvisor();
  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();
  const [hasQueried, setHasQueried] = useState(false);

  const handleSubmit = (product: string, rootCause: string | null, freeText: string | null) => {
    setHasQueried(true);
    void fetchBrief({ product, rootCause, freeText });
  };

  return (
    <main className="relative min-h-screen pb-16">
      {loading && (
        <div className="sticky top-0 z-40 h-1 w-full overflow-hidden bg-blue-100/80">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-amber-500 to-orange-500" />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1340px] flex-col gap-5 px-4 py-5 md:px-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Complaint Advisor</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Pre-analysed intelligence briefs for FOS complaint products and root causes. Select a product to view risk
            assessments, key precedents, what wins and loses cases, and recommended actions.
          </p>
        </div>

        {/* Input form */}
        <AdvisorInputForm
          products={options?.products || []}
          rootCauses={options?.rootCauses || []}
          loading={loading}
          optionsLoading={optionsLoading}
          onSubmit={handleSubmit}
        />

        {/* Error */}
        {error && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span>{error}</span>
          </section>
        )}

        {/* Loading skeleton */}
        {loading && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </section>
        )}

        {/* Empty state */}
        {!loading && hasQueried && !brief && !error && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm text-amber-800">
              No pre-computed intelligence brief is available for this combination yet. Briefs are generated periodically
              for product/root-cause combinations with sufficient case volume.
            </p>
          </section>
        )}

        {/* Brief results — report layout */}
        {brief && !loading && (
          <>
            {/* 1. Report header */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-lg font-semibold text-slate-900">{brief.query.product}</span>
                {brief.query.rootCause && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span className="text-base text-slate-700">{brief.query.rootCause}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Brief generated {brief.generatedAt ? formatDate(brief.generatedAt) : 'recently'}
              </p>
            </div>

            {/* 2. Executive Summary (AI narrative) */}
            {brief.aiExecutiveSummary && (
              <ExecutiveSummary summary={brief.aiExecutiveSummary} />
            )}

            {/* 3. Risk Assessment + Outcome Donut side-by-side */}
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RiskAssessmentCard risk={brief.riskAssessment} />
              </div>
              {brief.outcomeDistribution && brief.outcomeDistribution.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Outcome Distribution</h3>
                  <OutcomeDonutChart distribution={brief.outcomeDistribution} />
                </div>
              )}
            </section>

            {/* 4. Year-over-Year Trend (full-width) */}
            {brief.riskAssessment.yearTrend.length > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Year-over-Year Trend</h3>
                <YearTrendChart yearTrend={brief.riskAssessment.yearTrend} />
              </div>
            )}

            {/* 5. Precedent Analysis (bar chart) + 6. Root Cause Patterns */}
            <section className="grid gap-4 xl:grid-cols-2">
              <ExpandableCard title="Precedent Analysis" description="Most frequently cited precedents in decisions for this product.">
                <PrecedentBarChart precedents={brief.keyPrecedents} />
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <PrecedentList precedents={brief.keyPrecedents} />
                </div>
              </ExpandableCard>
              <ExpandableCard title="Root Cause Analysis" description="Root causes ranked by frequency with their upheld rates.">
                <RootCausePatterns patterns={brief.rootCausePatterns} />
              </ExpandableCard>
            </section>

            {/* 7. What Wins / What Loses (AI narratives with case citations) */}
            <section className="grid gap-4 md:grid-cols-2">
              <ThemeCard
                title="What Wins Cases (Not Upheld)"
                aiNarrative={brief.aiWhatWins}
                themes={brief.whatWins}
                variant="wins"
              />
              <ThemeCard
                title="What Loses Cases (Upheld)"
                aiNarrative={brief.aiWhatLoses}
                themes={brief.whatLoses}
                variant="loses"
              />
            </section>

            {/* AI Guidance (if available) */}
            {brief.aiGuidance && (
              <div className="rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Compliance Guidance</h3>
                <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {brief.aiGuidance}
                </div>
              </div>
            )}

            {/* 8. Recommended Actions */}
            <ExpandableCard title="Recommended Actions" description="Prioritised checklist based on precedents, root causes, and vulnerability patterns.">
              <ActionChecklist actions={brief.recommendedActions} />
            </ExpandableCard>

            {/* 9. Decisions Browser (paginated table) */}
            <ExpandableCard title="Sample Decisions" description="Recent upheld and not-upheld decisions. Click a row to view full case detail.">
              <DecisionsBrowser cases={brief.sampleCases} onSelectCase={setSelectedCaseId} />
            </ExpandableCard>
          </>
        )}

        {/* Initial state */}
        {!hasQueried && !loading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">
              Select a product above to load its pre-analysed intelligence brief.
            </p>
          </section>
        )}
      </div>

      {/* Case detail sheet */}
      <CaseDetailSheet
        open={!!selectedCaseId}
        onOpenChange={(open) => !open && setSelectedCaseId(null)}
        caseDetail={selectedCase}
        loading={caseLoading}
        error={caseError}
        onSelectCase={setSelectedCaseId}
      />
    </main>
  );
}
