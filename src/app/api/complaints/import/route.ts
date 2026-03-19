import { NextRequest } from 'next/server';
import { DatabaseClient } from '@/lib/database';
import { ensureComplaintsWorkspaceSchema } from '@/lib/complaints/schema';
import { commitComplaintImport } from '@/lib/complaints/repository';
import { buildComplaintImportPreview } from '@/lib/complaints/import-preview';
import { buildComplaintImportRows, parseComplaintImportFile } from '@/lib/complaints/import-parser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const previewRaw = String(formData.get('preview') || 'true').toLowerCase();
    const preview = ['1', 'true', 'yes'].includes(previewRaw);

    if (!file || typeof File === 'undefined' || !(file instanceof File)) {
      return Response.json({ success: false, error: 'A CSV or Excel file is required.' }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      return Response.json({ success: false, error: 'Unsupported file type. Use CSV or Excel.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseComplaintImportFile(file.name, buffer);
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
      return Response.json(previewPayload);
    }

    const result = await commitComplaintImport({
      fileName: parsed.fileName,
      rows: previewRows,
      warnings: parsed.warnings,
      createdBy: 'MEMA user',
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
    const message = error instanceof Error ? error.message : 'Failed to import complaint file.';
    const status = message.toLowerCase().includes('worksheet') || message.toLowerCase().includes('required') ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
