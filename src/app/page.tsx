'use client';

import { useEffect, useState } from 'react';

// TypeScript interfaces for your actual API response
interface KPIData {
  total_complaints?: number;
  total_closed?: number;
  avg_upheld_rate?: number;
}

interface FirmMetric {
  firm_id: string;
  firm_name: string;
  firm_group: string;
  reporting_period_id: string;
  period_name: string;
  year: number;
  product_category_id: string;
  category_name: string;
  closed_within_3_days_pct: number;
  closed_after_3_days_within_8_weeks_pct: number;
  upheld_rate_pct: number;
  total_complaints: number;
}

interface ConsumerCredit {
  firm_id: string;
  firm_name: string;
  firm_group: string;
  reporting_period_id: string;
  period_name: string;
  year: number;
  complaints_received: number;
  complaints_closed: number;
  complaints_upheld_pct: number;
  reporting_frequency: string;
}

interface DashboardData {
  firmMetrics: FirmMetric[];
  consumerCredit: ConsumerCredit[];
  kpis: KPIData;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('🔄 Fetching dashboard data...');
        
        // Fixed: Use 'query' parameter instead of 'type' to match your API
        const response = await fetch('/api/dashboard?query=initial_load');
        const result = await response.json();
        
        console.log('📊 API Response:', result);
        
        if (result.success) {
          setData(result.data);
          setError(null);
          console.log('✅ Data loaded successfully');
        } else {
          throw new Error(result.error || 'Failed to fetch data');
        }
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number | undefined): string => {
    if (!num) return '0.0%';
    return `${num.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get unique firms and categories from the data
  const uniqueFirms = data?.firmMetrics ? 
    Array.from(new Set(data.firmMetrics.map(f => f.firm_name)))
    .map(name => {
      const firm = data.firmMetrics.find(f => f.firm_name === name);
      return {
        firm_name: name,
        total_complaints: data.firmMetrics
          .filter(f => f.firm_name === name)
          .reduce((sum, f) => sum + f.total_complaints, 0),
        avg_uphold_rate: data.firmMetrics
          .filter(f => f.firm_name === name)
          .reduce((sum, f) => sum + f.upheld_rate_pct, 0) / 
          data.firmMetrics.filter(f => f.firm_name === name).length
      };
    }).sort((a, b) => a.avg_uphold_rate - b.avg_uphold_rate) : [];

  const uniqueCategories = data?.firmMetrics ? 
    Array.from(new Set(data.firmMetrics.map(f => f.category_name)))
    .map(name => ({
      category_name: name,
      complaint_count: data.firmMetrics
        .filter(f => f.category_name === name)
        .reduce((sum, f) => sum + f.total_complaints, 0)
    })).sort((a, b) => b.complaint_count - a.complaint_count) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Financial Complaints Tracking Dashboard</h1>
          <p className="text-gray-600 mt-2">Comprehensive analysis of complaint resolution performance across financial firms</p>
          <div className="mt-4 flex items-center space-x-4">
            <div className="flex items-center text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Live Data: Connected to Neon database with real firm names and complaint metrics
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Complaints</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(data?.kpis?.total_complaints)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Closed</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(data?.kpis?.total_closed)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Uphold Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_upheld_rate)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Performing Firms */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Firms by Uphold Rate (Best to Worst)</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uniqueFirms.slice(0, 15).map((firm, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-900">{firm.firm_name}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">{formatPercentage(firm.avg_uphold_rate)}</div>
                    <div className="text-xs text-gray-500">{formatNumber(firm.total_complaints)} complaints</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Categories */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Categories by Volume</h3>
            <div className="space-y-3">
              {uniqueCategories.slice(0, 10).map((category, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-900">{category.category_name}</span>
                  <div className="text-sm font-semibold text-blue-600">{formatNumber(category.complaint_count)} complaints</div>
                </div>
              ))}
            </div>
          </div>

          {/* Consumer Credit Overview */}
          <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumer Credit Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.consumerCredit?.slice(0, 9).map((firm, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{firm.firm_name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Period:</span>
                      <span className="font-medium">{firm.period_name} {firm.year}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Received:</span>
                      <span className="font-medium">{formatNumber(firm.complaints_received)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Closed:</span>
                      <span className="font-medium">{formatNumber(firm.complaints_closed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uphold Rate:</span>
                      <span className="font-medium">{formatPercentage(firm.complaints_upheld_pct)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Raw Data Summary */}
        <div className="mt-8 bg-gray-100 p-4 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Data Summary</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>📊 Firm Metrics Records: {data?.firmMetrics?.length || 0}</p>
            <p>💳 Consumer Credit Records: {data?.consumerCredit?.length || 0}</p>
            <p>🏢 Unique Firms: {uniqueFirms.length}</p>
            <p>📦 Product Categories: {uniqueCategories.length}</p>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
            <span className="mr-2">ℹ️</span> About This Dashboard
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            This dashboard displays live data from your Neon PostgreSQL database with real firm names, product categories, and reporting periods. 
            The data includes complaint resolution performance metrics across different firms and product categories, sourced from regulatory reporting requirements.
          </p>
        </div>
      </div>
    </div>
  );
}
