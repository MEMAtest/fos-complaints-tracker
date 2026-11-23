'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

interface AdvisorInputFormProps {
  products: string[];
  rootCauses: string[];
  loading: boolean;
  optionsLoading: boolean;
  initialProduct?: string;
  initialRootCause?: string;
  onRetryOptions: () => void;
  onSubmit: (product: string, rootCause: string | null, freeText: string | null) => void;
}

export function AdvisorInputForm({
  products,
  rootCauses,
  loading,
  optionsLoading,
  initialProduct = '',
  initialRootCause = '',
  onRetryOptions,
  onSubmit,
}: AdvisorInputFormProps) {
  const [product, setProduct] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [freeText, setFreeText] = useState('');
  const { user, loading: authLoading, refresh } = useAuth();
  const example = products.includes('Banking and Payments') ? 'Banking and Payments' : products[0];
  const optionsUnavailable = !optionsLoading && products.length === 0;
  const returnParams = new URLSearchParams();
  if (product) returnParams.set('product', product);
  if (rootCause) returnParams.set('rootCause', rootCause);
  const returnPath = returnParams.size ? `/advisor?${returnParams.toString()}` : '/advisor';

  useEffect(() => {
    setProduct(initialProduct);
    setRootCause(initialRootCause);
  }, [initialProduct, initialRootCause]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!products.includes(product) || loading) return;
    onSubmit(product, rootCause || null, user ? freeText.trim() || null : null);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-950">Build your brief</h2>
        {example && (
          <button type="button" disabled={loading || optionsLoading} onClick={() => {
            setProduct(example);
            setRootCause('');
            setFreeText('');
            onSubmit(example, null, null);
          }} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-60">
            Try {example}
          </button>
        )}
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="advisor-product" className="mb-1 block text-xs font-medium text-slate-700">
            Product sector <span className="font-normal text-slate-600">(required)</span>
          </label>
          <select
            id="advisor-product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            required
            disabled={optionsLoading || optionsUnavailable}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          >
            <option value="">{optionsLoading ? 'Loading products…' : optionsUnavailable ? 'Products unavailable' : 'Choose a product'}</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="advisor-root-cause" className="mb-1 block text-xs font-medium text-slate-700">
            Root cause <span className="text-slate-400">(optional)</span>
          </label>
          <select
            id="advisor-root-cause"
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            disabled={optionsLoading || optionsUnavailable}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          >
            <option value="">All root causes</option>
            {rootCauses.map((rc) => (
              <option key={rc} value={rc}>{rc}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!products.includes(product) || loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:bg-slate-200 disabled:text-slate-600 sm:col-span-2 lg:col-span-1"
        >
          {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          {loading ? 'Loading brief…' : 'Get Intelligence'}
        </button>
      </div>

      {optionsUnavailable ? (
        <p role="status" className="mt-3 text-sm text-rose-800">Product choices could not load. <button type="button" onClick={onRetryOptions} className="font-semibold underline">Retry</button></p>
      ) : (
        <details className="mt-3 border-t border-slate-200 pt-2" onToggle={(event) => {
          if (event.currentTarget.open) void refresh();
        }}>
          <summary className="cursor-pointer py-1 text-sm font-semibold text-violet-900">Match cases using complaint text <span className="font-normal text-slate-600">(optional)</span></summary>
          {authLoading ? (
            <p role="status" className="py-2 text-sm text-slate-600">Checking sign-in…</p>
          ) : user ? (
            <div className="mt-2">
              <label htmlFor="advisor-text" className="mb-1 block text-xs font-medium text-slate-700">Complaint text</label>
              <textarea id="advisor-text" value={freeText} onChange={(event) => setFreeText(event.target.value)} rows={3} maxLength={5000}
                placeholder="Describe the issue to find similar decisions."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-700" />
            </div>
          ) : (
            <p className="py-2 text-sm text-slate-700"><Link href={`/login?next=${encodeURIComponent(returnPath)}`} className="font-semibold text-violet-900 underline">Sign in</Link> to submit complaint text privately. A product brief is available above.</p>
          )}
        </details>
      )}
    </form>
  );
}
