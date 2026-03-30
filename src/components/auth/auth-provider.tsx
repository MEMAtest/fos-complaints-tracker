'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AppUserRole, AuthenticatedAppUser } from '@/lib/auth/types';

interface AuthContextValue {
  user: AuthenticatedAppUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  can: (minimumRole: AppUserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedAppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!response.ok) {
        setUser(null);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      setUser(payload.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pathname === '/' || pathname === '/login' || pathname.startsWith('/insights')) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [pathname]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    refresh,
    can: (minimumRole) => {
      const current = user?.role || 'viewer';
      return roleRank(current) >= roleRank(minimumRole);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

function roleRank(role: AppUserRole): number {
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
