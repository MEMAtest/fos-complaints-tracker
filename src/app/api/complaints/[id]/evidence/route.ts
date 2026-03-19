import { NextRequest } from 'next/server';
import { createComplaintEvidence, getComplaintById, listComplaintEvidence } from '@/lib/complaints/repository';
import type { ComplaintEvidenceCategory } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const evidence = await listComplaintEvidence(id);
    return Response.json({ success: true, evidence });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint evidence.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
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
      uploadedBy: 'MEMA user',
    });

    return Response.json({ success: true, evidence }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload evidence.';
    const status = message.toLowerCase().includes('required') || message.toLowerCase().includes('limit') ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
