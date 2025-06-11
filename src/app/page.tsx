'use client';

import { useEffect, useState } from 'react';

// --- HELPER FUNCTION FOR RETRYING FETCH ---
// This function will automatically retry the fetch call if it fails,
// which is perfect for waking up a sleeping Neon database.
async function fetchWithRetry(url: string, retries = 3, delay = 2500): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `API responded with status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error("All fetch attempts failed.");
        throw error;
      }
    }
  }
}


// --- TYPESCRIPT INTERFACES (from your original code) ---
interface KPIData {
  total_complaints?: number;
  total_closed?: number;
  avg_uphold_rate?: number;
  total_rows?: number;
}

interface FirmData {
  firm_name: string;
  complaint_count?: number;
  avg_uphold_rate?: number;
  total_received?: number;
  avg_upheld_pct?: number;
}

interface CategoryData {
  category_name: string;
  complaint_count: number;
}

interface DashboardData {
  kpis: KPIData;
  topPerformers: FirmData[];
  productCategories: CategoryData[];
  industryComparison: FirmData[];
  consumerCredit: FirmData[];
}


export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    // This function remains the same.
    const loadChartJS = () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof window !== 'undefined' && (window as any).Chart) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.head.appendChild(script);
      });
    };

    // --- MODIFIED DATA FETCHING LOGIC ---
    const fetchData = async () => {
      try {
        console.log('🔄 Fetching dashboard data with retry logic...');
        
        // Use the new fetchWithRetry function instead of the standard fetch
        const result = await fetchWithRetry('/api/dashboard?query=initial_load');
        
        console.log('📊 API Response:', result);
        
        // This part of your logic was good, so it remains.
        if (result.success) {
          setData(result.data);
          setDebug(result.debug);
          setError(null);
          console.log('✅ Data loaded successfully');
        } else {
          // This will now only be reached if the API itself returns an error,
          // not if the fetch call fails.
          throw new Error(result.error || 'The API returned an unsuccessful response.');
        }
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred after multiple retries.');
      } finally {
        setLoading(false);
      }
    };

    const init = async () => {
      try {
        await loadChartJS();
        await fetchData();
      } catch (err) {
        console.error('❌ Initialization error:', err);
        setError(err instanceof Error ? err.message : 'Initialization failed');
        setLoading(false);
      }
    };

    init();
  }, []);

  // Your formatting functions remain unchanged
  const formatNumber = (num: number | undefined): string => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number | undefined): string => {
    if (!num) return '0.0%';
    return `${num.toFixed(1)}%`;
  };

  // Your excellent loading and error states remain unchanged
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard... (May take a moment to wake database)</p>
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
          <div className="text-sm text-gray-500 space-y-2">
            <p>This can happen if the database connection fails after several attempts.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- THE REST OF YOUR JSX RENDER LOGIC REMAINS THE SAME ---
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
              Live Data: Connected to Neon database with real firm names, product categories, and complaint metrics from your lookup tables.
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button className="py-4 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600">
              Performance Overview
            </button>
            <button className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
              Firm Deep Dive
            </button>
            <button className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
              Product Analysis
            </button>
            <button className="py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700">
              Consumer Credit Focus
            </button>
          </nav>
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
                <p className="text-sm font-medium text-gray-600">Total Data Rows</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(data?.kpis?.total_rows)}</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(data?.kpis?.avg_uphold_rate)}</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Firms (by Uphold Rate)</h3>
            <div className="space-y-3">
              {data?.topPerformers?.slice(0, 10).map((firm, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-900">{firm.firm_name}</span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">{formatPercentage(firm.avg_uphold_rate)}</div>
                    <div className="text-xs text-gray-500">{formatNumber(firm.complaint_count)} complaints</div>
                  </div>
                </div>
              )) || <p className="text-gray-500">No firm data available</p>}
            </div>
          </div>

          {/* Product Categories */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Categories</h3>
            <div className="space-y-3">
              {data?.productCategories?.slice(0, 10).map((category, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-900">{category.category_name}</span>
                  <div className="text-sm font-semibold text-blue-600">{formatNumber(category.complaint_count)} complaints</div>
                </div>
              )) || <p className="text-gray-500">No category data available</p>}
            </div>
          </div>

          {/* Consumer Credit */}
          <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumer Credit Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.consumerCredit?.slice(0, 6).map((firm, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{firm.firm_name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Received:</span>
                      <span className="font-medium">{formatNumber(firm.total_received)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uphold Rate:</span>
                      <span className="font-medium">{formatPercentage(firm.avg_upheld_pct)}</span>
                    </div>
                  </div>
                </div>
              )) || <p className="text-gray-500">No consumer credit data available</p>}
            </div>
          </div>
        </div>

        {/* Debug Information */}
        {debug && (
          <div className="mt-8 bg-gray-100 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Debug Information</h4>
            <pre className="text-xs text-gray-600 bg-white p-2 rounded overflow-auto">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </div>
        )}
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

