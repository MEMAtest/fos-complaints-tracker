// ✅ UPDATED: Complete type definitions for dashboard

export interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

// ✅ ENHANCED: KPIs interface with new metrics
export interface KPIData {
  total_complaints: number;
  total_closed: number;
  total_firms: number;
  avg_upheld_rate: number;
  avg_uphold_rate: number; // Alternative field name
  total_rows: number;
  // ✅ NEW: Additional KPI metrics as requested
  banking_avg_percentage?: number;
  sector_uphold_averages?: {[key: string]: number};
  sector_closure_averages?: {[key: string]: number};
}

export interface FirmData {
  firm_name: string;
  avg_uphold_rate: number;
  avg_upheld_rate?: number; // Alternative field name for API compatibility
  avg_closure_rate: number;
  complaint_count: number;
}

// ✅ ENHANCED: Consumer Credit with multiple field mappings
export interface ConsumerCreditData {
  firm_name: string;
  total_received: number;
  total_records?: number; // API might return this field name
  complaint_count?: number; // Alternative field name
  avg_upheld_pct: number;
  avg_uphold_rate?: number; // Alternative field name
  avg_closure_rate?: number;
}

export interface ProductData {
  category_name: string;
  product_category?: string; // Alternative field name from API
  complaint_count: number;
  avg_uphold_rate: number;
  avg_closure_rate: number;
}

export interface FirmListItem {
  firm_name: string;
}

// ✅ ENHANCED: Complete API response structure
export interface DashboardAPIResponse {
  success: boolean;
  filters: FilterParams;
  data: {
    kpis: KPIData;
    topPerformers: FirmData[];
    consumerCredit: ConsumerCreditData[];
    productCategories: ProductData[];
    industryComparison: FirmData[];
    allFirms: FirmListItem[];
  };
  debug?: {
    appliedFilters: FilterParams;
    executionTime: string;
    dataSource: string;
    queryCounts?: {
      kpis: number;
      topPerformers: number;
      consumerCredit: number;
      productCategories: number;
      industryComparison: number;
      allFirms: number;
      sectorUphold?: number;
      sectorClosure?: number;
    };
    sampleData?: {
      consumerCredit: ConsumerCreditData[];
      topPerformers: FirmData[];
    };
  };
}

// ✅ ENHANCED: Dashboard data interface for component
export interface DashboardData {
  kpis: KPIData;
  topPerformers: FirmData[];
  consumerCredit: ConsumerCreditData[];
  categoryData: ProductData[];
  industryComparison: FirmData[];
  allFirms: FirmListItem[];
}

// ✅ NEW: Credit filters interface (simplified - removed period)
export interface CreditFilters {
  selectedFirms: string[];
}

// ✅ Chart.js types for better type safety
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'bubble';

export interface ChartDataset {
  label?: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  tension?: number;
  type?: ChartType;
  yAxisID?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartOptions {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins?: any;
  scales?: any;
  indexAxis?: 'x' | 'y';
}

// ✅ NEW: Utility types for better development experience
export type SortDirection = 'asc' | 'desc';
export type TabId = 'overview' | 'firm' | 'product' | 'credit';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

// ✅ NEW: Form and UI state types
export interface UIState {
  activeTab: TabId;
  selectedFirms: string[];
  selectedProduct: string;
  firmSearchTerm: string;
  showFirmDropdown: boolean;
  loading: boolean;
  error: string | null;
}

// ✅ API Error response type
export interface APIErrorResponse {
  success: false;
  error: string;
  details?: string;
  debug?: {
    executionTime: string;
    dataSource: string;
  };
}

// ✅ Complete API response union type
export type APIResponse = DashboardAPIResponse | APIErrorResponse;
