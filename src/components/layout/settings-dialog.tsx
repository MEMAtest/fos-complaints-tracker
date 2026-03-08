'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FOSSettings {
  defaultPageSize: number;
  chartAnimations: boolean;
}

const STORAGE_KEY = 'fos-settings';
const DEFAULT_SETTINGS: FOSSettings = {
  defaultPageSize: 25,
  chartAnimations: true,
};

function loadSettings(): FOSSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: FOSSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<FOSSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  function handlePageSizeChange(value: string) {
    const next = { ...settings, defaultPageSize: Number(value) };
    setSettings(next);
    saveSettings(next);
  }

  function handleAnimationsChange(checked: boolean) {
    const next = { ...settings, chartAnimations: checked };
    setSettings(next);
    saveSettings(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your FOS Complaints Intelligence preferences.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-5">
          {/* Default page size */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Default page size
            </label>
            <select
              value={settings.defaultPageSize}
              onChange={(e) => handlePageSizeChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Number of cases shown per page in the Case Explorer.
            </p>
          </div>

          {/* Chart animations */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Chart animations</p>
              <p className="text-xs text-slate-500">Enable or disable chart transition animations.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.chartAnimations}
              onClick={() => handleAnimationsChange(!settings.chartAnimations)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.chartAnimations ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.chartAnimations ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
