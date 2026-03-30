import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

const NAV_ITEMS = [
  { href: '/insights/years', label: 'Years' },
  { href: '/insights/firms', label: 'Firms' },
  { href: '/insights/products', label: 'Products' },
  { href: '/insights/types', label: 'Themes' },
  { href: '/insights/year-products', label: 'Year + Product' },
  { href: '/insights/firm-products', label: 'Firm + Product' },
] as const;

export function PublicInsightsShell({ children }: { children: React.ReactNode }) {
  const workspaceHref = getWorkspaceEntryHref();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),#f5f8ff] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/88 backdrop-blur-lg">
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
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
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

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-10 md:grid-cols-[1.4fr_1fr] md:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">FOS Insights</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Public complaint analysis built on the same intelligence stack as the MEMA workspace.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              These public pages are generated from the published Financial Ombudsman decision corpus, with editorial-style narrative sections,
              structured rankings, and representative cases designed for search visibility and practical research use.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-slate-600">
            <Link href="/insights/years" className="hover:text-slate-950">Browse annual analysis</Link>
            <Link href="/insights/firms" className="hover:text-slate-950">Browse firm analysis</Link>
            <Link href="/insights/products" className="hover:text-slate-950">Browse product analysis</Link>
            <Link href="/insights/types" className="hover:text-slate-950">Browse complaint themes</Link>
            <Link href="/insights/year-products" className="hover:text-slate-950">Browse year and product analysis</Link>
            <Link href="/insights/firm-products" className="hover:text-slate-950">Browse firm and product analysis</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
