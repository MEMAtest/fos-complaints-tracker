import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getFirmInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getFirmInsightPage(slug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightFirmDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getFirmInsightPage(slug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
