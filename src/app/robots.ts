import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/analysis', '/root-causes', '/comparison', '/advisor', '/insights', '/insights/', '/insights/*'],
      disallow: ['/login', '/complaints', '/board-pack', '/imports', '/api/'],
    },
    sitemap: 'https://foscomplaints.memaconsultants.com/sitemap.xml',
  };
}
