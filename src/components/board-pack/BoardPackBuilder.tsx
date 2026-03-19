'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplaintWorkspaceSettingsPanel } from '@/components/complaints/ComplaintWorkspaceSettingsPanel';
import type { BoardPackPreview } from '@/lib/board-pack/types';
import { formatDateTime, formatNumber } from '@/lib/utils';

const DEFAULT_FROM = new Date(new Date().getUTCFullYear(), 0, 1).toISOString().slice(0, 10);
const DEFAULT_TO = new Date().toISOString().slice(0, 10);

export function BoardPackBuilder() {
  const [form, setForm] = useState({
    title: 'FOS Complaints Board Pack',
    dateFrom: DEFAULT_FROM,
    dateTo: DEFAULT_TO,
    includeOperationalComplaints: true,
    includeComparison: true,
    includeRootCauseDeepDive: true,
    includeAppendix: true,
    executiveSummaryNote: '',
    boardFocusNote: '',
    actionSummaryNote: '',
  });
  const [preview, setPreview] = useState<BoardPackPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [downloading, setDownloading] = useState<'pdf' | 'pptx' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('title', form.title);
    params.set('dateFrom', form.dateFrom);
    params.set('dateTo', form.dateTo);
    params.set('includeOperationalComplaints', String(form.includeOperationalComplaints));
    params.set('includeComparison', String(form.includeComparison));
    params.set('includeRootCauseDeepDive', String(form.includeRootCauseDeepDive));
    params.set('includeAppendix', String(form.includeAppendix));
    return params.toString();
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setLoadingPreview(true);
      try {
        const response = await fetch(`/api/fos/board-pack?${previewParams}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to build board pack preview.');
        }
        if (!cancelled) setPreview(payload);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Failed to build board pack preview.');
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [previewParams]);

  async function download(format: 'pdf' | 'pptx') {
    setDownloading(format);
    setMessage(null);
    try {
      const response = await fetch('/api/fos/board-pack/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, format, firms: [], products: [], outcomes: [] }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to generate board pack.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${slugify(form.title)}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Generated ${format.toUpperCase()} board pack successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to generate board pack.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-5 md:px-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Board Pack Builder</h1>
          <p className="mt-1 text-sm text-slate-600">Generate executive-ready complaints reporting in PDF or PPTX with operational commentary and FOS intelligence metrics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void download('pdf')} disabled={downloading !== null}>
            {downloading === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} PDF pack
          </Button>
          <Button className="gap-2" onClick={() => void download('pptx')} disabled={downloading !== null}>
            {downloading === 'pptx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />} PPTX deck
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Board pack scope</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <Field label="Date from" type="date" value={form.dateFrom} onChange={(value) => setForm((current) => ({ ...current, dateFrom: value }))} />
            <Field label="Date to" type="date" value={form.dateTo} onChange={(value) => setForm((current) => ({ ...current, dateTo: value }))} />
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Executive summary note</span>
              <textarea rows={4} value={form.executiveSummaryNote} onChange={(event) => setForm((current) => ({ ...current, executiveSummaryNote: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Board focus note</span>
              <textarea rows={3} value={form.boardFocusNote} onChange={(event) => setForm((current) => ({ ...current, boardFocusNote: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Action summary note</span>
              <textarea rows={3} value={form.actionSummaryNote} onChange={(event) => setForm((current) => ({ ...current, actionSummaryNote: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <Toggle label="Include operational complaints section" checked={form.includeOperationalComplaints} onChange={(checked) => setForm((current) => ({ ...current, includeOperationalComplaints: checked }))} />
            <Toggle label="Include comparison section" checked={form.includeComparison} onChange={(checked) => setForm((current) => ({ ...current, includeComparison: checked }))} />
            <Toggle label="Include root-cause deep dive" checked={form.includeRootCauseDeepDive} onChange={(checked) => setForm((current) => ({ ...current, includeRootCauseDeepDive: checked }))} />
            <Toggle label="Include appendix" checked={form.includeAppendix} onChange={(checked) => setForm((current) => ({ ...current, includeAppendix: checked }))} />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <ComplaintWorkspaceSettingsPanel />

          <Card>
            <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-14 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : preview ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">{preview.branding.organizationName}</p>
                    <p className="mt-1">{preview.branding.subtitle || 'Board-ready complaints and ombudsman intelligence pack'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryCard label="FOS cases" value={formatNumber(preview.metrics.totalCases)} />
                    <SummaryCard label="Upheld rate" value={`${preview.metrics.upheldRate.toFixed(1)}%`} />
                    <SummaryCard label="Open complaints" value={formatNumber(preview.metrics.complaintsOpen)} />
                    <SummaryCard label="Overdue complaints" value={formatNumber(preview.metrics.overdueComplaints)} />
                    <SummaryCard label="Appendix letters" value={formatNumber(preview.metrics.appendixLetters)} />
                    <SummaryCard label="Appendix evidence" value={formatNumber(preview.metrics.appendixEvidence)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Included sections</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preview.sections.map((section) => (
                        <span key={section.key} className={`rounded-full px-3 py-1 text-xs font-semibold ${section.status === 'included' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {section.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent generated packs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(preview?.recentRuns || []).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No board packs have been generated yet.</p>
              ) : (
                preview?.recentRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{run.title}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(run.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{run.format.toUpperCase()}</span>
                      <span className={`rounded-full px-2 py-1 ${run.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{run.status}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{message}</div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1 md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'board-pack';
}
