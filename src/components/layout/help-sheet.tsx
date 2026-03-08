'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface HelpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpSheet({ open, onOpenChange }: HelpSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] max-w-full overflow-y-auto sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>Help & Usage Guide</SheetTitle>
          <SheetDescription>Learn how to use the FOS Complaints Intelligence platform.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm text-slate-700">
          {/* Getting Started */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Getting Started</h3>
            <p className="mb-2">
              The platform provides four main views for exploring Financial Ombudsman Service (FOS) decisions:
            </p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li><strong>Dashboard</strong> &mdash; Search, KPIs, trends, outcomes, and case browsing.</li>
              <li><strong>Analysis</strong> &mdash; Deep-dive into year/product heatmaps, firm benchmarks, and precedent matrices.</li>
              <li><strong>Root Causes</strong> &mdash; Explore root-cause tag hierarchies, treemaps, and trends.</li>
              <li><strong>Firm Comparison</strong> &mdash; Compare up to 5 firms across outcomes, products, and key metrics.</li>
            </ul>
          </section>

          {/* How Filtering Works */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">How Filtering Works</h3>
            <p className="mb-2">
              Filters are cross-linked: applying a year, product, firm, or tag filter updates all charts and tables on the current page.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li>Click year pills to toggle year filters.</li>
              <li>Click chart segments, bars, or table rows to drill through.</li>
              <li>Active filters appear as removable chips below the search bar.</li>
              <li>Use the <strong>All</strong> button in the year bar to select or clear all years.</li>
            </ul>
          </section>

          {/* Chart Interactions */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Chart Interactions</h3>
            <p className="mb-1">
              Most charts are interactive. Look for the blue mouse-pointer hint below each chart title.
            </p>
            <ul className="ml-4 list-disc space-y-1 text-slate-600">
              <li><strong>Trend chart</strong> &mdash; Click dots to filter by year.</li>
              <li><strong>Outcome donut</strong> &mdash; Click a segment to filter by outcome.</li>
              <li><strong>Sunburst</strong> &mdash; Click inner or outer ring segments to filter by root cause.</li>
              <li><strong>Treemap</strong> &mdash; Click a block to filter by tag.</li>
              <li><strong>Bubble chart</strong> &mdash; Click a bubble to filter by product.</li>
              <li><strong>Stacked bars</strong> &mdash; Click a bar segment to filter by product.</li>
              <li><strong>Heatmap table</strong> &mdash; Click a cell to combine year and product filters.</li>
            </ul>
          </section>

          {/* Data Source */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Data Source</h3>
            <p className="text-slate-600">
              Data is sourced from the Financial Ombudsman Service published decisions corpus. Decisions are ingested,
              parsed for structured fields (firm, product, outcome, precedents, root causes), and stored for analysis.
              All counts and rates are computed from the filtered dataset.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
