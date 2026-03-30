import { unstable_cache } from 'next/cache';
import { getInsightsLandingData } from '@/lib/insights/repository';
import { getAppHref } from './config';
import type { HomepageSnapshot } from './types';

const REVALIDATE_SECONDS = 60 * 60;

function helper(metric: string | undefined, fallback: string): string {
  return metric?.trim() || fallback;
}

export const getHomepageSnapshot = unstable_cache(async (): Promise<HomepageSnapshot> => {
  const landing = await getInsightsLandingData();
  const latestYear = landing.collections.find((collection) => collection.href === '/insights/years')?.items[0];
  const topFirm = landing.collections.find((collection) => collection.href === '/insights/firms')?.items[0];
  const topProduct = landing.collections.find((collection) => collection.href === '/insights/products')?.items[0];
  const topTheme = landing.collections.find((collection) => collection.href === '/insights/types')?.items[0];

  return {
    hero: {
      eyebrow: 'Live FOS complaints intelligence',
      title: 'See live complaint intelligence clearly, then move straight into the workflow.',
      dek:
        'Explore firms, products, years, and complaint themes in public. Then step into the secure workspace to investigate complaints, draft responses, and produce board-ready reporting without rebuilding the story by hand.',
      primaryCta: {
        label: 'Explore live data',
        href: '/insights',
      },
      secondaryCta: {
        label: 'Open workspace',
        href: getAppHref('/'),
      },
    },
    liveProof: [
      {
        label: 'Published decisions',
        value: helper(landing.metrics[0]?.value, 'Live'),
        helper: helper(landing.metrics[0]?.helper, 'Live published ombudsman decision coverage.'),
      },
      {
        label: 'Public insight pages',
        value: helper(landing.metrics[1]?.value, 'Growing'),
        helper: helper(landing.metrics[1]?.helper, 'Search-friendly year, firm, product, and theme analysis.'),
      },
      {
        label: 'Current upheld rate',
        value: helper(landing.metrics[2]?.value, 'Live'),
        helper: helper(landing.metrics[2]?.helper, 'A live read on the current published decision mix.'),
      },
      {
        label: 'Latest year in focus',
        value: helper(landing.metrics[3]?.value, latestYear?.title || 'Current'),
        helper: helper(landing.metrics[3]?.helper, 'The latest annual complaint analysis already published.'),
      },
    ],
    demoSteps: [
      {
        key: 'search',
        label: 'Search',
        title: 'Start with live public complaint intelligence.',
        caption:
          'Search the public corpus by year, firm, product, and complaint theme before you ever enter the secure workspace.',
        href: '/insights',
        actionLabel: 'Open live insights',
        eyebrow: 'Live public access',
        metrics: [
          { label: 'Published decisions', value: helper(landing.metrics[0]?.value, 'Live'), helper: 'Corpus coverage' },
          { label: 'Latest year', value: latestYear?.title || helper(landing.metrics[3]?.value, 'Current'), helper: 'Annual analysis' },
        ],
        bullets: [
          'Jump into annual, firm, product, and theme pages immediately.',
          'Use public pages as the front door into the platform.',
          'Move from search visibility into real complaint context without friction.',
        ],
        previewRows: [
          { label: 'Search query', value: 'Lloyds · Banking and credit', tone: 'accent' },
          { label: 'Live archive', value: 'Years · Firms · Products · Themes' },
          { label: 'Featured page', value: latestYear?.title ? `${latestYear.title} annual analysis` : 'Latest annual analysis', tone: 'positive' },
        ],
      },
      {
        key: 'compare',
        label: 'Compare',
        title: 'See how firms and products sit against the wider dataset.',
        caption:
          'Move from a single page into relative context: which firms dominate, which products carry exposure, and where upheld patterns diverge.',
        href: '/comparison',
        actionLabel: 'Open firm comparison',
        eyebrow: 'Context before judgment',
        metrics: [
          { label: 'Top firm', value: topFirm?.title || 'Leading firm view', helper: 'High-volume comparison candidate' },
          { label: 'Top product', value: topProduct?.title || 'Product view', helper: 'Recurring product line' },
        ],
        bullets: [
          'Compare live firm footprints against the wider published corpus.',
          'Spot product concentration and upheld-rate context quickly.',
          'Use comparison as the bridge between browsing and investigation.',
        ],
        previewRows: [
          { label: topFirm?.title || 'Firm A', value: topFirm?.summary || 'High published decision volume', tone: 'accent' },
          { label: topProduct?.title || 'Firm B', value: topProduct?.summary || 'Product concentration in view' },
          { label: 'Compare by', value: 'Volume · upheld rate · complaint mix', tone: 'positive' },
        ],
      },
      {
        key: 'work',
        label: 'Work',
        title: 'Handle complaints in one place once you move into the workspace.',
        caption:
          'The secure workspace is where evidence, letters, approvals, actions, and timelines stay connected instead of being rebuilt across tools.',
        href: getAppHref('/complaints'),
        actionLabel: 'Open complaints workspace',
        eyebrow: 'Operational complaint handling',
        metrics: [
          { label: 'Workspace focus', value: 'Evidence + letters', helper: 'Operational complaint handling' },
          { label: 'Review model', value: 'Approvals + versions', helper: 'Controlled correspondence workflow' },
        ],
        bullets: [
          'Track complaint detail, evidence, letters, reviewer notes, and actions together.',
          'Use historical complaint intelligence to support draft quality and reviewer focus.',
          'Keep the full operating trail visible from intake to final response.',
        ],
        previewRows: [
          { label: 'Complaint detail', value: 'Evidence linked · letters versioned', tone: 'accent' },
          { label: 'Review state', value: 'Draft → approved → sent' },
          { label: 'SLA and actions', value: 'Deadlines, owners, remediation prompts', tone: 'positive' },
        ],
      },
      {
        key: 'report',
        label: 'Report',
        title: 'Finish with outputs leadership can actually use.',
        caption:
          'Board packs, appendix material, and management reporting are built from the same complaint and insight layer, so the narrative stays consistent.',
        href: getAppHref('/board-pack'),
        actionLabel: 'Open board pack builder',
        eyebrow: 'Board-ready reporting',
        metrics: [
          { label: 'Outputs', value: 'PDF + PPTX', helper: 'Export-ready board reporting' },
          { label: 'Appendix inputs', value: 'Letters + evidence', helper: 'Operational detail included' },
        ],
        bullets: [
          'Generate reporting directly from the intelligence and complaint workflow.',
          'Bring evidence, correspondence, and actions into cleaner board-level summaries.',
          'Avoid rebuilding slides and commentary in separate tools each cycle.',
        ],
        previewRows: [
          { label: 'Executive summary', value: 'Live portfolio and complaint context', tone: 'accent' },
          { label: 'Appendix', value: 'Evidence · letters · overdue items' },
          { label: 'Exports', value: 'Board-ready PDF and PPTX', tone: 'positive' },
        ],
      },
    ],
    storySteps: [
      {
        key: 'explore',
        stage: '01',
        title: 'Explore the public signal before you commit to the workspace.',
        body:
          'The homepage and insights layer are designed as a real entry point, not a marketing dead end. Users can browse years, firms, products, and complaint themes immediately and understand what sits behind the platform.',
        bullets: [
          'Search live complaint intelligence publicly.',
          'Use real annual, firm, and product pages as the first interaction.',
          'See fresh analysis instead of static brochure copy.',
        ],
        href: '/insights',
        accentMetric: helper(landing.metrics[1]?.value, 'Live pages'),
      },
      {
        key: 'understand',
        stage: '02',
        title: 'Move from surface-level browsing into context.',
        body:
          'Comparison and structured analysis let users see whether a complaint signal is concentrated, broad, worsening, or isolated. That is the step where raw browsing becomes real decision context.',
        bullets: [
          'Compare firms and products against the wider dataset.',
          'Use relative context before drawing conclusions.',
          'Carry public insight into deeper review work.',
        ],
        href: '/comparison',
        accentMetric: topFirm?.title || 'Firm comparison',
      },
      {
        key: 'work',
        stage: '03',
        title: 'Work complaints with evidence, letters, approvals, and actions connected.',
        body:
          'The workspace is where the platform becomes operational. Users can manage complaint detail, evidence, controlled correspondence, reviewer notes, and remediation actions without losing the analytical context that brought them there.',
        bullets: [
          'Evidence, letters, approvals, and actions stay on the same record.',
          'Historical intelligence improves draft quality and review focus.',
          'The handling trail stays visible from start to finish.',
        ],
        href: getAppHref('/complaints'),
        accentMetric: 'Investigation-ready workflow',
      },
      {
        key: 'report',
        stage: '04',
        title: 'Report the outcome without rebuilding the narrative elsewhere.',
        body:
          'Board packs and leadership outputs sit on top of the same complaint and intelligence layer. That keeps public insight, handling activity, and reporting aligned instead of fragmenting the story across decks and spreadsheets.',
        bullets: [
          'Board-ready exports are built from the live workspace.',
          'Appendix material can draw on letters, evidence, and actions.',
          'Leadership reporting stays anchored to the actual operating record.',
        ],
        href: getAppHref('/board-pack'),
        accentMetric: 'Board-ready outputs',
      },
    ],
    surfaces: [
      {
        key: 'insights',
        eyebrow: 'Live Insights',
        title: 'Public analysis pages with real substance behind them.',
        body: 'The public layer exposes high-signal firm, product, theme, and annual analysis pages so users can start from live data instead of a brochure.',
        bullets: [
          'Year, firm, product, and theme archives.',
          'SEO-friendly deep pages with representative cases.',
          'Clear routing into higher-value analysis surfaces.',
        ],
        href: '/insights',
        metric: helper(landing.metrics[1]?.value, 'Public insight pages'),
      },
      {
        key: 'comparison',
        eyebrow: 'Firm and Product Comparison',
        title: 'A cleaner way to compare exposure and concentration.',
        body: 'Comparison pages bring together firm footprint, product mix, upheld context, and concentration so users can see the pattern before they investigate the detail.',
        bullets: [
          'Relative firm and product context.',
          'Stronger interpretation than a flat table or search result.',
          'Useful bridge between public browsing and operational review.',
        ],
        href: '/comparison',
        metric: topFirm?.title || 'Live comparison workspace',
      },
      {
        key: 'workspace',
        eyebrow: 'Complaints Workspace',
        title: 'The operational layer for handling complaints properly.',
        body: 'Once users move into the workspace, the platform holds the evidence trail, correspondence workflow, approvals, reminders, and activity history together.',
        bullets: [
          'Evidence and complaint detail in one place.',
          'Letters with reviewer workflow and version history.',
          'Actions, deadlines, and handling visibility.',
        ],
        href: getAppHref('/complaints'),
        metric: 'Evidence + letters + approvals',
      },
      {
        key: 'reporting',
        eyebrow: 'Board Pack Builder',
        title: 'Reporting built from the same intelligence and workflow layer.',
        body: 'Board packs and appendix material are generated from the same complaint and analysis context, so leadership reporting stays cleaner and more defensible.',
        bullets: [
          'Templates, saved definitions, and appendix material.',
          'PDF and PPTX output paths.',
          'Reporting grounded in live complaint context.',
        ],
        href: getAppHref('/board-pack'),
        metric: 'PDF + PPTX outputs',
      },
    ],
    expectations: [
      {
        title: 'You can start publicly.',
        body: 'Visitors can search live firm, year, product, and complaint-theme analysis before they ever touch the secure workspace.',
      },
      {
        title: 'You can move into operational complaint handling.',
        body: 'Once inside the workspace, users can manage evidence, letters, approvals, reviewer notes, actions, and timelines in one system.',
      },
      {
        title: 'You can work at analyst or board level.',
        body: 'The same platform supports quick research, deeper complaint handling, and leadership-ready board reporting without splitting the process across separate tools.',
      },
      {
        title: 'You can expect a clear path through the platform.',
        body: 'Explore the signal, understand the pattern, work the complaint, and report the outcome. The homepage is built to make that flow obvious.',
      },
    ],
    featuredLinks: landing.featured.slice(0, 6).map((item, index) => ({
      title: item.title,
      href: item.href,
      description: item.description,
      tag: index === 0 ? 'Featured live page' : 'Live analysis',
    })),
    updatedAt: landing.lastUpdated,
  };
}, ['marketing-homepage-snapshot'], { revalidate: REVALIDATE_SECONDS });
