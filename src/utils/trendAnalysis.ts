// src/utils/trendAnalysis.ts
// ✅ Trend analysis utilities for historical data

export interface TrendPoint {
  year: string;
  value: number;
  period?: string;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  changeValue: number;
  isSignificant: boolean;
  confidence: 'high' | 'medium' | 'low';
  periods: number;
}

export interface FirmTrendData {
  firm_name: string;
  trends: {
    uphold_rate: TrendAnalysis;
    closure_3_days: TrendAnalysis;
    closure_8_weeks: TrendAnalysis;
  };
  yearlyData: TrendPoint[];
}

/**
 * ✅ Calculate trend analysis from historical data points
 */
export function calculateTrend(
  dataPoints: TrendPoint[], 
  metric: 'value' = 'value',
  options: {
    significanceThreshold?: number;
    minPeriodsForTrend?: number;
  } = {}
): TrendAnalysis {
  
  const { significanceThreshold = 5, minPeriodsForTrend = 2 } = options;
  
  if (!dataPoints || dataPoints.length < minPeriodsForTrend) {
    return {
      direction: 'stable',
      changePercent: 0,
      changeValue: 0,
      isSignificant: false,
      confidence: 'low',
      periods: dataPoints?.length || 0
    };
  }

  // Sort by year to ensure chronological order
  const sortedPoints = [...dataPoints].sort((a, b) => a.year.localeCompare(b.year));
  
  const firstValue = sortedPoints[0].value;
  const lastValue = sortedPoints[sortedPoints.length - 1].value;
  
  const changeValue = lastValue - firstValue;
  const changePercent = firstValue !== 0 ? (changeValue / firstValue) * 100 : 0;
  
  // Determine direction
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercent) >= significanceThreshold) {
    direction = changePercent > 0 ? 'up' : 'down';
  }
  
  // Calculate confidence based on data consistency
  const confidence = calculateTrendConfidence(sortedPoints, direction);
  
  return {
    direction,
    changePercent: Math.round(changePercent * 10) / 10,
    changeValue: Math.round(changeValue * 10) / 10,
    isSignificant: Math.abs(changePercent) >= significanceThreshold,
    confidence,
    periods: sortedPoints.length
  };
}

/**
 * ✅ Calculate confidence level based on trend consistency
 */
function calculateTrendConfidence(
  points: TrendPoint[], 
  direction: 'up' | 'down' | 'stable'
): 'high' | 'medium' | 'low' {
  
  if (points.length < 3) return 'low';
  
  if (direction === 'stable') return 'medium';
  
  // Calculate consistency of direction
  let consistentMoves = 0;
  for (let i = 1; i < points.length; i++) {
    const currentChange = points[i].value - points[i-1].value;
    const expectedDirection = direction === 'up' ? 1 : -1;
    
    if ((currentChange > 0 && expectedDirection > 0) || (currentChange < 0 && expectedDirection < 0)) {
      consistentMoves++;
    }
  }
  
  const consistencyRatio = consistentMoves / (points.length - 1);
  
  if (consistencyRatio >= 0.8) return 'high';
  if (consistencyRatio >= 0.6) return 'medium';
  return 'low';
}

/**
 * ✅ Process historical trends data for firms
 */
export function processFirmTrends(historicalData: any[]): FirmTrendData[] {
  if (!historicalData || historicalData.length === 0) return [];
  
  // Group by firm
  const firmGroups = historicalData.reduce((groups: {[key: string]: any[]}, item) => {
    if (!groups[item.firm_name]) {
      groups[item.firm_name] = [];
    }
    groups[item.firm_name].push(item);
    return groups;
  }, {});
  
  return Object.entries(firmGroups).map(([firmName, firmData]) => {
    // Create yearly aggregates
    const yearlyData: {[key: string]: {uphold: number[], closure_3: number[], closure_8: number[]}} = {};
    
    firmData.forEach(item => {
      if (!yearlyData[item.trend_year]) {
        yearlyData[item.trend_year] = { uphold: [], closure_3: [], closure_8: [] };
      }
      
      if (item.upheld_rate !== null && item.upheld_rate !== undefined) {
        yearlyData[item.trend_year].uphold.push(item.upheld_rate);
      }
      if (item.closure_rate_3_days !== null && item.closure_rate_3_days !== undefined) {
        yearlyData[item.trend_year].closure_3.push(item.closure_rate_3_days);
      }
      if (item.closure_rate_8_weeks !== null && item.closure_rate_8_weeks !== undefined) {
        yearlyData[item.trend_year].closure_8.push(item.closure_rate_8_weeks);
      }
    });
    
    // Calculate yearly averages
    const upholdPoints: TrendPoint[] = [];
    const closure3Points: TrendPoint[] = [];
    const closure8Points: TrendPoint[] = [];
    
    Object.entries(yearlyData).forEach(([year, data]) => {
      if (data.uphold.length > 0) {
        upholdPoints.push({
          year,
          value: data.uphold.reduce((sum, val) => sum + val, 0) / data.uphold.length
        });
      }
      if (data.closure_3.length > 0) {
        closure3Points.push({
          year,
          value: data.closure_3.reduce((sum, val) => sum + val, 0) / data.closure_3.length
        });
      }
      if (data.closure_8.length > 0) {
        closure8Points.push({
          year,
          value: data.closure_8.reduce((sum, val) => sum + val, 0) / data.closure_8.length
        });
      }
    });
    
    return {
      firm_name: firmName,
      trends: {
        uphold_rate: calculateTrend(upholdPoints),
        closure_3_days: calculateTrend(closure3Points),
        closure_8_weeks: calculateTrend(closure8Points)
      },
      yearlyData: upholdPoints
    };
  });
}

/**
 * ✅ Calculate industry trend benchmarks
 */
export function calculateIndustryTrends(industryData: any[]): {
  uphold_rate: TrendAnalysis;
  closure_3_days: TrendAnalysis;
  closure_8_weeks: TrendAnalysis;
  yearlyBenchmarks: TrendPoint[];
} {
  
  if (!industryData || industryData.length === 0) {
    return {
      uphold_rate: calculateTrend([]),
      closure_3_days: calculateTrend([]),
      closure_8_weeks: calculateTrend([]),
      yearlyBenchmarks: []
    };
  }
  
  const upholdPoints = industryData.map(item => ({
    year: item.year,
    value: item.avg_uphold_rate
  }));
  
  const closure3Points = industryData.map(item => ({
    year: item.year,
    value: item.avg_closure_3_days
  }));
  
  const closure8Points = industryData.map(item => ({
    year: item.year,
    value: item.avg_closure_8_weeks
  }));
  
  return {
    uphold_rate: calculateTrend(upholdPoints),
    closure_3_days: calculateTrend(closure3Points),
    closure_8_weeks: calculateTrend(closure8Points),
    yearlyBenchmarks: upholdPoints
  };
}

/**
 * ✅ Format trend for display in UI
 */
export function formatTrendDisplay(trend: TrendAnalysis): {
  icon: string;
  text: string;
  color: string;
  tooltip: string;
} {
  
  const absChange = Math.abs(trend.changePercent);
  const sign = trend.changePercent >= 0 ? '+' : '';
  
  let icon = '→';
  let color = 'text-gray-500';
  
  if (trend.direction === 'up') {
    icon = '↗';
    color = trend.changePercent > 0 ? 'text-red-500' : 'text-green-500'; // For uphold rates, up is bad
  } else if (trend.direction === 'down') {
    icon = '↘';
    color = trend.changePercent < 0 ? 'text-green-500' : 'text-red-500'; // For uphold rates, down is good
  }
  
  const confidenceText = trend.confidence === 'high' ? 'Strong trend' : 
                        trend.confidence === 'medium' ? 'Moderate trend' : 'Weak trend';
  
  return {
    icon,
    text: `${sign}${absChange.toFixed(1)}%`,
    color,
    tooltip: `${confidenceText} over ${trend.periods} periods. ${trend.isSignificant ? 'Significant change' : 'Minor change'}.`
  };
}

/**
 * ✅ Get firms with most significant trends
 */
export function getTopTrendingFirms(
  firmTrends: FirmTrendData[], 
  metric: 'uphold_rate' | 'closure_3_days' | 'closure_8_weeks' = 'uphold_rate',
  direction: 'improving' | 'declining' | 'both' = 'both',
  limit: number = 5
): FirmTrendData[] {
  
  const filtered = firmTrends.filter(firm => {
    const trend = firm.trends[metric];
    if (!trend.isSignificant) return false;
    
    if (direction === 'improving') {
      // For uphold rates, "improving" means decreasing (fewer upheld complaints)
      return metric === 'uphold_rate' ? trend.direction === 'down' : trend.direction === 'up';
    } else if (direction === 'declining') {
      // For uphold rates, "declining" means increasing (more upheld complaints)
      return metric === 'uphold_rate' ? trend.direction === 'up' : trend.direction === 'down';
    }
    
    return true; // both directions
  });
  
  return filtered
    .sort((a, b) => Math.abs(b.trends[metric].changePercent) - Math.abs(a.trends[metric].changePercent))
    .slice(0, limit);
}
