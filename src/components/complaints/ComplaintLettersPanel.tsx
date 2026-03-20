'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, LockKeyhole, Mail, Save, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComplaintLetterIntelligencePanel } from '@/components/complaints/ComplaintLetterIntelligencePanel';
import { ComplaintWorkspaceSettingsPanel } from '@/components/complaints/ComplaintWorkspaceSettingsPanel';
import {
  COMPLAINT_LETTER_TEMPLATES,
  type ComplaintLetter,
  type ComplaintLetterVersion,
  type ComplaintRecord,
  type ComplaintWorkspaceActorRole,
  type ComplaintWorkspaceSettings,
} from '@/lib/complaints/types';
import { formatDateTime } from '@/lib/utils';

const DEFAULT_SETTINGS: ComplaintWorkspaceSettings = {
  organizationName: 'MEMA Consultants',
  complaintsTeamName: 'Complaints Team',
  complaintsEmail: '',
  complaintsPhone: '',
  complaintsAddress: '',
  boardPackSubtitle: 'Board-ready complaints and ombudsman intelligence pack',
  lateReferralPosition: 'review_required',
  lateReferralCustomText: '',
  currentActorName: 'MEMA reviewer',
  currentActorRole: 'reviewer',
  letterApprovalRole: 'reviewer',
  requireIndependentReviewer: false,
  updatedAt: new Date(0).toISOString(),
};

export function ComplaintLettersPanel({
  complaint,
  letters,
  onRefresh,
}: {
  complaint: ComplaintRecord;
  letters: ComplaintLetter[];
  onRefresh: () => Promise<void>;
}) {
  const [creating, setCreating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(letters[0]?.id || null);
  const [customSubject, setCustomSubject] = useState(`Complaint correspondence - ${complaint.complaintReference}`);
  const [customRecipientName, setCustomRecipientName] = useState(complaint.complainantName);
  const [customRecipientEmail, setCustomRecipientEmail] = useState(complaint.complainantEmail || '');
  const [customBody, setCustomBody] = useState('');
  const selectedLetter = useMemo(() => letters.find((item) => item.id === selectedLetterId) || null, [letters, selectedLetterId]);
  const [editorSubject, setEditorSubject] = useState('');
  const [editorRecipientName, setEditorRecipientName] = useState('');
  const [editorRecipientEmail, setEditorRecipientEmail] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [versions, setVersions] = useState<ComplaintLetterVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ComplaintWorkspaceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!selectedLetter && letters[0]) {
      setSelectedLetterId(letters[0].id);
    }
  }, [letters, selectedLetter]);

  useEffect(() => {
    setEditorSubject(selectedLetter?.subject || '');
    setEditorRecipientName(selectedLetter?.recipientName || '');
    setEditorRecipientEmail(selectedLetter?.recipientEmail || '');
    setEditorBody(selectedLetter?.bodyText || '');
    setReviewerNotes(selectedLetter?.reviewerNotes || '');
    setApprovalNote('');
  }, [selectedLetter?.id, selectedLetter?.subject, selectedLetter?.recipientName, selectedLetter?.recipientEmail, selectedLetter?.bodyText, selectedLetter?.reviewerNotes]);

  const loadVersions = useCallback(async (letterId: string | null) => {
    if (!letterId) {
      setVersions([]);
      setVersionsError(null);
      return;
    }

    let cancelled = false;
    async function loadVersionsForLetter() {
      setVersionsLoading(true);
      setVersionsError(null);
      try {
        const response = await fetch(`/api/complaints/letters/${letterId}/versions`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load letter history.');
        }
        if (!cancelled) setVersions(Array.isArray(payload.versions) ? payload.versions : []);
      } catch (err) {
        if (!cancelled) setVersionsError(err instanceof Error ? err.message : 'Failed to load letter history.');
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    }

    await loadVersionsForLetter();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let dispose: (() => void) | void;
    void (async () => {
      dispose = await loadVersions(selectedLetterId);
    })();
    return () => {
      dispose?.();
    };
  }, [loadVersions, selectedLetterId]);

  const hasEditorChanges = useMemo(() => {
    if (!selectedLetter) return false;
    return (
      editorSubject !== selectedLetter.subject
      || editorRecipientName !== (selectedLetter.recipientName || '')
      || editorRecipientEmail !== (selectedLetter.recipientEmail || '')
      || editorBody !== selectedLetter.bodyText
      || reviewerNotes !== (selectedLetter.reviewerNotes || '')
    );
  }, [editorBody, editorRecipientEmail, editorRecipientName, editorSubject, reviewerNotes, selectedLetter]);

  async function generateTemplate(templateKey: string) {
    setCreating(templateKey);
    setError(null);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey,
          actorName: settings.currentActorName,
          actorRole: settings.currentActorRole,
          approvalRoleRequired: settings.letterApprovalRole,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to generate complaint letter.');
      setSelectedLetterId(payload.letter?.id || null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate complaint letter.');
    } finally {
      setCreating(null);
    }
  }

  async function createCustomDraft() {
    setCreating('custom');
    setError(null);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: 'custom',
          subject: customSubject,
          recipientName: customRecipientName,
          recipientEmail: customRecipientEmail,
          bodyText: customBody,
          actorName: settings.currentActorName,
          actorRole: settings.currentActorRole,
          approvalRoleRequired: settings.letterApprovalRole,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to create custom draft.');
      setSelectedLetterId(payload.letter?.id || null);
      setCustomBody('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create custom draft.');
    } finally {
      setCreating(null);
    }
  }

  async function saveLetter(nextStatus?: 'draft' | 'generated' | 'approved' | 'sent') {
    if (!selectedLetter) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/complaints/letters/${selectedLetter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editorSubject,
          recipientName: editorRecipientName,
          recipientEmail: editorRecipientEmail,
          bodyText: editorBody,
          reviewerNotes,
          status: nextStatus || selectedLetter.status,
          approvalNote,
          actorName: settings.currentActorName,
          actorRole: settings.currentActorRole,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update complaint letter.');
      setSelectedLetterId(payload.letter?.id || selectedLetter.id);
      await onRefresh();
      await loadVersions(payload.letter?.id || selectedLetter.id);
      setApprovalNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint letter.');
    } finally {
      setSaving(false);
    }
  }

  function downloadDraft(letter: ComplaintLetter) {
    const blob = new Blob([`Subject: ${letter.subject}\n\n${letter.bodyText}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${letter.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'complaint-letter'}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function appendDraftingText(text: string) {
    setEditorBody((current) => (current.trim().length > 0 ? `${current.trimEnd()}\n\n${text}` : text));
  }

  function appendReviewerNote(text: string) {
    setReviewerNotes((current) => (current.trim().length > 0 ? `${current.trimEnd()}\n\n${text}` : text));
  }

  const canApprove = useMemo(() => {
    return actorRoleRank(settings.currentActorRole) >= actorRoleRank(selectedLetter?.approvalRoleRequired || settings.letterApprovalRole);
  }, [selectedLetter?.approvalRoleRequired, settings.currentActorRole, settings.letterApprovalRole]);

  const independentReviewerBlocked = Boolean(
    selectedLetter
    && settings.requireIndependentReviewer
    && settings.currentActorName.trim()
    && settings.currentActorName.trim() === (selectedLetter.updatedBy || '').trim()
  );

  const approvalBlockReason = useMemo(() => {
    if (!selectedLetter) return null;
    if (!canApprove) {
      return `Approval requires ${selectedLetter.approvalRoleRequired} role or higher.`;
    }
    if (independentReviewerBlocked) {
      return 'Independent reviewer is required before approval.';
    }
    return null;
  }, [canApprove, independentReviewerBlocked, selectedLetter]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4" />Letter templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COMPLAINT_LETTER_TEMPLATES.filter((template) => template.key !== 'custom').map((template) => (
            <button
              key={template.key}
              onClick={() => void generateTemplate(template.key)}
              disabled={creating !== null}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{template.label}</p>
                {creating === template.key ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <FileText className="h-4 w-4 text-slate-400" />}
              </div>
              <p className="mt-2 text-xs text-slate-500">{template.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      <ComplaintWorkspaceSettingsPanel title="Correspondence profile" compact onSaved={setSettings} />

      <ComplaintLetterIntelligencePanel
        complaint={complaint}
        activeTemplateKey={selectedLetter?.templateKey || null}
        hasActiveLetter={Boolean(selectedLetter)}
        onInsertDraft={appendDraftingText}
        onInsertReviewerNote={appendReviewerNote}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Subject</span>
              <input value={customSubject} onChange={(event) => setCustomSubject(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recipient name</span>
              <input value={customRecipientName} onChange={(event) => setCustomRecipientName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recipient email</span>
            <input value={customRecipientEmail} onChange={(event) => setCustomRecipientEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Draft body</span>
            <textarea value={customBody} onChange={(event) => setCustomBody(event.target.value)} rows={8} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Write the correspondence to be stored against this complaint." />
          </label>
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => void createCustomDraft()} disabled={creating !== null || !customSubject.trim() || !customBody.trim()}>
              {creating === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create custom draft
            </Button>
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved letters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {letters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No complaint letters have been generated yet.
              </div>
            ) : letters.map((letter) => (
              <button
                key={letter.id}
                onClick={() => setSelectedLetterId(letter.id)}
                className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${selectedLetterId === letter.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{letter.subject}</p>
                  <Badge variant={letter.status === 'sent' ? 'default' : 'outline'}>{letter.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{letter.recipientName || 'No named recipient'}{letter.recipientEmail ? ` · ${letter.recipientEmail}` : ''}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDateTime(letter.createdAt)}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letter editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedLetter ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Select or generate a letter to edit and send it.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Subject</span>
                    <input value={editorSubject} onChange={(event) => setEditorSubject(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recipient name</span>
                    <input value={editorRecipientName} onChange={(event) => setEditorRecipientName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Recipient email</span>
                  <input value={editorRecipientEmail} onChange={(event) => setEditorRecipientEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Body</span>
                  <textarea value={editorBody} onChange={(event) => setEditorBody(event.target.value)} rows={14} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Internal reviewer notes
                  </span>
                  <textarea
                    value={reviewerNotes}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    placeholder="Internal-only reviewer guidance, precedent checks, and comparable-case notes."
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Approval note</span>
                  <textarea
                    value={approvalNote}
                    onChange={(event) => setApprovalNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Optional internal approval note or rationale for this version."
                  />
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Actor {settings.currentActorName}</Badge>
                    <Badge variant="outline">Role {settings.currentActorRole}</Badge>
                    <Badge variant="outline">Approval role {selectedLetter.approvalRoleRequired}</Badge>
                    {settings.requireIndependentReviewer ? <Badge variant="outline">Independent reviewer on</Badge> : null}
                  </div>
                  {approvalBlockReason ? (
                    <div className="mt-3 flex items-start gap-2 text-amber-700">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                      <span>{approvalBlockReason}</span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  <div className="flex flex-wrap gap-2">
                    <span>Template: {selectedLetter.templateKey.replace(/_/g, ' ')}</span>
                    <span>Version: v{selectedLetter.versionNumber}</span>
                    <span>Updated by: {selectedLetter.updatedBy || 'Unrecorded'}</span>
                    {selectedLetter.approvedAt ? <span>Approved: {formatDateTime(selectedLetter.approvedAt)}</span> : null}
                    {selectedLetter.approvedBy ? <span>Approved by: {selectedLetter.approvedBy}</span> : null}
                    {selectedLetter.approvedRole ? <span>Approved role: {selectedLetter.approvedRole}</span> : null}
                    {selectedLetter.sentAt ? <span>Sent: {formatDateTime(selectedLetter.sentAt)}</span> : null}
                    <span>Updated: {formatDateTime(selectedLetter.updatedAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => window.open(`/api/complaints/letters/${selectedLetter.id}?format=pdf`, '_blank', 'noopener,noreferrer')}
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => downloadDraft({ ...selectedLetter, subject: editorSubject, recipientName: editorRecipientName || null, recipientEmail: editorRecipientEmail || null, bodyText: editorBody })}>
                      <Download className="h-3.5 w-3.5" /> TXT
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void saveLetter('draft')} disabled={saving || !hasEditorChanges}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {selectedLetter.status === 'approved' || selectedLetter.status === 'sent' ? 'Create new draft' : 'Save draft'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void saveLetter('approved')}
                      disabled={saving || selectedLetter.status === 'approved' || selectedLetter.status === 'sent' || Boolean(approvalBlockReason)}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => void saveLetter('sent')}
                      disabled={saving || selectedLetter.status === 'sent' || selectedLetter.status !== 'approved' || hasEditorChanges || !canApprove}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Mark sent
                    </Button>
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Version history</p>
                      <p className="mt-1 text-xs text-slate-500">Every save, approval, and send event is recorded as a new version snapshot.</p>
                    </div>
                    {versionsLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  </div>
                  {versionsError ? <p className="mt-3 text-sm text-rose-600">{versionsError}</p> : null}
                  {!versionsLoading && versions.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No saved versions yet.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {versions.map((version) => (
                        <div key={version.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">v{version.versionNumber}</span>
                              <Badge variant={version.status === 'sent' ? 'default' : 'outline'}>{version.status}</Badge>
                            </div>
                            <span className="text-xs text-slate-500">{formatDateTime(version.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{version.subject}</p>
                          {version.snapshotReason ? <p className="mt-1 text-xs text-slate-500">{version.snapshotReason}</p> : null}
                          {version.snapshotBy || version.snapshotByRole ? <p className="mt-1 text-xs text-slate-500">By {version.snapshotBy || 'Unknown'}{version.snapshotByRole ? ` · ${version.snapshotByRole}` : ''}</p> : null}
                          {version.reviewerNotes ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white px-2 py-2 text-xs text-slate-600">{version.reviewerNotes}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function actorRoleRank(role: ComplaintWorkspaceActorRole): number {
  switch (role) {
    case 'admin':
      return 4;
    case 'manager':
      return 3;
    case 'reviewer':
      return 2;
    case 'operator':
    default:
      return 1;
  }
}
