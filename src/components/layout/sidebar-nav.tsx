'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Network, GitCompare, Settings, HelpCircle, ClipboardList, Upload, Briefcase, Lightbulb, Newspaper, SlidersHorizontal, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppUserRole } from '@/lib/auth/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/layout/settings-dialog';
import { HelpSheet } from '@/components/layout/help-sheet';
import { RegComplaintsWordmark } from '@/components/brand/regcomplaints-brand';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  requiresAuth: boolean;
  minimumRole?: AppUserRole;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/workspace', label: 'Dashboard', icon: Home, requiresAuth: false },
  { href: '/analysis', label: 'Analysis', icon: BarChart3, requiresAuth: false },
  { href: '/root-causes', label: 'Root Causes', icon: Network, requiresAuth: false },
  { href: '/comparison', label: 'Firm Comparison', icon: GitCompare, requiresAuth: false },
  { href: '/insights', label: 'Public Insights', icon: Newspaper, requiresAuth: false },
  { href: '/complaints', label: 'Complaints', icon: ClipboardList, requiresAuth: true },
  { href: '/imports/complaints', label: 'Imports', icon: Upload, requiresAuth: true },
  { href: '/board-pack', label: 'Board Pack', icon: Briefcase, requiresAuth: true },
  { href: '/advisor', label: 'Complaint Advisor', icon: Lightbulb, requiresAuth: false },
  { href: '/settings/insights', label: 'Insight Controls', icon: SlidersHorizontal, requiresAuth: true, minimumRole: 'admin' },
];

const INTELLIGENCE_HREFS = new Set(['/workspace', '/analysis', '/root-causes', '/comparison', '/insights', '/advisor']);

export function SidebarNav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { user, can } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.requiresAuth && !user) return false;
    if (item.minimumRole && !can(item.minimumRole)) return false;
    return true;
  });

  return (
    <>
      <nav className="flex h-full w-full flex-col bg-[linear-gradient(180deg,#081d36_0%,#102a4e_58%,#0a2944_100%)] px-3 py-4 text-white">
        <Link
          href="/"
          aria-label="RegComplaints public home"
          className="mb-5 flex min-h-14 items-center rounded-xl px-2 transition hover:bg-white/8"
        >
          <RegComplaintsWordmark tone="on-dark" markWidth={34} subtitle="Management platform" />
        </Link>

        <Link href="/" className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white">
          Public research site
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        <div className="flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Intelligence</p>
          <div className="grid gap-1">
          {visibleItems.filter((item) => INTELLIGENCE_HREFS.has(item.href)).map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gradient-to-r from-teal-500/35 to-cyan-400/18 text-white shadow-[inset_3px_0_0_#2dd4bf]'
                        : 'text-white/62 hover:bg-white/8 hover:text-white'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          </div>

          {visibleItems.some((item) => !INTELLIGENCE_HREFS.has(item.href)) ? (
            <>
              <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Complaint operations</p>
              <div className="grid gap-1">
                {visibleItems.filter((item) => !INTELLIGENCE_HREFS.has(item.href)).map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gradient-to-r from-teal-500/35 to-cyan-400/18 text-white shadow-[inset_3px_0_0_#2dd4bf]'
                          : 'text-white/62 hover:bg-white/8 hover:text-white'
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 grid gap-1 border-t border-white/10 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/62 transition-colors hover:bg-white/8 hover:text-white"
              >
                <Settings className="h-4.5 w-4.5" />
                Settings
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Help"
                onClick={() => setHelpOpen(true)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/62 transition-colors hover:bg-white/8 hover:text-white"
              >
                <HelpCircle className="h-4.5 w-4.5" />
                Help
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Help</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
