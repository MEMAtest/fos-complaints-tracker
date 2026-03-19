'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2, Paperclip, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { COMPLAINT_EVIDENCE_CATEGORIES, type ComplaintEvidence } from '@/lib/complaints/types';
import { formatDateTime, formatNumber } from '@/lib/utils';

export function ComplaintEvidencePanel({
  complaintId,
  evidence,
  onRefresh,
}: {
  complaintId: string;
  evidence: ComplaintEvidence[];
  onRefresh: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<typeof COMPLAINT_EVIDENCE_CATEGORIES[number]>('other');
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFile = useMemo(() => Boolean(file), [file]);

  async function uploadEvidence() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('category', category);
      if (summary.trim()) form.set('summary', summary.trim());
      const response = await fetch(`/api/complaints/${complaintId}/evidence`, {
        method: 'POST',
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to upload evidence.');
      }
      setFile(null);
      setSummary('');
      setCategory('other');
      const input = document.getElementById('complaint-evidence-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload evidence.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-4 w-4" />Add complaint evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Evidence file</span>
              <input
                id="complaint-evidence-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as typeof COMPLAINT_EVIDENCE_CATEGORIES[number])} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {COMPLAINT_EVIDENCE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Summary / relevance</span>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              placeholder="Explain why this file matters to the complaint or what it evidences."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">{file ? file.name : 'Select a file to upload'}</p>
              <p>{file ? `${formatNumber(file.size)} bytes` : 'Max size 5MB. Stored against the complaint record for later review.'}</p>
            </div>
            <Button className="gap-2" onClick={() => void uploadEvidence()} disabled={uploading || !hasFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload evidence
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Paperclip className="h-4 w-4" />Evidence library</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {evidence.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No evidence has been uploaded for this complaint yet.
            </div>
          ) : evidence.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.fileName}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <Badge variant="outline">{item.category.replace(/_/g, ' ')}</Badge>
                    <span>{formatNumber(item.fileSize)} bytes</span>
                    <span>{formatDateTime(item.createdAt)}</span>
                    {item.uploadedBy ? <span>By {item.uploadedBy}</span> : null}
                  </div>
                </div>
                <a
                  href={`/api/complaints/evidence/${item.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>
              {item.summary ? <p className="mt-3 text-sm text-slate-600">{item.summary}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
