import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmInsightPage } from '@/lib/insights/repository';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const page = await getFirmInsightPage(params.slug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightFirmDetailPage({ params }: { params: { slug: string } }) {
  const page = await getFirmInsightPage(params.slug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
