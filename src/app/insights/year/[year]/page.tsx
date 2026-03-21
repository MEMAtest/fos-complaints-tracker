import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearInsightPage } from '@/lib/insights/repository';

export async function generateMetadata({ params }: { params: { year: string } }): Promise<Metadata> {
  const page = await getYearInsightPage(Number(params.year));
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightYearDetailPage({ params }: { params: { year: string } }) {
  const page = await getYearInsightPage(Number(params.year));
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
