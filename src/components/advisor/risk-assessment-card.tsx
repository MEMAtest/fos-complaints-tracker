'use client';

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FOSAdvisorRiskAssessment } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

const RISK_STYLES = {
  low: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Low risk', icon: ShieldCheck },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Medium risk', icon: Shield },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', label: 'High risk', icon: ShieldAlert },
  very_high: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Very high risk', icon: AlertTriangle },
};

const TREND_ICONS = {
  improving: { icon: TrendingDown, text: 'text-emerald-600', label: 'Improving' },
  stable: { icon: Minus, text: 'text-slate-500', label: 'Stable' },
  worsening: { icon: TrendingUp, text: 'text-rose-600', label: 'Worsening' },
};

interface RiskAssessmentCardProps {
  risk: FOSAdvisorRiskAssessment;
}

export function RiskAssessmentCard({ risk }: RiskAssessmentCardProps) {
  const style = RISK_STYLES[risk.riskLevel];
  const trend = TREND_ICONS[risk.trendDirection];
  const RiskIcon = style.icon;
  const TrendIcon = trend.icon;

  const upheldBarWidth = Math.min(risk.upheldRate, 100);
  const overallBarWidth = Math.min(risk.overallUpheldRate, 100);

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <RiskIcon className={`h-5 w-5 ${style.text}`} />
          <span className={`text-sm font-semibold ${style.text}`}>{style.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`h-4 w-4 ${trend.text}`} />
          <span className={`text-xs font-medium ${trend.text}`}>{trend.label}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Total cases</p>
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{formatNumber(risk.totalCases)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Upheld rate</p>
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{formatPercent(risk.upheldRate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Not upheld rate</p>
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{formatPercent(risk.notUpheldRate)}</p>
        </div>
      </div>

      {/* Upheld rate bar comparison */}
      <div className="mt-4 space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">This product</span>
            <span className="font-medium text-slate-900">{formatPercent(risk.upheldRate)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-rose-400 transition-all"
              style={{ width: `${upheldBarWidth}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Overall FOS average</span>
            <span className="font-medium text-slate-900">{formatPercent(risk.overallUpheldRate)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-slate-400 transition-all"
              style={{ width: `${overallBarWidth}%` }}
            />
          </div>
        </div>
      </div>

      {/* Year trend sparkline */}
      {risk.yearTrend.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-slate-600">Upheld rate trend by year</p>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={risk.yearTrend}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Upheld rate']}
                  labelFormatter={(label) => `Year ${label}`}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="upheldRate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
