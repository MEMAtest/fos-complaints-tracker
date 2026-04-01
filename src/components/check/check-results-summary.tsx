import { AlertCircle, BarChart3, Building2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatRiskLabel(level: string) {
  return level.replace(/_/g, ' ');
}

export function CheckResultsSummary({
  upheldRate,
  upholdRiskLevel,
  sampleSize,
  overallUpheldRate,
  firmName,
  firmRate,
}: {
  upheldRate: number;
  upholdRiskLevel: 'low' | 'medium' | 'high' | 'very_high';
  sampleSize: number;
  overallUpheldRate: number;
  firmName?: string | null;
  firmRate?: number | null;
}) {
  const cards = [
    {
      key: 'upheld',
      label: 'Estimated upheld rate',
      value: `${upheldRate.toFixed(1)}%`,
      helper: 'Comparable published decisions in the selected context.',
      icon: BarChart3,
      tone: 'blue',
    },
    {
      key: 'risk',
      label: 'Uphold Risk',
      value: formatRiskLabel(upholdRiskLevel),
      helper: 'Internal shorthand for how exposed this complaint context looks.',
      icon: ShieldCheck,
      tone: upholdRiskLevel === 'very_high' || upholdRiskLevel === 'high' ? 'amber' : 'ink',
    },
    {
      key: 'sample',
      label: 'Sample size',
      value: sampleSize.toLocaleString(),
      helper: 'Published decisions backing this estimate right now.',
      icon: AlertCircle,
      tone: 'violet',
    },
    {
      key: 'firm',
      label: firmName ? `${firmName} overlay` : 'FOS overall context',
      value: `${(firmRate ?? overallUpheldRate).toFixed(1)}%`,
      helper: firmName ? 'Firm rate within the same product context, where available.' : 'Overall published upheld rate across the current corpus.',
      icon: Building2,
      tone: 'soft',
    },
  ] as const;

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className={cn(
              'rounded-[1.8rem] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)]',
              card.tone === 'blue'
                ? 'border-sky-200 bg-[linear-gradient(180deg,#f2f9ff_0%,#ffffff_100%)]'
                : card.tone === 'amber'
                  ? 'border-amber-200 bg-[linear-gradient(180deg,#fff8ec_0%,#ffffff_100%)]'
                  : card.tone === 'violet'
                    ? 'border-violet-200 bg-[linear-gradient(180deg,#f7f2ff_0%,#ffffff_100%)]'
                    : card.tone === 'ink'
                      ? 'border-[#102a4e] bg-[#102a4e] text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]'
                      : index % 2 === 0
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={cn('text-[11px] uppercase tracking-[0.2em]', card.tone === 'ink' ? 'text-white/58' : 'text-slate-500')}>
                  {card.label}
                </p>
                <p className={cn('mt-3 text-3xl font-semibold tracking-tight', card.tone === 'ink' ? 'text-white' : 'text-slate-950')}>
                  {card.value}
                </p>
              </div>
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', card.tone === 'ink' ? 'bg-white/10 text-white' : 'bg-[#102a4e] text-white')}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className={cn('mt-4 text-sm leading-6', card.tone === 'ink' ? 'text-white/72' : 'text-slate-600')}>
              {card.helper}
            </p>
          </article>
        );
      })}
    </section>
  );
}
