import { unstable_cache } from 'next/cache';
import { getInsightsLandingData } from '@/lib/insights/repository';
import { getAppHref, getWorkspaceEntryHref } from './config';
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
        'Explore the public complaint signal first. Then move into the workspace to investigate complaints, manage evidence and letters, and produce reporting that leadership can actually use.',
      primaryCta: {
        label: 'Start analysis',
        href: '/insights',
      },
      secondaryCta: {
        label: 'Request workspace demo',
        href: getWorkspaceEntryHref(),
      },
      trustPoints: [
        'Live firm, product, year, and theme analysis',
        'Workspace for evidence, letters, approvals, and actions',
        'Board-ready outputs built from the same intelligence layer',
      ],
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
        title: 'Explore the public signal first.',
        caption:
          'Start with public year, firm, product, and theme pages so users can understand the complaint landscape before they ever enter the secure workspace.',
        href: '/insights',
        actionLabel: 'Start analysis',
        eyebrow: 'Live public access',
        metrics: [
          { label: 'Published decisions', value: helper(landing.metrics[0]?.value, 'Live'), helper: 'Corpus coverage' },
          { label: 'Latest year', value: latestYear?.title || helper(landing.metrics[3]?.value, 'Current'), helper: 'Annual analysis' },
          { label: 'Theme focus', value: topTheme?.title || 'Complaint themes', helper: 'Root-cause and complaint-theme view' },
        ],
        bullets: [
          'Search live annual, firm, product, and complaint-theme analysis.',
          'Use public pages as the front door into the product.',
          'Move from search visibility into real complaint context immediately.',
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
        title: 'See the complaint pattern in context.',
        caption:
          'Comparison views show where firm footprint, product concentration, and upheld patterns diverge, so users do not jump from a single page straight to a conclusion.',
        href: '/comparison',
        actionLabel: 'Open comparison',
        eyebrow: 'Context before judgment',
        metrics: [
          { label: 'Top firm', value: topFirm?.title || 'Leading firm view', helper: 'High-volume comparison candidate' },
          { label: 'Top product', value: topProduct?.title || 'Product view', helper: 'Recurring product line' },
          { label: 'Compare by', value: 'Volume + upheld', helper: 'Relative context across the corpus' },
        ],
        bullets: [
          'Compare live firm footprints against the wider published corpus.',
          'Spot product concentration and upheld-rate context quickly.',
          'Use comparison as the bridge between browsing and investigation.',
        ],
        previewRows: [
          { label: topFirm?.title || 'Firm profile', value: topFirm?.summary || 'High published decision volume', tone: 'accent' },
          { label: topProduct?.title || 'Product profile', value: topProduct?.summary || 'Product concentration in view' },
          { label: 'Comparison lens', value: 'Volume · mix · upheld context', tone: 'positive' },
        ],
      },
      {
        key: 'work',
        label: 'Work',
        title: 'Transition into the workspace when the complaint needs handling depth.',
        caption:
          'The workspace holds complaint detail, evidence, correspondence, approvals, and actions together so the operating trail stays connected from start to finish.',
        href: getAppHref('/complaints'),
        actionLabel: 'Request workspace demo',
        eyebrow: 'Operational complaint handling',
        metrics: [
          { label: 'Workspace focus', value: 'Evidence + letters', helper: 'Operational complaint handling' },
          { label: 'Review model', value: 'Approvals + versions', helper: 'Controlled correspondence workflow' },
          { label: 'Action layer', value: 'Owners + deadlines', helper: 'Operational follow-through' },
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
          'Board packs and appendix material are built from the same complaint and insight layer, so the reporting story stays consistent instead of fragmenting across decks and spreadsheets.',
        href: getAppHref('/board-pack'),
        actionLabel: 'See reporting flow',
        eyebrow: 'Board-ready reporting',
        metrics: [
          { label: 'Outputs', value: 'PDF + PPTX', helper: 'Export-ready board reporting' },
          { label: 'Appendix inputs', value: 'Letters + evidence', helper: 'Operational detail included' },
          { label: 'Reporting lens', value: 'Board-ready', helper: 'Built from live complaint context' },
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
        stage: 'Phase 1',
        title: 'Explore the Public Signal',
        body:
          'Search the public complaint layer by year, firm, product, and complaint theme. The homepage should make it obvious that the platform is live from the first click, not hidden behind a brochure.',
        bullets: [
          'SEO-friendly analysis pages',
          'Live firm, product, year, and theme coverage',
          'Direct path into real complaint context',
        ],
        href: '/insights',
        ctaLabel: 'Start analysis',
        accentMetric: helper(landing.metrics[1]?.value, 'Live pages'),
      },
      {
        key: 'transition',
        stage: 'Phase 2',
        title: 'Transition into the Workspace',
        body:
          'Once a complaint needs operational depth, move into the workspace to keep evidence, letters, approvals, and actions in one controlled handling flow.',
        bullets: [
          'Complaint detail with evidence and timeline',
          'Letter drafting with review control',
          'Approvals, actions, and operational ownership',
        ],
        href: getWorkspaceEntryHref(),
        ctaLabel: 'Request workspace demo',
        accentMetric: 'Workspace-ready flow',
      },
      {
        key: 'work',
        stage: 'Phase 3',
        title: 'Work complaints with evidence, letters, approvals, and actions connected.',
        body:
          'The product becomes operational inside the workspace. The key shift is that evidence, correspondence, review, and remediation do not split across separate tools.',
        bullets: [
          'Evidence and complaint records connected',
          'Reviewer notes and version history visible',
          'Deadlines and actions kept in the same operating thread',
        ],
        href: getAppHref('/complaints'),
        ctaLabel: 'Open complaints flow',
        accentMetric: 'Investigation-ready workflow',
      },
      {
        key: 'report',
        stage: 'Phase 4',
        title: 'Finish with outputs leadership can actually use.',
        body:
          'Board packs, appendix material, and leadership reporting are generated from the same complaint and intelligence layer, so the reporting story stays grounded in the live operating record.',
        bullets: [
          'Board-ready PDF and PPTX output',
          'Appendix material from evidence and letters',
          'Leadership reporting built on live complaint context',
        ],
        href: getAppHref('/board-pack'),
        ctaLabel: 'See reporting flow',
        accentMetric: 'Board-ready outputs',
      },
    ],
    audienceCards: [
      {
        key: 'public-teams',
        eyebrow: 'For Public-Facing Data Teams',
        title: 'Use the public intelligence layer to understand the complaint signal fast.',
        body:
          'Analysts, researchers, and decision-makers can start publicly with live year, firm, product, and complaint-theme pages before they ever need access to the secure workspace.',
        bullets: [
          'Search-friendly public insight pages',
          'Comparison and context before deeper review',
          'Clear route from discovery into real complaint analysis',
        ],
        href: '/insights',
        ctaLabel: 'Start analysis',
        tone: 'light',
      },
      {
        key: 'workspace-teams',
        eyebrow: 'For Workspace Complaint Teams',
        title: 'Handle complaints with a clearer operating record and stronger reporting finish.',
        body:
          'Complaint handlers, reviewers, and governance leads can manage evidence, letters, approvals, actions, and reporting in the same product rather than rebuilding the workflow elsewhere.',
        bullets: [
          'Evidence, correspondence, and approvals together',
          'Actions and deadlines visible in the same flow',
          'Board-ready outputs connected back to the operating record',
        ],
        href: getWorkspaceEntryHref(),
        ctaLabel: 'Request workspace demo',
        tone: 'dark',
      },
    ],
    featuredLinks: landing.featured.slice(0, 6).map((item, index) => ({
      title: item.title,
      href: item.href,
      description: item.description,
      tag: index === 0 ? 'Live annual page' : index === 1 ? 'Firm page' : 'Featured live page',
    })),
    updatedAt: landing.lastUpdated,
  };
}, ['marketing-homepage-snapshot'], { revalidate: REVALIDATE_SECONDS });
