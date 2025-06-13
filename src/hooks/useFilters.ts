import { useState, useCallback } from 'react';

// ✅ FIXED: Complete filter interface with proper typing
interface Filters {
  years?: string[];
  firms?: string[];
  products?: string[];
  categories?: string[];
  reportingPeriods?: string[];
}

// ✅ FIXED: Return type interface with proper boolean return
interface UseFiltersReturn {
  filters: Filters;
  updateFilter: (key: keyof Filters, value: string[] | string | undefined) => void;
  clearAllFilters: () => void;
  clearFilter: (key: keyof Filters) => void;
  hasActiveFilters: () => boolean; // ✅ FIXED: Always returns boolean
  getFilterSummary: () => string;
}

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<Filters>({
    years: [],
    firms: [],
    products: [],
    categories: [],
    reportingPeriods: []
  });

  // ✅ ENHANCED: Update filter with proper type handling
  const updateFilter = useCallback((key: keyof Filters, value: string[] | string | undefined) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      
      if (value === undefined || value === null || value === '') {
        // Clear the filter completely
        delete newFilters[key];
      } else if (Array.isArray(value)) {
        // Handle array values
        newFilters[key] = value.length > 0 ? value : undefined;
      } else {
        // Handle single string values - convert to array
        newFilters[key] = [value];
      }
      
      // Remove undefined values to keep object clean
      Object.keys(newFilters).forEach(filterKey => {
        const typedKey = filterKey as keyof Filters;
        if (newFilters[typedKey] === undefined || 
            (Array.isArray(newFilters[typedKey]) && newFilters[typedKey]!.length === 0)) {
          delete newFilters[typedKey];
        }
      });
      
      console.log('🔄 Filter updated:', { key, value, newFilters });
      return newFilters;
    });
  }, []);

  // ✅ FIXED: Clear all filters completely
  const clearAllFilters = useCallback(() => {
    console.log('🧹 Clearing all filters');
    setFilters({
      years: [],
      firms: [],
      products: [],
      categories: [],
      reportingPeriods: []
    });
  }, []);

  // ✅ NEW: Clear individual filter
  const clearFilter = useCallback((key: keyof Filters) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      console.log('🧹 Cleared filter:', key);
      return newFilters;
    });
  }, []);

  // ✅ FIXED: Always returns boolean, never undefined
  const hasActiveFilters = useCallback((): boolean => {
    try {
      // Check if any filter has values
      const hasYears = Boolean(filters.years && filters.years.length > 0);
      const hasFirms = Boolean(filters.firms && filters.firms.length > 0);
      const hasProducts = Boolean(filters.products && filters.products.length > 0);
      const hasCategories = Boolean(filters.categories && filters.categories.length > 0);
      const hasReportingPeriods = Boolean(filters.reportingPeriods && filters.reportingPeriods.length > 0);
      
      const result = hasYears || hasFirms || hasProducts || hasCategories || hasReportingPeriods;
      
      // ✅ GUARANTEE: Always return boolean
      return Boolean(result);
    } catch (error) {
      console.error('Error checking active filters:', error);
      // ✅ FALLBACK: Return false on error, never undefined
      return false;
    }
  }, [filters]);

  // ✅ ENHANCED: Get human-readable filter summary
  const getFilterSummary = useCallback((): string => {
    try {
      const summary: string[] = [];
      
      if (filters.years && filters.years.length > 0) {
        summary.push(`Years: ${filters.years.join(', ')}`);
      }
      
      if (filters.firms && filters.firms.length > 0) {
        const firmSummary = filters.firms.length > 3 
          ? `${filters.firms.slice(0, 3).join(', ')} +${filters.firms.length - 3} more`
          : filters.firms.join(', ');
        summary.push(`Firms: ${firmSummary}`);
      }
      
      if (filters.products && filters.products.length > 0) {
        summary.push(`Products: ${filters.products.join(', ')}`);
      }
      
      if (filters.categories && filters.categories.length > 0) {
        summary.push(`Categories: ${filters.categories.join(', ')}`);
      }
      
      if (filters.reportingPeriods && filters.reportingPeriods.length > 0) {
        summary.push(`Periods: ${filters.reportingPeriods.join(', ')}`);
      }
      
      return summary.length > 0 ? summary.join(' | ') : 'No active filters';
    } catch (error) {
      console.error('Error generating filter summary:', error);
      return 'Filter summary unavailable';
    }
  }, [filters]);

  // ✅ DEBUGGING: Log filter state changes
  console.log('🔍 Current filters state:', {
    filters,
    hasActive: hasActiveFilters(),
    summary: getFilterSummary()
  });

  return {
    filters,
    updateFilter,
    clearAllFilters,
    clearFilter,
    hasActiveFilters, // ✅ FIXED: Now guaranteed to return boolean
    getFilterSummary
  };
}
