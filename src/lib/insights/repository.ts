import { createHash } from 'crypto';
import { unstable_cache } from 'next/cache';
import { DatabaseClient } from '@/lib/database';
import { getAnalysisSnapshot } from '@/lib/fos/analysis-repository';
import { getAdvisorBrief } from '@/lib/fos/advisor-repository';
import { getCaseList } from '@/lib/fos/cases-repository';
import { getDashboardSnapshot } from '@/lib/fos/dashboard-repository';
import { getComparisonSnapshot } from '@/lib/fos/repository';
import { ensureDatabaseConfigured, ensureFosDecisionsTableExists, normalizeTagLabel, outcomeExpression, caseIdExpression } from '@/lib/fos/repo-helpers';
import type { FOSDashboardFilters, FOSCaseListItem } from '@/lib/fos/types';
import { formatDate, formatNumber, formatPercent } from '@/lib/utils';
import { slugify } from './seo';
import type {
  InsightArchiveItem,
  InsightFaqItem,
  InsightLandingData,
  InsightMetric,
  InsightNarrativeSection,
  InsightPageData,
  InsightRankedItem,
  InsightRelatedLink,
  InsightRepresentativeCase,
} from './types';

const REVALIDATE_SECONDS = 60 * 60;
const MIN_YEAR_CASES = 100;
const MIN_FIRM_CASES = 250;
const MAX_FIRM_PAGES = 250;
const MIN_PRODUCT_CASES = 100;
const MIN_TYPE_CASES = 100;
const MAX_REPRESENTATIVE_CASES = 5;

const EMPTY_FILTERS: FOSDashboardFilters = {
  query: '',
  years: [],
  outcomes: [],
  products: [],
  firms: [],
  tags: [],
  page: 1,
  pageSize: MAX_REPRESENTATIVE_CASES,
};

type ArchiveRow = {
  entity_key: string | number | null;
  title: string | null;
  total_cases: number | string | null;
  upheld_rate: number | string | null;
  latest_decision_date: string | Date | null;
};

type TypeTrendRow = {
  year: number | string | null;
  total: number | string | null;
  upheld_rate: number | string | null;
};

type RankRow = {
  label: string | null;
  total: number | string | null;
  upheld_rate?: number | string | null;
  count?: number | string | null;
};

const getYearArchive = unstable_cache(async () => queryYearArchive(), ['insights-year-archive'], { revalidate: REVALIDATE_SECONDS });
const getFirmArchive = unstable_cache(async () => queryFirmArchive(), ['insights-firm-archive'], { revalidate: REVALIDATE_SECONDS });
const getProductArchive = unstable_cache(async () => queryProductArchive(), ['insights-product-archive'], { revalidate: REVALIDATE_SECONDS });
const getTypeArchive = unstable_cache(async () => queryTypeArchive(), ['insights-type-archive'], { revalidate: REVALIDATE_SECONDS });

export const getInsightsLandingData = unstable_cache(async (): Promise<InsightLandingData> => {
  const [dashboard, years, firms, products, types] = await Promise.all([
    getDashboardSnapshot({ ...EMPTY_FILTERS }, { includeCases: false }),
    getYearArchive(),
    getFirmArchive(),
    getProductArchive(),
    getTypeArchive(),
  ]);

  const yearsCovered = years.length;
  const publishedPages = years.length + firms.length + products.length + types.length;
  const latestYear = years[0];

  return {
    hero: {
      eyebrow: 'Public FOS Insights',
      title: 'Search-friendly ombudsman complaint analysis by year, firm, product, and theme.',
      dek: 'A public editorial layer over the Financial Ombudsman decision corpus, generated from the same intelligence model that powers the workspace.',
    },
    metrics: [
      metric('Published decisions', formatNumber(dashboard.overview.totalCases), `${yearsCovered} years currently covered`),
      metric('Public insight pages', formatNumber(publishedPages), 'SEO-ready annual, firm, product, and complaint-theme pages'),
      metric('Current upheld rate', formatPercent(dashboard.overview.upheldRate), `${formatNumber(dashboard.overview.upheldCases)} upheld decisions in the corpus`),
      metric('Latest year in focus', latestYear?.title || 'n/a', latestYear ? latestYear.summary : 'Awaiting sufficient yearly data'),
    ],
    featured: [
      latestYear,
      firms[0],
      products[0],
      types[0],
    ].filter(Boolean).map((item) => ({
      title: item!.title,
      href: item!.href,
      description: item!.summary,
    })),
    collections: [
      {
        title: 'Year analysis',
        href: '/insights/years',
        description: 'Annual complaint patterns, shifts, and upheld-rate context across the published FOS corpus.',
        items: years.slice(0, 6),
      },
      {
        title: 'Firm analysis',
        href: '/insights/firms',
        description: 'Complaint volumes, product concentration, and upheld-rate context for the biggest firms in the corpus.',
        items: firms.slice(0, 6),
      },
      {
        title: 'Product analysis',
        href: '/insights/products',
        description: 'Deep dives into complaint performance by product line and recurring ombudsman themes.',
        items: products.slice(0, 6),
      },
      {
        title: 'Complaint themes',
        href: '/insights/types',
        description: 'Root-cause and complaint-theme pages built from the recurring issues tagged across published decisions.',
        items: types.slice(0, 6),
      },
    ],
    lastUpdated: dashboard.overview.latestDecisionDate,
  };
}, ['insights-landing'], { revalidate: REVALIDATE_SECONDS });

export async function getPublishedYearInsights(): Promise<InsightArchiveItem[]> {
  return getYearArchive();
}

export async function getPublishedFirmInsights(): Promise<InsightArchiveItem[]> {
  return getFirmArchive();
}

export async function getPublishedProductInsights(): Promise<InsightArchiveItem[]> {
  return getProductArchive();
}

export async function getPublishedTypeInsights(): Promise<InsightArchiveItem[]> {
  return getTypeArchive();
}

export const getYearInsightPage = unstable_cache(async (year: number): Promise<InsightPageData | null> => {
  const years = await getYearArchive();
  const current = years.find((item) => item.entityKey === String(year));
  if (!current) return null;

  const filters = { ...EMPTY_FILTERS, years: [year] };
  const [dashboard, analysis, cases, firms, products, types] = await Promise.all([
    getDashboardSnapshot(filters, { includeCases: false }),
    getAnalysisSnapshot(filters),
    getCaseList(filters),
    getFirmArchive(),
    getProductArchive(),
    getTypeArchive(),
  ]);

  const previous = years.find((item) => item.entityKey === String(year - 1));
  const total = dashboard.overview.totalCases;
  const topProduct = dashboard.products[0];
  const topFirm = dashboard.firms[0];
  const topTheme = dashboard.rootCauses[0];
  const leadingProducts = analysis.yearProductOutcome.slice(0, 5);

  const sections: InsightNarrativeSection[] = [
    {
      key: 'summary',
      title: `What stood out in ${year}`,
      paragraphs: [
        `${formatNumber(total)} published ombudsman decisions landed in ${year}. ${formatPercent(dashboard.overview.upheldRate)} of those decisions were upheld, while ${formatPercent(dashboard.overview.notUpheldRate)} were not upheld. That makes ${year} a meaningful benchmark year for understanding where complaint pressure and adjudication risk sat across the corpus.`,
        `${topProduct ? `${topProduct.product} was the heaviest product area, accounting for ${formatNumber(topProduct.total)} decisions.` : 'The product mix remained varied across the published corpus.'} ${topFirm ? `${topFirm.firm} appeared most often at firm level.` : 'Firm concentration was spread more broadly.'} ${topTheme ? `The most frequently tagged complaint theme was ${topTheme.label.toLowerCase()}.` : ''}`.trim(),
      ],
      bullets: buildBullets([
        topProduct ? `${topProduct.product}: ${formatNumber(topProduct.total)} decisions` : null,
        topFirm ? `${topFirm.firm}: ${formatNumber(topFirm.total)} decisions` : null,
        topTheme ? `${topTheme.label}: ${formatNumber(topTheme.count)} tagged decisions` : null,
        previous ? compareTotalsSentence(total, previous.totalCases, `${year} versus ${year - 1}`) : null,
      ]),
    },
    {
      key: 'product-mix',
      title: 'Product mix and concentration',
      paragraphs: [
        leadingProducts.length > 0
          ? `The year was led by ${joinLabels(leadingProducts.map((row) => row.product), 3)}, which together represented the centre of complaint activity in the published decisions for ${year}.`
          : `Product concentration signals were limited for ${year}.`,
        topProduct
          ? `${topProduct.product} alone contributed ${shareSentence(topProduct.total, total)} of all decisions published in ${year}, which makes it the clearest lens for understanding how complaint pressure expressed itself that year.`
          : 'No single product category dominated the year strongly enough to set a clear leading signal.',
      ],
      bullets: leadingProducts.map((item) => `${item.product}: ${formatNumber(item.total)} decisions, ${formatPercent(item.upheldRate)} upheld`),
    },
    {
      key: 'firm-and-theme',
      title: 'Firm and complaint-theme signals',
      paragraphs: [
        dashboard.firms.length > 0
          ? `${joinLabels(dashboard.firms.map((item) => item.firm), 3)} were the most visible firms in the published decisions for ${year}. That does not prove complaint prevalence in a consumer-market sense, but it does show which firms were most exposed in the final ombudsman decisions dataset.`
          : 'Firm-level concentration was too diffuse to generate a strong signal.',
        dashboard.rootCauses.length > 0
          ? `Complaint-theme tagging pointed most strongly to ${joinLabels(dashboard.rootCauses.map((item) => item.label.toLowerCase()), 3)}. These themes are the most useful public proxy for “complaint type” in this corpus because the raw decisions are not stored with a dedicated complaint-type field.`
          : 'Complaint-theme tagging was not rich enough to pull through a strong year-level pattern.',
      ],
      bullets: buildBullets([
        dashboard.precedents[0] ? `Most frequent precedent signal: ${dashboard.precedents[0].label}` : null,
        dashboard.precedents[1] ? `Second precedent signal: ${dashboard.precedents[1].label}` : null,
        dashboard.rootCauses[0] ? `Primary complaint theme: ${dashboard.rootCauses[0].label}` : null,
      ]),
    },
  ];

  const rankedLists = [
    ranked('Top products', 'The product lines with the highest published decision volume in this year.', dashboard.products.map((item) => archiveRank(item.product, item.total, `${formatPercent(item.upheldRate)} upheld`, products))),
    ranked('Top firms', 'The firms that appeared most often in published decisions for this year.', dashboard.firms.map((item) => archiveRank(item.firm, item.total, `${formatPercent(item.upheldRate)} upheld`, firms))),
    ranked('Complaint themes', 'Root-cause tags used here as the closest durable complaint-type taxonomy in the corpus.', dashboard.rootCauses.map((item) => archiveRank(item.label, item.count, 'Tagged theme', types))),
    ranked('Precedent signals', 'Frequently cited or detected rule and precedent references in the published decision set.', dashboard.precedents.map((item) => ({ label: item.label, value: item.count, valueLabel: formatNumber(item.count), helper: 'Referenced decisions' }))),
  ].filter((section) => section.items.length > 0);

  const faq = [
    {
      question: `How many Financial Ombudsman decisions were published in ${year}?`,
      answer: `${formatNumber(total)} published decisions in this dataset carry a decision date in ${year}.`,
    },
    {
      question: `What was the upheld rate in ${year}?`,
      answer: `${formatPercent(dashboard.overview.upheldRate)} of the published decisions in ${year} were upheld, while ${formatPercent(dashboard.overview.notUpheldRate)} were not upheld.`,
    },
    {
      question: `Which themes stood out most in ${year}?`,
      answer: dashboard.rootCauses.length > 0
        ? `${joinLabels(dashboard.rootCauses.map((item) => item.label.toLowerCase()), 3)} were the strongest complaint-theme signals in the year.`
        : `The available tagging for ${year} did not produce a strong complaint-theme pattern.`,
    },
  ];

  const relatedLinks = compactLinks([
    previous ? linkForItem(previous, `Read the ${year - 1} annual analysis`) : null,
    topProduct ? findLink(products, topProduct.product, `Explore ${topProduct.product} complaint analysis`) : null,
    topFirm ? findLink(firms, topFirm.firm, `Explore ${topFirm.firm} complaint analysis`) : null,
    topTheme ? findLink(types, topTheme.label, `Explore the ${topTheme.label.toLowerCase()} complaint-theme page`) : null,
    { title: 'Browse all annual pages', href: '/insights/years', description: 'See the full archive of annual FOS complaint analysis pages.' },
  ]);

  return buildPage({
    kind: 'year',
    slug: current.slug,
    entityKey: current.entityKey,
    title: `${year} Financial Ombudsman complaints analysis`,
    description: `${formatNumber(total)} published FOS decisions in ${year}, including upheld-rate context, top firms, top products, recurring complaint themes, and representative cases.`,
    canonicalPath: current.href,
    hero: {
      eyebrow: 'Year analysis',
      title: `${year} complaint and ombudsman analysis`,
      dek: `Detailed public analysis of the ${year} published Financial Ombudsman decision set, including complaint volume, outcome mix, product concentration, firm exposure, and recurring complaint themes.`,
    },
    metrics: [
      metric('Published decisions', formatNumber(total), `${year} decision volume in the public corpus`),
      metric('Upheld rate', formatPercent(dashboard.overview.upheldRate), `${formatNumber(dashboard.overview.upheldCases)} upheld decisions`),
      metric('Leading product', topProduct?.product || 'n/a', topProduct ? `${shareSentence(topProduct.total, total)} of annual decisions` : 'No dominant product signal'),
      metric('Leading firm', topFirm?.firm || 'n/a', topFirm ? `${formatNumber(topFirm.total)} published decisions` : 'No dominant firm signal'),
    ],
    sections,
    rankedLists,
    representativeCases: mapCases(cases.items),
    faq,
    relatedLinks,
    breadcrumbs: [
      { title: 'Insights', href: '/insights' },
      { title: 'Years', href: '/insights/years' },
      { title: String(year), href: current.href },
    ],
    seo: {
      title: `${year} Financial Ombudsman complaints analysis | FOS Insights`,
      description: `${formatNumber(total)} published FOS decisions in ${year}. Explore upheld rates, leading firms, products, complaint themes, and representative cases.`,
      keywords: [`financial ombudsman complaints ${year}`, `FOS complaints ${year}`, `${year} ombudsman decisions`, `financial ombudsman year analysis ${year}`],
    },
    lastUpdated: current.latestDecisionDate,
  });
}, ['insights-year-page'], { revalidate: REVALIDATE_SECONDS });

export const getFirmInsightPage = unstable_cache(async (slug: string): Promise<InsightPageData | null> => {
  const [firms, products, types, years] = await Promise.all([getFirmArchive(), getProductArchive(), getTypeArchive(), getYearArchive()]);
  const current = firms.find((item) => item.slug === slug);
  if (!current) return null;

  const filters = { ...EMPTY_FILTERS, firms: [current.title] };
  const [dashboard, comparison, cases] = await Promise.all([
    getDashboardSnapshot(filters, { includeCases: false }),
    getComparisonSnapshot([current.title], EMPTY_FILTERS),
    getCaseList(filters),
  ]);

  const firm = comparison.firms[0];
  const topProduct = firm?.topProducts[0];
  const topTheme = dashboard.rootCauses[0];
  const latestYear = firm?.yearBreakdown[firm.yearBreakdown.length - 1];

  const sections: InsightNarrativeSection[] = [
    {
      key: 'overview',
      title: `${current.title} at a glance`,
      paragraphs: [
        `${current.title} appears in ${formatNumber(dashboard.overview.totalCases)} published decisions in this corpus. ${formatPercent(dashboard.overview.upheldRate)} of those decisions were upheld, which gives a public view of how often complaints involving this firm ended in a fully upheld outcome in the final published set.`,
        topProduct
          ? `${topProduct.product} is the firm’s clearest product exposure in the published decisions, with ${formatNumber(topProduct.total)} decisions and an upheld rate of ${formatPercent(topProduct.upheldRate)}.`
          : `No single product line dominated the published decisions strongly enough to define the firm’s profile outright.`,
      ],
      bullets: buildBullets([
        latestYear ? `Latest active year in the published data: ${latestYear.year} (${formatNumber(latestYear.total)} decisions)` : null,
        topTheme ? `Most common complaint theme: ${topTheme.label}` : null,
        dashboard.precedents[0] ? `Most common precedent signal: ${dashboard.precedents[0].label}` : null,
      ]),
    },
    {
      key: 'trajectory',
      title: 'Volume and outcome trajectory',
      paragraphs: [
        firm && firm.yearBreakdown.length > 1
          ? `${current.title}'s decision trail runs from ${firm.yearBreakdown[0].year} to ${firm.yearBreakdown[firm.yearBreakdown.length - 1].year}. That range gives enough public history to see whether complaint exposure has been broad-based or concentrated into certain years.`
          : `${current.title}'s public decision trail is comparatively narrow, which limits how much trend commentary can be drawn safely.`,
        latestYear
          ? `In the latest year represented here, ${current.title} appeared in ${formatNumber(latestYear.total)} published decisions with an upheld rate of ${formatPercent(latestYear.upheldRate)}.`
          : `There is no strong latest-year signal to isolate in the published data.`,
      ],
      bullets: (firm?.yearBreakdown || []).slice(-5).reverse().map((item) => `${item.year}: ${formatNumber(item.total)} decisions, ${formatPercent(item.upheldRate)} upheld`),
    },
    {
      key: 'themes',
      title: 'Themes, products, and precedent signals',
      paragraphs: [
        topTheme
          ? `${topTheme.label} is the strongest complaint-theme signal tied to ${current.title} in the published decisions. In this corpus, those themes are the most stable public proxy for complaint “type”.`
          : `The complaint-theme layer does not surface a single dominant signal strongly enough to summarise the firm in one phrase.`,
        dashboard.precedents.length > 0
          ? `${joinLabels(dashboard.precedents.map((item) => item.label), 3)} are the most visible precedent signals in the firm’s published decisions. That gives extra context on the rules and fairness arguments appearing most often around the firm.`
          : `Precedent tagging does not surface a strong repeated signal for this firm.`,
      ],
      bullets: buildBullets([
        topProduct ? `${topProduct.product}: ${formatNumber(topProduct.total)} decisions` : null,
        dashboard.rootCauses[1] ? `Second complaint theme: ${dashboard.rootCauses[1].label}` : null,
        dashboard.precedents[1] ? `Second precedent signal: ${dashboard.precedents[1].label}` : null,
      ]),
    },
  ];

  const rankedLists = [
    ranked('Top products', 'The product areas most frequently associated with this firm in the published decisions.', (firm?.topProducts || []).map((item) => archiveRank(item.product, item.total, `${formatPercent(item.upheldRate)} upheld`, products))),
    ranked('Complaint themes', 'Root-cause tags used here as the complaint-theme taxonomy for the published decision set.', dashboard.rootCauses.map((item) => archiveRank(item.label, item.count, 'Tagged theme', types))),
    ranked('Precedent signals', 'Frequently surfaced rule and precedent references in published decisions involving this firm.', dashboard.precedents.map((item) => ({ label: item.label, value: item.count, valueLabel: formatNumber(item.count), helper: 'Referenced decisions' }))),
  ].filter((section) => section.items.length > 0);

  const faq: InsightFaqItem[] = [
    {
      question: `How often do complaints involving ${current.title} get upheld?`,
      answer: `${formatPercent(dashboard.overview.upheldRate)} of the published decisions involving ${current.title} in this corpus were upheld.`,
    },
    {
      question: `Which product areas show up most often for ${current.title}?`,
      answer: topProduct ? `${topProduct.product} is the leading product area in the published decision set for ${current.title}.` : `No single product area dominates the published decision set strongly enough to stand alone.`,
    },
    {
      question: `What complaint themes recur most often for ${current.title}?`,
      answer: dashboard.rootCauses.length > 0 ? `${joinLabels(dashboard.rootCauses.map((item) => item.label.toLowerCase()), 3)} are the strongest recurring themes.` : `The complaint-theme data is too diffuse to isolate one recurring signal confidently.`,
    },
  ];

  const relatedLinks = compactLinks([
    topProduct ? findLink(products, topProduct.product, `Explore ${topProduct.product} analysis`) : null,
    topTheme ? findLink(types, topTheme.label, `Explore the ${topTheme.label.toLowerCase()} complaint-theme page`) : null,
    latestYear ? findLink(years, String(latestYear.year), `Read the ${latestYear.year} year analysis`) : null,
    { title: 'Browse all firm pages', href: '/insights/firms', description: 'See the wider archive of firm-level complaint analysis pages.' },
  ]);

  return buildPage({
    kind: 'firm',
    slug: current.slug,
    entityKey: current.entityKey,
    title: `${current.title} complaints analysis`,
    description: `${formatNumber(dashboard.overview.totalCases)} published decisions involving ${current.title}, with product mix, upheld-rate context, complaint themes, precedent signals, and representative cases.`,
    canonicalPath: current.href,
    hero: {
      eyebrow: 'Firm analysis',
      title: `${current.title} complaint analysis`,
      dek: `A public analysis page covering published Financial Ombudsman decisions involving ${current.title}, including outcome context, product mix, complaint themes, and representative cases.`,
    },
    metrics: [
      metric('Published decisions', formatNumber(dashboard.overview.totalCases), 'Firm-specific decision volume in the public corpus'),
      metric('Upheld rate', formatPercent(dashboard.overview.upheldRate), `${formatNumber(dashboard.overview.upheldCases)} upheld decisions`),
      metric('Leading product', topProduct?.product || 'n/a', topProduct ? `${formatNumber(topProduct.total)} decisions` : 'No dominant product signal'),
      metric('Leading complaint theme', topTheme?.label || 'n/a', topTheme ? `${formatNumber(topTheme.count)} tagged decisions` : 'No dominant theme signal'),
    ],
    sections,
    rankedLists,
    representativeCases: mapCases(cases.items),
    faq,
    relatedLinks,
    breadcrumbs: [
      { title: 'Insights', href: '/insights' },
      { title: 'Firms', href: '/insights/firms' },
      { title: current.title, href: current.href },
    ],
    seo: {
      title: `${current.title} complaints analysis | FOS Insights`,
      description: `${formatNumber(dashboard.overview.totalCases)} published FOS decisions involving ${current.title}. Explore upheld-rate context, product mix, complaint themes, and representative cases.`,
      keywords: [`${current.title} complaints`, `${current.title} ombudsman complaints`, `${current.title} upheld complaints`, `${current.title} financial ombudsman`],
    },
    lastUpdated: current.latestDecisionDate,
  });
}, ['insights-firm-page'], { revalidate: REVALIDATE_SECONDS });

export const getProductInsightPage = unstable_cache(async (slug: string): Promise<InsightPageData | null> => {
  const [products, firms, types, years] = await Promise.all([getProductArchive(), getFirmArchive(), getTypeArchive(), getYearArchive()]);
  const current = products.find((item) => item.slug === slug);
  if (!current) return null;

  const filters = { ...EMPTY_FILTERS, products: [current.title] };
  const [dashboard, analysis, advisor, cases] = await Promise.all([
    getDashboardSnapshot(filters, { includeCases: false }),
    getAnalysisSnapshot(filters),
    getAdvisorBrief({ product: current.title, rootCause: null, freeText: '' }),
    getCaseList(filters),
  ]);

  const yearly = analysis.yearProductOutcome
    .filter((row) => row.product === current.title)
    .sort((a, b) => a.year - b.year);
  const topFirm = dashboard.firms[0];
  const topTheme = dashboard.rootCauses[0];
  const latestYear = yearly[yearly.length - 1];

  const sections: InsightNarrativeSection[] = [
    {
      key: 'overview',
      title: `${current.title} in the ombudsman corpus`,
      paragraphs: [
        `${formatNumber(dashboard.overview.totalCases)} published decisions in this corpus sit within ${current.title}. ${formatPercent(dashboard.overview.upheldRate)} of those decisions were upheld, which makes this a useful public category page for spotting where complaint outcomes have tended to land.`,
        topFirm
          ? `${topFirm.firm} is the single biggest firm exposure inside ${current.title} in the published decision set. ${topTheme ? `${topTheme.label} is the leading complaint theme in the same category.` : ''}`.trim()
          : `${topTheme ? `${topTheme.label} is the clearest complaint-theme signal in ${current.title}.` : 'No dominant firm or theme signal emerged strongly enough to define the product on its own.'}`,
      ],
      bullets: buildBullets([
        latestYear ? `Latest year in the product series: ${latestYear.year}` : null,
        dashboard.precedents[0] ? `Leading precedent signal: ${dashboard.precedents[0].label}` : null,
        advisor?.riskAssessment?.riskLevel ? `Advisor risk signal: ${advisor.riskAssessment.riskLevel.replace(/_/g, ' ')}` : null,
      ]),
    },
    {
      key: 'trend',
      title: 'How the product moved over time',
      paragraphs: [
        yearly.length > 1
          ? `${current.title} has a multi-year decision trail in the corpus, which makes it possible to compare recent complaint pressure against earlier years rather than relying on a single snapshot.`
          : `The public history for ${current.title} is too short to support a strong multi-year narrative.`,
        latestYear
          ? `In ${latestYear.year}, ${current.title} recorded ${formatNumber(latestYear.total)} published decisions with an upheld rate of ${formatPercent(latestYear.upheldRate)}.`
          : `The latest-year breakdown for ${current.title} is not yet strong enough to anchor a standalone trend statement.`,
      ],
      bullets: yearly.slice(-5).reverse().map((item) => `${item.year}: ${formatNumber(item.total)} decisions, ${formatPercent(item.upheldRate)} upheld`),
    },
    {
      key: 'themes-and-actions',
      title: 'Themes, precedent signals, and handling implications',
      paragraphs: [
        dashboard.rootCauses.length > 0
          ? `${joinLabels(dashboard.rootCauses.map((item) => item.label.toLowerCase()), 3)} are the strongest complaint-theme signals in ${current.title}. For public analysis, those tags are the closest durable “type” layer available in the dataset.`
          : `Complaint-theme tagging does not expose a single dominant issue cluster in ${current.title}.`,
        advisor?.recommendedActions?.length
          ? `The existing advisor model also points to recurring handling implications for ${current.title}, including ${joinLabels(advisor.recommendedActions.map((item) => item.item.toLowerCase()), 2)}.`
          : dashboard.precedents.length > 0
            ? `${joinLabels(dashboard.precedents.map((item) => item.label), 3)} are the most visible precedent signals shaping decisions in this product area.`
            : 'The available advisory and precedent layers do not produce a strong repeated handling signal here.',
      ],
      bullets: buildBullets([
        advisor?.whatLoses?.[0] ? `What tends to lose: ${advisor.whatLoses[0].theme}` : null,
        advisor?.whatWins?.[0] ? `What tends to win: ${advisor.whatWins[0].theme}` : null,
        topTheme ? `Leading complaint theme: ${topTheme.label}` : null,
      ]),
    },
  ];

  const rankedLists = [
    ranked('Top firms', 'The firms most often associated with published decisions in this product category.', dashboard.firms.map((item) => archiveRank(item.firm, item.total, `${formatPercent(item.upheldRate)} upheld`, firms))),
    ranked('Complaint themes', 'Root-cause tags used as the public complaint-theme taxonomy for this product.', dashboard.rootCauses.map((item) => archiveRank(item.label, item.count, 'Tagged theme', types))),
    ranked('Precedent signals', 'Frequently surfaced rule and precedent references within this product category.', dashboard.precedents.map((item) => ({ label: item.label, value: item.count, valueLabel: formatNumber(item.count), helper: 'Referenced decisions' }))),
  ].filter((section) => section.items.length > 0);

  const faq: InsightFaqItem[] = [
    {
      question: `How often are ${current.title} complaints upheld?`,
      answer: `${formatPercent(dashboard.overview.upheldRate)} of the published decisions in ${current.title} were upheld in this corpus.`,
    },
    {
      question: `Which firms appear most often in ${current.title} decisions?`,
      answer: topFirm ? `${topFirm.firm} is the most frequent firm in the published decision set for ${current.title}.` : `No single firm dominates the published decision set strongly enough to stand alone.`,
    },
    {
      question: `What complaint themes recur in ${current.title}?`,
      answer: dashboard.rootCauses.length > 0 ? `${joinLabels(dashboard.rootCauses.map((item) => item.label.toLowerCase()), 3)} are the strongest recurring themes.` : `No single complaint-theme cluster stands out strongly in the available tagging.`,
    },
  ];

  const relatedLinks = compactLinks([
    topFirm ? findLink(firms, topFirm.firm, `Explore ${topFirm.firm} analysis`) : null,
    topTheme ? findLink(types, topTheme.label, `Explore the ${topTheme.label.toLowerCase()} complaint-theme page`) : null,
    latestYear ? findLink(years, String(latestYear.year), `Read the ${latestYear.year} year analysis`) : null,
    { title: 'Browse all product pages', href: '/insights/products', description: 'See the full archive of product-level analysis pages.' },
  ]);

  return buildPage({
    kind: 'product',
    slug: current.slug,
    entityKey: current.entityKey,
    title: `${current.title} complaints analysis`,
    description: `${formatNumber(dashboard.overview.totalCases)} published FOS decisions in ${current.title}, with upheld-rate context, firm exposure, complaint themes, advisory patterns, and representative cases.`,
    canonicalPath: current.href,
    hero: {
      eyebrow: 'Product analysis',
      title: `${current.title} complaint analysis`,
      dek: `A public view of how ${current.title} performs in the published Financial Ombudsman decisions dataset, including volume, outcome mix, firm exposure, and recurring complaint themes.`,
    },
    metrics: [
      metric('Published decisions', formatNumber(dashboard.overview.totalCases), 'Product-specific decision volume in the public corpus'),
      metric('Upheld rate', formatPercent(dashboard.overview.upheldRate), `${formatNumber(dashboard.overview.upheldCases)} upheld decisions`),
      metric('Leading firm', topFirm?.firm || 'n/a', topFirm ? `${formatNumber(topFirm.total)} decisions` : 'No dominant firm signal'),
      metric('Leading complaint theme', topTheme?.label || 'n/a', topTheme ? `${formatNumber(topTheme.count)} tagged decisions` : 'No dominant theme signal'),
    ],
    sections,
    rankedLists,
    representativeCases: mapCases(cases.items),
    faq,
    relatedLinks,
    breadcrumbs: [
      { title: 'Insights', href: '/insights' },
      { title: 'Products', href: '/insights/products' },
      { title: current.title, href: current.href },
    ],
    seo: {
      title: `${current.title} complaints analysis | FOS Insights`,
      description: `${formatNumber(dashboard.overview.totalCases)} published FOS decisions in ${current.title}. Explore upheld rates, top firms, complaint themes, and representative ombudsman cases.`,
      keywords: [`${current.title} complaints`, `${current.title} ombudsman complaints`, `${current.title} upheld complaints`, `${current.title} complaint analysis`],
    },
    lastUpdated: current.latestDecisionDate,
  });
}, ['insights-product-page'], { revalidate: REVALIDATE_SECONDS });

export const getTypeInsightPage = unstable_cache(async (slug: string): Promise<InsightPageData | null> => {
  const [types, firms, products, years] = await Promise.all([getTypeArchive(), getFirmArchive(), getProductArchive(), getYearArchive()]);
  const current = types.find((item) => item.slug === slug);
  if (!current) return null;

  const data = await queryTypeInsightData(current.title);
  if (!data) return null;

  const topFirm = data.firms[0];
  const topProduct = data.products[0];
  const latestYear = data.trends[data.trends.length - 1];

  const sections: InsightNarrativeSection[] = [
    {
      key: 'overview',
      title: `${current.title} as a public complaint theme`,
      paragraphs: [
        `${formatNumber(data.totalCases)} published decisions in the corpus carry the complaint-theme tag ${current.title.toLowerCase()}. ${formatPercent(data.upheldRate)} of those decisions were upheld, which makes this one of the most useful public “type” slices available in the dataset.`,
        topProduct
          ? `${topProduct.label} is the product line most often associated with this theme, while ${topFirm ? `${topFirm.label} is the firm that appears most often alongside it in published decisions.` : 'firm concentration is more dispersed.'}`
          : `No single product line dominates this theme strongly enough to stand on its own.`,
      ],
      bullets: buildBullets([
        latestYear ? `Latest year represented: ${latestYear.year}` : null,
        data.precedents[0] ? `Leading precedent signal: ${data.precedents[0].label}` : null,
        topFirm ? `Leading firm: ${topFirm.label}` : null,
      ]),
    },
    {
      key: 'trend',
      title: 'How this theme moves across the corpus',
      paragraphs: [
        data.trends.length > 1
          ? `${current.title} has enough history in the published decisions to show how complaint pressure has evolved across multiple years, rather than appearing as a one-off issue cluster.`
          : `The time series behind this complaint theme is still narrow, which limits trend commentary.`,
        latestYear
          ? `In ${latestYear.year}, ${current.title.toLowerCase()} appeared in ${formatNumber(latestYear.total)} published decisions with an upheld rate of ${formatPercent(latestYear.upheldRate)}.`
          : `There is no strong latest-year signal available for this complaint theme.`,
      ],
      bullets: data.trends.slice(-5).reverse().map((item) => `${item.year}: ${formatNumber(item.total)} decisions, ${formatPercent(item.upheldRate)} upheld`),
    },
    {
      key: 'context',
      title: 'Where the theme concentrates',
      paragraphs: [
        topProduct
          ? `${joinLabels(data.products.map((item) => item.label), 3)} are the product areas most associated with this theme in published decisions. That helps explain where this complaint type is most likely to appear in the ombudsman corpus.`
          : `Product concentration is not strong enough to isolate a few standout areas for this theme.`,
        data.precedents.length > 0
          ? `${joinLabels(data.precedents.map((item) => item.label), 3)} are the most visible precedent signals tied to this complaint theme.`
          : `The precedent layer does not expose a strong repeated signal for this theme.`,
      ],
      bullets: buildBullets([
        topProduct ? `${topProduct.label}: ${formatNumber(topProduct.total)} decisions` : null,
        topFirm ? `${topFirm.label}: ${formatNumber(topFirm.total)} decisions` : null,
        data.precedents[1] ? `Second precedent signal: ${data.precedents[1].label}` : null,
      ]),
    },
  ];

  const rankedLists = [
    ranked('Top products', 'Product categories most often associated with this complaint theme.', data.products.map((item) => archiveRank(item.label, item.total, item.upheldRate != null ? `${formatPercent(item.upheldRate)} upheld` : 'Published decisions', products))),
    ranked('Top firms', 'Firms most often associated with this complaint theme in the published decisions.', data.firms.map((item) => archiveRank(item.label, item.total, item.upheldRate != null ? `${formatPercent(item.upheldRate)} upheld` : 'Published decisions', firms))),
    ranked('Precedent signals', 'Frequently surfaced rule and precedent references connected to this complaint theme.', data.precedents.map((item) => ({ label: item.label, value: item.total, valueLabel: formatNumber(item.total), helper: 'Referenced decisions' }))),
  ].filter((section) => section.items.length > 0);

  const faq: InsightFaqItem[] = [
    {
      question: `What does the complaint theme ${current.title.toLowerCase()} mean in this dataset?`,
      answer: `This page uses the root-cause tagging layer in the FOS corpus as the closest durable proxy for complaint “type”. ${current.title} is therefore a theme page built from repeated issue tagging across published decisions.`,
    },
    {
      question: `How often are ${current.title.toLowerCase()} complaints upheld?`,
      answer: `${formatPercent(data.upheldRate)} of the published decisions tagged ${current.title.toLowerCase()} were upheld in this corpus.`,
    },
    {
      question: `Where does ${current.title.toLowerCase()} appear most often?`,
      answer: topProduct ? `${topProduct.label} is the leading product category for this theme in the published decisions.` : `The theme is spread across multiple product areas without one dominant category.`,
    },
  ];

  const relatedLinks = compactLinks([
    topProduct ? findLink(products, topProduct.label, `Explore ${topProduct.label} analysis`) : null,
    topFirm ? findLink(firms, topFirm.label, `Explore ${topFirm.label} analysis`) : null,
    latestYear ? findLink(years, String(latestYear.year), `Read the ${latestYear.year} year analysis`) : null,
    { title: 'Browse all complaint themes', href: '/insights/types', description: 'See the full archive of complaint-theme analysis pages.' },
  ]);

  return buildPage({
    kind: 'type',
    slug: current.slug,
    entityKey: current.entityKey,
    title: `${current.title} complaint theme analysis`,
    description: `${formatNumber(data.totalCases)} published decisions tagged ${current.title.toLowerCase()}, with upheld-rate context, product concentration, firm exposure, precedent signals, and representative cases.`,
    canonicalPath: current.href,
    hero: {
      eyebrow: 'Complaint theme analysis',
      title: `${current.title} complaint theme analysis`,
      dek: `A public analysis page for the complaint theme ${current.title.toLowerCase()}, built from the root-cause tagging layer across published Financial Ombudsman decisions.`,
    },
    metrics: [
      metric('Tagged decisions', formatNumber(data.totalCases), 'Published decisions carrying this complaint-theme tag'),
      metric('Upheld rate', formatPercent(data.upheldRate), `${formatNumber(data.upheldCases)} upheld decisions`),
      metric('Leading product', topProduct?.label || 'n/a', topProduct ? `${formatNumber(topProduct.total)} decisions` : 'No dominant product signal'),
      metric('Leading firm', topFirm?.label || 'n/a', topFirm ? `${formatNumber(topFirm.total)} decisions` : 'No dominant firm signal'),
    ],
    sections,
    rankedLists,
    representativeCases: data.cases,
    faq,
    relatedLinks,
    breadcrumbs: [
      { title: 'Insights', href: '/insights' },
      { title: 'Complaint Themes', href: '/insights/types' },
      { title: current.title, href: current.href },
    ],
    seo: {
      title: `${current.title} complaint theme analysis | FOS Insights`,
      description: `${formatNumber(data.totalCases)} published FOS decisions tagged ${current.title.toLowerCase()}. Explore upheld rates, firms, products, precedent signals, and representative cases.`,
      keywords: [`${current.title} complaints`, `${current.title} ombudsman`, `${current.title} complaint type`, `${current.title} complaint theme`],
    },
    lastUpdated: current.latestDecisionDate,
  });
}, ['insights-type-page'], { revalidate: REVALIDATE_SECONDS });

async function queryYearArchive(): Promise<InsightArchiveItem[]> {
  const rows = await queryArchiveRows(
    `
      SELECT
        EXTRACT(YEAR FROM d.decision_date)::INT AS entity_key,
        EXTRACT(YEAR FROM d.decision_date)::INT::TEXT AS title,
        COUNT(*)::INT AS total_cases,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
        MAX(d.decision_date) AS latest_decision_date
      FROM fos_decisions d
      WHERE d.decision_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT
      HAVING COUNT(*) >= $1
      ORDER BY entity_key DESC
    `,
    [MIN_YEAR_CASES]
  );

  return rows.map((row) => {
    const year = String(row.entity_key || row.title || '');
    const totalCases = toInt(row.total_cases);
    const upheldRate = toNumber(row.upheld_rate);
    return {
      kind: 'year',
      slug: year,
      entityKey: year,
      title: year,
      href: `/insights/year/${year}`,
      totalCases,
      upheldRate,
      latestDecisionDate: toIsoDate(row.latest_decision_date),
      summary: `${formatNumber(totalCases)} published decisions with an upheld rate of ${formatPercent(upheldRate)}.`,
      highlight: `${year} annual complaints analysis`,
    } satisfies InsightArchiveItem;
  });
}

async function queryFirmArchive(): Promise<InsightArchiveItem[]> {
  const rows = await queryArchiveRows(
    `
      SELECT
        COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS entity_key,
        COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS title,
        COUNT(*)::INT AS total_cases,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
        MAX(d.decision_date) AS latest_decision_date
      FROM fos_decisions d
      GROUP BY COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
      HAVING COUNT(*) >= $1
      ORDER BY total_cases DESC, title ASC
      LIMIT $2
    `,
    [MIN_FIRM_CASES, MAX_FIRM_PAGES]
  );
  return toArchiveItems('firm', rows, (totalCases, upheldRate) => `${formatNumber(totalCases)} published decisions with ${formatPercent(upheldRate)} upheld.`);
}

async function queryProductArchive(): Promise<InsightArchiveItem[]> {
  const rows = await queryArchiveRows(
    `
      SELECT
        COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS entity_key,
        COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS title,
        COUNT(*)::INT AS total_cases,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
        MAX(d.decision_date) AS latest_decision_date
      FROM fos_decisions d
      GROUP BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
      HAVING COUNT(*) >= $1
      ORDER BY total_cases DESC, title ASC
    `,
    [MIN_PRODUCT_CASES]
  );
  return toArchiveItems('product', rows, (totalCases, upheldRate) => `${formatNumber(totalCases)} published decisions with ${formatPercent(upheldRate)} upheld.`);
}

async function queryTypeArchive(): Promise<InsightArchiveItem[]> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  const rows = await DatabaseClient.query<ArchiveRow>(
    `
      SELECT
        LOWER(BTRIM(tag.value)) AS entity_key,
        LOWER(BTRIM(tag.value)) AS title,
        COUNT(*)::INT AS total_cases,
        ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate,
        MAX(d.decision_date) AS latest_decision_date
      FROM fos_decisions d
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS tag(value)
      WHERE BTRIM(tag.value) <> ''
      GROUP BY LOWER(BTRIM(tag.value))
      HAVING COUNT(*) >= $1
      ORDER BY total_cases DESC, title ASC
    `,
    [MIN_TYPE_CASES]
  );
  return toArchiveItems('type', rows, (totalCases, upheldRate) => `${formatNumber(totalCases)} tagged decisions with ${formatPercent(upheldRate)} upheld.`);
}

function toArchiveItems(kind: InsightArchiveItem['kind'], rows: ArchiveRow[], summaryBuilder: (totalCases: number, upheldRate: number) => string): InsightArchiveItem[] {
  const slugMap = buildSlugMap(rows.map((row) => ({
    entityKey: String(row.entity_key || row.title || '').trim(),
    title: normalizeArchiveTitle(kind, String(row.title || row.entity_key || '')),
  })));

  return rows.map((row) => {
    const entityKey = String(row.entity_key || row.title || '').trim();
    const title = normalizeArchiveTitle(kind, String(row.title || row.entity_key || ''));
    const totalCases = toInt(row.total_cases);
    const upheldRate = toNumber(row.upheld_rate);
    const slug = slugMap.get(entityKey) || slugify(title);
    return {
      kind,
      slug,
      entityKey,
      title,
      href: `/insights/${kind}/${slug}`,
      totalCases,
      upheldRate,
      latestDecisionDate: toIsoDate(row.latest_decision_date),
      summary: summaryBuilder(totalCases, upheldRate),
      highlight: `${title} ${kind === 'type' ? 'complaint-theme' : kind} analysis`,
    } satisfies InsightArchiveItem;
  });
}

async function queryTypeInsightData(label: string): Promise<{
  totalCases: number;
  upheldCases: number;
  upheldRate: number;
  trends: Array<{ year: number; total: number; upheldRate: number }>;
  firms: Array<{ label: string; total: number; upheldRate: number | null }>;
  products: Array<{ label: string; total: number; upheldRate: number | null }>;
  precedents: Array<{ label: string; total: number }>;
  cases: InsightRepresentativeCase[];
} | null> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  const params = [label.toLowerCase()];
  const tagCondition = `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(d.root_cause_tags, '[]'::jsonb)) AS tag(value) WHERE LOWER(BTRIM(tag.value)) = $1)`;
  const [overview, trends, firms, products, precedents, cases] = await Promise.all([
    DatabaseClient.queryOne<Record<string, unknown>>(
      `
        SELECT
          COUNT(*)::INT AS total_cases,
          COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld')::INT AS upheld_cases,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
        FROM fos_decisions d
        WHERE ${tagCondition}
      `,
      params
    ),
    DatabaseClient.query<TypeTrendRow>(
      `
        SELECT
          EXTRACT(YEAR FROM d.decision_date)::INT AS year,
          COUNT(*)::INT AS total,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
        FROM fos_decisions d
        WHERE ${tagCondition}
          AND d.decision_date IS NOT NULL
        GROUP BY EXTRACT(YEAR FROM d.decision_date)::INT
        ORDER BY year ASC
      `,
      params
    ),
    DatabaseClient.query<RankRow>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm') AS label,
          COUNT(*)::INT AS total,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
        FROM fos_decisions d
        WHERE ${tagCondition}
        GROUP BY COALESCE(NULLIF(BTRIM(d.business_name), ''), 'Unknown firm')
        ORDER BY total DESC, label ASC
        LIMIT 8
      `,
      params
    ),
    DatabaseClient.query<RankRow>(
      `
        SELECT
          COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified') AS label,
          COUNT(*)::INT AS total,
          ROUND(100.0 * COUNT(*) FILTER (WHERE ${outcomeExpression('d')} = 'upheld') / NULLIF(COUNT(*), 0), 2) AS upheld_rate
        FROM fos_decisions d
        WHERE ${tagCondition}
        GROUP BY COALESCE(NULLIF(BTRIM(d.product_sector), ''), 'Unspecified')
        ORDER BY total DESC, label ASC
        LIMIT 8
      `,
      params
    ),
    DatabaseClient.query<RankRow>(
      `
        SELECT
          LOWER(BTRIM(tag.value)) AS label,
          COUNT(*)::INT AS total
        FROM fos_decisions d
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d.precedents, '[]'::jsonb)) AS tag(value)
        WHERE ${tagCondition}
          AND BTRIM(tag.value) <> ''
        GROUP BY LOWER(BTRIM(tag.value))
        ORDER BY total DESC, label ASC
        LIMIT 8
      `,
      params
    ),
    DatabaseClient.query<Record<string, unknown>>(
      `
        SELECT
          ${caseIdExpression('d')} AS case_id,
          d.decision_reference,
          d.decision_date,
          NULLIF(BTRIM(d.business_name), '') AS firm_name,
          NULLIF(BTRIM(d.product_sector), '') AS product_group,
          ${outcomeExpression('d')} AS outcome,
          d.decision_summary,
          d.source_url,
          d.pdf_url
        FROM fos_decisions d
        WHERE ${tagCondition}
        ORDER BY d.decision_date DESC NULLS LAST, d.decision_reference ASC
        LIMIT ${MAX_REPRESENTATIVE_CASES}
      `,
      params
    ),
  ]);

  const totalCases = toInt(overview?.total_cases);
  if (totalCases < MIN_TYPE_CASES) return null;

  return {
    totalCases,
    upheldCases: toInt(overview?.upheld_cases),
    upheldRate: toNumber(overview?.upheld_rate),
    trends: trends.map((row) => ({
      year: toInt(row.year),
      total: toInt(row.total),
      upheldRate: toNumber(row.upheld_rate),
    })),
    firms: firms.map((row) => ({ label: String(row.label || 'Unknown firm'), total: toInt(row.total), upheldRate: row.upheld_rate == null ? null : toNumber(row.upheld_rate) })),
    products: products.map((row) => ({ label: String(row.label || 'Unspecified'), total: toInt(row.total), upheldRate: row.upheld_rate == null ? null : toNumber(row.upheld_rate) })),
    precedents: precedents.map((row) => ({ label: normalizeTagLabel(String(row.label || 'unknown')), total: toInt(row.total || row.count) })),
    cases: cases.map((row) => ({
      caseId: String(row.case_id || row.decision_reference || ''),
      decisionReference: String(row.decision_reference || row.case_id || ''),
      firmName: nullable(row.firm_name),
      productGroup: nullable(row.product_group),
      outcome: normalizeOutcomeLabel(String(row.outcome || 'unknown')),
      decisionDate: toIsoDate(row.decision_date),
      summary: nullable(row.decision_summary),
      sourceUrl: nullable(row.source_url),
      pdfUrl: nullable(row.pdf_url),
    })),
  };
}

async function queryArchiveRows(sql: string, params: unknown[]): Promise<ArchiveRow[]> {
  ensureDatabaseConfigured();
  await ensureFosDecisionsTableExists();
  return DatabaseClient.query<ArchiveRow>(sql, params);
}

function buildPage(data: InsightPageData): InsightPageData {
  return data;
}

function buildSlugMap(items: Array<{ entityKey: string; title: string }>): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();

  for (const item of items) {
    const base = slugify(item.title);
    let slug = base;
    if (used.has(slug)) {
      slug = `${base}-${shortHash(item.entityKey)}`;
    }
    used.add(slug);
    map.set(item.entityKey, slug);
  }

  return map;
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 6);
}

function normalizeArchiveTitle(kind: InsightArchiveItem['kind'], value: string): string {
  return kind === 'type' ? normalizeTagLabel(value) : value;
}

function metric(label: string, value: string, helper?: string): InsightMetric {
  return { label, value, helper };
}

function ranked(keyTitle: string, description: string, items: InsightRankedItem[]) {
  return {
    key: slugify(keyTitle),
    title: keyTitle,
    description,
    items,
  };
}

function archiveRank(label: string, value: number, helper: string, archive: InsightArchiveItem[]): InsightRankedItem {
  const link = findItemByTitle(archive, label);
  return {
    label,
    value,
    valueLabel: formatNumber(value),
    helper,
    href: link?.href,
  };
}

function mapCases(items: FOSCaseListItem[]): InsightRepresentativeCase[] {
  return items.slice(0, MAX_REPRESENTATIVE_CASES).map((item) => ({
    caseId: item.caseId,
    decisionReference: item.decisionReference,
    firmName: item.firmName,
    productGroup: item.productGroup,
    outcome: normalizeOutcomeLabel(item.outcome),
    decisionDate: item.decisionDate,
    summary: item.decisionSummary,
    sourceUrl: item.sourceUrl,
    pdfUrl: item.pdfUrl,
  }));
}

function buildBullets(values: Array<string | null>): string[] | undefined {
  const filtered = values.filter((value): value is string => Boolean(value));
  return filtered.length > 0 ? filtered : undefined;
}

function compareTotalsSentence(current: number, previous: number, label: string): string {
  if (previous === 0) return `${label}: no prior baseline available`;
  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 2) return `${label}: broadly flat year on year`;
  return `${label}: ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}% year on year`;
}

function shareSentence(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function joinLabels(values: string[], limit: number): string {
  const unique = Array.from(new Set(values.filter(Boolean)));
  if (unique.length === 0) return 'no standout labels';
  if (unique.length <= limit) return unique.join(', ');
  return `${unique.slice(0, limit).join(', ')}, and others`;
}

function compactLinks(values: Array<InsightRelatedLink | null>): InsightRelatedLink[] {
  const seen = new Set<string>();
  const output: InsightRelatedLink[] = [];
  for (const value of values) {
    if (!value || seen.has(value.href)) continue;
    seen.add(value.href);
    output.push(value);
  }
  return output;
}

function findLink(archive: InsightArchiveItem[], title: string, description: string): InsightRelatedLink | null {
  const item = findItemByTitle(archive, title);
  if (!item) return null;
  return linkForItem(item, description);
}

function linkForItem(item: InsightArchiveItem, description: string): InsightRelatedLink {
  return {
    title: item.title,
    href: item.href,
    description,
  };
}

function findItemByTitle(items: InsightArchiveItem[], title: string): InsightArchiveItem | undefined {
  const normalized = title.trim().toLowerCase();
  return items.find((item) => item.entityKey.trim().toLowerCase() === normalized || item.title.trim().toLowerCase() === normalized);
}

function nullable(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  const parsed = Number.parseInt(String(value || '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(String(value || '0'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeOutcomeLabel(value: string): string {
  const normalized = value.replace(/_/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
