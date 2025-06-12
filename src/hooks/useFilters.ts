// ✅ FIXED: Filter state management with multi-select support

import { useState, useCallback } from 'react';
import { FilterParams } from '../types/dashboard';

interface UseFiltersReturn {
  filters: FilterParams;
  updateFilter: (key: keyof FilterParams, value: string[] | string | null) => void;
  clearAllFilters: () => void;
  hasActiveFilters: () => boolean;
  resetFilter: (key: keyof FilterParams) => void;
}

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<FilterParams>({
    years: [],
    firms: [],
    products: []
  });

  // ✅ ENHANCED: Update filter with proper type handling
  const updateFilter = useCallback((key: keyof FilterParams, value: string[] | string | null) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      
      if (value === null || value === '') {
        // Clear the filter
        newFilters[key] = [];
      } else if (Array.isArray(value)) {
        // Handle array values (multi-select)
        newFilters[key] = value;
      } else {
        // Handle single string values, convert to array for consistency
        newFilters[key] = [value];
      }
      
      console.log(`🔄 Filter updated - ${key}:`, newFilters[key]);
      return newFilters;
    });
  }, []);

  // ✅ Clear all filters
  const clearAllFilters = useCallback(() => {
    console.log('🧹 Clearing all filters');
    setFilters({
      years: [],
      firms: [],
      products: []
    });
  }, []);

  // ✅ Reset specific filter
  const resetFilter = useCallback((key: keyof FilterParams) => {
    setFilters(prev => ({
      ...prev,
      [key]: []
    }));
    console.log(`🔄 Reset filter - ${key}`);
  }, []);

  // ✅ FIXED: Check if any filters are active - always returns boolean
  const hasActiveFilters = useCallback((): boolean => {
    return Boolean(
      (filters.years && filters.years.length > 0) ||
      (filters.firms && filters.firms.length > 0) ||
      (filters.products && filters.products.length > 0)
    );
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearAllFilters,
    hasActiveFilters,
    resetFilter
  };
}
