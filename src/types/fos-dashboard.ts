import { FOSAnalysisSnapshot, FOSCaseDetail, FOSDashboardFilters, FOSDashboardSnapshot } from '@/lib/fos/types';

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
