import type { FOSOutcome } from './types';

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
  vulnerabilities: FOSAdvisorVulnerability[];
  sampleCases: FOSAdvisorSampleCase[];
  recommendedActions: FOSAdvisorChecklist[];
}
