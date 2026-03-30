import Link from 'next/link';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

export function MarketingHeader() {
  const workspaceHref = getWorkspaceEntryHref();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-[rgba(246,248,252,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1f4f] text-white shadow-lg shadow-blue-950/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">MEMA Consultants</p>
            <p className="text-sm font-semibold text-slate-950 md:text-base">FOS Complaints Intelligence</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          <Link href="/insights" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Live Data</Link>
          <Link href="/check" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Outcome Estimator</Link>
          <Link href="#how-it-works" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">How it works</Link>
          <Link href={workspaceHref} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Platform</Link>
          <Link href="#roles" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Who it helps</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/insights"
            className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-sky-300 hover:text-sky-900 md:inline-flex"
          >
            Start analysis
          </Link>
          <Link
            href={workspaceHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
          >
            Request workspace demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
