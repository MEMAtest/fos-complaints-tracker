import { ArrowRight, BarChart3 } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

export function MarketingHeader() {
  const workspaceHref = getWorkspaceEntryHref();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-[rgba(250,251,255,0.84)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <PublicTrackedLink href="/" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'brand_home' }} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1f4f] text-white shadow-lg shadow-blue-950/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">MEMA Consultants</p>
            <p className="text-sm font-semibold text-slate-950 md:text-base">FOS Complaints Intelligence</p>
          </div>
        </PublicTrackedLink>

        <nav className="hidden items-center gap-6 lg:flex">
          <PublicTrackedLink href="/insights" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'live_data' }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Live Data</PublicTrackedLink>
          <PublicTrackedLink href="/check" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'outcome_estimator' }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Outcome Estimator</PublicTrackedLink>
          <PublicTrackedLink href="/#how-it-works" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'how_it_works' }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">How it works</PublicTrackedLink>
          <PublicTrackedLink href={workspaceHref} eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'platform' }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Platform</PublicTrackedLink>
          <PublicTrackedLink href="/#roles" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'who_it_helps' }} className="text-sm font-medium text-slate-600 transition hover:text-slate-950">Who it helps</PublicTrackedLink>
        </nav>

        <div className="flex items-center gap-2">
          <PublicTrackedLink
            href="/insights"
            eventName="public_cta_clicked"
            eventProps={{ source: 'marketing_header', cta: 'start_analysis' }}
            className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-sky-300 hover:text-sky-900 md:inline-flex"
          >
            Start analysis
          </PublicTrackedLink>
          <PublicTrackedLink
            href={workspaceHref}
            eventName="public_cta_clicked"
            eventProps={{ source: 'marketing_header', cta: 'workspace_demo' }}
            className="inline-flex items-center gap-2 rounded-full bg-[#0f1f4f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0c1940]"
          >
            Request workspace demo
            <ArrowRight className="h-4 w-4" />
          </PublicTrackedLink>
        </div>
      </div>
    </header>
  );
}
