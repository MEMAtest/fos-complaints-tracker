'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Network, GitCompare, Settings, HelpCircle, ClipboardList, Upload, Briefcase } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SettingsDialog } from '@/components/layout/settings-dialog';
import { HelpSheet } from '@/components/layout/help-sheet';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/analysis', label: 'Analysis', icon: BarChart3 },
  { href: '/root-causes', label: 'Root Causes', icon: Network },
  { href: '/comparison', label: 'Firm Comparison', icon: GitCompare },
  { href: '/complaints', label: 'Complaints', icon: ClipboardList },
  { href: '/imports/complaints', label: 'Imports', icon: Upload },
  { href: '/board-pack', label: 'Board Pack', icon: Briefcase },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <nav className="flex h-full w-16 flex-col items-center bg-[#0f1f4f] py-4">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
          <span className="text-sm font-bold text-white">FI</span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Settings className="h-5 w-5" />
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
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <HelpCircle className="h-5 w-5" />
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
