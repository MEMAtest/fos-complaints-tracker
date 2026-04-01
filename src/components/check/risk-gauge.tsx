'use client';

type UpholdRiskLevel = 'low' | 'medium' | 'high' | 'very_high';

interface RiskGaugeProps {
  upheldRate: number;
  upholdRiskLevel: UpholdRiskLevel;
}

const RISK_LABELS: Record<UpholdRiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
};

const RISK_COLORS: Record<UpholdRiskLevel, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  very_high: '#ef4444',
};

export function RiskGauge({ upheldRate, upholdRiskLevel }: RiskGaugeProps) {
  const rate = Math.max(0, Math.min(100, Number(upheldRate) || 0));
  const needleColor = RISK_COLORS[upholdRiskLevel];
  const cx = 160;
  const cy = 150;
  const r = 118;
  const startAngle = Math.PI;

  const zones: { from: number; to: number; color: string }[] = [
    { from: 0, to: 30, color: '#10b981' },
    { from: 30, to: 45, color: '#f59e0b' },
    { from: 45, to: 60, color: '#f97316' },
    { from: 60, to: 100, color: '#ef4444' },
  ];

  function pctToAngle(pct: number): number {
    return startAngle - (pct / 100) * Math.PI;
  }

  function arcPath(fromPct: number, toPct: number): string {
    const a1 = pctToAngle(fromPct);
    const a2 = pctToAngle(toPct);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const largeArc = toPct - fromPct > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
  }

  const needleAngle = pctToAngle(rate);
  const needleLen = r - 16;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  return (
    <div className="rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Uphold Risk</p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Where the upheld-rate signal sits right now</h3>
        </div>
        <span
          className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
          style={{ backgroundColor: `${needleColor}18`, color: needleColor }}
        >
          {RISK_LABELS[upholdRiskLevel]}
        </span>
      </div>
      <div className="mt-4 flex flex-col items-center">
        <svg viewBox="0 0 320 190" className="w-full max-w-[320px]" aria-label={`Risk gauge showing ${rate.toFixed(1)}% upheld rate — ${RISK_LABELS[upholdRiskLevel]} uphold risk`}>
          <path d={arcPath(0, 100)} fill="none" stroke="#e2e8f0" strokeWidth={22} strokeLinecap="round" />
          {zones.map((zone) => (
            <path
              key={zone.from}
              d={arcPath(zone.from, zone.to)}
              fill="none"
              stroke={zone.color}
              strokeWidth={22}
              strokeLinecap="butt"
              opacity={0.88}
            />
          ))}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={7} fill={needleColor} />
          <circle cx={cx} cy={cy} r={3.5} fill="white" />
          <text x={cx} y={cy - 24} textAnchor="middle" fill="#0f172a" fontSize={38} fontWeight={700}>
            {rate.toFixed(1)}%
          </text>
          <text x={cx} y={cy + 2} textAnchor="middle" fill="#64748b" fontSize={12}>
            comparable upheld rate
          </text>
          <text x="32" y={cy + 18} textAnchor="middle" fill="#94a3b8" fontSize={10}>0%</text>
          <text x="288" y={cy + 18} textAnchor="middle" fill="#94a3b8" fontSize={10}>100%</text>
        </svg>
        <p className="mt-2 max-w-xs text-center text-sm leading-6 text-slate-600">
          Based on similar historical FOS outcomes. Use it as a decision-support signal, not as the final complaint answer.
        </p>
      </div>
    </div>
  );
}
