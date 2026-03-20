'use client';

import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplaintSlaSummary } from '@/lib/complaints/types';
import { cn, formatDate } from '@/lib/utils';

export function DeadlineTracker({
  receivedDate,
  fourWeekDueDate,
  eightWeekDueDate,
  finalResponseDate,
  resolvedDate,
  slaSummary,
}: {
  receivedDate: string;
  fourWeekDueDate: string | null;
  eightWeekDueDate: string | null;
  finalResponseDate: string | null;
  resolvedDate: string | null;
  slaSummary: ComplaintSlaSummary | null;
}) {
  const now = new Date();
  const received = new Date(receivedDate);
  const dayCount = Math.max(0, Math.floor((now.getTime() - received.getTime()) / (1000 * 60 * 60 * 24)));
  const progress = Math.min(100, Math.round((dayCount / 56) * 100));
  const overdue = Boolean(eightWeekDueDate && new Date(eightWeekDueDate) < now && !resolvedDate && !finalResponseDate);
  const atRisk = !overdue && dayCount >= 42;
  const statusTone = overdue ? 'bg-rose-500' : atRisk ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deadline Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{dayCount} days elapsed</span>
            <span className={cn('font-semibold', overdue ? 'text-rose-600' : atRisk ? 'text-amber-600' : 'text-emerald-600')}>
              {resolvedDate || finalResponseDate ? 'Closed out' : overdue ? 'Overdue' : atRisk ? 'Approaching deadline' : 'On track'}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={cn('h-full rounded-full transition-all', statusTone)} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-400">
            <span>Day 0</span>
            <span>4 weeks</span>
            <span>8 weeks</span>
          </div>
        </div>

        <DeadlineRow label="Received" value={formatDate(receivedDate)} done />
        <DeadlineRow label="4-week due" value={fourWeekDueDate ? formatDate(fourWeekDueDate) : 'Pending'} done={Boolean(finalResponseDate || resolvedDate || (fourWeekDueDate && new Date(fourWeekDueDate) >= now))} warn={Boolean(fourWeekDueDate && new Date(fourWeekDueDate) < now && !finalResponseDate && !resolvedDate)} />
        <DeadlineRow label="8-week due" value={eightWeekDueDate ? formatDate(eightWeekDueDate) : 'Pending'} done={Boolean(finalResponseDate || resolvedDate)} warn={overdue} />
        <DeadlineRow label="Final response" value={finalResponseDate ? formatDate(finalResponseDate) : resolvedDate ? formatDate(resolvedDate) : 'Pending'} done={Boolean(finalResponseDate || resolvedDate)} />
        {slaSummary?.nextMilestoneLabel ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Next milestone: <span className="font-semibold text-slate-800">{slaSummary.nextMilestoneLabel}</span>
            {slaSummary.nextMilestoneDate ? ` by ${formatDate(slaSummary.nextMilestoneDate)}` : ''}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DeadlineRow({ label, value, done, warn = false }: { label: string; value: string; done?: boolean; warn?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between rounded-xl border px-3 py-2', warn ? 'border-rose-200 bg-rose-50' : done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50')}>
      <div className="flex items-center gap-2">
        {warn ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-slate-500" />}
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <span className="text-xs font-semibold text-slate-600">{value}</span>
    </div>
  );
}
