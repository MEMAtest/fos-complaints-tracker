'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SampleCasesTable } from '@/components/advisor/sample-cases-table';
import { ActionChecklist } from '@/components/advisor/action-checklist';
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

        {/* Brief results */}
        {brief && !loading && (
          <>
            {/* Brief header */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-slate-900">{brief.query.product}</span>
                {brief.query.rootCause && (
                  <>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-700">{brief.query.rootCause}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Brief generated {brief.generatedAt ? formatDate(brief.generatedAt) : 'recently'}
              </p>
            </div>

            {/* Risk assessment */}
            <RiskAssessmentCard risk={brief.riskAssessment} />

            {/* AI guidance */}
            {brief.aiGuidance && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Overall Guidance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                    {brief.aiGuidance}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* What wins / what loses */}
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

            {/* Precedents + Root cause patterns */}
            <section className="grid gap-4 xl:grid-cols-2">
              <ExpandableCard title="Key Precedents" description="Most frequently cited precedents in decisions for this product.">
                <PrecedentList precedents={brief.keyPrecedents} />
              </ExpandableCard>
              <ExpandableCard title="Root Cause Patterns" description="Root causes ranked by frequency with their upheld rates.">
                <RootCausePatterns patterns={brief.rootCausePatterns} />
              </ExpandableCard>
            </section>

            {/* Sample cases */}
            <ExpandableCard title="Sample Decisions" description="Recent upheld and not-upheld decisions. Click a row to view full case detail.">
              <SampleCasesTable cases={brief.sampleCases} onSelectCase={setSelectedCaseId} />
            </ExpandableCard>

            {/* Recommended actions */}
            <ExpandableCard title="Recommended Actions" description="Prioritised checklist based on precedents, root causes, and vulnerability patterns.">
              <ActionChecklist actions={brief.recommendedActions} />
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
      />
    </main>
  );
}
