import Link from 'next/link';
import type { InsightPageData } from '@/lib/insights/types';
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from '@/lib/insights/seo';
import { formatDate, formatNumber } from '@/lib/utils';

export function InsightDetailView({ page }: { page: InsightPageData }) {
  const breadcrumbSchema = buildBreadcrumbSchema(page);
  const faqSchema = buildFaqSchema(page.faq);
  const webPageSchema = buildWebPageSchema(page);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} /> : null}

      <section className="overflow-hidden rounded-[2.25rem] border border-slate-200/70 bg-[linear-gradient(140deg,#ffffff_0%,#f4f8ff_45%,#eaf4ff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
        <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-10">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {page.breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  <Link href={crumb.href} className="hover:text-slate-900">{crumb.title}</Link>
                  {index < page.breadcrumbs.length - 1 ? <span>/</span> : null}
                </span>
              ))}
            </nav>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{page.hero.eyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">{page.hero.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{page.hero.dek}</p>
          </div>
          <div className="rounded-[1.8rem] border border-slate-200 bg-white/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Page summary</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">{page.description}</p>
            <div className="mt-6 grid gap-3">
              {page.metrics.slice(0, 2).map((metric) => (
                <div key={metric.label} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{metric.value}</p>
                  {metric.helper ? <p className="mt-1 text-xs text-slate-500">{metric.helper}</p> : null}
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-slate-500">{page.lastUpdated ? `Latest published decision ${formatDate(page.lastUpdated)}` : 'Latest decision date unavailable'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {page.metrics.map((metric) => (
          <article key={metric.label} className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
            {metric.helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p> : null}
          </article>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-6">
          {page.sections.map((section) => (
            <article key={section.key} className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-6 shadow-sm md:p-7">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
              <div className="mt-4 grid gap-4 text-sm leading-7 text-slate-600 md:text-[15px]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-600" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          <article className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-6 shadow-sm md:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Representative cases</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Recent published decisions in this slice</h2>
              </div>
              <p className="text-sm text-slate-500">{formatNumber(page.representativeCases.length)} examples shown</p>
            </div>
            <div className="mt-5 grid gap-4">
              {page.representativeCases.map((item) => {
                const href = item.sourceUrl || item.pdfUrl || null;
                return (
                  <article key={item.caseId} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>{item.decisionReference}</span>
                      {item.decisionDate ? <span>{formatDate(item.decisionDate)}</span> : null}
                      <span>{item.outcome}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{item.firmName || 'Unnamed firm'}{item.productGroup ? ` · ${item.productGroup}` : ''}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary || 'No summary extracted for this decision.'}</p>
                    {href ? (
                      <Link href={href} className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900" target="_blank" rel="noreferrer">
                        View source decision
                      </Link>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-24 xl:self-start">
          {page.rankedLists.map((section) => {
            const maxValue = Math.max(...section.items.map((item) => item.value), 1);
            return (
              <section key={section.key} className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ranked view</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
                <div className="mt-5 grid gap-4">
                  {section.items.slice(0, 8).map((item) => (
                    <div key={`${section.key}-${item.label}`}>
                      <div className="flex items-start justify-between gap-3 text-sm">
                        {item.href ? (
                          <Link href={item.href} className="font-medium text-slate-900 hover:text-sky-800">{item.label}</Link>
                        ) : (
                          <span className="font-medium text-slate-900">{item.label}</span>
                        )}
                        <span className="font-semibold text-slate-950">{item.valueLabel}</span>
                      </div>
                      {item.helper ? <p className="mt-1 text-xs text-slate-500">{item.helper}</p> : null}
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-700" style={{ width: `${Math.max(12, (item.value / maxValue) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">FAQ</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Common questions</h2>
            <div className="mt-5 grid gap-4">
              {page.faq.map((item) => (
                <article key={item.question} className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Related analysis</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Keep exploring</h2>
            <div className="mt-5 grid gap-3">
              {page.relatedLinks.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-200 hover:bg-sky-50/70">
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
