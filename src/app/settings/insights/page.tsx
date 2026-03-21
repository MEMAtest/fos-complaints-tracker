import { RequireAuth } from '@/components/auth/require-auth';
import { InsightPublicationControls } from '@/components/insights/insight-publication-controls';

export default function InsightPublicationSettingsPage() {
  return (
    <RequireAuth minimumRole="admin">
      <InsightPublicationControls />
    </RequireAuth>
  );
}
