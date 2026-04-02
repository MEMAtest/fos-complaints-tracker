import type { ReactNode } from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { PublicIllustration } from '@/components/illustrations/public-illustration';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

const NAV_ITEMS = [
  { href: '/insights/years', label: 'Years' },
  { href: '/insights/firms', label: 'Firms' },
  { href: '/insights/products', label: 'Products' },
  { href: '/insights/types', label: 'Themes' },
  { href: '/insights/year-products', label: 'Year + Product' },
  { href: '/insights/firm-products', label: 'Firm + Product' },
] as const;

export function PublicInsightsShell({ children }: { children: ReactNode }) {
  const workspaceHref = getWorkspaceEntryHref();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf8f2_0%,#f5f8ff_18%,#ffffff_46%,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[rgba(255,255,255,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <PublicTrackedLink href="/" eventName="public_nav_clicked" eventProps={{ source: 'insights_header', cta: 'brand_home' }} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1f4f] text-white shadow-lg shadow-blue-950/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Public Insights</p>
                <h1 className="text-sm font-semibold text-slate-900 md:text-base">FOS Complaints Intelligence</h1>
              </div>
            </PublicTrackedLink>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <PublicTrackedLink key={item.href} href={item.href} eventName="public_nav_clicked" eventProps={{ source: 'insights_header', cta: item.label }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                {item.label}
              </PublicTrackedLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <PublicTrackedLink href="/analysis" eventName="public_cta_clicked" eventProps={{ source: 'insights_header', cta: 'open_analysis' }} className="hidden h-8 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 md:inline-flex">
              Open analysis
            </PublicTrackedLink>
            <PublicTrackedLink href={workspaceHref} eventName="public_cta_clicked" eventProps={{ source: 'insights_header', cta: 'workspace' }} className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-[#0f1f4f] px-4 text-xs font-medium text-white shadow transition hover:bg-[#0c1940]">
              Workspace
              <ArrowRight className="h-4 w-4" />
            </PublicTrackedLink>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-[#08162f] text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-12">
          <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-center">
            <PublicIllustration variant="insight" className="border-white/10 bg-[linear-gradient(180deg,#fffdf7_0%,#eef4ff_100%)] shadow-none" />
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/55">FOS Insights</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Public complaint analysis built on the same intelligence layer as the MEMA workspace.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                Search-friendly firm, product, year, and complaint-theme pages generated from the published Financial Ombudsman decision corpus, with cleaner ranked views, representative cases, and stronger public navigation into the workspace.
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-white/70 md:grid-cols-2">
            <PublicTrackedLink href="/insights/years" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'years' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse annual analysis</PublicTrackedLink>
            <PublicTrackedLink href="/insights/firms" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'firms' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse firm analysis</PublicTrackedLink>
            <PublicTrackedLink href="/insights/products" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'products' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse product analysis</PublicTrackedLink>
            <PublicTrackedLink href="/insights/types" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'themes' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse complaint themes</PublicTrackedLink>
            <PublicTrackedLink href="/insights/year-products" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'year_products' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse year and product analysis</PublicTrackedLink>
            <PublicTrackedLink href="/insights/firm-products" eventName="public_nav_clicked" eventProps={{ source: 'insights_footer', cta: 'firm_products' }} className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse firm and product analysis</PublicTrackedLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
