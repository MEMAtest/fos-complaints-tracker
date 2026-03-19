'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Loader2, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ComplaintTimeline } from './ComplaintTimeline';
import { DeadlineTracker } from './DeadlineTracker';
import { QuickActions } from './QuickActions';
import type { ComplaintActivity, ComplaintRecord } from '@/lib/complaints/types';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

interface ComplaintPayload extends ComplaintRecord {
  activities?: ComplaintActivity[];
}

export function ComplaintDetailView({ complaintId }: { complaintId: string }) {
  const [complaint, setComplaint] = useState<ComplaintPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'letters'>('overview');

  const fetchComplaint = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/complaints/${complaintId}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load complaint.');
      }
      setComplaint(payload.complaint || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load complaint.');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    void fetchComplaint();
  }, [fetchComplaint]);

  const statusTone = useMemo(() => {
    switch (complaint?.status) {
      case 'resolved':
      case 'closed':
        return 'bg-emerald-100 text-emerald-700';
      case 'escalated':
      case 'referred_to_fos':
        return 'bg-rose-100 text-rose-700';
      case 'investigating':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  }, [complaint?.status]);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  if (!complaint || error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="text-lg font-semibold text-slate-900">Complaint unavailable</p>
        <p className="mt-2 text-sm text-slate-500">{error || 'This complaint record could not be found.'}</p>
        <Link href="/complaints" className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to complaints
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div>
          <Link href="/complaints" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
            <ArrowLeft className="h-4 w-4" /> Back to complaints workspace
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">{complaint.complainantName}</h1>
          <p className="mt-1 text-sm text-slate-500">Reference {complaint.complaintReference} · {complaint.firmName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={statusTone}>{complaint.status.replace(/_/g, ' ')}</Badge>
          <Badge variant="outline">{complaint.priority}</Badge>
          {complaint.fosReferred ? <Badge className="bg-rose-100 text-rose-700"><Scale className="mr-1 h-3.5 w-3.5" />FOS referred</Badge> : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.75fr_0.95fr]">
        <div className="space-y-5">
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {(['overview', 'timeline', 'letters'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {tab === 'letters' ? 'Letters & Responses' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Complaint Snapshot</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  <Row label="Received" value={formatDate(complaint.receivedDate)} />
                  <Row label="Product" value={complaint.product || 'Unspecified'} />
                  <Row label="Assigned owner" value={complaint.assignedTo || 'Unassigned'} />
                  <Row label="Root cause" value={complaint.rootCause || 'Not yet classified'} />
                  <Row label="Updated" value={formatDateTime(complaint.updatedAt)} />
                  {complaint.linkedFosCaseId ? <Row label="Linked FOS case" value={complaint.linkedFosCaseId} /> : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Narrative</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-600">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Description</p>
                    <p className="mt-1 whitespace-pre-line">{complaint.description || 'No complaint narrative has been captured yet.'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resolution</p>
                    <p className="mt-1 whitespace-pre-line">{complaint.resolution || 'No final resolution has been recorded yet.'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Compensation / redress</p>
                    <p className="mt-1">{complaint.compensationAmount != null ? `£${formatNumber(complaint.compensationAmount)}` : 'No redress recorded'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {activeTab === 'timeline' ? <ComplaintTimeline activities={complaint.activities || []} /> : null}

          {activeTab === 'letters' ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Letters & response workflow</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm text-slate-600">
                <p>
                  This first implementation anchors the letters tab around timeline, deadlines, and complaint resolution. The next step is to store generated holding letters and final responses as first-class complaint artifacts.
                </p>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Use the quick actions rail to add a management note or update status. Those actions are already logged into the complaint timeline.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <DeadlineTracker
            receivedDate={complaint.receivedDate}
            fourWeekDueDate={complaint.fourWeekDueDate}
            eightWeekDueDate={complaint.eightWeekDueDate}
            finalResponseDate={complaint.finalResponseDate}
            resolvedDate={complaint.resolvedDate}
          />
          <QuickActions complaint={complaint} onRefresh={fetchComplaint} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}
