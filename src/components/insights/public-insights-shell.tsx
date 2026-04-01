import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1f4f] text-white shadow-lg shadow-blue-950/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Public Insights</p>
                <h1 className="text-sm font-semibold text-slate-900 md:text-base">FOS Complaints Intelligence</h1>
              </div>
            </Link>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden rounded-full border-slate-300 bg-white md:inline-flex">
              <Link href="/analysis">Open analysis</Link>
            </Button>
            <Button asChild size="sm" className="gap-2 rounded-full bg-[#0f1f4f] px-4 hover:bg-[#0c1940]">
              <Link href={workspaceHref}>
                Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
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
            <Link href="/insights/years" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse annual analysis</Link>
            <Link href="/insights/firms" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse firm analysis</Link>
            <Link href="/insights/products" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse product analysis</Link>
            <Link href="/insights/types" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse complaint themes</Link>
            <Link href="/insights/year-products" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse year and product analysis</Link>
            <Link href="/insights/firm-products" className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 transition hover:bg-white/10 hover:text-white">Browse firm and product analysis</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
