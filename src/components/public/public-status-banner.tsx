import { AlertTriangle } from 'lucide-react';
import type { PublicDataStatus } from '@/lib/insights/types';

type PublicStatusBannerProps = {
  status: PublicDataStatus;
  className?: string;
};

export function PublicStatusBanner({ status, className }: PublicStatusBannerProps) {
  if (status.mode !== 'degraded') return null;

  return (
    <section
      className={`rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(180deg,#fff9ef_0%,#fffdf8_100%)] px-5 py-4 shadow-sm ${className || ''}`.trim()}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Public data status</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {status.message || 'Live public data is temporarily unavailable. Fallback content is being shown.'}
          </p>
        </div>
      </div>
    </section>
  );
}
