'use client';

import { FormEvent, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to sign in.');
      }
      window.location.assign(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_55%)] px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-xl shadow-slate-200/60">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f1f4f] text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-slate-900">Workspace sign in</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Sign in to complaints operations, imports, and board-pack workflows.</p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                data-testid="login-email"
                autoComplete="username"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                data-testid="login-password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Enter your password"
              />
            </label>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}

            <Button type="submit" className="w-full gap-2" disabled={saving} data-testid="login-submit">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
