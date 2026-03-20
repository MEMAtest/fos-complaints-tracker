'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileText, Loader2, LockKeyhole, Mail, Save, Send } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComplaintLetterIntelligencePanel } from '@/components/complaints/ComplaintLetterIntelligencePanel';
import { ComplaintWorkspaceSettingsPanel } from '@/components/complaints/ComplaintWorkspaceSettingsPanel';
import {
  composeComplaintLetterBodyFromStructuredState,
  getComplaintLetterStructuredEditorState,
  type ComplaintLetterDecisionPath,
  type ComplaintLetterStructuredSection,
} from '@/lib/complaints/letter-templates';
import {
  COMPLAINT_LETTER_REVIEW_DECISION_CODES,
  COMPLAINT_LETTER_TEMPLATES,
  type ComplaintLetter,
  type ComplaintLetterStatus,
  type ComplaintLetterReviewDecisionCode,
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
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
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
  const [structuredSections, setStructuredSections] = useState<ComplaintLetterStructuredSection[]>([]);
  const [structuredDecisionPath, setStructuredDecisionPath] = useState<ComplaintLetterDecisionPath | null>(null);
  const [structuredLockedLabels, setStructuredLockedLabels] = useState<string[]>([]);
  const [structuredTemplateMode, setStructuredTemplateMode] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [reviewDecisionCode, setReviewDecisionCode] = useState<ComplaintLetterReviewDecisionCode>('ready_to_issue');
  const [versions, setVersions] = useState<ComplaintLetterVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ComplaintWorkspaceSettings>(DEFAULT_SETTINGS);
  const { user, loading: userLoading } = useAuth();
  const currentActorName = user?.fullName || 'Signed-out user';
  const currentActorRole = user?.role || 'viewer';
  const isSignedIn = Boolean(user);

  useEffect(() => {
    if (!selectedLetter && letters[0]) {
      setSelectedLetterId(letters[0].id);
    }
  }, [letters, selectedLetter]);

  useEffect(() => {
    const structuredState = selectedLetter
      ? getComplaintLetterStructuredEditorState(
          complaint,
          selectedLetter.templateKey,
          settings,
          selectedLetter.bodyText,
          selectedLetter.recipientName || complaint.complainantName
        )
      : null;

    setEditorSubject(selectedLetter?.subject || '');
    setEditorRecipientName(selectedLetter?.recipientName || '');
    setEditorRecipientEmail(selectedLetter?.recipientEmail || '');
    setEditorBody(selectedLetter?.bodyText || '');
    setStructuredSections(structuredState?.sections || []);
    setStructuredDecisionPath(structuredState?.decisionPath || null);
    setStructuredLockedLabels(structuredState?.lockedSectionLabels || []);
    setStructuredTemplateMode(Boolean(structuredState));
    setReviewerNotes(selectedLetter?.reviewerNotes || '');
    setApprovalNote(selectedLetter?.reviewDecisionNote || '');
    setReviewDecisionCode(selectedLetter?.reviewDecisionCode || 'ready_to_issue');
  }, [complaint, selectedLetter, settings]);

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

  const effectiveEditorBody = useMemo(() => {
    if (!selectedLetter || !structuredTemplateMode) {
      return editorBody;
    }

    return composeComplaintLetterBodyFromStructuredState(
      complaint,
      selectedLetter.templateKey,
      settings,
      editorRecipientName || complaint.complainantName,
      {
        templateKey: selectedLetter.templateKey,
        sections: structuredSections,
        lockedSectionLabels: structuredLockedLabels,
        decisionPath: structuredDecisionPath,
      }
    );
  }, [complaint, editorBody, editorRecipientName, selectedLetter, settings, structuredDecisionPath, structuredLockedLabels, structuredSections, structuredTemplateMode]);

  const hasEditorChanges = useMemo(() => {
    if (!selectedLetter) return false;
    return (
      editorSubject !== selectedLetter.subject
      || editorRecipientName !== (selectedLetter.recipientName || '')
      || editorRecipientEmail !== (selectedLetter.recipientEmail || '')
      || effectiveEditorBody !== selectedLetter.bodyText
      || reviewerNotes !== (selectedLetter.reviewerNotes || '')
    );
  }, [editorRecipientEmail, editorRecipientName, editorSubject, effectiveEditorBody, reviewerNotes, selectedLetter]);

  async function generateTemplate(templateKey: string) {
    setCreating(templateKey);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/complaints/${complaint.id}/letters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey,
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
    setStatusNotice(null);
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

  async function saveLetter(nextStatus?: 'draft' | 'generated' | 'under_review' | 'approved' | 'rejected_for_rework' | 'sent') {
    if (!selectedLetter) return;
    setSaving(true);
    setError(null);
    setStatusNotice(null);
    try {
      const response = await fetch(`/api/complaints/letters/${selectedLetter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editorSubject,
          recipientName: editorRecipientName,
          recipientEmail: editorRecipientEmail,
          bodyText: effectiveEditorBody,
          reviewerNotes,
          status: nextStatus || selectedLetter.status,
          approvalNote,
          reviewDecisionCode,
          reviewDecisionNote: approvalNote,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update complaint letter.');
      setSelectedLetterId(payload.letter?.id || selectedLetter.id);
      await onRefresh();
      await loadVersions(payload.letter?.id || selectedLetter.id);
      setApprovalNote('');
      setStatusNotice(getLetterActionNotice(nextStatus || selectedLetter.status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint letter.');
    } finally {
      setSaving(false);
    }
  }

  function downloadDraft(letter: ComplaintLetter) {
    const blob = new Blob([`Subject: ${letter.subject}\n\n${effectiveEditorBody}`], { type: 'text/plain;charset=utf-8' });
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
    if (structuredTemplateMode) {
      setStructuredSections((current) => {
        const fallbackKey = selectedLetter?.templateKey === 'final_response' ? 'decision_reasons' : current[0]?.key;
        if (!fallbackKey) return current;
        return current.map((section) => (
          section.key === fallbackKey
            ? { ...section, value: section.value.trim().length > 0 ? `${section.value.trimEnd()}\n\n${text}` : text }
            : section
        ));
      });
      return;
    }
    setEditorBody((current) => (current.trim().length > 0 ? `${current.trimEnd()}\n\n${text}` : text));
  }

  function appendReviewerNote(text: string) {
    setReviewerNotes((current) => (current.trim().length > 0 ? `${current.trimEnd()}\n\n${text}` : text));
  }

  const canApprove = useMemo(() => {
    return actorRoleRank(currentActorRole) >= actorRoleRank(selectedLetter?.approvalRoleRequired || settings.letterApprovalRole);
  }, [currentActorRole, selectedLetter?.approvalRoleRequired, settings.letterApprovalRole]);

  const independentReviewerBlocked = Boolean(
    selectedLetter
    && settings.requireIndependentReviewer
    && currentActorName.trim()
    && currentActorName.trim() === (selectedLetter.updatedBy || '').trim()
  );

  const approvalBlockReason = useMemo(() => {
    if (!selectedLetter) return null;
    if (!canApprove) {
      return `Review decisions require ${selectedLetter.approvalRoleRequired} role or higher.`;
    }
    if (independentReviewerBlocked) {
      return 'Independent reviewer is required before review signoff.';
    }
    return null;
  }, [canApprove, independentReviewerBlocked, selectedLetter]);

  const previousVersion = useMemo(() => {
    if (!selectedLetter || versions.length < 2) return null;
    const priorVersion = versions.find((version) => version.versionNumber < selectedLetter.versionNumber);
    return priorVersion || null;
  }, [selectedLetter, versions]);

  const diffRows = useMemo(() => buildLineDiff(previousVersion?.bodyText || '', effectiveEditorBody), [effectiveEditorBody, previousVersion?.bodyText]);

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
              disabled={creating !== null || !isSignedIn}
              data-testid={`letter-template-${template.key}`}
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
            <Button className="gap-2" onClick={() => void createCustomDraft()} disabled={creating !== null || !customSubject.trim() || !customBody.trim() || !isSignedIn}>
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
                onClick={() => {
                  setStatusNotice(null);
                  setSelectedLetterId(letter.id);
                }}
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
                {structuredTemplateMode ? (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Template-controlled editor</p>
                        <p className="mt-1 text-xs text-slate-500">Only the case-specific sections below are editable. Regulatory/FOS rights wording is preserved when the letter is rebuilt.</p>
                      </div>
                      <Badge variant="outline">Locked: {structuredLockedLabels.join(', ') || 'standard wording'}</Badge>
                    </div>

                    {selectedLetter?.templateKey === 'final_response' ? (
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Decision position</span>
                        <select
                          data-testid="letter-decision-path"
                          value={structuredDecisionPath || 'other'}
                          onChange={(event) => setStructuredDecisionPath(event.target.value as ComplaintLetterDecisionPath)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="upheld">Upheld</option>
                          <option value="not_upheld">Not upheld</option>
                          <option value="partially_upheld">Partially upheld</option>
                          <option value="other">Custom / other</option>
                        </select>
                      </label>
                    ) : null}

                    <div className="space-y-4">
                      {structuredSections.map((section) => (
                        <label key={section.key} className="block text-sm">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{section.label}</span>
                          <textarea
                            data-testid={`letter-section-${section.key}`}
                            value={section.value}
                            onChange={(event) => setStructuredSections((current) => current.map((item) => item.key === section.key ? { ...item, value: event.target.value } : item))}
                            rows={section.key === 'decision_reasons' ? 7 : 4}
                            placeholder={section.placeholder}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Composed preview</p>
                      <pre data-testid="letter-composed-preview" className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-slate-700">{effectiveEditorBody}</pre>
                    </div>
                  </section>
                ) : (
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Body</span>
                    <textarea data-testid="letter-body" value={editorBody} onChange={(event) => setEditorBody(event.target.value)} rows={14} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Internal reviewer notes
                  </span>
                  <textarea
                    data-testid="letter-reviewer-notes"
                    value={reviewerNotes}
                    onChange={(event) => setReviewerNotes(event.target.value)}
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    placeholder="Internal-only reviewer guidance, precedent checks, and comparable-case notes."
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reviewer decision code</span>
                    <select
                      data-testid="letter-review-decision-code"
                      value={reviewDecisionCode}
                      onChange={(event) => setReviewDecisionCode(event.target.value as ComplaintLetterReviewDecisionCode)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {COMPLAINT_LETTER_REVIEW_DECISION_CODES.map((code) => (
                        <option key={code} value={code}>{code.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm md:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reviewer decision note</span>
                    <textarea
                      data-testid="letter-review-decision-note"
                      value={approvalNote}
                      onChange={(event) => setApprovalNote(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Required for approve/reject actions. Capture signoff rationale or rework direction."
                    />
                  </label>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="letter-current-status">Status {selectedLetter.status}</Badge>
                    <Badge variant="outline">Actor {currentActorName}</Badge>
                    <Badge variant="outline">Role {currentActorRole}</Badge>
                    <Badge variant="outline">Approval role {selectedLetter.approvalRoleRequired}</Badge>
                    {settings.requireIndependentReviewer ? <Badge variant="outline">Independent reviewer on</Badge> : null}
                  </div>
                  {statusNotice ? (
                    <div className="mt-3 flex items-start gap-2 text-emerald-700" data-testid="letter-status-notice">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
                      <span>{statusNotice}</span>
                    </div>
                  ) : null}
                  {!isSignedIn && !userLoading ? (
                    <div className="mt-3 flex items-start gap-2 text-rose-700">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
                      <span>Sign in to edit, approve, or send complaint letters.</span>
                    </div>
                  ) : null}
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
                    {selectedLetter.reviewedAt ? <span>Reviewed: {formatDateTime(selectedLetter.reviewedAt)}</span> : null}
                    {selectedLetter.reviewedBy ? <span>Reviewed by: {selectedLetter.reviewedBy}</span> : null}
                    {selectedLetter.reviewedRole ? <span>Reviewed role: {selectedLetter.reviewedRole}</span> : null}
                    {selectedLetter.reviewDecisionCode ? <span>Decision code: {selectedLetter.reviewDecisionCode.replace(/_/g, ' ')}</span> : null}
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
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => void saveLetter('draft')} disabled={saving || !hasEditorChanges || !isSignedIn} data-testid="letter-save-draft">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {['approved', 'sent', 'under_review'].includes(selectedLetter.status) ? 'Create new draft' : 'Save draft'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void saveLetter('under_review')}
                      disabled={saving || !isSignedIn || selectedLetter.status === 'under_review' || selectedLetter.status === 'sent'}
                      data-testid="letter-submit-review"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      Submit for review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void saveLetter('approved')}
                      disabled={saving || selectedLetter.status === 'approved' || selectedLetter.status === 'sent' || !['under_review', 'rejected_for_rework'].includes(selectedLetter.status) || Boolean(approvalBlockReason) || !approvalNote.trim() || !isSignedIn}
                      data-testid="letter-approve"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void saveLetter('rejected_for_rework')}
                      disabled={saving || !['under_review', 'rejected_for_rework'].includes(selectedLetter.status) || Boolean(approvalBlockReason) || !approvalNote.trim() || !isSignedIn}
                      data-testid="letter-reject"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      Reject to rework
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => void saveLetter('sent')}
                      disabled={saving || selectedLetter.status === 'sent' || selectedLetter.status !== 'approved' || hasEditorChanges || !canApprove || !isSignedIn}
                      data-testid="letter-send"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Mark sent
                    </Button>
                  </div>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4" data-testid="letter-diff">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Reviewer diff</p>
                      <p className="mt-1 text-xs text-slate-500">Compare the current draft body against the previous saved version before approval.</p>
                    </div>
                    {previousVersion ? (
                      <Badge variant="outline">Comparing v{selectedLetter.versionNumber} to v{previousVersion.versionNumber}</Badge>
                    ) : (
                      <Badge variant="outline">First saved version</Badge>
                    )}
                  </div>
                  {previousVersion ? (
                    <div className="mt-3 space-y-2">
                      {diffRows.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">No body text changes since the previous version.</div>
                      ) : (
                        diffRows.map((row, index) => (
                          <div
                            key={`${row.type}-${index}-${row.text}`}
                            className={`rounded-xl px-3 py-2 text-sm ${
                              row.type === 'added'
                                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                                : row.type === 'removed'
                                  ? 'border border-rose-200 bg-rose-50 text-rose-800'
                                  : 'border border-slate-200 bg-slate-50 text-slate-600'
                            }`}
                          >
                            <span className="mr-2 font-semibold">{row.type === 'added' ? '+' : row.type === 'removed' ? '-' : '='}</span>
                            <span className="whitespace-pre-wrap">{row.text || ' '}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Generate or save at least two versions to review line changes.
                    </div>
                  )}
                </section>

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

function actorRoleRank(role: ComplaintWorkspaceActorRole | 'viewer'): number {
  switch (role) {
    case 'admin':
      return 5;
    case 'manager':
      return 4;
    case 'reviewer':
      return 3;
    case 'operator':
      return 2;
    case 'viewer':
    default:
      return 1;
  }
}

function buildLineDiff(previousText: string, currentText: string): Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> {
  const previousLines = previousText.split('\n');
  const currentLines = currentText.split('\n');
  const maxLength = Math.max(previousLines.length, currentLines.length);
  const rows: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }> = [];

  for (let index = 0; index < maxLength; index += 1) {
    const previousLine = previousLines[index] ?? null;
    const currentLine = currentLines[index] ?? null;

    if (previousLine === currentLine && previousLine !== null) {
      rows.push({ type: 'unchanged', text: previousLine });
      continue;
    }
    if (previousLine !== null) {
      rows.push({ type: 'removed', text: previousLine });
    }
    if (currentLine !== null) {
      rows.push({ type: 'added', text: currentLine });
    }
  }

  return rows.slice(0, 80);
}

function getLetterActionNotice(status: ComplaintLetterStatus): string {
  switch (status) {
    case 'under_review':
      return 'Submitted for reviewer signoff.';
    case 'approved':
      return 'Letter approved and ready to issue.';
    case 'rejected_for_rework':
      return 'Letter returned for rework.';
    case 'sent':
      return 'Letter marked as sent.';
    case 'draft':
      return 'Draft saved.';
    case 'generated':
      return 'Letter updated.';
    case 'superseded':
      return 'Letter superseded.';
    default:
      return 'Letter updated.';
  }
}
