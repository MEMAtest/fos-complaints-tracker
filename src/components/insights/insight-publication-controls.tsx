'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { InsightKind, InsightPublicationCandidate, InsightPublicationOverrideInput } from '@/lib/insights/types';

const KIND_OPTIONS: Array<{ value: InsightKind | 'all'; label: string }> = [
  { value: 'all', label: 'All pages' },
  { value: 'year', label: 'Years' },
  { value: 'firm', label: 'Firms' },
  { value: 'product', label: 'Products' },
  { value: 'type', label: 'Themes' },
  { value: 'year-product', label: 'Year + product' },
  { value: 'firm-product', label: 'Firm + product' },
];

type FormState = {
  isPublished: boolean;
  isNoindex: boolean;
  titleOverride: string;
  descriptionOverride: string;
  heroDekOverride: string;
  featuredRank: string;
};

const DEFAULT_FORM: FormState = {
  isPublished: true,
  isNoindex: false,
  titleOverride: '',
  descriptionOverride: '',
  heroDekOverride: '',
  featuredRank: '',
};

export function InsightPublicationControls() {
  const [kind, setKind] = useState<InsightKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<InsightPublicationCandidate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const selected = useMemo(
    () => candidates.find((candidate) => selectionKey(candidate.kind, candidate.entityKey) === selectedKey) || null,
    [candidates, selectedKey]
  );

  useEffect(() => {
    if (!selected) {
      setForm(DEFAULT_FORM);
      return;
    }
    setForm({
      isPublished: selected.override?.isPublished ?? true,
      isNoindex: selected.override?.isNoindex ?? false,
      titleOverride: selected.override?.titleOverride ?? '',
      descriptionOverride: selected.override?.descriptionOverride ?? '',
      heroDekOverride: selected.override?.heroDekOverride ?? '',
      featuredRank: selected.override?.featuredRank != null ? String(selected.override.featuredRank) : '',
    });
  }, [selected]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (kind !== 'all') params.set('kind', kind);
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`/api/insights/overrides?${params.toString()}`, { credentials: 'include' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load publication controls.');
      }
      const nextCandidates = Array.isArray(payload.candidates) ? payload.candidates as InsightPublicationCandidate[] : [];
      setCandidates(nextCandidates);
      setSelectedKey((current) => {
        if (current && nextCandidates.some((candidate) => selectionKey(candidate.kind, candidate.entityKey) === current)) {
          return current;
        }
        return nextCandidates[0] ? selectionKey(nextCandidates[0].kind, nextCandidates[0].entityKey) : null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load publication controls.');
    } finally {
      setLoading(false);
    }
  }, [kind, query]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  async function saveOverride() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload: InsightPublicationOverrideInput = {
        kind: selected.kind,
        entityKey: selected.entityKey,
        isPublished: form.isPublished,
        isNoindex: form.isNoindex,
        titleOverride: form.titleOverride.trim() || null,
        descriptionOverride: form.descriptionOverride.trim() || null,
        heroDekOverride: form.heroDekOverride.trim() || null,
        featuredRank: form.featuredRank.trim() ? Number(form.featuredRank) : null,
      };
      const response = await fetch('/api/insights/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to save override.');
      }
      setStatus('Override saved.');
      await loadCandidates();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save override.');
    } finally {
      setSaving(false);
    }
  }

  async function resetOverride() {
    if (!selected || !selected.override) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/insights/overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: selected.kind, entityKey: selected.entityKey }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to remove override.');
      }
      setStatus('Override removed.');
      await loadCandidates();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to remove override.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Admin controls</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Insight publication controls</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          Control which public insight pages are published, noindexed, or featured on the landing page without changing code. These overrides sit on top of the generated SEO layer.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as InsightKind | 'all')}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, summaries, or entity keys"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">{loading ? 'Loading candidates…' : `${candidates.length} candidates in the current view.`}</p>
          {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {status ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p> : null}
          <div className="mt-4 grid gap-3">
            {candidates.map((candidate) => {
              const active = selectionKey(candidate.kind, candidate.entityKey) === selectedKey;
              return (
                <button
                  key={selectionKey(candidate.kind, candidate.entityKey)}
                  type="button"
                  onClick={() => setSelectedKey(selectionKey(candidate.kind, candidate.entityKey))}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${active ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <span>{candidate.kind}</span>
                    {!candidate.effectivePublished ? <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">suppressed</span> : null}
                    {candidate.effectiveNoindex ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">noindex</span> : null}
                    {candidate.effectiveFeaturedRank != null ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">featured #{candidate.effectiveFeaturedRank}</span> : null}
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-slate-950">{candidate.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.summary}</p>
                  <p className="mt-3 text-xs text-slate-500">{candidate.href} · {candidate.totalCases.toLocaleString()} decisions</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {selected ? (
            <div className="grid gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <span>{selected.kind}</span>
                  <span>{selected.entityKey}</span>
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{selected.title}</h2>
                <Link href={selected.href} className="mt-2 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900" target="_blank" rel="noreferrer">
                  Open public page
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isPublished} onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))} />
                  Publish this page
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={form.isNoindex} onChange={(event) => setForm((current) => ({ ...current, isNoindex: event.target.checked }))} />
                  Noindex this page
                </label>
              </div>

              <label className="grid gap-2 text-sm text-slate-700">
                <span className="font-medium">Featured rank</span>
                <input value={form.featuredRank} onChange={(event) => setForm((current) => ({ ...current, featuredRank: event.target.value }))} placeholder="e.g. 1" className="rounded-xl border border-slate-200 px-3 py-2" />
                <span className="text-xs text-slate-500">Lower numbers appear first in the public insights landing cards.</span>
              </label>

              <label className="grid gap-2 text-sm text-slate-700">
                <span className="font-medium">Title override</span>
                <input value={form.titleOverride} onChange={(event) => setForm((current) => ({ ...current, titleOverride: event.target.value }))} placeholder="Optional page title override" className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>

              <label className="grid gap-2 text-sm text-slate-700">
                <span className="font-medium">Description override</span>
                <textarea value={form.descriptionOverride} onChange={(event) => setForm((current) => ({ ...current, descriptionOverride: event.target.value }))} rows={4} placeholder="Optional description and archive summary override" className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>

              <label className="grid gap-2 text-sm text-slate-700">
                <span className="font-medium">Hero deck override</span>
                <textarea value={form.heroDekOverride} onChange={(event) => setForm((current) => ({ ...current, heroDekOverride: event.target.value }))} rows={4} placeholder="Optional hero deck override for the detail page" className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => void saveOverride()} disabled={saving} className="rounded-full bg-[#0f1f4f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0c1940] disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save override'}
                </button>
                <button type="button" onClick={() => void resetOverride()} disabled={saving || !selected.override} className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-60">
                  Clear override
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Select a candidate page to manage its publication settings.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function selectionKey(kind: InsightKind, entityKey: string): string {
  return `${kind}::${entityKey}`;
}
