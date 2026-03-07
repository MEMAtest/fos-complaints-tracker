import { FOSDashboardFilters, FOSOutcome } from './types';

export const OUTCOME_LABELS: Record<FOSOutcome, string> = {
  upheld: 'Upheld',
  not_upheld: 'Not upheld',
  partially_upheld: 'Partially upheld',
  settled: 'Settled',
  not_settled: 'Not settled',
  unknown: 'Unknown',
};

export const STATUS_STYLES: Record<
  'running' | 'idle' | 'warning' | 'error',
  { badge: string; dot: string; label: string }
> = {
  running: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Running' },
  idle: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-500', label: 'Idle' },
  warning: { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Warning' },
  error: { badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', label: 'Error' },
};

export const INITIAL_FILTERS: FOSDashboardFilters = {
  query: '',
  years: [],
  outcomes: [],
  products: [],
  firms: [],
  tags: [],
  page: 1,
  pageSize: 25,
};

export const OUTCOME_COLORS: Record<FOSOutcome, string> = {
  upheld: '#10b981',
  not_upheld: '#f43f5e',
  partially_upheld: '#6366f1',
  settled: '#f59e0b',
  not_settled: '#94a3b8',
  unknown: '#64748b',
};

export const DASHBOARD_TIMEOUT_MS = 45_000;
export const ANALYSIS_TIMEOUT_MS = 60_000;
