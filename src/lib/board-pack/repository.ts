import { INITIAL_FILTERS } from '@/lib/fos/constants';
import type { FOSDashboardFilters } from '@/lib/fos/types';
import { getDashboardSnapshot, getAnalysisSnapshot, getRootCauseSnapshot } from '@/lib/fos/repository';
import { getComplaintOperationsSummary, getComplaintWorkspaceSettings, listBoardPackRuns, listComplaintAppendixArtifacts } from '@/lib/complaints/repository';
import type { BoardPackData, BoardPackPreview, BoardPackRequest, BoardPackSection } from './types';

export async function getBoardPackPreview(input: Partial<BoardPackRequest>): Promise<BoardPackPreview> {
  const filters = filtersFromBoardPackInput(input);
  const sections = buildBoardPackSections(input);
  const dashboard = await getDashboardSnapshot(filters, { includeCases: false });
  const complaintSummary = await getComplaintOperationsSummary(input.dateFrom || null, input.dateTo || null);
  const recentRuns = await listBoardPackRuns(8);
  const settings = await getComplaintWorkspaceSettings();
  const appendix = await listComplaintAppendixArtifacts(input.dateFrom || null, input.dateTo || null);

  return {
    success: true,
    sections,
    metrics: {
      totalCases: dashboard.overview.totalCases,
      upheldRate: dashboard.overview.upheldRate,
      complaintsOpen: complaintSummary.open,
      overdueComplaints: complaintSummary.overdue,
      fosReferredCount: complaintSummary.referredToFos,
      appendixLetters: appendix.recentLetters.length,
      appendixEvidence: appendix.recentEvidence.length,
    },
    branding: {
      organizationName: settings.organizationName,
      subtitle: settings.boardPackSubtitle,
    },
    recentRuns,
  };
}

export async function buildBoardPackData(input: BoardPackRequest): Promise<BoardPackData> {
  const filters = filtersFromBoardPackInput(input);
  const sections = buildBoardPackSections(input);
  const dashboard = await getDashboardSnapshot(filters, { includeCases: false });
  const analysis = await getAnalysisSnapshot(filters);
  const rootCauseSnapshot = await getRootCauseSnapshot(filters);
  const complaintSummary = await getComplaintOperationsSummary(input.dateFrom || null, input.dateTo || null);
  const settings = await getComplaintWorkspaceSettings();
  const appendix = await listComplaintAppendixArtifacts(input.dateFrom || null, input.dateTo || null);

  const topFirms = dashboard.firms.slice(0, 8).map((firm) => ({
    firm: firm.firm,
    total: firm.total,
    upheldRate: firm.upheldRate,
    notUpheldRate: firm.notUpheldRate,
  }));

  const topProducts = dashboard.products.slice(0, 8).map((product) => ({
    product: product.product,
    total: product.total,
    upheldRate: product.upheldRate,
  }));

  const topRootCauses = (input.includeRootCauseDeepDive ? rootCauseSnapshot.frequency : dashboard.rootCauses)
    .slice(0, input.includeRootCauseDeepDive ? 8 : 4)
    .map((row) => ({ label: row.label, count: row.count }));

  const trends = dashboard.trends.map((trend) => ({
    year: trend.year,
    total: trend.total,
    upheld: trend.upheld,
    notUpheld: trend.notUpheld,
  }));

  const periodLabel = buildPeriodLabel(input.dateFrom, input.dateTo, filters.years);

  return {
    title: input.title || 'FOS Complaints Board Pack',
    generatedAt: new Date().toISOString(),
    periodLabel,
    branding: {
      organizationName: settings.organizationName,
      subtitle: settings.boardPackSubtitle,
      complaintsTeamName: settings.complaintsTeamName,
      complaintsEmail: settings.complaintsEmail,
      complaintsPhone: settings.complaintsPhone,
      complaintsAddress: settings.complaintsAddress,
    },
    summary: {
      totalCases: dashboard.overview.totalCases,
      upheldRate: dashboard.overview.upheldRate,
      notUpheldRate: dashboard.overview.notUpheldRate,
      totalComplaints: complaintSummary.total,
      openComplaints: complaintSummary.open,
      overdueComplaints: complaintSummary.overdue,
      referredToFos: complaintSummary.referredToFos,
    },
    topFirms,
    topProducts,
    topRootCauses,
    trends: analysis.yearNarratives.length > 0
      ? analysis.yearNarratives.map((row) => ({ year: row.year, total: row.total, upheld: Math.round((row.upheldRate / 100) * row.total), notUpheld: row.total - Math.round((row.upheldRate / 100) * row.total) }))
      : trends,
    boardNotes: {
      executiveSummaryNote: sanitizeText(input.executiveSummaryNote),
      boardFocusNote: sanitizeText(input.boardFocusNote),
      actionSummaryNote: sanitizeText(input.actionSummaryNote),
    },
    appendix: {
      recentLetters: appendix.recentLetters,
      recentEvidence: appendix.recentEvidence,
      lateReferralText: lateReferralPolicyText(settings),
    },
    sections,
  };
}

export function buildBoardPackSections(input: Partial<BoardPackRequest>): BoardPackSection[] {
  return [
    { key: 'cover', title: 'Cover & scope', status: 'included' },
    { key: 'executive_summary', title: 'Executive summary', status: 'included' },
    { key: 'outcomes', title: 'Outcome and trend overview', status: 'included' },
    { key: 'root_causes', title: 'Root causes and precedents', status: input.includeRootCauseDeepDive === false ? 'excluded' : 'included' },
    { key: 'concentration', title: 'Firm and product concentration', status: 'included' },
    { key: 'operations', title: 'Operational complaints health', status: input.includeOperationalComplaints === false ? 'excluded' : 'included' },
    { key: 'comparison', title: 'Comparison section', status: input.includeComparison ? 'included' : 'excluded' },
    { key: 'actions', title: 'Management actions', status: 'included' },
    { key: 'appendix', title: 'Appendix', status: input.includeAppendix === false ? 'excluded' : 'included' },
  ];
}

function filtersFromBoardPackInput(input: Partial<BoardPackRequest>): FOSDashboardFilters {
  const years = yearsFromRange(input.dateFrom, input.dateTo);
  return {
    ...INITIAL_FILTERS,
    years,
    firms: Array.isArray(input.firms) ? input.firms.filter(Boolean) : [],
    products: Array.isArray(input.products) ? input.products.filter(Boolean) : [],
    outcomes: Array.isArray(input.outcomes) ? input.outcomes.filter(Boolean) as FOSDashboardFilters['outcomes'] : [],
    pageSize: 25,
  };
}

function yearsFromRange(dateFrom?: string | null, dateTo?: string | null): number[] {
  const fromYear = dateFrom ? safeYear(dateFrom) : null;
  const toYear = dateTo ? safeYear(dateTo) : null;
  if (!fromYear && !toYear) return [];
  const start = fromYear || toYear || new Date().getUTCFullYear();
  const end = toYear || fromYear || start;
  const years: number[] = [];
  for (let year = Math.min(start, end); year <= Math.max(start, end); year += 1) {
    years.push(year);
  }
  return years;
}

function safeYear(value: string): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getUTCFullYear();
}

function buildPeriodLabel(dateFrom?: string | null, dateTo?: string | null, years: number[] = []): string {
  if (dateFrom && dateTo) {
    return `${dateFrom} to ${dateTo}`;
  }
  if (years.length > 0) {
    return years.length === 1 ? `${years[0]}` : `${years[0]} to ${years[years.length - 1]}`;
  }
  return 'All available data';
}

function sanitizeText(value?: string | null): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text : null;
}

function lateReferralPolicyText(settings: Awaited<ReturnType<typeof getComplaintWorkspaceSettings>>): string {
  switch (settings.lateReferralPosition) {
    case 'consent':
      return 'Configured policy: the organisation consents to the Ombudsman considering complaints referred outside the normal time limit.';
    case 'do_not_consent':
      return 'Configured policy: the organisation does not usually consent to the Ombudsman considering complaints referred outside the normal time limit unless an individual-case decision is made.';
    case 'custom':
      return settings.lateReferralCustomText || 'Configured policy: custom late-referral wording has been set for complaint correspondence.';
    case 'review_required':
    default:
      return settings.lateReferralCustomText || 'Configured policy: late-referral wording remains subject to manual review before issue.';
  }
}
