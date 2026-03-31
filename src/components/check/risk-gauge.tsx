'use client';

type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';

interface RiskGaugeProps {
  upheldRate: number;
  riskLevel: RiskLevel;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  very_high: 'Very High Risk',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  very_high: '#ef4444',
};

// SVG semicircular gauge — 4 color zones, needle, central number
export function RiskGauge({ upheldRate, riskLevel }: RiskGaugeProps) {
  const rate = Math.max(0, Math.min(100, Number(upheldRate) || 0));
  const needleColor = RISK_COLORS[riskLevel];

  // Arc geometry: semicircle from left to right
  const cx = 150;
  const cy = 140;
  const r = 110;
  const startAngle = Math.PI; // left (180°)
  const endAngle = 0; // right (0°)

  // Zone boundaries (in % of 0-100 range)
  const zones: { from: number; to: number; color: string }[] = [
    { from: 0, to: 30, color: '#10b981' },   // green
    { from: 30, to: 45, color: '#f59e0b' },  // amber
    { from: 45, to: 60, color: '#f97316' },   // orange
    { from: 60, to: 100, color: '#ef4444' },  // red
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

  // Needle
  const needleAngle = pctToAngle(rate);
  const needleLen = r - 15;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 170" className="w-full max-w-[280px]" aria-label={`Risk gauge showing ${rate.toFixed(1)}% upheld rate — ${RISK_LABELS[riskLevel]}`}>
        {/* Background track */}
        <path d={arcPath(0, 100)} fill="none" stroke="#e2e8f0" strokeWidth={20} strokeLinecap="round" />

        {/* Zone arcs */}
        {zones.map((zone) => (
          <path
            key={zone.from}
            d={arcPath(zone.from, zone.to)}
            fill="none"
            stroke={zone.color}
            strokeWidth={20}
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill={needleColor} />
        <circle cx={cx} cy={cy} r={3} fill="white" />

        {/* Central label */}
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-slate-900 text-3xl font-bold" fontSize={36} fontWeight={700}>
          {rate.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" className="fill-slate-500 text-xs" fontSize={12}>
          upheld rate
        </text>

        {/* Axis labels */}
        <text x={30} y={cy + 16} textAnchor="middle" className="fill-slate-400" fontSize={10}>0%</text>
        <text x={270} y={cy + 16} textAnchor="middle" className="fill-slate-400" fontSize={10}>100%</text>
      </svg>
      <span
        className="mt-1 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
        style={{ backgroundColor: `${needleColor}15`, color: needleColor }}
      >
        {RISK_LABELS[riskLevel]}
      </span>
    </div>
  );
}
