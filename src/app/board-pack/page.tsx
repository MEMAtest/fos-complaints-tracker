import { RequireAuth } from '@/components/auth/require-auth';
import { BoardPackBuilder } from '@/components/board-pack/BoardPackBuilder';

export default function BoardPackPage() {
  return (
    <RequireAuth minimumRole="viewer">
      <BoardPackBuilder />
    </RequireAuth>
  );
}
