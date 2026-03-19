import type { ComplaintImportPreviewRow, ComplaintImportPreviewResponse } from './types';

export function buildComplaintImportPreview(params: {
  fileName: string;
  rows: ComplaintImportPreviewRow[];
  warnings?: string[];
}): ComplaintImportPreviewResponse {
  const validRows = params.rows.filter((row) => row.action === 'new' || row.action === 'overwrite');
  return {
    success: true,
    preview: true,
    fileName: params.fileName,
    summary: {
      totalRows: params.rows.length,
      validRows: validRows.length,
      newCount: params.rows.filter((row) => row.action === 'new').length,
      overwriteCount: params.rows.filter((row) => row.action === 'overwrite').length,
      duplicateCount: params.rows.filter((row) => row.action === 'duplicate_in_file').length,
      invalidCount: params.rows.filter((row) => row.action === 'invalid').length,
    },
    rows: params.rows,
    warnings: params.warnings || [],
  };
}
