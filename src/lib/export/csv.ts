import type { FOSDashboardSnapshot, FOSAnalysisSnapshot } from '@/lib/fos/types';

/**
 * Escape a value for CSV output.
 * Wraps in double-quotes if the value contains commas, double-quotes, or newlines.
 * Internal double-quotes are doubled per RFC 4180.
 */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

/**
 * Generate CSV content from a dashboard snapshot (case list).
 */
export function snapshotToCsv(snapshot: FOSDashboardSnapshot): string {
  const headers = [
    'Case ID',
    'Decision Reference',
    'Decision Date',
    'Firm Name',
    'Product Group',
    'Outcome',
    'Ombudsman Name',
  ];

  const rows = snapshot.cases.map((c) =>
    buildCsvRow([
      c.caseId,
      c.decisionReference,
      c.decisionDate,
      c.firmName,
      c.productGroup,
      c.outcome,
      c.ombudsmanName,
    ])
  );

  return [buildCsvRow(headers), ...rows].join('\n');
}

/**
 * Generate CSV content from an analysis snapshot.
 * Includes two sections: Year-Product-Outcome data and Firm Benchmark data.
 */
export function analysisToCsv(snapshot: FOSAnalysisSnapshot): string {
  const sections: string[] = [];

  // Section 1: Year-Product-Outcome data
  const ypoHeaders = [
    'Year',
    'Product',
    'Total',
    'Upheld',
    'Not Upheld',
    'Partially Upheld',
    'Upheld Rate',
  ];
  const ypoRows = snapshot.yearProductOutcome.map((r) =>
    buildCsvRow([
      r.year,
      r.product,
      r.total,
      r.upheld,
      r.notUpheld,
      r.partiallyUpheld,
      `${(r.upheldRate * 100).toFixed(1)}%`,
    ])
  );
  sections.push(buildCsvRow(ypoHeaders), ...ypoRows);

  // Blank separator row
  sections.push('');

  // Section 2: Firm Benchmark data
  const fbHeaders = ['Firm', 'Total', 'Upheld Rate', 'Not Upheld Rate'];
  const fbRows = snapshot.firmBenchmark.map((r) =>
    buildCsvRow([
      r.firm,
      r.total,
      `${(r.upheldRate * 100).toFixed(1)}%`,
      `${(r.notUpheldRate * 100).toFixed(1)}%`,
    ])
  );
  sections.push(buildCsvRow(fbHeaders), ...fbRows);

  return sections.join('\n');
}

/**
 * Trigger a browser download of CSV content.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  let url = '';
  let link: HTMLAnchorElement | null = null;
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    url = URL.createObjectURL(blob);
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    if (link && link.parentNode) document.body.removeChild(link);
    if (url) URL.revokeObjectURL(url);
  }
}
