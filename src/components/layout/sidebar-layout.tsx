'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNav } from './sidebar-nav';
import { AppHeader } from './app-header';
import { cn } from '@/lib/utils';

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/login' || pathname.startsWith('/insights')) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Close sidebar"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-16 transition-transform duration-200 lg:static lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarNav />
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader onToggleSidebar={() => setMobileOpen(!mobileOpen)} />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
