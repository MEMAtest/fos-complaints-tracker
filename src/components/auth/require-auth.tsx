'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from './auth-provider';
import type { AppUserRole } from '@/lib/auth/types';

export function RequireAuth({
  minimumRole = 'viewer',
  children,
}: {
  minimumRole?: AppUserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, can } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!can(minimumRole)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-rose-600" />
        <h1 className="text-xl font-semibold text-slate-900">Access restricted</h1>
        <p className="text-sm text-slate-500">This workspace requires a {minimumRole} role or higher. You are signed in as {user.role}.</p>
      </div>
    );
  }

  return <>{children}</>;
}
