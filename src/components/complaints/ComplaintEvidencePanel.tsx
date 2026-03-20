'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Archive, Download, Eye, FilePenLine, FileText, Loader2, Paperclip, RefreshCcw, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { COMPLAINT_EVIDENCE_CATEGORIES, type ComplaintEvidence, type ComplaintEvidencePreview } from '@/lib/complaints/types';
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
  const { user } = useAuth();
  const [items, setItems] = useState<ComplaintEvidence[]>(evidence);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(evidence[0]?.id || null);
  const [preview, setPreview] = useState<ComplaintEvidencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<typeof COMPLAINT_EVIDENCE_CATEGORIES[number]>('other');
  const [summary, setSummary] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [duplicateEvidence, setDuplicateEvidence] = useState<ComplaintEvidence | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editCategory, setEditCategory] = useState<typeof COMPLAINT_EVIDENCE_CATEGORIES[number]>('other');
  const [editSummary, setEditSummary] = useState('');

  const selectedEvidence = useMemo(
    () => items.find((item) => item.id === selectedEvidenceId) || null,
    [items, selectedEvidenceId]
  );

  const canManageEvidence = Boolean(user && ['operator', 'reviewer', 'manager', 'admin'].includes(user.role));
  const canDeleteEvidence = Boolean(user && ['manager', 'admin'].includes(user.role));
  const hasFile = Boolean(file);

  const loadEvidence = useCallback(async () => {
    const response = await fetch(`/api/complaints/${complaintId}/evidence?includeArchived=${includeArchived ? '1' : '0'}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Failed to load evidence library.');
    }
    const nextItems = Array.isArray(payload.evidence) ? payload.evidence : [];
    setItems(nextItems);
    setSelectedEvidenceId((current) => {
      if (current && nextItems.some((item: ComplaintEvidence) => item.id === current)) {
        return current;
      }
      return nextItems[0]?.id || null;
    });
  }, [complaintId, includeArchived]);

  useEffect(() => {
    if (!includeArchived) {
      setItems(evidence);
      setSelectedEvidenceId((current) => {
        if (current && evidence.some((item) => item.id === current)) {
          return current;
        }
        return evidence[0]?.id || null;
      });
    }
  }, [evidence, includeArchived]);

  useEffect(() => {
    if (includeArchived) {
      void loadEvidence().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load evidence library.'));
    }
  }, [includeArchived, loadEvidence]);

  useEffect(() => {
    const activeEvidence = selectedEvidence;
    if (!activeEvidence) {
      setPreview(null);
      setEditing(false);
      return;
    }

    setEditFileName(activeEvidence.fileName);
    setEditCategory(activeEvidence.category);
    setEditSummary(activeEvidence.summary || '');
    setEditing(false);
    const evidenceId = activeEvidence.id;

    let cancelled = false;
    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const response = await fetch(`/api/complaints/evidence/${evidenceId}?preview=1`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load evidence preview.');
        }
        if (!cancelled) setPreview(payload.preview as ComplaintEvidencePreview);
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : 'Failed to load evidence preview.');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedEvidence]);

  async function syncAfterMutation() {
    await onRefresh();
    await loadEvidence().catch(() => undefined);
  }

  async function uploadEvidence() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setStatusNotice(null);
    setDuplicateEvidence(null);
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
        if (response.status === 409 && payload.duplicateEvidence) {
          setDuplicateEvidence(payload.duplicateEvidence as ComplaintEvidence);
        }
        throw new Error(payload.error || 'Failed to upload evidence.');
      }
      setFile(null);
      setSummary('');
      setCategory('other');
      setStatusNotice('Evidence uploaded and indexed for preview.');
      const input = document.getElementById('complaint-evidence-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await syncAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload evidence.');
    } finally {
      setUploading(false);
    }
  }

  async function saveEvidenceMetadata() {
    if (!selectedEvidence) return;
    setSaving(true);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/complaints/evidence/${selectedEvidence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: editFileName,
          category: editCategory,
          summary: editSummary,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to update evidence.');
      }
      setStatusNotice('Evidence metadata updated.');
      setEditing(false);
      await syncAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update evidence.');
    } finally {
      setSaving(false);
    }
  }

  async function setArchived(archived: boolean) {
    if (!selectedEvidence) return;
    setSaving(true);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/complaints/evidence/${selectedEvidence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to update archive state.');
      }
      setStatusNotice(archived ? 'Evidence archived.' : 'Evidence restored.');
      await syncAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archive state.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvidence() {
    if (!selectedEvidence) return;
    setDeleteBusy(true);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/complaints/evidence/${selectedEvidence.id}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to delete evidence.');
      }
      setStatusNotice('Evidence deleted.');
      await syncAfterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete evidence.');
    } finally {
      setDeleteBusy(false);
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
                data-testid="evidence-file-input"
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
              data-testid="evidence-summary-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              placeholder="Explain why this file matters to the complaint or what it evidences."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {statusNotice ? <p className="text-sm text-emerald-700">{statusNotice}</p> : null}
          {duplicateEvidence ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Duplicate evidence detected. Matching file: <span className="font-semibold">{duplicateEvidence.fileName}</span>.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div>
              <p className="font-medium text-slate-800">{file ? file.name : 'Select a file to upload'}</p>
              <p>{file ? `${formatNumber(file.size)} bytes` : 'Max size 5MB. Duplicate files are detected by content hash.'}</p>
            </div>
            <Button data-testid="evidence-upload-button" className="gap-2" onClick={() => void uploadEvidence()} disabled={uploading || !hasFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload evidence
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base"><Paperclip className="h-4 w-4" />Evidence library</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={includeArchived ? 'default' : 'outline'} onClick={() => setIncludeArchived((current) => !current)}>
                {includeArchived ? 'Showing archived' : 'Active only'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void loadEvidence()}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No evidence has been uploaded for this complaint yet.
              </div>
            ) : items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`evidence-row-${item.id}`}
                onClick={() => {
                  setSelectedEvidenceId(item.id);
                  setStatusNotice(null);
                  setError(null);
                }}
                className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${selectedEvidenceId === item.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.fileName}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge variant="outline">{item.category.replace(/_/g, ' ')}</Badge>
                      {item.archivedAt ? <Badge variant="outline">archived</Badge> : null}
                      <span>{formatNumber(item.fileSize)} bytes</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                      {item.uploadedBy ? <span>By {item.uploadedBy}</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {item.previewText ? <FileText className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{item.sha256.slice(0, 8)}</span>
                  </div>
                </div>
                {item.summary ? <p className="mt-3 text-sm text-slate-600">{item.summary}</p> : null}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" />Evidence preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedEvidence ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Select an evidence item to preview and manage it.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedEvidence.fileName}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Badge data-testid="evidence-preview-category" variant="outline">{selectedEvidence.category.replace(/_/g, ' ')}</Badge>
                      {selectedEvidence.archivedAt ? <Badge variant="outline">archived</Badge> : null}
                      <span>{formatNumber(selectedEvidence.fileSize)} bytes</span>
                      <span>SHA {selectedEvidence.sha256.slice(0, 12)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/complaints/evidence/${selectedEvidence.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                    {preview?.previewKind === 'pdf' || preview?.previewKind === 'image' ? (
                      <a href={preview.inlineUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                        <Eye className="h-3.5 w-3.5" /> Open inline
                      </a>
                    ) : null}
                    {canManageEvidence ? (
                      <Button size="sm" variant="outline" onClick={() => setEditing((current) => !current)}>
                        <FilePenLine className="mr-2 h-3.5 w-3.5" /> {editing ? 'Close edit' : 'Edit'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {previewLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading evidence preview...
                  </div>
                ) : previewError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{previewError}</div>
                ) : preview ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {preview.previewKind === 'image' ? (
                      <div className="relative h-[28rem] w-full bg-slate-50">
                        <Image src={preview.inlineUrl} alt={preview.evidence.fileName} fill unoptimized className="object-contain" />
                      </div>
                    ) : null}
                    {preview.previewKind === 'pdf' ? (
                      <iframe src={preview.inlineUrl} className="h-[28rem] w-full bg-white" title={preview.evidence.fileName} />
                    ) : null}
                    {preview.previewKind === 'text' ? (
                      <pre data-testid="evidence-text-preview" className="max-h-[28rem] overflow-auto whitespace-pre-wrap px-4 py-4 text-sm text-slate-700">{preview.textPreview || 'No text preview available.'}</pre>
                    ) : null}
                    {preview.previewKind === 'download' ? (
                      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm text-slate-500">
                        <ShieldAlert className="h-8 w-8 text-slate-400" />
                        <p>Inline preview is not available for this file type.</p>
                        <a href={preview.downloadUrl} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                          <Download className="h-3.5 w-3.5" /> Download file
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {editing && selectedEvidence ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">File name</span>
                        <input data-testid="evidence-edit-file-name" value={editFileName} onChange={(event) => setEditFileName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Category</span>
                        <select data-testid="evidence-edit-category" value={editCategory} onChange={(event) => setEditCategory(event.target.value as typeof COMPLAINT_EVIDENCE_CATEGORIES[number])} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                          {COMPLAINT_EVIDENCE_CATEGORIES.map((option) => (
                            <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Summary</span>
                      <textarea data-testid="evidence-edit-summary" value={editSummary} onChange={(event) => setEditSummary(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button data-testid="evidence-save-button" size="sm" className="gap-2" onClick={() => void saveEvidenceMetadata()} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePenLine className="h-3.5 w-3.5" />} Save metadata
                      </Button>
                      <Button data-testid="evidence-archive-button" size="sm" variant="outline" className="gap-2" onClick={() => void setArchived(!Boolean(selectedEvidence.archivedAt))} disabled={saving}>
                        <Archive className="h-3.5 w-3.5" /> {selectedEvidence.archivedAt ? 'Restore' : 'Archive'}
                      </Button>
                      {canDeleteEvidence ? (
                        <Button data-testid="evidence-delete-button" size="sm" variant="outline" className="gap-2 text-rose-700" onClick={() => void deleteEvidence()} disabled={deleteBusy}>
                          {deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
