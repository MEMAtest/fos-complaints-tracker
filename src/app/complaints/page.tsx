import { RequireAuth } from '@/components/auth/require-auth';
import { ComplaintsRegisterClient } from '@/components/complaints/ComplaintsRegisterClient';

export default function ComplaintsPage() {
  return (
    <RequireAuth minimumRole="viewer">
      <ComplaintsRegisterClient />
    </RequireAuth>
  );
}
