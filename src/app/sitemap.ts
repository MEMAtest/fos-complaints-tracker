import type { MetadataRoute } from 'next';
import {
  getPublishedFirmInsights,
  getPublishedProductInsights,
  getPublishedTypeInsights,
  getPublishedYearInsights,
} from '@/lib/insights/repository';
import { absoluteUrl } from '@/lib/insights/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [years, firms, products, types] = await Promise.all([
    getPublishedYearInsights(),
    getPublishedFirmInsights(),
    getPublishedProductInsights(),
    getPublishedTypeInsights(),
  ]);

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
  ].map((path) => ({
    url: absoluteUrl(path || '/'),
    lastModified: new Date(),
    changeFrequency: path.startsWith('/insights/') ? 'weekly' : 'daily',
    priority: path === '' || path === '/insights' ? 1 : 0.8,
  }));

  const insightRoutes = [...years, ...firms, ...products, ...types].map((item) => ({
    url: absoluteUrl(item.href),
    lastModified: item.latestDecisionDate ? new Date(item.latestDecisionDate) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: item.kind === 'year' ? 0.9 : 0.75,
  }));

  return [...staticRoutes, ...insightRoutes];
}
