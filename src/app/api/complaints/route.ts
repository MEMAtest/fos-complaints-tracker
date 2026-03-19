import { NextRequest } from 'next/server';
import { createComplaint, listComplaints, parseComplaintFilters } from '@/lib/complaints/repository';
import type { ComplaintMutationInput } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const filters = parseComplaintFilters(request.nextUrl.searchParams);
    const result = await listComplaints(filters);
    return Response.json({ success: true, filters, ...result });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaints.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }
    const complaint = await createComplaint(body as ComplaintMutationInput, 'MEMA user');
    return Response.json({ success: true, complaint }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create complaint.';
    const status = message.toLowerCase().includes('required') ? 400 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
