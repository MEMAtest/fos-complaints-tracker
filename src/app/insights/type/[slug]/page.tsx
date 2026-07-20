import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getTypeInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getTypeInsightPage(slug);
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightTypeDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getTypeInsightPage(slug);
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
