import { RequireAuth } from '@/components/auth/require-auth';
import { ComplaintDetailView } from '@/components/complaints/ComplaintDetailView';

export default async function ComplaintDetailPage({ params }: { params: Promise<{ complaintId: string }> }) {
  const { complaintId } = await params;
  return (
    <RequireAuth minimumRole="viewer">
      <ComplaintDetailView complaintId={complaintId} />
    </RequireAuth>
  );
}
