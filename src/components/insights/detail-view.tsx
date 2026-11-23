import { ArrowRight } from 'lucide-react';
import { PublicTrackedLink } from '@/components/analytics/public-tracked-link';
import type { InsightPageData } from '@/lib/insights/types';
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from '@/lib/insights/seo';
import { formatDate, formatNumber } from '@/lib/utils';

const METRIC_TONES = [
  'border-sky-200 bg-[linear-gradient(180deg,#f3f9ff_0%,#ffffff_100%)]',
  'border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)]',
  'border-violet-200 bg-[linear-gradient(180deg,#f7f2ff_0%,#ffffff_100%)]',
  'border-slate-200 bg-white',
] as const;

const SECTION_TONES = [
  'border-slate-200 bg-white',
  'border-slate-200 bg-[linear-gradient(180deg,#fffdf7_0%,#ffffff_100%)]',
  'border-slate-200 bg-[linear-gradient(180deg,#f6faff_0%,#ffffff_100%)]',
] as const;

export function InsightDetailView({ page }: { page: InsightPageData }) {
  const breadcrumbSchema = buildBreadcrumbSchema(page);
  const faqSchema = buildFaqSchema(page.faq);
  const webPageSchema = buildWebPageSchema(page);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} /> : null}

      <section className="overflow-hidden rounded-[2.35rem] border border-slate-200/70 bg-[linear-gradient(140deg,#fffdf7_0%,#f5f8ff_48%,#edf3ff_100%)] shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
        <div className="grid items-start gap-6 p-6 md:p-8 xl:grid-cols-[1.02fr_0.98fr]">
          <div>
            <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {page.breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} className="flex items-center gap-2">
                  <PublicTrackedLink href={crumb.href} eventName="public_nav_clicked" eventProps={{ source: 'insight_breadcrumb', cta: crumb.title }} className="hover:text-slate-900">{crumb.title}</PublicTrackedLink>
                  {index < page.breadcrumbs.length - 1 ? <span>/</span> : null}
                </span>
              ))}
            </nav>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">{page.hero.eyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl md:leading-[1.02]">{page.hero.title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{page.hero.dek}</p>
            <p className="mt-4 text-xs text-slate-600">
              Source: published Financial Ombudsman Service decisions.
              {page.lastUpdated ? ` Latest decision in this view: ${formatDate(page.lastUpdated)}.` : ''}
            </p>
            {page.representativeCases.length > 0 && (
              <a href="#representative-decisions" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#102a4e] px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                View supporting decisions <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>

          <section aria-label="Decision metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {page.metrics.map((metric, index) => (
                <article key={metric.label} className={`rounded-[1.55rem] border p-5 shadow-sm ${METRIC_TONES[index % METRIC_TONES.length]}`}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                  {metric.helper ? <p className="mt-2 text-sm leading-6 text-slate-600">{metric.helper}</p> : null}
                </article>
              ))}
          </section>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="grid gap-6">
          {page.sections.map((section, index) => (
            <article key={section.key} className={`rounded-[1.9rem] border p-6 shadow-sm md:p-7 ${SECTION_TONES[index % SECTION_TONES.length]}`}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Analysis
                </span>
              </div>
              <div className="mt-4 grid gap-4 text-sm leading-7 text-slate-600 md:text-[15px]">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-5 grid gap-2 rounded-[1.5rem] border border-slate-200 bg-white/92 p-4 text-sm text-slate-700 shadow-sm">
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

          <article id="representative-decisions" className="scroll-mt-24 rounded-[1.95rem] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Representative cases</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Recent published decisions in this slice</h2>
              </div>
              <p className="text-sm text-slate-500">{formatNumber(page.representativeCases.length)} examples shown</p>
            </div>
            <div className="mt-5 grid gap-4">
              {page.representativeCases.map((item, index) => {
                const href = item.sourceUrl || item.pdfUrl || null;
                return (
                  <article key={item.caseId} className={index % 2 === 0 ? 'rounded-[1.4rem] border border-sky-200 bg-[linear-gradient(180deg,#f6fbff_0%,#ffffff_100%)] p-4' : 'rounded-[1.4rem] border border-slate-200 bg-[#fbfcfe] p-4'}>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>{item.decisionReference}</span>
                      {item.decisionDate ? <span>{formatDate(item.decisionDate)}</span> : null}
                      <span>{item.outcome}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{item.firmName || 'Unnamed firm'}{item.productGroup ? ` · ${item.productGroup}` : ''}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary || 'No summary extracted for this decision.'}</p>
                    {href ? (
                      <PublicTrackedLink href={href} eventName="public_cta_clicked" eventProps={{ source: 'insight_representative_case', cta: 'source_decision' }} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-900" target="_blank" rel="noreferrer">
                        View source decision
                        <ArrowRight className="h-4 w-4" />
                      </PublicTrackedLink>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </article>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-24 xl:self-start">
          {page.rankedLists.map((section, sectionIndex) => {
            const maxValue = Math.max(...section.items.map((item) => item.value), 1);
            return (
              <section key={section.key} className={sectionIndex === 0 ? 'rounded-[1.9rem] border border-[#102a4e] bg-[#102a4e] p-5 text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]' : 'rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm'}>
                <p className={sectionIndex === 0 ? 'text-xs uppercase tracking-[0.18em] text-white/55' : 'text-xs uppercase tracking-[0.18em] text-slate-500'}>Ranked view</p>
                <h2 className={sectionIndex === 0 ? 'mt-2 text-xl font-semibold tracking-tight text-white' : 'mt-2 text-xl font-semibold tracking-tight text-slate-950'}>{section.title}</h2>
                <p className={sectionIndex === 0 ? 'mt-2 text-sm leading-6 text-white/72' : 'mt-2 text-sm leading-6 text-slate-600'}>{section.description}</p>
                <div className="mt-5 grid gap-4">
                  {section.items.slice(0, 8).map((item) => (
                    <div key={`${section.key}-${item.label}`}>
                      <div className={sectionIndex === 0 ? 'flex items-start justify-between gap-3 text-sm text-white' : 'flex items-start justify-between gap-3 text-sm'}>
                        {item.href ? (
                          <PublicTrackedLink href={item.href} eventName="public_cta_clicked" eventProps={{ source: 'insight_ranked_view', cta: section.key }} className={sectionIndex === 0 ? 'font-medium text-white hover:text-sky-200' : 'font-medium text-slate-900 hover:text-sky-800'}>{item.label}</PublicTrackedLink>
                        ) : (
                          <span className={sectionIndex === 0 ? 'font-medium text-white' : 'font-medium text-slate-900'}>{item.label}</span>
                        )}
                        <span className={sectionIndex === 0 ? 'font-semibold text-white' : 'font-semibold text-slate-950'}>{item.valueLabel}</span>
                      </div>
                      {item.helper ? <p className={sectionIndex === 0 ? 'mt-1 text-xs text-white/58' : 'mt-1 text-xs text-slate-500'}>{item.helper}</p> : null}
                      <div className={sectionIndex === 0 ? 'mt-2 h-2 overflow-hidden rounded-full bg-white/10' : 'mt-2 h-2 overflow-hidden rounded-full bg-slate-100'}>
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-violet-500" style={{ width: `${Math.max(12, (item.value / maxValue) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-[1.9rem] border border-amber-200 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_100%)] p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">FAQ</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Common questions</h2>
            <div className="mt-5 grid gap-4">
              {page.faq.map((item) => (
                <article key={item.question} className="rounded-[1.35rem] border border-amber-200/70 bg-white/92 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Related analysis</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Keep exploring</h2>
            <div className="mt-5 grid gap-3">
              {page.relatedLinks.map((item, index) => (
                <PublicTrackedLink key={item.href} href={item.href} eventName="public_cta_clicked" eventProps={{ source: 'insight_related_links', cta: item.title }} className={index % 2 === 0 ? 'rounded-[1.3rem] border border-sky-200 bg-[linear-gradient(180deg,#f6fbff_0%,#ffffff_100%)] p-4 transition hover:border-sky-300' : 'rounded-[1.3rem] border border-slate-200 bg-[#fbfcfe] p-4 transition hover:border-slate-300'}>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </PublicTrackedLink>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
