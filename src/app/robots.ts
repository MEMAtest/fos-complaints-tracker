import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/insights/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/analysis', '/root-causes', '/comparison', '/advisor', '/check', '/insights', '/insights/', '/insights/*'],
      disallow: ['/login', '/complaints', '/board-pack', '/imports', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
