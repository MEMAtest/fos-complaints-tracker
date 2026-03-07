import { STATUS_STYLES } from '@/lib/fos/constants';

export function StatusBadge({ status }: { status: 'running' | 'idle' | 'warning' | 'error' }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
