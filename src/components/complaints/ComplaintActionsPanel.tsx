'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth/auth-provider';
import type { ComplaintAction, ComplaintActionStatus, ComplaintSlaSummary } from '@/lib/complaints/types';
import { formatDate } from '@/lib/utils';

const ACTION_STATUS_OPTIONS: ComplaintActionStatus[] = ['open', 'in_progress', 'completed', 'cancelled'];

export function ComplaintActionsPanel({
  complaintId,
  actions,
  slaSummary,
  onRefresh,
}: {
  complaintId: string;
  actions: ComplaintAction[];
  slaSummary: ComplaintSlaSummary | null;
  onRefresh: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const openActions = useMemo(() => actions.filter((action) => action.status === 'open' || action.status === 'in_progress'), [actions]);

  async function createAction() {
    if (!title.trim()) return;
    setSaving('create');
    try {
      const response = await fetch(`/api/complaints/${complaintId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, owner: owner || null, dueDate: dueDate || null, actionType: 'custom' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to create complaint action.');
      setTitle('');
      setOwner('');
      setDueDate('');
      await onRefresh();
    } finally {
      setSaving(null);
    }
  }

  async function updateAction(actionId: string, body: Record<string, unknown>) {
    setSaving(actionId);
    try {
      const response = await fetch(`/api/complaints/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update complaint action.');
      await onRefresh();
    } finally {
      setSaving(null);
    }
  }

  async function deleteAction(actionId: string) {
    setSaving(actionId);
    try {
      const response = await fetch(`/api/complaints/actions/${actionId}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to delete complaint action.');
      await onRefresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actions and SLA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">SLA posture</p>
              <p className="mt-1 text-sm font-semibold text-slate-900" data-testid="sla-state">{formatSlaState(slaSummary?.state || 'on_track')}</p>
            </div>
            <Badge variant="outline">{openActions.length} open actions</Badge>
          </div>
          {slaSummary ? (
            <div className="mt-3 grid gap-2 text-xs text-slate-600">
              <p>{slaSummary.daysElapsed} days elapsed since receipt.</p>
              <p>
                Next milestone: {slaSummary.nextMilestoneLabel || 'None'}
                {slaSummary.nextMilestoneDate ? ` · ${formatDate(slaSummary.nextMilestoneDate)}` : ''}
              </p>
              {slaSummary.overdue ? <p className="font-semibold text-rose-600">Eight-week deadline has passed.</p> : null}
              {!slaSummary.overdue && slaSummary.atRisk ? <p className="font-semibold text-amber-600">Eight-week deadline is within 7 days.</p> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Add management action</p>
          <div className="mt-3 space-y-3">
            <input data-testid="action-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Action title" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input data-testid="action-due-date-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <Button data-testid="action-create-button" className="w-full gap-2" onClick={() => void createAction()} disabled={saving === 'create' || !title.trim()}>
              {saving === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add action
            </Button>
          </div>
        </div>

        <div className="space-y-3" data-testid="actions-list">
          {actions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No complaint actions recorded yet.
            </div>
          ) : actions.map((action) => (
            <div key={action.id} data-testid="action-card" className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <Badge variant={action.source === 'system' ? 'outline' : 'default'}>{action.source}</Badge>
                    <Badge variant="outline">{action.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{action.actionType.replace(/_/g, ' ')}</p>
                  {action.description ? <p className="mt-2 text-sm text-slate-600">{action.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    {action.owner ? <span>Owner: {action.owner}</span> : null}
                    {action.dueDate ? <span>Due: {formatDate(action.dueDate)}</span> : null}
                    {action.completedAt ? <span>Completed: {formatDate(action.completedAt)}</span> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {action.status !== 'completed' ? (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void updateAction(action.id, { status: 'completed' })} disabled={saving === action.id} data-testid={`action-complete-${action.id}`}>
                      {saving === action.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Complete
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => void updateAction(action.id, { status: 'open' })} disabled={saving === action.id}>
                      Reopen
                    </Button>
                  )}
                  {user?.role === 'manager' || user?.role === 'admin' ? (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void deleteAction(action.id)} disabled={saving === action.id || action.source === 'system'}>
                      {saving === action.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSlaState(state: ComplaintSlaSummary['state']) {
  switch (state) {
    case 'closed':
      return 'Closed out';
    case 'overdue':
      return 'Overdue';
    case 'due_soon':
      return 'Due within 7 days';
    case 'on_track':
    default:
      return 'On track';
  }
}
