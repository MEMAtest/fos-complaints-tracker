import { FOSDashboardFilters, FOSDashboardSnapshot, FOSCaseDetail } from '@/lib/fos/types';

export interface FOSDashboardApiResponse {
  success: boolean;
  generatedAt: string;
  filters: FOSDashboardFilters;
  data: FOSDashboardSnapshot;
  error?: string;
}

export interface FOSCaseDetailApiResponse {
  success: boolean;
  data?: FOSCaseDetail;
  error?: string;
}
