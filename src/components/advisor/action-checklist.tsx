'use client';

import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { FOSAdvisorChecklist } from '@/lib/fos/types';

const PRIORITY_STYLES = {
  critical: { icon: AlertCircle, iconColor: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Critical' },
  important: { icon: AlertCircle, iconColor: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Important' },
  recommended: { icon: Info, iconColor: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Recommended' },
};

const SOURCE_LABELS: Record<string, string> = {
  precedent: 'Precedent',
  root_cause: 'Root cause',
  theme: 'Theme analysis',
  vulnerability: 'Vulnerability',
};

interface ActionChecklistProps {
  actions: FOSAdvisorChecklist[];
}

export function ActionChecklist({ actions }: ActionChecklistProps) {
  if (actions.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No recommended actions.</p>;
  }

  // Group by priority
  const grouped = {
    critical: actions.filter((a) => a.priority === 'critical'),
    important: actions.filter((a) => a.priority === 'important'),
    recommended: actions.filter((a) => a.priority === 'recommended'),
  };

  return (
    <div className="space-y-3">
      {(['critical', 'important', 'recommended'] as const).map((priority) => {
        const items = grouped[priority];
        if (items.length === 0) return null;
        const style = PRIORITY_STYLES[priority];
        const Icon = style.icon;

        return (
          <div key={priority}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />
              <span className={`text-xs font-semibold ${style.iconColor}`}>{style.label}</span>
            </div>
            <ul className="space-y-1.5">
              {items.map((action, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border ${style.border} ${style.bg} px-3 py-2`}
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">{action.item}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Source: {SOURCE_LABELS[action.source] || action.source}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
