import { NextRequest } from 'next/server';
import { deleteComplaint, getComplaintById, listComplaintActivities, listComplaintEvidence, listComplaintLetters, updateComplaint } from '@/lib/complaints/repository';
import type { ComplaintMutationInput } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const [activities, evidence, letters] = await Promise.all([
      listComplaintActivities(id),
      listComplaintEvidence(id),
      listComplaintLetters(id),
    ]);
    return Response.json({ success: true, complaint: { ...complaint, activities, evidence, letters } });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }
    const complaint = await updateComplaint(id, body as ComplaintMutationInput, 'MEMA user');
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    return Response.json({ success: true, complaint });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update complaint.';
    const status = message.toLowerCase().includes('required') ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteComplaint(id);
    if (!deleted) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete complaint.' }, { status: 500 });
  }
}
