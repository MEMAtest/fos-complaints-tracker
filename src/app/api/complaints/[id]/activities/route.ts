import { NextRequest } from 'next/server';
import { createComplaintActivity, getComplaintById, listComplaintActivities } from '@/lib/complaints/repository';
import type { ComplaintActivityType } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const activities = await listComplaintActivities(id);
    return Response.json({ success: true, activities });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint activities.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const activityType = String((body as { activityType?: string; activity_type?: string }).activityType || (body as { activity_type?: string }).activity_type || 'note_added') as ComplaintActivityType;
    const description = String((body as { description?: string }).description || '').trim();
    if (!description) {
      return Response.json({ success: false, error: 'Activity description is required.' }, { status: 400 });
    }

    const activity = await createComplaintActivity({
      complaintId: id,
      activityType,
      description,
      oldValue: typeof (body as { oldValue?: string }).oldValue === 'string' ? (body as { oldValue?: string }).oldValue : null,
      newValue: typeof (body as { newValue?: string }).newValue === 'string' ? (body as { newValue?: string }).newValue : null,
      metadata: (body as { metadata?: Record<string, unknown> }).metadata || null,
      performedBy: 'MEMA user',
    });

    return Response.json({ success: true, activity }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create complaint activity.';
    const status = message.toLowerCase().includes('invalid') ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
