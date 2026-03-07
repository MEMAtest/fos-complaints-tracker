'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  onExportCsv?: () => void;
  onExportPdf?: () => void;
}

export function ExportButton({ onExportCsv, onExportPdf }: ExportButtonProps) {
  const [loading, setLoading] = useState<'csv' | 'pdf' | null>(null);

  async function handleCsv() {
    if (!onExportCsv) return;
    setLoading('csv');
    try {
      onExportCsv();
    } finally {
      setLoading(null);
    }
  }

  async function handlePdf() {
    if (!onExportPdf) return;
    setLoading('pdf');
    try {
      await onExportPdf();
    } catch {
      // error handling is the caller's responsibility
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={loading !== null}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsv} disabled={!onExportCsv || loading !== null}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} disabled={!onExportPdf || loading !== null}>
          <FileText className="mr-2 h-4 w-4" />
          Export PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
