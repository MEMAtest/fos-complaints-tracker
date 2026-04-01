import { ArrowRight, BarChart3, Building2, FileCheck, Search } from 'lucide-react';
import { PublicIllustration } from '@/components/illustrations/public-illustration';

const CARDS = [
  {
    key: 'select',
    eyebrow: 'Step 1',
    title: 'Pick the complaint context',
    body: 'Start with product and optional root cause to anchor the estimate in comparable published decisions.',
    icon: Search,
    tone: 'light' as const,
  },
  {
    key: 'compare',
    eyebrow: 'Step 2',
    title: 'Read the live outcome pattern',
    body: 'See the current upheld-rate context, sample size, and the distribution of outcomes in similar published cases.',
    icon: BarChart3,
    tone: 'light' as const,
  },
  {
    key: 'overlay',
    eyebrow: 'Step 3',
    title: 'Overlay a firm if you have one',
    body: 'Where data exists, the firm overlay shows how that firm compares with the wider product-level outcome picture.',
    icon: Building2,
    tone: 'light' as const,
  },
  {
    key: 'next',
    eyebrow: 'Next move',
    title: 'Move into the full intelligence layer',
    body: 'Use the estimator as the fast public signal, then step into the advisor brief or workspace when the case needs handling depth.',
    icon: FileCheck,
    tone: 'dark' as const,
  },
] as const;

export function CheckExplainerGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {CARDS.map((card, index) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className={card.tone === 'dark'
              ? 'rounded-[1.9rem] border border-[#102a4e] bg-[#102a4e] p-5 text-white shadow-[0_24px_70px_rgba(16,42,78,0.22)]'
              : index % 2 === 0
                ? 'rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-sm'
                : 'rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] p-5 shadow-sm'}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={card.tone === 'dark' ? 'text-[11px] uppercase tracking-[0.2em] text-white/55' : 'text-[11px] uppercase tracking-[0.2em] text-slate-500'}>
                  {card.eyebrow}
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{card.title}</h3>
              </div>
              <div className={card.tone === 'dark' ? 'flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10' : 'flex h-11 w-11 items-center justify-center rounded-2xl bg-[#102a4e] text-white'}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className={card.tone === 'dark' ? 'mt-4 text-sm leading-7 text-white/72' : 'mt-4 text-sm leading-7 text-slate-600'}>
              {card.body}
            </p>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-black/5 bg-white/70 p-3">
              <PublicIllustration variant={card.key === 'next' ? 'workflow' : index === 1 ? 'insight' : card.key === 'overlay' ? 'firm' : 'estimator'} className="border-0 shadow-none" />
            </div>
            {card.tone === 'dark' ? (
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white">
                Explore the next layer
                <ArrowRight className="h-4 w-4" />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
