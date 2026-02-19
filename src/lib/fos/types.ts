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

export interface FOSCaseDetail extends FOSCaseListItem {
  complaintText: string | null;
  firmResponseText: string | null;
  ombudsmanReasoningText: string | null;
  finalDecisionText: string | null;
  fullText: string | null;
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
