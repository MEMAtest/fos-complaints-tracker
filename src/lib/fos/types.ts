export type FOSOutcome =
  | 'upheld'
  | 'not_upheld'
  | 'partially_upheld'
  | 'settled'
  | 'not_settled'
  | 'unknown';

export interface FOSDashboardFilters {
  query: string;
  years: number[];
  outcomes: FOSOutcome[];
  products: string[];
  firms: string[];
  tags: string[];
  page: number;
  pageSize: number;
}

export interface FOSOverview {
  totalCases: number;
  upheldCases: number;
  notUpheldCases: number;
  partiallyUpheldCases: number;
  upheldRate: number;
  notUpheldRate: number;
  topRootCause: string | null;
  topPrecedent: string | null;
  earliestDecisionDate: string | null;
  latestDecisionDate: string | null;
}

export interface FOSYearTrend {
  year: number;
  total: number;
  upheld: number;
  notUpheld: number;
  partiallyUpheld: number;
  unknown: number;
}

export interface FOSOutcomeDistribution {
  outcome: FOSOutcome;
  count: number;
}

export interface FOSProductDistribution {
  product: string;
  total: number;
  upheldRate: number;
}

export interface FOSFirmDistribution {
  firm: string;
  total: number;
  upheldRate: number;
  notUpheldRate: number;
}

export interface FOSTagCount {
  label: string;
  count: number;
}

export interface FOSCaseListItem {
  caseId: string;
  decisionReference: string;
  decisionDate: string | null;
  year: number | null;
  firmName: string | null;
  productGroup: string | null;
  outcome: FOSOutcome;
  ombudsmanName: string | null;
  decisionSummary: string | null;
  decisionLogic: string | null;
  precedents: string[];
  rootCauseTags: string[];
  vulnerabilityFlags: string[];
  pdfUrl: string | null;
  sourceUrl: string | null;
}

export type FOSSectionSource = 'stored' | 'inferred' | 'missing';

export interface FOSCaseSectionSources {
  complaint: FOSSectionSource;
  firmResponse: FOSSectionSource;
  ombudsmanReasoning: FOSSectionSource;
  finalDecision: FOSSectionSource;
}

export interface FOSCaseSectionConfidence {
  complaint: number;
  firmResponse: number;
  ombudsmanReasoning: number;
  finalDecision: number;
}

export interface FOSCaseDetail extends FOSCaseListItem {
  complaintText: string | null;
  firmResponseText: string | null;
  ombudsmanReasoningText: string | null;
  finalDecisionText: string | null;
  fullText: string | null;
  sectionSources: FOSCaseSectionSources;
  sectionConfidence: FOSCaseSectionConfidence;
}

export interface FOSPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FOSYearInsight {
  year: number;
  headline: string;
  detail: string;
}

export interface FOSFilterOptions {
  years: number[];
  outcomes: FOSOutcome[];
  products: string[];
  firms: string[];
  tags: string[];
}

export interface FOSIngestionStatus {
  status: 'running' | 'idle' | 'warning' | 'error';
  source: 'fos_ingestion_runs' | 'derived';
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  activeYear: number | null;
  windowsDone: number | null;
  windowsTotal: number | null;
  failedWindows: number | null;
  recordsIngested: number | null;
}

export interface FOSDataQuality {
  missingDecisionDate: number;
  missingOutcome: number;
  withReasoningText: number;
}

export interface FOSDashboardSnapshot {
  overview: FOSOverview;
  trends: FOSYearTrend[];
  outcomes: FOSOutcomeDistribution[];
  products: FOSProductDistribution[];
  firms: FOSFirmDistribution[];
  precedents: FOSTagCount[];
  rootCauses: FOSTagCount[];
  insights: FOSYearInsight[];
  cases: FOSCaseListItem[];
  pagination: FOSPagination;
  filters: FOSFilterOptions;
  ingestion: FOSIngestionStatus;
  dataQuality: FOSDataQuality;
}

export interface FOSYearProductOutcomeCell {
  year: number;
  product: string;
  total: number;
  upheld: number;
  notUpheld: number;
  partiallyUpheld: number;
  upheldRate: number;
  notUpheldRate: number;
}

export interface FOSFirmBenchmarkPoint {
  firm: string;
  total: number;
  upheldRate: number;
  notUpheldRate: number;
  avgDecisionYear: number | null;
  predominantProduct: string | null;
}

export interface FOSPrecedentRootCauseCell {
  precedent: string;
  rootCause: string;
  count: number;
}

export interface FOSProductTreeFirmNode {
  firm: string;
  total: number;
  upheldRate: number;
}

export interface FOSProductTreeNode {
  product: string;
  total: number;
  firms: FOSProductTreeFirmNode[];
}

export interface FOSYearNarrative {
  year: number;
  total: number;
  upheldRate: number;
  changeVsPrior: number | null;
  topProduct: string | null;
  topFirm: string | null;
  headline: string;
  detail: string;
}

export interface FOSMonthlyProductBreakdown {
  month: string;
  product: string;
  count: number;
}

export interface FOSDecisionDayMonthCell {
  month: number;
  dayOfWeek: number;
  count: number;
}

export interface FOSAnalysisSnapshot {
  yearProductOutcome: FOSYearProductOutcomeCell[];
  firmBenchmark: FOSFirmBenchmarkPoint[];
  precedentRootCauseMatrix: FOSPrecedentRootCauseCell[];
  productTree: FOSProductTreeNode[];
  yearNarratives: FOSYearNarrative[];
  monthlyProductBreakdown: FOSMonthlyProductBreakdown[];
  decisionDayMonthGrid: FOSDecisionDayMonthCell[];
}

// Root Cause Analysis types
export interface FOSRootCauseTrend {
  label: string;
  count: number;
  trend: { year: number; count: number }[];
}

export interface FOSRootCauseHierarchy {
  name: string;
  children: { name: string; value: number }[];
}

export interface FOSRootCauseSnapshot {
  rootCauses: FOSRootCauseTrend[];
  hierarchy: FOSRootCauseHierarchy[];
  frequency: FOSTagCount[];
}

// Firm Comparison types
export interface FOSFirmComparisonData {
  name: string;
  totalCases: number;
  upheldRate: number;
  notUpheldRate: number;
  topProducts: { product: string; total: number; upheldRate: number }[];
  yearBreakdown: { year: number; total: number; upheldRate: number }[];
}

export interface FOSComparisonSnapshot {
  firms: FOSFirmComparisonData[];
}

// Complaint Advisor types

export interface FOSAdvisorQuery {
  product: string;
  rootCause: string | null;
  freeText: string | null;
}

export interface FOSAdvisorRiskAssessment {
  totalCases: number;
  upheldRate: number;
  notUpheldRate: number;
  overallUpheldRate: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  trendDirection: 'improving' | 'stable' | 'worsening';
  yearTrend: { year: number; upheldRate: number; total: number }[];
}

export interface FOSAdvisorPrecedent {
  label: string;
  count: number;
  percentOfCases: number;
}

export interface FOSAdvisorRootCausePattern {
  label: string;
  count: number;
  upheldRate: number;
}

export interface FOSAdvisorThemeExtract {
  theme: string;
  frequency: number;
  sampleCaseIds: string[];
}

export interface FOSAdvisorVulnerability {
  label: string;
  count: number;
  percentOfCases: number;
}

export interface FOSAdvisorSampleCase {
  caseId: string;
  decisionReference: string;
  decisionDate: string | null;
  firmName: string | null;
  outcome: FOSOutcome;
  decisionSummary: string | null;
  rootCauseTags: string[];
  precedents: string[];
}

export interface FOSAdvisorChecklist {
  item: string;
  source: 'precedent' | 'root_cause' | 'theme' | 'vulnerability';
  priority: 'critical' | 'important' | 'recommended';
}

export interface FOSAdvisorBrief {
  query: FOSAdvisorQuery;
  generatedAt: string;
  riskAssessment: FOSAdvisorRiskAssessment;
  keyPrecedents: FOSAdvisorPrecedent[];
  rootCausePatterns: FOSAdvisorRootCausePattern[];
  whatWins: FOSAdvisorThemeExtract[];
  whatLoses: FOSAdvisorThemeExtract[];
  aiWhatWins: string | null;
  aiWhatLoses: string | null;
  aiGuidance: string | null;
  aiExecutiveSummary: string | null;
  outcomeDistribution: FOSOutcomeDistribution[] | null;
  vulnerabilities: FOSAdvisorVulnerability[];
  sampleCases: FOSAdvisorSampleCase[];
  recommendedActions: FOSAdvisorChecklist[];
}

// On-demand subset analysis types

export interface FOSSubsetRootCause {
  label: string;
  count: number;
  upheldRate: number;
}

export interface FOSSubsetPrecedent {
  label: string;
  count: number;
  percentOfCases: number;
}

export interface FOSSubsetAnalysis {
  narrative: string;
  rootCauses: FOSSubsetRootCause[];
  precedents: FOSSubsetPrecedent[];
  totalCases: number;
  upheldRate: number;
}

// Similar decisions types

export interface FOSSimilarCase {
  caseId: string;
  decisionReference: string;
  decisionDate: string | null;
  firmName: string | null;
  productGroup: string | null;
  outcome: FOSOutcome;
  decisionSummary: string | null;
  similarityScore: number;
}

export interface FOSCaseContext {
  productUpheldRate: number;
  productTotalCases: number;
  rootCauseRates: { label: string; count: number; upheldRate: number }[];
  precedentRates: { label: string; count: number; percentOfCases: number }[];
}
