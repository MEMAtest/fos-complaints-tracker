'use client';

import { useMemo, useState } from 'react';
import { Loader2, MessageSquarePlus, Send, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplaintPriority, ComplaintRecord, ComplaintStatus } from '@/lib/complaints/types';

const STATUS_OPTIONS: ComplaintStatus[] = ['open', 'investigating', 'escalated', 'referred_to_fos', 'resolved', 'closed'];
const PRIORITY_OPTIONS: ComplaintPriority[] = ['low', 'medium', 'high', 'urgent'];

export function QuickActions({
  complaint,
  onRefresh,
}: {
  complaint: ComplaintRecord;
  onRefresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [priority, setPriority] = useState<ComplaintPriority>(complaint.priority);
  const [assignee, setAssignee] = useState(complaint.assignedTo || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const hasNote = useMemo(() => note.trim().length > 0, [note]);

  async function updateComplaint(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to update complaint.');
      }
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!hasNote) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType: 'note_added', description: note }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to add note.');
      }
      setNote('');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</span>
          <div className="flex gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value as ComplaintStatus)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => void updateComplaint({ status })} disabled={saving || status === complaint.status}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Priority</span>
          <div className="flex gap-2">
            <select value={priority} onChange={(event) => setPriority(event.target.value as ComplaintPriority)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => void updateComplaint({ priority })} disabled={saving || priority === complaint.priority}>
              Update
            </Button>
          </div>
        </label>

        <label className="block text-sm">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"><UserRound className="h-3.5 w-3.5" />Assign owner</span>
          <div className="flex gap-2">
            <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="e.g. Complaints lead" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <Button size="sm" variant="outline" onClick={() => void updateComplaint({ assignedTo: assignee || null })} disabled={saving || assignee === (complaint.assignedTo || '')}>
              Assign
            </Button>
          </div>
        </label>

        <label className="block text-sm">
          <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"><MessageSquarePlus className="h-3.5 w-3.5" />Add timeline note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Record a management note, escalation, or next step." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </label>

        <Button className="w-full gap-2" onClick={() => void addNote()} disabled={saving || !hasNote}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Add Note to Timeline
        </Button>
      </CardContent>
    </Card>
  );
}
