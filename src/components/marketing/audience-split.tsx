import { ArrowRight } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import { getWorkspaceEntryHref } from '@/lib/marketing/config';
import type { HomepageAudienceCard, HomepageSnapshot } from '@/lib/marketing/types';
import { cn } from '@/lib/utils';

type AudienceSplitProps = {
  links: HomepageSnapshot['featuredLinks'];
  audienceCards: HomepageAudienceCard[];
};

export function AudienceSplit({ links, audienceCards }: AudienceSplitProps) {
  const workspaceHref = getWorkspaceEntryHref();
  const featured = links.slice(0, 3);

  return (
    <section id="roles" className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 md:px-8 md:pb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Platform fit</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            See how different roles benefit.
          </h2>
        </div>
        <PublicTrackedLink
          href="/insights"
          eventName="public_cta_clicked"
          eventProps={{ source: 'homepage_roles', cta: 'browse_live_pages' }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-800 transition hover:text-sky-950 md:text-sm"
        >
          Browse evidence pages
          <ArrowRight className="h-4 w-4" />
        </PublicTrackedLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {audienceCards.map((card) => (
            <article
              key={card.key}
              className={cn(
                'flex flex-col justify-between rounded-2xl border p-5 shadow-sm',
                card.tone === 'dark'
                  ? 'border-[#14224f] bg-[#14224f] text-white'
                  : 'border-slate-200 bg-white text-slate-950'
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('text-[10px] font-semibold uppercase tracking-[0.16em]', card.tone === 'dark' ? 'text-white/60' : 'text-slate-500')}>
                    {card.eyebrow}
                  </p>
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]', card.tone === 'dark' ? 'border-white/15 bg-white/10 text-white/75' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                    {card.key === 'workspace-teams' ? 'Workspace' : 'Public data'}
                  </span>
                </div>
                <h3 className="mt-2.5 text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className={cn('mt-2 text-xs leading-5', card.tone === 'dark' ? 'text-white/72' : 'text-slate-600')}>
                  {card.body}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {card.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className={cn('flex items-start gap-2 text-xs leading-5', card.tone === 'dark' ? 'text-white/80' : 'text-slate-600')}
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', card.tone === 'dark' ? 'bg-[#e2b12f]' : 'bg-sky-600')} />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <PublicTrackedLink
                  href={card.href}
                  eventName="public_cta_clicked"
                  eventProps={{ source: 'homepage_audience_card', cta: card.key }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                    card.tone === 'dark'
                      ? 'bg-white text-slate-950 hover:bg-slate-100'
                      : 'bg-[#0f1f4f] text-white hover:bg-[#0c1940]'
                  )}
                >
                  {card.ctaLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </PublicTrackedLink>
                {card.key === 'workspace-teams' ? (
                  <PublicTrackedLink
                    href={workspaceHref}
                    eventName="public_cta_clicked"
                    eventProps={{ source: 'homepage_audience_card', cta: 'workspace_direct' }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                  >
                    Open workspace
                  </PublicTrackedLink>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-2.5">
          {featured.map((link) => (
            <PublicTrackedLink
              key={link.href}
              href={link.href}
              eventName="public_cta_clicked"
              eventProps={{ source: 'homepage_featured_links', cta: link.tag }}
              className="group flex flex-1 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">{link.tag}</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950 group-hover:text-sky-900">{link.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{link.description}</p>
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 group-hover:text-sky-800">
                Open evidence page
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </PublicTrackedLink>
          ))}
        </div>
      </div>
    </section>
  );
}
