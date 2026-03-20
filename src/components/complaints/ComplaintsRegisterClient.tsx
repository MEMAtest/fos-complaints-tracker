'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2, Plus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ComplaintFormDialog } from './ComplaintFormDialog';
import type { ComplaintFilters, ComplaintListResult, ComplaintRecord } from '@/lib/complaints/types';
import { formatDate, formatNumber } from '@/lib/utils';

const DEFAULT_FILTERS: ComplaintFilters = {
  query: '',
  status: 'all',
  priority: 'all',
  firm: '',
  product: '',
  assignedTo: '',
  reviewer: '',
  letterStatus: 'all',
  hasEvidence: 'all',
  slaState: 'all',
  fosReferred: 'all',
  page: 1,
  pageSize: 20,
};

export function ComplaintsRegisterClient() {
  const [filters, setFilters] = useState<ComplaintFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<ComplaintListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ComplaintRecord | null>(null);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.set('query', filters.query);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.priority !== 'all') params.set('priority', filters.priority);
      if (filters.firm) params.set('firm', filters.firm);
      if (filters.product) params.set('product', filters.product);
      if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
      if (filters.reviewer) params.set('reviewer', filters.reviewer);
      if (filters.letterStatus !== 'all') params.set('letterStatus', filters.letterStatus);
      if (filters.hasEvidence !== 'all') params.set('hasEvidence', filters.hasEvidence);
      if (filters.slaState !== 'all') params.set('slaState', filters.slaState);
      if (filters.fosReferred !== 'all') params.set('fosReferred', filters.fosReferred);
      params.set('page', String(filters.page));
      params.set('pageSize', String(filters.pageSize));
      const response = await fetch(`/api/complaints?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch complaints.');
      }
      setData({
        records: payload.records || [],
        total: payload.total || 0,
        page: payload.page || filters.page,
        pageSize: payload.pageSize || filters.pageSize,
        totalPages: payload.totalPages || 1,
        stats: payload.stats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch complaints.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const firms = useMemo(() => Array.from(new Set((data?.records || []).map((record) => record.firmName))).sort((a, b) => a.localeCompare(b)), [data?.records]);
  const products = useMemo(() => Array.from(new Set((data?.records || []).map((record) => record.product).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [data?.records]);
  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('query', filters.query);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters.firm) params.set('firm', filters.firm);
    if (filters.product) params.set('product', filters.product);
    if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters.reviewer) params.set('reviewer', filters.reviewer);
    if (filters.letterStatus !== 'all') params.set('letterStatus', filters.letterStatus);
    if (filters.hasEvidence !== 'all') params.set('hasEvidence', filters.hasEvidence);
    if (filters.slaState !== 'all') params.set('slaState', filters.slaState);
    if (filters.fosReferred !== 'all') params.set('fosReferred', filters.fosReferred);
    return `/api/complaints/export?${params.toString()}`;
  }, [filters]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-5 md:px-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Complaints Workspace</h1>
          <p className="mt-1 text-sm text-slate-600">Operational complaints register, timeline tracking, and management actions alongside the FOS analytics product.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/imports/complaints" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300">
            <Upload className="h-4 w-4" /> Bulk import
          </Link>
          <Link data-testid="complaints-export" href={exportHref} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300">
            <Download className="h-4 w-4" /> Export CSV
          </Link>
          <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add complaint
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total complaints" value={formatNumber(data?.stats.totalComplaints || 0)} helper="Operational complaints records in workspace." />
        <MetricCard label="Open complaints" value={formatNumber(data?.stats.openComplaints || 0)} helper="Still in active workflow." />
        <MetricCard label="FOS referred" value={formatNumber(data?.stats.referredToFos || 0)} helper="Marked as escalated to FOS." />
        <MetricCard label="Overdue" value={formatNumber(data?.stats.overdueComplaints || 0)} helper="Past 8-week response deadline." />
        <MetricCard label="Due within 7 days" value={formatNumber(data?.stats.dueSoonComplaints || 0)} helper="Approaching 8-week deadline." />
        <MetricCard label="Urgent" value={formatNumber(data?.stats.urgentComplaints || 0)} helper="Priority tagged urgent." />
        <MetricCard label="Open actions" value={formatNumber(data?.stats.openActions || 0)} helper="Management and SLA actions still open." />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6 xl:grid-cols-8">
          <label className="relative md:col-span-2 xl:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              data-testid="complaints-query"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value, page: 1 }))}
              placeholder="Search complaint, notes, letters, evidence, owner"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ComplaintFilters['status'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="escalated">Escalated</option>
            <option value="referred_to_fos">Referred to FOS</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as ComplaintFilters['priority'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select value={filters.fosReferred} onChange={(event) => setFilters((current) => ({ ...current, fosReferred: event.target.value as ComplaintFilters['fosReferred'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All FOS states</option>
            <option value="yes">FOS referred</option>
            <option value="no">Not referred</option>
          </select>
          <select data-testid="complaints-letter-status" value={filters.letterStatus} onChange={(event) => setFilters((current) => ({ ...current, letterStatus: event.target.value as ComplaintFilters['letterStatus'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All letter states</option>
            <option value="draft">Draft</option>
            <option value="generated">Generated</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected_for_rework">Rejected for rework</option>
            <option value="sent">Sent</option>
          </select>
          <select data-testid="complaints-has-evidence" value={filters.hasEvidence} onChange={(event) => setFilters((current) => ({ ...current, hasEvidence: event.target.value as ComplaintFilters['hasEvidence'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All evidence states</option>
            <option value="yes">Has evidence</option>
            <option value="no">No evidence</option>
          </select>
          <select data-testid="complaints-sla-state" value={filters.slaState} onChange={(event) => setFilters((current) => ({ ...current, slaState: event.target.value as ComplaintFilters['slaState'], page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All SLA states</option>
            <option value="on_track">On track</option>
            <option value="due_soon">Due soon</option>
            <option value="overdue">Overdue</option>
            <option value="closed">Closed</option>
          </select>
          <select value={filters.firm} onChange={(event) => setFilters((current) => ({ ...current, firm: event.target.value, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All firms</option>
            {firms.map((firm) => <option key={firm} value={firm}>{firm}</option>)}
          </select>
          <select value={filters.product} onChange={(event) => setFilters((current) => ({ ...current, product: event.target.value, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All products</option>
            {products.map((product) => <option key={product} value={product}>{product}</option>)}
          </select>
          <input value={filters.assignedTo} onChange={(event) => setFilters((current) => ({ ...current, assignedTo: event.target.value, page: 1 }))} placeholder="Filter by owner" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input value={filters.reviewer} onChange={(event) => setFilters((current) => ({ ...current, reviewer: event.target.value, page: 1 }))} placeholder="Filter by reviewer" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <div className="md:col-span-6 xl:col-span-8 flex justify-end">
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Complaints Register</h2>
            <p className="text-sm text-slate-500">{data ? `${formatNumber(data.total)} complaints matched the current filters.` : 'Loading complaints register.'}</p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-3 px-6 py-8 text-slate-400">
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading complaints register</div>
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="space-y-3 px-6 py-12 text-sm">
            <p className="font-semibold text-rose-600">Unable to load complaints workspace.</p>
            <p className="text-slate-500">{error}</p>
            <div>
              <Button variant="outline" onClick={() => void fetchComplaints()}>Retry</Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Complainant</TableHead>
                  <TableHead>Firm</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Letters</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>FOS</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.records || []).map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium text-slate-900">{record.complaintReference}</TableCell>
                    <TableCell>{record.complainantName}</TableCell>
                    <TableCell>{record.firmName}</TableCell>
                    <TableCell><Badge className="bg-slate-100 text-slate-700">{record.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{record.priority}</Badge></TableCell>
                    <TableCell>{formatDate(record.receivedDate)}</TableCell>
                    <TableCell>{record.slaSummary?.state ? record.slaSummary.state.replace(/_/g, ' ') : 'n/a'}</TableCell>
                    <TableCell>
                      {record.latestLetterStatus ? (
                        <div className="space-y-1">
                          <Badge variant="outline">{record.latestLetterStatus.replace(/_/g, ' ')}</Badge>
                          {record.latestReviewedBy ? <p className="text-xs text-slate-500">Reviewer: {record.latestReviewedBy}</p> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No letters</span>
                      )}
                    </TableCell>
                    <TableCell>{record.evidenceCount || 0}</TableCell>
                    <TableCell>{record.fosReferred ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(record); setDialogOpen(true); }}>Edit</Button>
                        <Link href={`/complaints/${record.id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-12 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="text-base font-semibold text-slate-900">No complaints matched the current filter set.</p>
                        <p className="text-sm text-slate-500">Try widening the search, clearing one of the workflow filters, or import a new complaints file.</p>
                        <div className="flex justify-center gap-2">
                          <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>
                          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>Add complaint</Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        )}

        {data ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
            <span>Page {data.page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={data.page <= 1}>Previous</Button>
              <Button variant="outline" size="sm" onClick={() => setFilters((current) => ({ ...current, page: Math.min(data.totalPages, current.page + 1) }))} disabled={data.page >= data.totalPages}>Next</Button>
            </div>
          </div>
        ) : null}
      </section>

      <ComplaintFormDialog open={dialogOpen} onOpenChange={setDialogOpen} record={editing} onSaved={fetchComplaints} />
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}
