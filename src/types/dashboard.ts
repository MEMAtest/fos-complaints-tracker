// src/types/dashboard.ts

export interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

export interface DashboardKPIs {
  total_complaints: number;
  total_firms: number;
  avg_upheld_rate: number;
  total_rows: number;
}

export interface FirmData {
  firm_name: string;
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface ProductData {
  category_name: string;
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface ConsumerCreditData {
  firm_name: string;
  total_received: number;
  avg_upheld_pct: number;
  avg_closure_rate?: number;
}

export interface DashboardResponse {
  success: boolean;
  filters: FilterParams;
  data: {
    kpis: DashboardKPIs;
    topPerformers: FirmData[];
    productCategories: ProductData[];
    industryComparison: FirmData[];
    consumerCredit: ConsumerCreditData[];
    allFirms: { firm_name: string }[];
  };
  debug: {
    timestamp: string;
    dataSource: string;
    executionTime: string;
    appliedFilters: FilterParams;
  };
}
