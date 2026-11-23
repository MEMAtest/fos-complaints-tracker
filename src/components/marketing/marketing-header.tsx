import { ArrowRight, BriefcaseBusiness, Menu } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { RegComplaintsWordmark } from '@/components/brand/regcomplaints-brand';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

export function MarketingHeader() {
  const workspaceHref = getWorkspaceEntryHref();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-[rgba(250,251,255,0.88)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 xl:px-8">
        <PublicTrackedLink href="/" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'brand_home' }} className="flex shrink-0 items-center gap-2.5">
          <RegComplaintsWordmark tone="light" markWidth={36} subtitle="FOS Complaints Intelligence" />
        </PublicTrackedLink>

        <nav className="hidden items-center gap-4 lg:flex xl:gap-5">
          <PublicTrackedLink href="/insights" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'evidence_explorer' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">Evidence Explorer</PublicTrackedLink>
          <PublicTrackedLink href="/check" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'outcome_estimator' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">Outcome Estimator</PublicTrackedLink>
          <PublicTrackedLink href="/comparison" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'comparison' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">Compare Firms</PublicTrackedLink>
          <PublicTrackedLink href="/advisor" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'advisor' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">Advisor</PublicTrackedLink>
          <PublicTrackedLink href="/#how-it-works" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'how_it_works' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">How it works</PublicTrackedLink>
          <PublicTrackedLink href="/#roles" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'who_it_helps' }} className="whitespace-nowrap text-[13px] font-medium text-slate-600 transition hover:text-slate-950">Who it helps</PublicTrackedLink>
          <span className="h-5 w-px bg-slate-300" aria-hidden="true" />
          <PublicTrackedLink
            href={workspaceHref}
            eventName="public_nav_clicked"
            eventProps={{ source: 'marketing_header', cta: 'management_platform' }}
            className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[12px] font-semibold text-teal-900 transition hover:border-teal-300 hover:bg-teal-100"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Management platform
          </PublicTrackedLink>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <details className="relative lg:hidden">
            <summary role="button" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800" aria-label="Open navigation">
              <Menu className="h-4.5 w-4.5" />
            </summary>
            <nav className="absolute right-0 mt-3 grid w-64 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {[
                ['/insights', 'Evidence Explorer'],
                ['/check', 'Outcome Estimator'],
                ['/comparison', 'Compare Firms'],
                ['/advisor', 'Advisor'],
                [workspaceHref, 'Open management platform'],
              ].map(([href, label]) => (
                <PublicTrackedLink key={href} href={href} eventName="public_nav_clicked" eventProps={{ source: 'mobile_marketing_header', cta: label }} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {label}
                </PublicTrackedLink>
              ))}
            </nav>
          </details>
          <PublicTrackedLink
            href="/insights"
            eventName="public_cta_clicked"
            eventProps={{ source: 'marketing_header', cta: 'start_analysis' }}
            className="hidden whitespace-nowrap rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition hover:border-sky-300 hover:text-sky-900 xl:inline-flex"
          >
            Start analysis
          </PublicTrackedLink>
          <PublicTrackedLink
            href={workspaceHref}
            eventName="public_cta_clicked"
            eventProps={{ source: 'marketing_header', cta: 'workspace_demo' }}
            className="hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0f1f4f] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#0c1940] sm:inline-flex"
          >
            Open platform
            <ArrowRight className="h-3.5 w-3.5" />
          </PublicTrackedLink>
        </div>
      </div>
    </header>
  );
}
