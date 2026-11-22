import { ArrowRight } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { BRAND_TAGLINE, RegComplaintsLockup } from '@/components/brand/regcomplaints-brand';

type FooterCtaProps = {
  workspaceHref: string;
};

export function FooterCta({ workspaceHref }: FooterCtaProps) {
  return (
    <footer className="relative overflow-hidden border-t border-slate-200 bg-[#08162f] py-8 text-white md:py-10">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-white/10 bg-white/6 px-6 py-5 backdrop-blur-md lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#f5daa3]/80">Ready to build defensible complaint intelligence?</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
              Start with published Ombudsman intelligence, then step into the workspace for full case handling and board packs.
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <PublicTrackedLink
              href="/insights"
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_footer', cta: 'start_analysis' }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-slate-100 md:text-sm"
            >
              Start analysis
              <ArrowRight className="h-4 w-4" />
            </PublicTrackedLink>
            <PublicTrackedLink
              href={workspaceHref}
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_footer', cta: 'workspace_demo' }}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 md:text-sm"
            >
              Request workspace demo
            </PublicTrackedLink>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <RegComplaintsLockup width={210} tone="on-dark" />
            <span className="hidden h-4 w-px bg-white/15 md:inline-block" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f5daa3]/75">
              {BRAND_TAGLINE}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/65">
            <PublicTrackedLink href="/insights" eventName="public_nav_clicked" eventProps={{ source: 'homepage_footer', cta: 'evidence_data' }} className="transition hover:text-white">Evidence Explorer</PublicTrackedLink>
            <PublicTrackedLink href="/check" eventName="public_nav_clicked" eventProps={{ source: 'homepage_footer', cta: 'outcome_estimator' }} className="transition hover:text-white">Outcome Estimator</PublicTrackedLink>
            <a href="https://regcanary.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">RegCanary</a>
            <a href="https://regactions.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">RegActions</a>
            <a href="https://regduty.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">RegDuty</a>
            <a href="https://memaconsultants.com" target="_blank" rel="noopener noreferrer" className="transition hover:text-white">MEMA Consultants</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
