'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseDetailSheet } from '@/components/dashboard/case-detail-sheet';
import { useCaseDetail } from '@/hooks/use-fos-dashboard';
import {
  ComplaintLetterIntelligenceResponse,
  ComplaintLetterTemplateKey,
  ComplaintRecord,
} from '@/lib/complaints/types';
import {
  buildChallengeAreasBlock,
  buildReferralChecklistBlock,
  buildRemediationPromptsBlock,
  buildResponseStrengthsBlock,
  buildReviewPointsBlock,
} from '@/lib/complaints/letter-drafting';
import { formatDate, formatDateTime, formatNumber, formatPercent, truncate } from '@/lib/utils';

const ACTIONS_BY_TEMPLATE: Record<ComplaintLetterTemplateKey, Array<{ key: string; label: string }>> = {
  acknowledgement: [
    { key: 'reviewPoints', label: 'Insert review points' },
  ],
  holding_response: [
    { key: 'reviewPoints', label: 'Insert review points' },
    { key: 'challengeAreas', label: 'Insert challenge areas' },
  ],
  final_response: [
    { key: 'reviewPoints', label: 'Insert review points' },
    { key: 'challengeAreas', label: 'Insert challenge areas' },
    { key: 'responseStrengths', label: 'Insert response strengths' },
    { key: 'remediationPrompts', label: 'Insert remediation prompts' },
  ],
  fos_referral: [
    { key: 'referralChecklist', label: 'Insert referral checklist' },
  ],
  custom: [
    { key: 'reviewPoints', label: 'Insert review points' },
    { key: 'challengeAreas', label: 'Insert challenge areas' },
    { key: 'responseStrengths', label: 'Insert response strengths' },
    { key: 'remediationPrompts', label: 'Insert remediation prompts' },
    { key: 'referralChecklist', label: 'Insert referral checklist' },
  ],
};

export function ComplaintLetterIntelligencePanel({
  complaint,
  activeTemplateKey,
  hasActiveLetter,
  onInsert,
}: {
  complaint: ComplaintRecord;
  activeTemplateKey: ComplaintLetterTemplateKey | null;
  hasActiveLetter: boolean;
  onInsert: (text: string) => void;
}) {
  const [payload, setPayload] = useState<ComplaintLetterIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedCaseId, setSelectedCaseId, selectedCase, caseLoading, caseError } = useCaseDetail();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadIntelligence() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/complaints/${complaint.id}/letter-intelligence`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const nextPayload = (await response.json()) as ComplaintLetterIntelligenceResponse;
        if (!response.ok || !nextPayload.success) {
          throw new Error(nextPayload.error || 'Failed to load complaint drafting intelligence.');
        }
        if (!cancelled) setPayload(nextPayload);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load complaint drafting intelligence.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadIntelligence();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [complaint.id]);

  const intelligence = payload?.data || null;
  const actions = useMemo(() => ACTIONS_BY_TEMPLATE[activeTemplateKey || 'custom'], [activeTemplateKey]);

  function insertBlock(kind: string) {
    if (!intelligence) return;
    switch (kind) {
      case 'reviewPoints':
        onInsert(buildReviewPointsBlock(intelligence));
        return;
      case 'challengeAreas':
        onInsert(buildChallengeAreasBlock(intelligence));
        return;
      case 'responseStrengths':
        onInsert(buildResponseStrengthsBlock(intelligence));
        return;
      case 'remediationPrompts':
        onInsert(buildRemediationPromptsBlock(intelligence));
        return;
      case 'referralChecklist':
        onInsert(buildReferralChecklistBlock(intelligence));
        return;
      default:
        return;
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4" />FOS drafting intelligence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Building complaint-scoped guidance from the FOS analysis corpus.
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <div>{error}</div>
            </div>
          ) : !intelligence ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {payload?.reason || 'No complaint-scoped drafting intelligence is available for this file yet.'}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="outline">{intelligence.sourceScope === 'product_root_cause' ? 'Product + root cause' : 'Product only'}</Badge>
                <Badge variant="outline">Risk {intelligence.riskSnapshot.riskLevel.replace('_', ' ')}</Badge>
                <span>Generated {formatDateTime(intelligence.generatedAt)}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Similar cases" value={formatNumber(intelligence.riskSnapshot.totalCases)} />
                <MetricCard label="Upheld" value={formatPercent(intelligence.riskSnapshot.upheldRate)} />
                <MetricCard label="Not upheld" value={formatPercent(intelligence.riskSnapshot.notUpheldRate)} />
                <MetricCard label="Trend" value={intelligence.riskSnapshot.trendDirection} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Draft assist</p>
                    <p className="mt-1 text-xs text-slate-500">Insert editable internal drafting support into the active letter. Specific precedent and case references stay on-screen only.</p>
                  </div>
                  {!hasActiveLetter ? <Badge variant="outline">Select a letter to insert guidance</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button
                      key={action.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!hasActiveLetter}
                      onClick={() => insertBlock(action.key)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              {intelligence.aiGuidance ? (
                <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Internal guidance</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{intelligence.aiGuidance}</p>
                </section>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <InsightList
                  title="What tends to lose cases"
                  emptyLabel="No recurring losing themes are available yet."
                  items={intelligence.whatLoses.map((item) => `${item.theme} (${item.frequency})`)}
                />
                <InsightList
                  title="What tends to support the file"
                  emptyLabel="No recurring winning themes are available yet."
                  items={intelligence.whatWins.map((item) => `${item.theme} (${item.frequency})`)}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <InsightList
                  title="Recommended actions"
                  emptyLabel="No recommended actions are available yet."
                  items={intelligence.recommendedActions.map((item) => `${item.priority}: ${item.item}`)}
                />
                <InsightList
                  title="Root-cause patterns"
                  emptyLabel="No root-cause patterns are available yet."
                  items={intelligence.rootCausePatterns.map((item) => `${item.label} (${item.count} cases, ${formatPercent(item.upheldRate)} upheld)`)}
                />
              </div>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Internal precedents</p>
                    <p className="mt-1 text-xs text-slate-500">Use these themes to test your reasoning, not to cite directly in the customer letter.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intelligence.keyPrecedents.length === 0 ? (
                    <span className="text-sm text-slate-500">No precedent signals available.</span>
                  ) : intelligence.keyPrecedents.map((item) => (
                    <Badge key={item.label} variant="outline" className="rounded-full">
                      {item.label} · {item.count} · {formatPercent(item.percentOfCases)}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Comparable cases</p>
                  <p className="mt-1 text-xs text-slate-500">Review the underlying published decisions before finalising the reasoning.</p>
                </div>
                {intelligence.sampleCases.length === 0 ? (
                  <p className="text-sm text-slate-500">No comparable cases available.</p>
                ) : (
                  <div className="space-y-3">
                    {intelligence.sampleCases.map((item) => (
                      <button
                        key={item.caseId}
                        type="button"
                        onClick={() => setSelectedCaseId(item.caseId)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{item.decisionReference}</p>
                          <Badge variant="outline">{item.outcome.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.firmName || 'Unknown firm'}
                          {item.decisionDate ? ` · ${formatDate(item.decisionDate)}` : ''}
                        </p>
                        {item.summary ? <p className="mt-2 text-sm text-slate-600">{truncate(item.summary, 220)}</p> : null}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </CardContent>
      </Card>

      <CaseDetailSheet
        open={Boolean(selectedCaseId)}
        onOpenChange={(open) => {
          if (!open) setSelectedCaseId(null);
        }}
        caseDetail={selectedCase}
        loading={caseLoading}
        error={caseError}
      />
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InsightList({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
