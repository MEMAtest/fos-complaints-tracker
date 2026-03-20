import { RequireAuth } from '@/components/auth/require-auth';
import { ComplaintImportPanel } from '@/components/complaints/ComplaintImportPanel';

export default function ComplaintImportPage() {
  return (
    <RequireAuth minimumRole="operator">
      <ComplaintImportPanel />
    </RequireAuth>
  );
}
