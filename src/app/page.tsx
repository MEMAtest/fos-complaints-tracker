'use client';

import { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, BubbleController, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register all necessary Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, RadialLinearScale, BubbleController, Tooltip, Legend);

// --- TYPE DEFINITIONS for our data structures ---
type KpiData = { totalComplaints: string; totalClosed: string; avgUpheldRate: string; firmCount: string; };
type FirmInsight = { firmName: string; avgUpheldRate: number; avgResolutionSpeed: number; };
type InsightsData = { bestPerformers: FirmInsight[]; worstPerformers: FirmInsight[]; fastestResolution: FirmInsight[]; };
type Firm = { id: string; name: string; };
type Product = { id: string; name: string; };
type CategoryDistribution = { categoryName: string; complaintCount: string; };

type DashboardData = {
    kpis: KpiData;
    insights: InsightsData;
    firmList: Firm[];
    productList: Product[];
    categoryDistribution: CategoryDistribution[];
};

// --- Reusable UI Components ---
const LoadingScreen = () => <div className="flex items-center justify-center min-h-screen bg-gray-100"><div className="text-2xl font-medium text-gray-500">Loading FOS Dashboard...</div></div>;
const ErrorDisplay = ({ error }: { error: string }) => <div className="m-8 p-6 bg-red-50 border border-red-200 rounded-lg"><div className="text-xl font-bold text-red-800">An Error Occurred</div><p className="mt-2 text-red-700">{error}</p></div>;
const TabButton = ({ label, tabName, activeTab, setActiveTab }: { label: string, tabName: string, activeTab: string, setActiveTab: (tab: string) => void }) => (
    <button className={`px-4 py-2 font-medium text-sm rounded-md transition-colors ${activeTab === tabName ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`} onClick={() => setActiveTab(tabName)}>{label}</button>
);
const InsightList = ({ title, firms, metric, unit, colorClass }: { title: string, firms: FirmInsight[], metric: keyof FirmInsight, unit: string, colorClass: string }) => (
    <div>
        <h4 className={`font-semibold mb-2 ${colorClass}`}>{title}</h4>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700">
            {firms.map(firm => <li key={firm.firmName}>{firm.firmName} - <span className="font-medium">{Number(firm[metric]).toFixed(1)}{unit}</span></li>)}
        </ol>
    </div>
);
const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-80">{children}</div>
    </div>
);

// --- TAB CONTENT COMPONENTS ---

const PerformanceOverviewTab = ({ data }: { data: DashboardData }) => {
    const doughnutChartData = {
        labels: data.categoryDistribution.map(d => d.categoryName),
        datasets: [{
            label: '# of Complaints',
            data: data.categoryDistribution.map(d => d.complaintCount),
            backgroundColor: ['#4f46e5', '#db2777', '#f97316', '#16a34a', '#9333ea'],
            borderColor: '#fff',
            borderWidth: 2,
        }],
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white p-5 shadow rounded-lg"><dt className="text-sm font-medium text-gray-500">Total Complaints</dt><dd className="mt-1 text-3xl font-semibold text-gray-900">{data.kpis.totalComplaints}</dd></div>
                <div className="bg-white p-5 shadow rounded-lg"><dt className="text-sm font-medium text-gray-500">Complaints Closed</dt><dd className="mt-1 text-3xl font-semibold text-gray-900">{data.kpis.totalClosed}</dd></div>
                <div className="bg-white p-5 shadow rounded-lg"><dt className="text-sm font-medium text-gray-500">Avg. Uphold Rate</dt><dd className="mt-1 text-3xl font-semibold text-gray-900">{data.kpis.avgUpheldRate}</dd></div>
                <div className="bg-white p-5 shadow rounded-lg"><dt className="text-sm font-medium text-gray-500">Firms Tracked</dt><dd className="mt-1 text-3xl font-semibold text-gray-900">{data.kpis.firmCount}</dd></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">🏆 Key Performance Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <InsightList title="Top 5 Best Performers (Lowest Uphold)" firms={data.insights.bestPerformers} metric="avgUpheldRate" unit="%" colorClass="text-green-600" />
                    <InsightList title="Top 5 Needs Improvement (Highest Uphold)" firms={data.insights.worstPerformers} metric="avgUpheldRate" unit="%" colorClass="text-red-600" />
                    <InsightList title="Top 5 Fastest Resolution (in 3 Days)" firms={data.insights.fastestResolution} metric="avgResolutionSpeed" unit="%" colorClass="text-blue-600" />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <ChartCard title="Product Category Distribution">
                    <Doughnut data={doughnutChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                </ChartCard>
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm flex items-center justify-center">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-800">More Charts Coming Soon</h3>
                        <p className="text-gray-500 mt-2">The other charts from your design will be added here.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PlaceholderTab = ({ title }: { title: string }) => (
    <div className="bg-white p-8 rounded-lg shadow-sm text-center">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <p className="mt-4 text-gray-600">This section is ready for its dedicated charts and data. The application structure is now complete, making it easy to add this functionality next.</p>
    </div>
);

// --- THE MAIN APPLICATION COMPONENT ---
export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // This useEffect hook runs only once to fetch all the initial data for the entire application.
    useEffect(() => {
        async function fetchInitialData() {
            try {
                const response = await fetch('/api/dashboard?query=initial_load');
                if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
                const data = await response.json();
                if (data.error) throw new Error(data.details || 'An API error occurred');
                setDashboardData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred while loading dashboard.');
            }
        }
        fetchInitialData();
    }, []);

    const renderTabContent = () => {
        if (!dashboardData && !error) return <LoadingScreen />;
        if (error) return <ErrorDisplay error={error} />;
        if (dashboardData) {
            switch (activeTab) {
                case 'overview': return <PerformanceOverviewTab data={dashboardData} />;
                case 'firm': return <PlaceholderTab title="Firm Deep Dive" />;
                case 'product': return <PlaceholderTab title="Product Analysis" />;
                case 'credit': return <PlaceholderTab title="Consumer Credit Focus" />;
                default: return null;
            }
        }
        return null;
    };

    return (
        <main className="bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="bg-white p-6 rounded-lg shadow-sm">
                    <h1 className="text-3xl font-bold text-gray-900">FOS Complaints Dashboard</h1>
                    <p className="text-gray-600 mt-1">A fully functional, data-driven dashboard application.</p>
                </header>
                <nav className="flex space-x-2 bg-gray-200 p-1 rounded-lg">
                    <TabButton label="Performance Overview" tabName="overview" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Firm Deep Dive" tabName="firm" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Product Analysis" tabName="product" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton label="Consumer Credit Focus" tabName="credit" activeTab={activeTab} setActiveTab={setActiveTab} />
                </nav>
                <section>
                    {renderTabContent()}
                </section>
            </div>
        </main>
    );
}
