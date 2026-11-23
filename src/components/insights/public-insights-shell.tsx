'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { RegComplaintsLockup } from '@/components/brand/regcomplaints-brand';

const collections = [
  { href: '/insights', detail: '', label: 'Overview' },
  { href: '/insights/years', detail: '/insights/year/', label: 'Years' },
  { href: '/insights/firms', detail: '/insights/firm/', label: 'Firms' },
  { href: '/insights/products', detail: '/insights/product/', label: 'Products' },
  { href: '/insights/types', detail: '/insights/type/', label: 'Themes' },
  { href: '/insights/year-products', detail: '', label: 'Year + Product' },
  { href: '/insights/firm-products', detail: '', label: 'Firm + Product' },
];

export function PublicInsightsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/');
  const crossSection = segments[4] === 'product' && segments.length === 6;
  const active = crossSection
    ? segments[2] === 'year' ? '/insights/year-products' : '/insights/firm-products'
    : collections.find(({ href, detail }) => pathname === href || (detail && pathname.startsWith(detail)))?.href;

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#f8f7ff_0%,#f5f8ff_24%,#fff_60%)] text-slate-950">
      <MarketingHeader />
      <div className="border-b border-slate-200 bg-white/70">
        <nav aria-label="Browse evidence by" className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2.5 md:px-6 xl:px-8">
          {collections.map(({ href, label }) => (
            <PublicTrackedLink
              key={href}
              href={href}
              aria-current={active === href ? (pathname === href ? 'page' : 'location') : undefined}
              eventName="public_nav_clicked"
              eventProps={{ source: 'insights_header', cta: label }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active === href ? 'bg-violet-100 text-violet-900' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              {label}
            </PublicTrackedLink>
          ))}
        </nav>
      </div>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-[#08162f] text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-7 sm:flex-row sm:items-center sm:justify-between md:px-6 xl:px-8">
          <RegComplaintsLockup width={190} tone="on-dark" />
          <p className="text-sm text-slate-300">Evidence from published Financial Ombudsman Service decisions.</p>
        </div>
      </footer>
    </div>
  );
}
