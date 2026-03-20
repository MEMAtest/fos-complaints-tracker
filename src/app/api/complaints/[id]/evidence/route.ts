import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { createComplaintEvidence, getComplaintById, listComplaintEvidence } from '@/lib/complaints/repository';
import type { ComplaintEvidenceCategory } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === '1';
    const evidence = await listComplaintEvidence(id, { includeArchived });
    return Response.json({ success: true, evidence });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint evidence.' }, { status });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, 'operator');
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof File === 'undefined' || !(file instanceof File)) {
      return Response.json({ success: false, error: 'A file is required.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ success: false, error: 'File exceeds the 5MB evidence limit.' }, { status: 400 });
    }

    const category = String(formData.get('category') || 'other') as ComplaintEvidenceCategory;
    const summary = String(formData.get('summary') || '').trim() || null;
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const evidence = await createComplaintEvidence({
      complaintId: id,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      fileBytes,
      category,
      summary,
      uploadedBy: user.fullName,
    });

    return Response.json({ success: true, evidence }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload evidence.';
    const duplicateEvidence = 'duplicateEvidence' in (error as object)
      ? (error as { duplicateEvidence?: unknown }).duplicateEvidence
      : null;
    const status = 'status' in (error as object)
      ? Number((error as { status?: number }).status || 500)
      : ((message.toLowerCase().includes('required') || message.toLowerCase().includes('limit')) ? 400 : 500);
    return Response.json({ success: false, error: message, duplicateEvidence }, { status });
  }
}
