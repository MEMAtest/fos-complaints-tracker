import { useState, useCallback } from 'react';

export interface FilterParams {
  years?: string[];
  firms?: string[];
  products?: string[];
}

export const useFilters = () => {
  const [filters, setFilters] = useState<FilterParams>({
    years: [],
    firms: [],
    products: []
  });

  const updateFilter = useCallback((filterType: keyof FilterParams, values: string[]) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: values
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      years: [],
      firms: [],
      products: []
    });
  }, []);

  const hasActiveFilters = useCallback(() => {
    return (filters.years?.length || 0) > 0 || 
           (filters.firms?.length || 0) > 0 || 
           (filters.products?.length || 0) > 0;
  }, [filters]);

  return {
    filters,
    updateFilter,
    clearAllFilters,
    hasActiveFilters
  };
};
