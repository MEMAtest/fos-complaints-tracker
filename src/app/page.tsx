import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// This single API route handles all data requests for the dashboard
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get('query');

    try {
        let data;

        switch (queryType) {
            case 'initial_load':
                // Fetch all data needed for the initial dashboard load in parallel
                const [kpiRes, insightsRes, firmsRes, productsRes, overviewChartsRes] = await Promise.all([
                    // KPIs
                    sql`WITH ac AS (SELECT total_complaints r, (total_complaints * (COALESCE(closed_within_3_days_pct, 0) + COALESCE(closed_after_3_days_within_8_weeks_pct, 0)) / 100.0) c, upheld_rate_pct u FROM complaint_metrics UNION ALL SELECT complaints_received r, complaints_closed c, complaints_upheld_pct u FROM consumer_credit_metrics), km AS (SELECT SUM(r) tc, SUM(c) tcl, (SUM(c * u) / NULLIF(SUM(c), 0)) aur FROM ac), fc AS (SELECT COUNT(*) c FROM firms) SELECT (SELECT tc FROM km) "totalComplaints", (SELECT tcl FROM km) "totalClosed", (SELECT aur FROM km) "avgUpheldRate", (SELECT c FROM fc) "firmCount";`,
                    // Insights
                    sql`WITH fm AS (SELECT f.name "firmName", (SUM(cm.total_complaints * cm.upheld_rate_pct) / NULLIF(SUM(cm.total_complaints), 0)) "avgUpheldRate", (SUM(cm.total_complaints * cm.closed_within_3_days_pct) / NULLIF(SUM(cm.total_complaints), 0)) "avgResolutionSpeed" FROM complaint_metrics cm JOIN firms f ON cm.firm_id = f.id WHERE cm.total_complaints > 0 GROUP BY f.name) SELECT * FROM fm WHERE "avgUpheldRate" IS NOT NULL AND "avgResolutionSpeed" IS NOT NULL;`,
                    // Firm List
                    sql`SELECT id, name FROM firms ORDER BY name;`,
                    // Product List
                    sql`SELECT id, name FROM product_categories ORDER BY name;`,
                    // Overview Charts Data
                    sql`SELECT pc.name "categoryName", SUM(cm.total_complaints) "complaintCount" FROM complaint_metrics cm JOIN product_categories pc ON cm.product_category_id = pc.id GROUP BY pc.name ORDER BY 2 DESC;`
                ]);

                // Format KPIs
                const kpiResult = kpiRes[0];
                const formattedKpis = {
                    totalComplaints: Math.round(Number(kpiResult.totalComplaints)).toLocaleString(),
                    totalClosed: Math.round(Number(kpiResult.totalClosed)).toLocaleString(),
                    avgUpheldRate: `${Number(kpiResult.avgUpheldRate).toFixed(1)}%`,
                    firmCount: Number(kpiResult.firmCount).toLocaleString(),
                };

                // Format Insights
                const insightsData = insightsRes;
                const sortedByUpheld = [...insightsData].sort((a, b) => a.avgUpheldRate - b.avgUpheldRate);
                const sortedBySpeed = [...insightsData].sort((a, b) => b.avgResolutionSpeed - a.avgResolutionSpeed);
                const formattedInsights = {
                    bestPerformers: sortedByUpheld.slice(0, 5),
                    worstPerformers: sortedByUpheld.slice(-5).reverse(),
                    fastestResolution: sortedBySpeed.slice(0, 5)
                };

                return NextResponse.json({
                    kpis: formattedKpis,
                    insights: formattedInsights,
                    firmList: firmsRes,
                    productList: productsRes,
                    categoryDistribution: overviewChartsRes
                });

            // Add more specific, dynamic queries for other tabs later if needed
            // For now, initial_load provides everything for the overview tab.

            default:
                return new NextResponse(JSON.stringify({ error: 'Invalid query type' }), { status: 400 });
        }

    } catch (error) {
        console.error(`API Error for query=${queryType}:`, error);
        return new NextResponse(JSON.stringify({ error: 'Failed to fetch dashboard data.', details: (error as Error).message }), { status: 500 });
    }
}
