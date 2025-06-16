// src/types/dashboard.ts
// ✅ COMPLETE UPDATED VERSION with Enhanced Chart Types

export interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

export interface KPIData {
  total_complaints: number;
  total_closed: number;
  avg_upheld_rate: number;
  total_firms?: number;
  total_rows?: number;
  
  // ✅ Keep existing fields for backward compatibility
  banking_avg_percentage?: number;
  
  // ✅ Required fields
  avg_percentage_upheld?: number;
  avg_closed_within_8_weeks?: number;
  avg_closed_within_3_days?: number;
  
  sector_uphold_averages?: {[key: string]: number};
  sector_closure_averages?: {[key: string]: number};
  
  // ✅ All sector averages for Product Analysis
  all_sector_averages?: {[key: string]: {uphold_rate: number, complaint_count: number}};
}

export interface TopPerformerData {
  firm_name: string;
  complaint_count?: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface ConsumerCreditData {
  firm_name: string;
  total_received: number;
  total_closed?: number;
  avg_upheld_pct: number;
  avg_closure_rate?: number;
  period_count?: number;
}

export interface ProductCategoryData {
  category_name: string;
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface IndustryComparisonData {
  firm_name: string;
  complaint_count?: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface FirmData {
  firm_name: string;
}

export interface HistoricalTrendData {
  firm_name: string;
  reporting_period: string;
  product_category: string;
  upheld_rate: number;
  closure_rate_3_days: number;
  closure_rate_8_weeks: number;
  trend_year: string;
}

export interface IndustryTrendData {
  year: string;
  avg_uphold_rate: number;
  avg_closure_3_days: number;
  avg_closure_8_weeks: number;
  firm_count: number;
  record_count: number;
}

export interface DashboardAPIResponse {
  success: boolean;
  filters: FilterParams;
  data: {
    kpis: KPIData;
    topPerformers: TopPerformerData[];
    consumerCredit: ConsumerCreditData[];
    productCategories: ProductCategoryData[];
    industryComparison: IndustryComparisonData[];
    allFirms: FirmData[];
    historicalTrends: HistoricalTrendData[];
    industryTrends: IndustryTrendData[];
  };
  debug?: {
    appliedFilters: FilterParams;
    executionTime: string;
    dataSource: string;
    queryCounts: {[key: string]: number};
    sampleData?: {[key: string]: any};
  };
}

export interface APIErrorResponse {
  success: false;
  error: string;
  details?: string;
  debug?: {
    executionTime: string;
    dataSource: string;
  };
}

// ✅ Keep both for compatibility
export interface DashboardResponse extends DashboardAPIResponse {}

// ✅ NEW: Enhanced chart comparison interfaces for Change 1
export interface ChartComparisonMode {
  mode: 'absolute' | 'relative' | 'normalized';
  scaleType: 'shared' | 'individual' | 'industry_relative';
}

export interface ChartScaleConfig {
  min?: number;
  max?: number;
  stepSize?: number;
}

export interface ExtendedDataset {
  label: string;
  data: Array<{x: string, y: number}>;
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  fill: boolean;
  tension: number;
  pointRadius: number;
  pointHoverRadius: number;
  yAxisID?: string;
  borderDash?: number[];
  type?: string;
}

// ✅ Additional interfaces for future features
export interface MultiFirmComparisonData {
  firms: {
    firm_name: string;
    avg_uphold_rate: number;
    avg_closure_rate: number;
    complaint_count: number;
  }[];
  industry_average: {
    avg_uphold_rate: number;
    avg_closure_rate: number;
  };
}

export interface TrendAnalysisData {
  period: string;
  firm_name?: string;
  avg_uphold_rate: number;
  avg_closure_rate: number;
  complaint_count: number;
  trend_direction: 'up' | 'down' | 'stable';
  change_percentage: number;
}

export interface ChartConfiguration {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'bubble';
  responsive: boolean;
  maintainAspectRatio: boolean;
  dynamicScaling?: boolean;
  maxValue?: number;
}