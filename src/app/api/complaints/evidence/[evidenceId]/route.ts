import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { deleteComplaintEvidence, getComplaintEvidenceContent, updateComplaintEvidence } from '@/lib/complaints/repository';
import type { ComplaintEvidenceCategory } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ evidenceId: string }> }) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const { evidenceId } = await params;
    const evidence = await getComplaintEvidenceContent(evidenceId);
    if (!evidence) {
      return Response.json({ success: false, error: 'Evidence not found.' }, { status: 404 });
    }

    if (request.nextUrl.searchParams.get('preview') === '1') {
      const previewKind = getEvidencePreviewKind(evidence.contentType, evidence.fileName);
      return Response.json({
        success: true,
        preview: {
          evidence: {
            id: evidence.id,
            complaintId: evidence.complaintId,
            fileName: evidence.fileName,
            contentType: evidence.contentType,
            fileSize: evidence.fileSize,
            sha256: evidence.sha256,
            category: evidence.category,
            summary: evidence.summary,
            previewText: evidence.previewText,
            uploadedBy: evidence.uploadedBy,
            archivedAt: evidence.archivedAt,
            archivedBy: evidence.archivedBy,
            createdAt: evidence.createdAt,
          },
          previewKind,
          inlineUrl: `/api/complaints/evidence/${evidence.id}?inline=1`,
          downloadUrl: `/api/complaints/evidence/${evidence.id}`,
          textPreview: previewKind === 'text' ? evidence.previewText : null,
        },
      });
    }

    const inline = request.nextUrl.searchParams.get('download') === '0' || request.nextUrl.searchParams.get('inline') === '1';
    return new Response(evidence.fileBytes, {
      headers: {
        'Content-Type': evidence.contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${evidence.fileName.replace(/\"/g, '')}"`,
        'Content-Length': String(evidence.fileSize),
      },
    });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to download evidence.' }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ evidenceId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, 'operator');
    const { evidenceId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const category = typeof (body as { category?: string }).category === 'string'
      ? ((body as { category?: string }).category as ComplaintEvidenceCategory)
      : undefined;

    const evidence = await updateComplaintEvidence({
      evidenceId,
      fileName: typeof (body as { fileName?: string }).fileName === 'string' ? (body as { fileName?: string }).fileName : undefined,
      category,
      summary: typeof (body as { summary?: string }).summary === 'string' ? (body as { summary?: string }).summary : undefined,
      archived: typeof (body as { archived?: boolean }).archived === 'boolean' ? (body as { archived?: boolean }).archived : undefined,
      performedBy: user.fullName,
    });

    if (!evidence) {
      return Response.json({ success: false, error: 'Evidence not found.' }, { status: 404 });
    }

    return Response.json({ success: true, evidence });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update evidence.' }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ evidenceId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, 'manager');
    const { evidenceId } = await params;
    const deleted = await deleteComplaintEvidence(evidenceId, user.fullName);
    if (!deleted) {
      return Response.json({ success: false, error: 'Evidence not found.' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete evidence.' }, { status });
  }
}

function getEvidencePreviewKind(contentType: string, fileName: string): 'image' | 'pdf' | 'text' | 'download' {
  const normalizedType = String(contentType || '').toLowerCase();
  const lowerName = String(fileName || '').toLowerCase();
  if (normalizedType.startsWith('image/')) return 'image';
  if (normalizedType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    normalizedType.startsWith('text/')
    || normalizedType.includes('json')
    || normalizedType.includes('xml')
    || normalizedType.includes('message/rfc822')
    || lowerName.endsWith('.txt')
    || lowerName.endsWith('.md')
    || lowerName.endsWith('.csv')
    || lowerName.endsWith('.eml')
  ) {
    return 'text';
  }
  return 'download';
}
