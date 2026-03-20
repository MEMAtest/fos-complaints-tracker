'use client';

import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Flag, Mail, MessageSquare, Paperclip, Scale, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplaintActivity, ComplaintActivityType } from '@/lib/complaints/types';
import { formatDateTime } from '@/lib/utils';

const ICONS: Record<ComplaintActivityType, React.ComponentType<{ className?: string }>> = {
  complaint_created: CheckCircle2,
  status_change: AlertCircle,
  evidence_added: Paperclip,
  evidence_updated: FileText,
  evidence_archived: Clock3,
  evidence_deleted: AlertCircle,
  letter_generated: Mail,
  letter_submitted_for_review: Clock3,
  letter_approved: CheckCircle2,
  letter_rejected: AlertCircle,
  letter_sent: Mail,
  letter_superseded: FileText,
  note_added: MessageSquare,
  action_created: CheckCircle2,
  action_updated: FileText,
  action_completed: CheckCircle2,
  action_deleted: AlertCircle,
  assigned: UserRound,
  priority_change: Flag,
  fos_referred: Scale,
  resolved: CheckCircle2,
  closed: Clock3,
};

export function ComplaintTimeline({ activities }: { activities: ComplaintActivity[] }) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, ComplaintActivity[]>();
    activities.forEach((activity) => {
      const key = activity.createdAt.slice(0, 10);
      const bucket = buckets.get(key) || [];
      bucket.push(activity);
      buckets.set(key, bucket);
    });
    return Array.from(buckets.entries()).map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }));
  }, [activities]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {grouped.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            No activity has been recorded yet.
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{group.date}</div>
              <div className="space-y-3">
                {group.items.map((activity) => {
                  const Icon = iconForActivity(activity);
                  return (
                    <div key={activity.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{labelForActivity(activity)}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(activity.createdAt)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{activity.description}</p>
                        {(activity.oldValue || activity.newValue || activity.performedBy) && (
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            {activity.oldValue ? <span className="rounded-full bg-slate-100 px-2 py-1">From: {activity.oldValue}</span> : null}
                            {activity.newValue ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">To: {activity.newValue}</span> : null}
                            {activity.performedBy ? <span className="rounded-full bg-slate-100 px-2 py-1">By: {activity.performedBy}</span> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function labelForActivity(activity: ComplaintActivity): string {
  const type = activity.activityType;
  switch (type) {
    case 'complaint_created':
      return 'Complaint Created';
    case 'status_change':
      return 'Status Change';
    case 'evidence_added':
      return 'Evidence Added';
    case 'evidence_updated':
      return 'Evidence Updated';
    case 'evidence_archived':
      return 'Evidence Archived';
    case 'evidence_deleted':
      return 'Evidence Deleted';
    case 'letter_generated':
      return 'Letter Generated';
    case 'letter_submitted_for_review':
      return 'Letter Submitted for Review';
    case 'letter_approved':
      return 'Letter Approved';
    case 'letter_rejected':
      return 'Letter Rejected for Rework';
    case 'letter_sent':
      return 'Letter Sent';
    case 'letter_superseded':
      return 'Letter Superseded';
    case 'note_added':
      return 'Note Added';
    case 'action_created':
      return 'Action Created';
    case 'action_updated':
      return 'Action Updated';
    case 'action_completed':
      return 'Action Completed';
    case 'action_deleted':
      return 'Action Deleted';
    case 'assigned':
      return 'Assignment Updated';
    case 'priority_change':
      return 'Priority Changed';
    case 'fos_referred':
      return 'Referred to FOS';
    case 'resolved':
      return 'Complaint Resolved';
    case 'closed':
      return 'Complaint Closed';
    default:
      return 'Activity';
  }
}

function iconForActivity(activity: ComplaintActivity) {
  return ICONS[activity.activityType] || MessageSquare;
}
