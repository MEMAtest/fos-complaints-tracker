'use client';

import { useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';

interface AdvisorInputFormProps {
  products: string[];
  rootCauses: string[];
  loading: boolean;
  optionsLoading: boolean;
  onSubmit: (product: string, rootCause: string | null, freeText: string | null) => void;
}

export function AdvisorInputForm({ products, rootCauses, loading, optionsLoading, onSubmit }: AdvisorInputFormProps) {
  const [product, setProduct] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [freeText, setFreeText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    onSubmit(product, rootCause || null, freeText.trim() || null);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
          <Lightbulb className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Generate Intelligence Brief</h2>
          <p className="text-xs text-slate-500">Select a product and optionally a root cause to view pre-analysed FOS intelligence.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="advisor-product" className="mb-1 block text-xs font-medium text-slate-700">
            Product sector <span className="text-rose-500">*</span>
          </label>
          <select
            id="advisor-product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            disabled={optionsLoading}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          >
            <option value="">{optionsLoading ? 'Loading products...' : 'Select a product'}</option>
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
            disabled={optionsLoading}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          >
            <option value="">All root causes</option>
            {rootCauses.map((rc) => (
              <option key={rc} value={rc}>{rc}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="advisor-text" className="mb-1 block text-xs font-medium text-slate-700">
          Complaint text <span className="text-slate-400">(optional — filters sample cases)</span>
        </label>
        <textarea
          id="advisor-text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={3}
          placeholder="Paste or describe the complaint to find matching cases..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={!product || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0f1f4f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#162b6b] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
          {loading ? 'Analysing...' : 'Get Intelligence'}
        </button>
        {loading && <span className="text-xs text-slate-500">Reading pre-computed brief...</span>}
      </div>
    </form>
  );
}
