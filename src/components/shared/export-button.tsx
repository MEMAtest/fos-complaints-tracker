'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Briefcase, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
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
  boardPackHref?: string;
}

export function ExportButton({ onExportCsv, onExportPdf, boardPackHref = '/board-pack' }: ExportButtonProps) {
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
        <Button size="sm" className="gap-2 bg-blue-600 text-white hover:bg-blue-700 border-0" disabled={loading !== null}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={boardPackHref}>
            <Briefcase className="mr-2 h-4 w-4" />
            Board Pack Builder
          </Link>
        </DropdownMenuItem>
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
