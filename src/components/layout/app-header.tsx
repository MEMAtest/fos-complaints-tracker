'use client';

import { useRouter } from 'next/navigation';
import { Loader2, LogIn, LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/shared/export-button';
import { useAuth } from '@/components/auth/auth-provider';

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    await refresh();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-semibold text-slate-900">FOS Complaints Intelligence</h1>
      </div>

      <div className="flex items-center gap-3">
        <ExportButton />
        {loading ? (
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking session
          </div>
        ) : user ? (
          <>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {user.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'WS'}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{user.role}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.push('/login')}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
