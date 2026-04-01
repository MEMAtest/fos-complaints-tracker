import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PublicIllustrationVariant =
  | 'estimator'
  | 'insight'
  | 'firm'
  | 'workflow'
  | 'reporting'
  | 'archive';

const stroke = '#111827';
const navy = '#102a4e';
const blue = '#2563eb';
const amber = '#f59e0b';
const violet = '#7c3aed';
const cloud = '#f8fafc';

function Frame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#fffef9_0%,#f7fbff_58%,#eef4ff_100%)] shadow-[0_20px_60px_rgba(15,23,42,0.12)]', className)}>
      <svg viewBox="0 0 360 260" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="0" y="0" width="360" height="260" fill="transparent" />
        <circle cx="286" cy="48" r="28" fill={amber} fillOpacity="0.2" />
        <circle cx="58" cy="208" r="34" fill={blue} fillOpacity="0.12" />
        <path d="M30 214H330" stroke={stroke} strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
        {children}
      </svg>
    </div>
  );
}

function MiniCloud({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y + 8} C ${x + 6} ${y - 6}, ${x + 18} ${y - 6}, ${x + 22} ${y + 4} C ${x + 33} ${y + 2}, ${x + 38} ${y + 12}, ${x + 34} ${y + 18} H ${x + 4} C ${x - 4} ${y + 18}, ${x - 6} ${y + 11}, ${x} ${y + 8} Z`}
      fill={cloud}
      stroke={stroke}
      strokeWidth="1.6"
    />
  );
}

function DataPanel({ x, y, w = 108, h = 74, bars = [18, 30, 44, 36], tone = 'blue' }: { x: number; y: number; w?: number; h?: number; bars?: number[]; tone?: 'blue' | 'violet' | 'amber' }) {
  const fill = tone === 'violet' ? violet : tone === 'amber' ? amber : blue;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="14" fill="white" stroke={stroke} strokeWidth="2" />
      <rect x={x + 12} y={y + 14} width={44} height="8" rx="4" fill={navy} fillOpacity="0.08" />
      <path d={`M ${x + 12} ${y + h - 16} H ${x + w - 12}`} stroke={stroke} strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />
      {bars.map((bar, index) => (
        <rect
          key={`${x}-${y}-${index}`}
          x={x + 18 + index * 18}
          y={y + h - 16 - bar}
          width="12"
          height={bar}
          rx="4"
          fill={fill}
        />
      ))}
    </g>
  );
}

function DeskPerson({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 48} cy={y + 24} r="11" fill="white" stroke={stroke} strokeWidth="2" />
      <path d={`M ${x + 40} ${y + 38} C ${x + 36} ${y + 58}, ${x + 52} ${y + 66}, ${x + 58} ${y + 90}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M ${x + 42} ${y + 48} L ${x + 24} ${y + 66}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M ${x + 56} ${y + 49} L ${x + 78} ${y + 64}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M ${x + 56} ${y + 90} L ${x + 40} ${y + 120}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M ${x + 60} ${y + 90} L ${x + 82} ${y + 120}`} stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <rect x={x + 12} y={y + 54} width="76" height="8" rx="4" fill={navy} fillOpacity="0.1" />
      <path d={`M ${x + 8} ${y + 126} H ${x + 90}`} stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <rect x={x + 76} y={y + 44} width="54" height="40" rx="10" fill="white" stroke={stroke} strokeWidth="2" />
      <rect x={x + 84} y={y + 54} width="12" height="18" rx="3" fill={amber} />
      <rect x={x + 100} y={y + 48} width="12" height="24" rx="3" fill={violet} />
      <rect x={x + 116} y={y + 40} width="8" height="32" rx="3" fill={blue} />
    </g>
  );
}

function LoupeScene() {
  return (
    <>
      <MiniCloud x={42} y={42} />
      <MiniCloud x={242} y={74} />
      <circle cx="122" cy="126" r="40" fill="white" stroke={stroke} strokeWidth="2.4" />
      <path d="M147 154L182 188" stroke={stroke} strokeWidth="8" strokeLinecap="round" />
      <circle cx="122" cy="126" r="24" fill={blue} fillOpacity="0.12" stroke={stroke} strokeWidth="2" />
      <rect x="112" y="112" width="10" height="22" rx="4" fill={amber} />
      <rect x="126" y="102" width="10" height="32" rx="4" fill={violet} />
      <rect x="140" y="92" width="10" height="42" rx="4" fill={blue} />
      <DeskPerson x={184} y={82} />
    </>
  );
}

function EstimatorScene() {
  return (
    <>
      <MiniCloud x={24} y={38} />
      <MiniCloud x={274} y={58} />
      <DataPanel x={42} y={58} w={138} h={90} bars={[20, 38, 52, 46, 60]} tone="violet" />
      <path d="M208 84C226 74 252 70 276 78C300 86 314 106 316 126" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="6 6" />
      <circle cx="314" cy="126" r="8" fill={amber} stroke={stroke} strokeWidth="2" />
      <path d="M208 88L218 106L228 98" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <DeskPerson x={190} y={96} />
      <rect x="64" y="164" width="90" height="44" rx="12" fill="white" stroke={stroke} strokeWidth="2" />
      <text x="82" y="186" fill={stroke} fontSize="11" fontWeight="700">UPHOLD RISK</text>
      <text x="82" y="200" fill={navy} fontSize="17" fontWeight="700">32.8%</text>
    </>
  );
}

function WorkflowScene() {
  return (
    <>
      <MiniCloud x={34} y={46} />
      <MiniCloud x={250} y={34} />
      <rect x="54" y="78" width="86" height="112" rx="18" fill="white" stroke={stroke} strokeWidth="2" />
      <rect x="70" y="96" width="50" height="10" rx="5" fill={navy} fillOpacity="0.1" />
      {[0, 1, 2].map((index) => (
        <g key={index}>
          <rect x="72" y={120 + index * 20} width="10" height="10" rx="3" fill={index === 0 ? amber : index === 1 ? blue : violet} />
          <rect x="90" y={121 + index * 20} width="36" height="8" rx="4" fill={navy} fillOpacity="0.08" />
        </g>
      ))}
      <path d="M152 132H204" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="6 6" />
      <path d="M204 132L196 126" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M204 132L196 138" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <DataPanel x={214} y={68} w={94} h={66} bars={[16, 28, 34, 42]} tone="amber" />
      <rect x="224" y="150" width="84" height="54" rx="14" fill={navy} />
      <rect x="236" y="166" width="34" height="8" rx="4" fill="white" fillOpacity="0.25" />
      <rect x="236" y="182" width="54" height="8" rx="4" fill="white" fillOpacity="0.16" />
      <circle cx="286" cy="176" r="9" fill={amber} />
    </>
  );
}

function ReportingScene() {
  return (
    <>
      <MiniCloud x={36} y={52} />
      <circle cx="276" cy="56" r="18" fill={amber} fillOpacity="0.28" />
      <rect x="58" y="88" width="110" height="90" rx="18" fill="white" stroke={stroke} strokeWidth="2" />
      <rect x="76" y="106" width="66" height="10" rx="5" fill={navy} fillOpacity="0.09" />
      <rect x="76" y="126" width="72" height="36" rx="10" fill="#eff6ff" stroke={stroke} strokeWidth="1.6" />
      <rect x="84" y="144" width="10" height="10" rx="3" fill={violet} />
      <rect x="98" y="134" width="10" height="20" rx="3" fill={amber} />
      <rect x="112" y="124" width="10" height="30" rx="3" fill={blue} />
      <path d="M198 82L246 70L292 82L284 168L208 168Z" fill="white" stroke={stroke} strokeWidth="2" />
      <path d="M246 70V168" stroke={stroke} strokeWidth="2" />
      <rect x="216" y="104" width="18" height="46" rx="8" fill={blue} fillOpacity="0.16" />
      <rect x="258" y="96" width="18" height="54" rx="8" fill={amber} fillOpacity="0.2" />
      <path d="M192 196H300" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function FirmScene() {
  return (
    <>
      <MiniCloud x={34} y={52} />
      <rect x="54" y="70" width="118" height="124" rx="22" fill="white" stroke={stroke} strokeWidth="2" />
      <rect x="74" y="92" width="78" height="10" rx="5" fill={navy} fillOpacity="0.08" />
      <rect x="76" y="118" width="18" height="54" rx="9" fill={amber} fillOpacity="0.26" stroke={stroke} strokeWidth="1.6" />
      <rect x="104" y="108" width="18" height="64" rx="9" fill={violet} fillOpacity="0.22" stroke={stroke} strokeWidth="1.6" />
      <rect x="132" y="96" width="18" height="76" rx="9" fill={blue} fillOpacity="0.18" stroke={stroke} strokeWidth="1.6" />
      <circle cx="248" cy="104" r="22" fill="white" stroke={stroke} strokeWidth="2" />
      <path d="M248 124C224 138 220 174 220 194" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M248 124C272 138 276 174 276 194" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M234 106H262" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M248 92V120" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M220 196H286" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <DataPanel x={212} y={134} w={92} h={58} bars={[10, 18, 26, 32]} tone="blue" />
    </>
  );
}

export function PublicIllustration({ variant, className }: { variant: PublicIllustrationVariant; className?: string }) {
  return (
    <Frame className={className}>
      {variant === 'estimator' ? <EstimatorScene /> : null}
      {variant === 'insight' ? <LoupeScene /> : null}
      {variant === 'firm' ? <FirmScene /> : null}
      {variant === 'workflow' ? <WorkflowScene /> : null}
      {variant === 'reporting' ? <ReportingScene /> : null}
      {variant === 'archive' ? <LoupeScene /> : null}
    </Frame>
  );
}
