import { ArrowRight, BarChart3, Building2, FileCheck, Search } from 'lucide-react';

const CARDS = [
  {
    key: 'select',
    eyebrow: 'Step 1',
    title: 'Pick the complaint context',
    body: 'Choose the product and, where useful, the root cause.',
    icon: Search,
    tone: 'light' as const,
  },
  {
    key: 'compare',
    eyebrow: 'Step 2',
    title: 'Read the live outcome pattern',
    body: 'See the upheld rate and the decision sample behind it.',
    icon: BarChart3,
    tone: 'light' as const,
  },
  {
    key: 'overlay',
    eyebrow: 'Step 3',
    title: 'Overlay a firm if you have one',
    body: 'Compare the named firm with its published peer context.',
    icon: Building2,
    tone: 'light' as const,
  },
  {
    key: 'next',
    eyebrow: 'Next move',
    title: 'Move into the full intelligence layer',
    body: 'Carry the signal into analysis, advice or complaint handling.',
    icon: FileCheck,
    tone: 'dark' as const,
  },
] as const;

type StoryboardKey = typeof CARDS[number]['key'];

function JourneyStoryboard({ variant, dark }: { variant: StoryboardKey; dark: boolean }) {
  const ink = dark ? '#ffffff' : '#172554';
  const muted = dark ? 'rgba(255,255,255,0.2)' : '#dbe4f4';
  return (
    <svg viewBox="0 0 240 92" className="h-24 w-full" fill="none" aria-hidden="true">
      <path d="M0 74C44 58 78 84 126 68C170 53 198 58 240 47V92H0Z" fill={dark ? 'rgba(255,255,255,0.08)' : '#eef2ff'} />
      <circle cx="204" cy="19" r="14" fill="#f59e0b" fillOpacity={dark ? 0.28 : 0.18} />
      {variant === 'select' ? (
        <>
          <rect x="18" y="17" width="88" height="58" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
          <text x="29" y="32" fill="#64748b" fontSize="6" fontWeight="700">PRODUCT</text>
          <rect x="28" y="38" width="68" height="12" rx="4" fill="#ede9fe" />
          <text x="34" y="46" fill="#5b21b6" fontSize="6" fontWeight="700">Banking & payments</text>
          <text x="29" y="60" fill="#64748b" fontSize="6" fontWeight="700">ROOT CAUSE</text>
          <path d="M116 47H144" stroke={ink} strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M139 42L145 47L139 52" stroke={ink} strokeWidth="1.5" />
          <rect x="151" y="16" width="70" height="59" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
          {[16, 27, 39, 50].map((height, index) => <rect key={height} x={164 + index * 13} y={66 - height} width="8" height={height} rx="3" fill={index === 3 ? '#7c3aed' : '#a78bfa'} />)}
          <path d="M160 67H211" stroke={muted} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : null}
      {variant === 'compare' ? (
        <>
          <circle cx="55" cy="45" r="29" fill="white" stroke={muted} strokeWidth="7" />
          <path d="M55 16A29 29 0 0 1 81 58" stroke="#7c3aed" strokeWidth="7" strokeLinecap="round" />
          <text x="55" y="45" textAnchor="middle" fill={ink} fontSize="13" fontWeight="800">32.8%</text>
          <text x="55" y="56" textAnchor="middle" fill="#64748b" fontSize="6" fontWeight="700">UPHELD</text>
          <path d="M91 45H119" stroke={ink} strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="127" y="16" width="94" height="59" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
          {[14, 24, 32, 43, 50].map((height, index) => <rect key={height} x={141 + index * 13} y={66 - height} width="8" height={height} rx="3" fill="#7c3aed" />)}
          <rect x="172" y="68" width="42" height="10" rx="4" fill="white" stroke={ink} strokeWidth="1" />
          <text x="193" y="75" textAnchor="middle" fill={ink} fontSize="6" fontWeight="700">n = live</text>
        </>
      ) : null}
      {variant === 'overlay' ? (
        <>
          {[['SIMILAR CASES', 18], ['YOUR FIRM', 132]].map(([label, x], panelIndex) => (
            <g key={String(label)}>
              <rect x={Number(x)} y="17" width="90" height="58" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
              <text x={Number(x) + 10} y="31" fill="#64748b" fontSize="6" fontWeight="700">{label}</text>
              {[13, 20, 29, 38].map((height, index) => <rect key={height} x={Number(x) + 14 + index * 14} y={66 - height / 2} width="9" height={height / 2} rx="3" fill={panelIndex === 0 ? '#8b5cf6' : '#3b82f6'} />)}
              <path d={`M ${Number(x) + 10} 67 H ${Number(x) + 80}`} stroke={muted} strokeWidth="1.5" />
            </g>
          ))}
          <path d="M110 46H129" stroke={ink} strokeWidth="1.5" strokeDasharray="4 3" />
        </>
      ) : null}
      {variant === 'next' ? (
        <>
          <rect x="18" y="19" width="82" height="56" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
          {[14, 22, 31, 40].map((height, index) => <rect key={height} x={32 + index * 14} y={66 - height} width="9" height={height} rx="3" fill="#7c3aed" />)}
          <path d="M108 47H137" stroke={ink} strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M132 42L138 47L132 52" stroke={ink} strokeWidth="1.5" />
          <rect x="145" y="15" width="77" height="63" rx="11" fill="white" stroke={ink} strokeWidth="1.7" />
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <circle cx="158" cy={30 + index * 15} r="4" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1" />
              <path d={`M156 ${30 + index * 15}L158 ${32 + index * 15}L162 ${27 + index * 15}`} stroke="#7c3aed" strokeWidth="1" />
              <path d={`M168 ${30 + index * 15}H210`} stroke={muted} strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </>
      ) : null}
    </svg>
  );
}

export function CheckExplainerGrid() {
  return (
    <aside className="self-start overflow-hidden rounded-[1.9rem] border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-700">Four-step estimator journey</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">From question to useful signal</h3>
      </div>
      <div className="grid gap-px bg-slate-200 xl:grid-cols-2">
        {CARDS.map((card, index) => {
          const Icon = card.icon;
          const dark = card.tone === 'dark';
          return (
            <article key={card.key} className={dark ? 'bg-[#102a4e] p-4 text-white' : 'bg-white p-4'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={dark ? 'text-[10px] uppercase tracking-[0.2em] text-white/55' : 'text-[10px] uppercase tracking-[0.2em] text-slate-500'}>{card.eyebrow}</p>
                  <h3 className="mt-1 text-base font-semibold leading-tight tracking-tight">{card.title}</h3>
                </div>
                <div className={dark ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10' : index === 1 ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700' : index === 2 ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700' : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700'}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className={dark ? 'mt-2 text-xs leading-5 text-white/72' : 'mt-2 text-xs leading-5 text-slate-600'}>{card.body}</p>
              <div className={dark ? 'mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5' : 'mt-3 overflow-hidden rounded-xl border border-slate-200 bg-[#fbfcff]'}>
                <JourneyStoryboard variant={card.key} dark={dark} />
              </div>
              {dark ? <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white">Results show the next route <ArrowRight className="h-3.5 w-3.5" /></div> : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
