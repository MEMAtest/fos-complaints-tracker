import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
    <section id="roles" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8 md:py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Platform fit</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">See how different roles benefit.</h2>
        </div>
        <Link href="/insights" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-800 transition hover:text-sky-950">
          Browse live pages
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-3">
          {featured.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'group rounded-[1.7rem] border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)]',
                index === 0
                  ? 'border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]'
                  : index === 1
                    ? 'border-slate-200 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)]'
                    : 'border-slate-200 bg-[linear-gradient(180deg,#fff7eb_0%,#ffffff_100%)]'
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{link.tag}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{link.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{link.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 transition group-hover:text-sky-900">
                Open live page
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-4">
          {audienceCards.map((card) => (
            <article
              key={card.key}
              className={cn(
                'rounded-[1.9rem] border p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-7',
                card.tone === 'dark' ? 'border-[#14224f] bg-[#14224f] text-white' : 'border-slate-200 bg-white text-slate-950'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={cn('text-[11px] uppercase tracking-[0.18em]', card.tone === 'dark' ? 'text-white/58' : 'text-slate-500')}>
                  {card.eyebrow}
                </p>
                <div className={cn('rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]', card.tone === 'dark' ? 'border-white/12 bg-white/8 text-white/72' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                  {card.key === 'workspace-teams' ? 'Workspace' : 'Public data'}
                </div>
              </div>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight md:text-[1.95rem]">{card.title}</h3>
              <p className={cn('mt-4 text-sm leading-7', card.tone === 'dark' ? 'text-white/72' : 'text-slate-600')}>
                {card.body}
              </p>
              <ul className="mt-5 grid gap-3 md:grid-cols-3">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className={cn('rounded-[1.15rem] border px-4 py-3 text-sm leading-6', card.tone === 'dark' ? 'border-white/10 bg-white/7 text-white/76' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                    {bullet}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={card.href}
                  className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition', card.tone === 'dark' ? 'bg-white text-slate-950 hover:bg-slate-100' : 'bg-[#0f1f4f] text-white hover:bg-[#0c1940]')}
                >
                  {card.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {card.key === 'workspace-teams' ? (
                  <Link href={workspaceHref} className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition', card.tone === 'dark' ? 'border-white/14 bg-white/8 text-white hover:bg-white/12' : 'border-slate-300 bg-white text-slate-950 hover:border-sky-300 hover:text-sky-900')}>
                    Open workspace
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
