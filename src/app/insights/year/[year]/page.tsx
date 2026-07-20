import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { InsightDetailView } from '@/components/insights/detail-view';
import { buildInsightMetadata } from '@/lib/insights/seo';
import { getYearInsightPage } from '@/lib/insights/repository';

type PageProps = { params: Promise<{ year: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { year } = await params;
  const page = await getYearInsightPage(Number(year));
  return page ? buildInsightMetadata(page) : {};
}

export default async function InsightYearDetailPage({ params }: PageProps) {
  const { year } = await params;
  const page = await getYearInsightPage(Number(year));
  if (!page) notFound();
  return <InsightDetailView page={page} />;
}
