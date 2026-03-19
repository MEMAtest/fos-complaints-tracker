import { ComplaintDetailView } from '@/components/complaints/ComplaintDetailView';

export default async function ComplaintDetailPage({ params }: { params: Promise<{ complaintId: string }> }) {
  const { complaintId } = await params;
  return <ComplaintDetailView complaintId={complaintId} />;
}
