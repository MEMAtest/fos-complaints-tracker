'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ComplaintImportPreviewResponse, ComplaintImportRun } from '@/lib/complaints/types';
import { formatDateTime } from '@/lib/utils';

export function ComplaintImportPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ComplaintImportPreviewResponse | null>(null);
  const [runs, setRuns] = useState<ComplaintImportRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readyRows = useMemo(() => preview?.rows.filter((row) => row.action === 'new' || row.action === 'overwrite') || [], [preview]);

  async function loadRuns() {
    const response = await fetch('/api/complaints/import-runs');
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setRuns(payload.runs || []);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  async function send(previewOnly: boolean) {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('preview', previewOnly ? 'true' : 'false');
      const response = await fetch('/api/complaints/import', { method: 'POST', body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Import request failed.');
      }
      if (previewOnly) {
        setPreview(payload);
        setMessage(`${payload.summary.validRows} row(s) ready to import.`);
      } else {
        setMessage(`Import completed: ${payload.importedCount} new, ${payload.overwrittenCount} overwritten, ${payload.skippedCount} skipped.`);
        setPreview(null);
        setFile(null);
        await loadRuns();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 py-5 md:px-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Complaints Bulk Import</h1>
        <p className="mt-1 text-sm text-slate-600">Upload a CSV or Excel complaints file, preview what will change, then commit the import once overwrite risk is clear.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload and preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <FileUp className="h-8 w-8 text-slate-400" />
            <p className="mt-4 text-sm font-semibold text-slate-900">Drop a complaints CSV/XLSX here or click to choose a file</p>
            <p className="mt-1 text-xs text-slate-500">Supported formats: .csv, .xlsx, .xls</p>
            <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>{file ? `Selected: ${file.name}` : 'No file selected'}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => { setFile(null); setPreview(null); }} disabled={loading}>Clear</Button>
              <Button onClick={() => void send(true)} disabled={!file || loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Preview import
              </Button>
            </div>
          </div>

          {message ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p> : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirm import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-5">
              <SummaryChip label="Total rows" value={String(preview.summary.totalRows)} />
              <SummaryChip label="Valid" value={String(preview.summary.validRows)} />
              <SummaryChip label="New" value={String(preview.summary.newCount)} tone="emerald" />
              <SummaryChip label="Overwrite" value={String(preview.summary.overwriteCount)} tone="amber" />
              <SummaryChip label="Invalid / duplicate" value={String(preview.summary.invalidCount + preview.summary.duplicateCount)} tone="rose" />
            </div>
            {preview.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {preview.warnings.join(' ')}
              </div>
            ) : null}
            <div className="max-h-[420px] overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.complaintReference || 'no-ref'}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.rowNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.complaintReference || 'Missing reference'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.action === 'new' ? 'bg-emerald-100 text-emerald-700' : row.action === 'overwrite' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{row.action.replace(/_/g, ' ')}</span></td>
                      <td className="px-4 py-3 text-slate-500">{row.issues.length > 0 ? row.issues.join(' ') : 'Ready to import'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={loading}>Cancel</Button>
              <Button onClick={() => void send(false)} disabled={loading || readyRows.length === 0}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Commit ${readyRows.length} row(s)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent import runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No complaint imports have been recorded yet.</p>
          ) : runs.map((run) => (
            <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{run.fileName}</p>
                <p className="text-xs text-slate-500">{formatDateTime(run.createdAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-1">{run.status}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">Imported {run.importedCount}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">Overwritten {run.overwrittenCount}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">Skipped {run.skippedCount}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryChip({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
