import {
  FOSAdvisorBrief,
  FOSAnalysisSnapshot,
  FOSCaseDetail,
  FOSCaseListItem,
  FOSDashboardFilters,
  FOSDashboardSnapshot,
  FOSPagination,
  FOSSubsetAnalysis,
  FOSSimilarCase,
  FOSCaseContext,
} from '@/lib/fos/types';

export interface FOSApiMeta {
  queryMs: number;
  cached: boolean;
  snapshotAt: string;
}

export interface FOSDashboardApiResponse {
  success: boolean;
  generatedAt: string;
  filters: FOSDashboardFilters;
  data: FOSDashboardSnapshot;
  meta?: FOSApiMeta;
  error?: string;
}

export interface FOSCaseDetailApiResponse {
  success: boolean;
  data?: FOSCaseDetail;
  error?: string;
}

export interface FOSAnalysisApiResponse {
  success: boolean;
  generatedAt: string;
  filters: FOSDashboardFilters;
  data?: FOSAnalysisSnapshot;
  meta?: FOSApiMeta;
  error?: string;
}

export interface FOSAdvisorApiResponse {
  success: boolean;
  data?: FOSAdvisorBrief;
  error?: string;
}

export interface FOSAdvisorOptionsApiResponse {
  success: boolean;
  data?: { products: string[]; rootCauses: string[] };
  error?: string;
}

export interface FOSCasesApiResponse {
  success: boolean;
  data?: {
    items: FOSCaseListItem[];
    pagination: FOSPagination;
  };
  meta?: FOSApiMeta;
  error?: string;
}

export interface FOSSynthesisApiResponse {
  success: boolean;
  data?: FOSSubsetAnalysis;
  meta?: FOSApiMeta;
  error?: string;
}

export interface FOSSimilarCasesApiResponse {
  success: boolean;
  data?: {
    cases: FOSSimilarCase[];
    context: FOSCaseContext;
  };
  error?: string;
}
