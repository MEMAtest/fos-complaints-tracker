'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ComplaintWorkspaceSettings } from '@/lib/complaints/types';

const DEFAULT_SETTINGS: ComplaintWorkspaceSettings = {
  organizationName: 'MEMA Consultants',
  complaintsTeamName: 'Complaints Team',
  complaintsEmail: '',
  complaintsPhone: '',
  complaintsAddress: '',
  boardPackSubtitle: 'Board-ready complaints and ombudsman intelligence pack',
  lateReferralPosition: 'review_required',
  lateReferralCustomText: '',
  updatedAt: new Date(0).toISOString(),
};

export function ComplaintWorkspaceSettingsPanel({
  title = 'Brand and correspondence policy',
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  const [settings, setSettings] = useState<ComplaintWorkspaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/complaints/settings');
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to load settings.');
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, ...(payload.settings || {}) });
          setMessage(null);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Failed to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/complaints/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to save settings.');
      setSettings({ ...DEFAULT_SETTINGS, ...(payload.settings || {}) });
      setMessage('Saved brand and policy settings.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className={`grid gap-4 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-2'}`}>
              <Field label="Organisation name" value={settings.organizationName} onChange={(value) => setSettings((current) => ({ ...current, organizationName: value }))} />
              <Field label="Complaints team name" value={settings.complaintsTeamName} onChange={(value) => setSettings((current) => ({ ...current, complaintsTeamName: value }))} />
              <Field label="Complaints email" value={settings.complaintsEmail || ''} onChange={(value) => setSettings((current) => ({ ...current, complaintsEmail: value }))} />
              <Field label="Complaints phone" value={settings.complaintsPhone || ''} onChange={(value) => setSettings((current) => ({ ...current, complaintsPhone: value }))} />
            </div>
            <Field label="Board pack subtitle" value={settings.boardPackSubtitle || ''} onChange={(value) => setSettings((current) => ({ ...current, boardPackSubtitle: value }))} />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Complaints address</span>
              <textarea
                rows={compact ? 2 : 3}
                value={settings.complaintsAddress || ''}
                onChange={(event) => setSettings((current) => ({ ...current, complaintsAddress: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Late-referral policy</span>
              <select
                value={settings.lateReferralPosition}
                onChange={(event) => setSettings((current) => ({ ...current, lateReferralPosition: event.target.value as ComplaintWorkspaceSettings['lateReferralPosition'] }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="review_required">Manual review before issue</option>
                <option value="consent">Consent to Ombudsman review</option>
                <option value="do_not_consent">Do not usually consent</option>
                <option value="custom">Custom wording</option>
              </select>
            </label>
            {settings.lateReferralPosition === 'custom' || settings.lateReferralPosition === 'review_required' ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {settings.lateReferralPosition === 'custom' ? 'Custom late-referral wording' : 'Review note'}
                </span>
                <textarea
                  rows={compact ? 3 : 4}
                  value={settings.lateReferralCustomText || ''}
                  onChange={(event) => setSettings((current) => ({ ...current, lateReferralCustomText: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder={settings.lateReferralPosition === 'custom' ? 'Enter the exact wording to include in complaint letters.' : 'Optional internal note to replace the default review-required paragraph.'}
                />
              </label>
            ) : null}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <span>These settings apply to complaint letters and board-pack branding across the workspace.</span>
              <Button size="sm" className="gap-2" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save settings
              </Button>
            </div>
          </>
        )}
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}
