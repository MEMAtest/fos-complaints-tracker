// src/utils/chartHelpers.ts
// ✅ Chart scaling utilities for better data visualization

export interface ScalingResult {
  min: number;
  max: number;
  stepSize?: number;
}

export interface ChartData {
  values: number[];
  type: 'percentage' | 'volume' | 'rate';
}

/**
 * ✅ Calculate dynamic chart scaling based on data values
 */
export function calculateDynamicScale(
  values: number[], 
  chartType: 'percentage' | 'volume' | 'rate' = 'percentage',
  options: {
    minPadding?: number;
    maxPadding?: number;
    forceZeroBase?: boolean;
    roundTo?: number;
  } = {}
): ScalingResult {
  
  if (!values || values.length === 0) {
    return { min: 0, max: 100 };
  }

  const {
    minPadding = 0,
    maxPadding = 10,
    forceZeroBase = true,
    roundTo = 5
  } = options;

  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  
  if (validValues.length === 0) {
    return { min: 0, max: 100 };
  }

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;

  console.log('🎯 Dynamic scaling input:', { 
    values: validValues, 
    min, 
    max, 
    range, 
    chartType 
  });

  let scaledMin = forceZeroBase ? 0 : Math.max(0, min - minPadding);
  let scaledMax = max + maxPadding;

  // ✅ Apply chart type-specific scaling logic
  switch (chartType) {
    case 'percentage':
      scaledMax = calculatePercentageScale(min, max, range);
      break;
      
    case 'volume':
      scaledMax = calculateVolumeScale(max, maxPadding);
      break;
      
    case 'rate':
      scaledMax = calculateRateScale(min, max, range);
      break;
  }

  // ✅ Round to nearest specified value for cleaner scales
  if (roundTo > 0) {
    scaledMax = Math.ceil(scaledMax / roundTo) * roundTo;
  }

  // ✅ Ensure minimum viable range
  if (scaledMax - scaledMin < 5) {
    scaledMax = scaledMin + 10;
  }

  const result = {
    min: scaledMin,
    max: Math.min(scaledMax, chartType === 'percentage' ? 100 : scaledMax),
    stepSize: calculateStepSize(scaledMax - scaledMin)
  };

  console.log('🎯 Dynamic scaling result:', result);
  return result;
}

/**
 * ✅ Percentage-specific scaling (0-100% context)
 */
function calculatePercentageScale(min: number, max: number, range: number): number {
  // Very low percentages (0-15%)
  if (max <= 15) {
    return 20;
  }
  
  // Low percentages (15-30%)
  if (max <= 30) {
    return 35;
  }
  
  // Medium percentages (30-60%)
  if (max <= 60) {
    return max + 15;
  }
  
  // High percentages with small range
  if (min >= 70 && range <= 20) {
    return 100;
  }
  
  // Default: add 10-20% padding
  return Math.min(max + (range > 30 ? 10 : 20), 100);
}

/**
 * ✅ Volume-specific scaling (complaint counts, etc.)
 */
function calculateVolumeScale(max: number, padding: number): number {
  // Small volumes
  if (max <= 100) {
    return max + 20;
  }
  
  // Medium volumes  
  if (max <= 1000) {
    return max + (max * 0.2); // 20% padding
  }
  
  // Large volumes
  if (max <= 10000) {
    return max + (max * 0.15); // 15% padding
  }
  
  // Very large volumes
  return max + (max * 0.1); // 10% padding
}

/**
 * ✅ Rate-specific scaling (closure rates, resolution rates)
 */
function calculateRateScale(min: number, max: number, range: number): number {
  // Similar to percentage but with different thresholds
  if (max <= 25) {
    return 30;
  }
  
  if (max <= 50) {
    return max + 15;
  }
  
  return Math.min(max + 20, 100);
}

/**
 * ✅ Calculate appropriate step size for chart ticks
 */
function calculateStepSize(range: number): number {
  if (range <= 20) return 5;
  if (range <= 50) return 10;
  if (range <= 100) return 20;
  return Math.ceil(range / 5);
}

/**
 * ✅ Apply dynamic scaling to Chart.js options
 */
export function applyDynamicScaling(
  chartOptions: any, 
  yAxisData: number[], 
  chartType: 'percentage' | 'volume' | 'rate' = 'percentage'
): any {
  
  const scaling = calculateDynamicScale(yAxisData, chartType);
  
  // ✅ Apply to Chart.js y-axis configuration
  if (!chartOptions.scales) {
    chartOptions.scales = {};
  }
  
  if (!chartOptions.scales.y) {
    chartOptions.scales.y = {};
  }
  
  chartOptions.scales.y = {
    ...chartOptions.scales.y,
    beginAtZero: scaling.min === 0,
    min: scaling.min,
    max: scaling.max,
    ticks: {
      ...chartOptions.scales.y.ticks,
      stepSize: scaling.stepSize,
      callback: function(value: string | number): string {
        if (chartType === 'percentage' || chartType === 'rate') {
          return value + '%';
        }
        return typeof value === 'number' ? value.toLocaleString() : value.toString();
      }
    }
  };

  console.log('✅ Applied dynamic scaling to chart options:', {
    chartType,
    yAxisData,
    scaling,
    finalOptions: chartOptions.scales.y
  });

  return chartOptions;
}

/**
 * ✅ Helper function to extract values from different data structures
 */
export function extractChartValues(
  data: any[], 
  valueKey: string | ((item: any) => number)
): number[] {
  
  if (!data || data.length === 0) return [];
  
  const extractor = typeof valueKey === 'string' 
    ? (item: any) => item[valueKey] 
    : valueKey;
    
  return data
    .map(extractor)
    .filter(val => val !== null && val !== undefined && !isNaN(val));
}

/**
 * ✅ Determine if chart needs dynamic scaling based on data variance
 */
export function shouldApplyDynamicScaling(values: number[]): boolean {
  if (!values || values.length === 0) return false;
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  
  // Apply dynamic scaling if:
  // 1. Max value is less than 80% (leaves room for improvement)
  // 2. Data range is small compared to 0-100 scale
  // 3. All values are in lower portion of scale
  
  return max < 80 || (max - min) < 30 || max < 50;
}
