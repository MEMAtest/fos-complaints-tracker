import type { Metadata } from 'next';
import type { InsightFaqItem, InsightPageData } from './types';

const SITE_URL = 'https://foscomplaints.memaconsultants.com';

export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'insight';
}

export function buildInsightMetadata(page: InsightPageData): Metadata {
  return {
    title: page.seo.title,
    description: page.seo.description,
    keywords: page.seo.keywords,
    robots: page.noindex ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: absoluteUrl(page.canonicalPath),
    },
    openGraph: {
      title: page.seo.title,
      description: page.seo.description,
      url: absoluteUrl(page.canonicalPath),
      siteName: 'FOS Complaints Intelligence',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.seo.title,
      description: page.seo.description,
    },
  };
}

export function buildBreadcrumbSchema(page: InsightPageData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.title,
      item: absoluteUrl(crumb.href),
    })),
  };
}

export function buildWebPageSchema(page: InsightPageData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: absoluteUrl(page.canonicalPath),
    dateModified: page.lastUpdated || undefined,
    about: page.hero.eyebrow,
  };
}

export function buildFaqSchema(faq: InsightFaqItem[]) {
  if (faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
