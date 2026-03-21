import type { MetadataRoute } from 'next';
import {
  getPublishedFirmInsights,
  getPublishedFirmProductInsights,
  getPublishedProductInsights,
  getPublishedTypeInsights,
  getPublishedYearInsights,
  getPublishedYearProductInsights,
} from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const years = await getPublishedYearInsights();
  const firms = await getPublishedFirmInsights();
  const products = await getPublishedProductInsights();
  const types = await getPublishedTypeInsights();
  const yearProducts = await getPublishedYearProductInsights();
  const firmProducts = await getPublishedFirmProductInsights();

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/analysis',
    '/root-causes',
    '/comparison',
    '/advisor',
    '/insights',
    '/insights/years',
    '/insights/firms',
    '/insights/products',
    '/insights/types',
    '/insights/year-products',
    '/insights/firm-products',
  ].map((path) => ({
    url: absoluteUrl(path || '/'),
    lastModified: new Date(),
    changeFrequency: path.startsWith('/insights/') ? 'weekly' : 'daily',
    priority: path === '' || path === '/insights' ? 1 : 0.8,
  }));

  const insightRoutes = [...years, ...firms, ...products, ...types, ...yearProducts, ...firmProducts]
    .filter((item) => !item.isNoindex)
    .map((item) => ({
    url: absoluteUrl(item.href),
    lastModified: item.latestDecisionDate ? new Date(item.latestDecisionDate) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: item.kind === 'year' || item.kind === 'year-product' ? 0.9 : 0.75,
  }));

  return [...staticRoutes, ...insightRoutes];
}
