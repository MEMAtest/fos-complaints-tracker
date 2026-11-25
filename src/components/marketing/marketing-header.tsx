'use client';

import { useRef } from 'react';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Menu } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { RegComplaintsWordmark } from '@/components/brand/regcomplaints-brand';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';

const publicLinks = [
  { href: '/insights', label: 'Evidence Explorer', event: 'evidence_explorer' },
  { href: '/check', label: 'Outcome Estimator', event: 'outcome_estimator' },
  { href: '/comparison', label: 'Compare Firms', event: 'comparison' },
  { href: '/advisor', label: 'Advisor', event: 'advisor' },
  { href: '/cmc', label: 'CMCs & Claims', event: 'cmc_claims' },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const workspaceHref = getWorkspaceEntryHref();

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  const links = publicLinks.map(({ href, label, event }) => {
    const current = pathname === href || pathname?.startsWith(href + '/');
    return (
      <PublicTrackedLink
        key={href}
        href={href}
        aria-current={current ? 'page' : undefined}
        eventName="public_nav_clicked"
        eventProps={{ source: 'marketing_header', cta: event }}
        onClick={closeMenu}
        className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${current ? 'bg-violet-100 text-violet-900' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'}`}
      >
        {label}
      </PublicTrackedLink>
    );
  });

  const platformLink = (
    <PublicTrackedLink
      href={workspaceHref}
      eventName="public_nav_clicked"
      eventProps={{ source: 'marketing_header', cta: 'management_platform' }}
      onClick={closeMenu}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#102a4e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#173960]"
    >
      <BriefcaseBusiness className="h-4 w-4 text-teal-200" aria-hidden="true" />
      Management platform
    </PublicTrackedLink>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[rgba(250,251,255,0.95)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 xl:px-8">
        <PublicTrackedLink href="/" eventName="public_nav_clicked" eventProps={{ source: 'marketing_header', cta: 'brand_home' }} className="flex min-w-0 items-center">
          <RegComplaintsWordmark tone="light" markWidth={36} subtitle="FOS Complaints Intelligence" />
        </PublicTrackedLink>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {links}
        </nav>
        <div className="hidden shrink-0 lg:block">{platformLink}</div>
        <details ref={menuRef} className="relative shrink-0 lg:hidden" onKeyDown={(event) => {
          if (event.key === 'Escape' && menuRef.current?.open) {
            closeMenu();
            menuRef.current?.querySelector('summary')?.focus();
          }
        }}>
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800" aria-label="Open navigation">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <nav aria-label="Main navigation" className="absolute right-0 mt-3 grid w-64 max-w-[calc(100vw-2rem)] gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {links}
            <div className="mt-1 border-t border-slate-200 pt-2">{platformLink}</div>
          </nav>
        </details>
      </div>
    </header>
  );
}
