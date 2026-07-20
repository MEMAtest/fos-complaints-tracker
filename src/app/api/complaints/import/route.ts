import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { DatabaseClient } from '@/lib/database';
import { ensureComplaintsWorkspaceSchema } from '@/lib/complaints/schema';
import { commitComplaintImport } from '@/lib/complaints/repository';
import { buildComplaintImportPreview } from '@/lib/complaints/import-preview';
import {
  buildComplaintImportRows,
  ComplaintImportValidationError,
  parseComplaintImportFile,
} from '@/lib/complaints/import-parser';
import { clientKeyFromRequest, RateLimitError, rateLimitOrThrow } from '@/lib/server/rate-limit';
import { logRouteMetric } from '@/lib/server/route-metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Vercel Functions cap request bodies at 4.5 MB. Keep the file below that
// ceiling so multipart framing has room as well.
const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024;
const MAX_IMPORT_REQUEST_BYTES = Math.floor(4.5 * 1024 * 1024);

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let actor: string | null = null;
  try {
    const user = await requireAuthenticatedUser(request, 'operator');
    actor = user.email;
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_REQUEST_BYTES) {
      return Response.json({ success: false, error: 'Import files are limited to 4 MB.' }, { status: 413 });
    }
    const formData = await request.formData();
    const file = formData.get('file');
    const previewRaw = String(formData.get('preview') || 'true').toLowerCase();
    const preview = ['1', 'true', 'yes'].includes(previewRaw);
    await rateLimitOrThrow(clientKeyFromRequest(request, `complaints-import:${user.email}`), preview ? 30 : 10, preview ? 60_000 : 300_000);

    if (!file || typeof File === 'undefined' || !(file instanceof File)) {
      return Response.json({ success: false, error: 'A CSV or Excel file is required.' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      return Response.json({ success: false, error: 'Unsupported file type. Use CSV or .xlsx Excel files.' }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return Response.json({ success: false, error: 'Import files are limited to 4 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseComplaintImportFile(file.name, buffer);
    await ensureComplaintsWorkspaceSchema();

    const candidateReferences = parsed.rows
      .map((row) => typeof row.normalizedFields.complaintReference === 'string' ? row.normalizedFields.complaintReference.trim() : '')
      .filter(Boolean);

    const existingRows = candidateReferences.length > 0
      ? await DatabaseClient.query<{ complaint_reference: string }>(
          `SELECT complaint_reference FROM complaints_records WHERE LOWER(complaint_reference) = ANY($1::text[])`,
          [candidateReferences.map((reference) => reference.toLowerCase())]
        )
      : [];

    const previewRows = buildComplaintImportRows({
      parsedRows: parsed.rows,
      existingReferences: new Set(existingRows.map((row) => String(row.complaint_reference || '').toLowerCase())),
    });
    const previewPayload = buildComplaintImportPreview({ fileName: parsed.fileName, rows: previewRows, warnings: parsed.warnings });

    if (preview) {
      logRouteMetric({
        route: '/api/complaints/import',
        method: 'POST',
        status: 200,
        durationMs: Date.now() - startedAt,
        actor,
        detail: { preview: true, fileName: parsed.fileName, rows: previewRows.length },
      });
      return Response.json(previewPayload);
    }

    const result = await commitComplaintImport({
      fileName: parsed.fileName,
      rows: previewRows,
      warnings: parsed.warnings,
      createdBy: user.fullName,
    });

    logRouteMetric({
      route: '/api/complaints/import',
      method: 'POST',
      status: 200,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { preview: false, fileName: parsed.fileName, importedCount: result.importedCount, overwrittenCount: result.overwrittenCount },
    });
    return Response.json({
      success: true,
      preview: false,
      importedCount: result.importedCount,
      overwrittenCount: result.overwrittenCount,
      skippedCount: result.skippedCount,
      importRunId: result.importRunId,
      warnings: parsed.warnings,
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : 'Failed to import complaint file.';
    const errorStatus = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status || 500)
      : 500;
    const status = error instanceof ComplaintImportValidationError
      ? error.status
      : errorStatus;
    logRouteMetric({
      route: '/api/complaints/import',
      method: 'POST',
      status,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { error: internalMessage },
    });
    if (error instanceof RateLimitError) {
      return Response.json(
        { success: false, error: 'Too many import requests. Please try again later.' },
        { status, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    const publicMessage = status >= 500 ? 'Failed to import complaint file.' : internalMessage;
    return Response.json({ success: false, error: publicMessage }, { status });
  }
}
