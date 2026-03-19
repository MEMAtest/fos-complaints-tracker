import { NextRequest } from 'next/server';
import { updateComplaintLetter } from '@/lib/complaints/repository';
import type { ComplaintLetterStatus } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ letterId: string }> }) {
  try {
    const { letterId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const letter = await updateComplaintLetter({
      letterId,
      subject: typeof (body as { subject?: string }).subject === 'string' ? (body as { subject?: string }).subject : null,
      bodyText: typeof (body as { bodyText?: string }).bodyText === 'string' ? (body as { bodyText?: string }).bodyText : null,
      recipientName: typeof (body as { recipientName?: string }).recipientName === 'string' ? (body as { recipientName?: string }).recipientName : null,
      recipientEmail: typeof (body as { recipientEmail?: string }).recipientEmail === 'string' ? (body as { recipientEmail?: string }).recipientEmail : null,
      status: typeof (body as { status?: string }).status === 'string' ? (body as { status?: string }).status as ComplaintLetterStatus : null,
      performedBy: 'MEMA user',
    });

    if (!letter) {
      return Response.json({ success: false, error: 'Letter not found.' }, { status: 404 });
    }

    return Response.json({ success: true, letter });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update complaint letter.' }, { status: 500 });
  }
}
