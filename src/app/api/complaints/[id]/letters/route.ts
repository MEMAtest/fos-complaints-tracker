import { NextRequest } from 'next/server';
import { createComplaintLetter, getComplaintById, listComplaintLetters } from '@/lib/complaints/repository';
import type { ComplaintLetterTemplateKey, ComplaintWorkspaceActorRole } from '@/lib/complaints/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const letters = await listComplaintLetters(id);
    return Response.json({ success: true, letters });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint letters.' }, { status: 500 });
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

    const letter = await createComplaintLetter({
      complaintId: id,
      templateKey: String((body as { templateKey?: string }).templateKey || 'custom') as ComplaintLetterTemplateKey,
      subject: typeof (body as { subject?: string }).subject === 'string' ? (body as { subject?: string }).subject : null,
      bodyText: typeof (body as { bodyText?: string }).bodyText === 'string' ? (body as { bodyText?: string }).bodyText : null,
      recipientName: typeof (body as { recipientName?: string }).recipientName === 'string' ? (body as { recipientName?: string }).recipientName : null,
      recipientEmail: typeof (body as { recipientEmail?: string }).recipientEmail === 'string' ? (body as { recipientEmail?: string }).recipientEmail : null,
      generatedBy: typeof (body as { actorName?: string }).actorName === 'string' ? (body as { actorName?: string }).actorName : null,
      generatedByRole: typeof (body as { actorRole?: string }).actorRole === 'string' ? (body as { actorRole?: string }).actorRole as ComplaintWorkspaceActorRole : null,
      reviewerNotes: typeof (body as { reviewerNotes?: string }).reviewerNotes === 'string' ? (body as { reviewerNotes?: string }).reviewerNotes : null,
      approvalRoleRequired: typeof (body as { approvalRoleRequired?: string }).approvalRoleRequired === 'string'
        ? (body as { approvalRoleRequired?: string }).approvalRoleRequired as ComplaintWorkspaceActorRole
        : null,
    });

    return Response.json({ success: true, letter }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate complaint letter.';
    const status = message.toLowerCase().includes('complaint not found') ? 404 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}
