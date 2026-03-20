import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { createComplaintLetter, getComplaintById, listComplaintLetters } from '@/lib/complaints/repository';
import type { ComplaintLetterTemplateKey, ComplaintWorkspaceActorRole } from '@/lib/complaints/types';

const VALID_TEMPLATE_KEYS: ComplaintLetterTemplateKey[] = ['acknowledgement', 'holding_response', 'final_response', 'fos_referral', 'custom'];
const VALID_ACTOR_ROLES: ComplaintWorkspaceActorRole[] = ['operator', 'reviewer', 'manager', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const { id } = await params;
    const complaint = await getComplaintById(id);
    if (!complaint) {
      return Response.json({ success: false, error: 'Complaint not found.' }, { status: 404 });
    }
    const letters = await listComplaintLetters(id);
    return Response.json({ success: true, letters });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch complaint letters.' }, { status });
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const rawTemplateKey = typeof (body as { templateKey?: string }).templateKey === 'string'
      ? (body as { templateKey?: string }).templateKey!
      : 'custom';
    const templateKey: ComplaintLetterTemplateKey = VALID_TEMPLATE_KEYS.includes(rawTemplateKey as ComplaintLetterTemplateKey)
      ? (rawTemplateKey as ComplaintLetterTemplateKey)
      : 'custom';

    const rawEmail = typeof (body as { recipientEmail?: string }).recipientEmail === 'string'
      ? (body as { recipientEmail?: string }).recipientEmail!.trim()
      : null;
    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      return Response.json({ success: false, error: 'Invalid recipient email address.' }, { status: 400 });
    }

    const rawApprovalRole = typeof (body as { approvalRoleRequired?: string }).approvalRoleRequired === 'string'
      ? (body as { approvalRoleRequired?: string }).approvalRoleRequired!
      : null;
    const approvalRoleRequired: ComplaintWorkspaceActorRole | null = rawApprovalRole && VALID_ACTOR_ROLES.includes(rawApprovalRole as ComplaintWorkspaceActorRole)
      ? (rawApprovalRole as ComplaintWorkspaceActorRole)
      : null;

    const letter = await createComplaintLetter({
      complaintId: id,
      templateKey,
      subject: typeof (body as { subject?: string }).subject === 'string' ? (body as { subject?: string }).subject : null,
      bodyText: typeof (body as { bodyText?: string }).bodyText === 'string' ? (body as { bodyText?: string }).bodyText : null,
      recipientName: typeof (body as { recipientName?: string }).recipientName === 'string' ? (body as { recipientName?: string }).recipientName : null,
      recipientEmail: rawEmail,
      generatedBy: user.fullName,
      generatedByRole: user.role as ComplaintWorkspaceActorRole,
      reviewerNotes: typeof (body as { reviewerNotes?: string }).reviewerNotes === 'string' ? (body as { reviewerNotes?: string }).reviewerNotes : null,
      approvalRoleRequired,
    });

    return Response.json({ success: true, letter }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate complaint letter.';
    const status = 'status' in (error as object)
      ? Number((error as { status?: number }).status || 500)
      : (message.toLowerCase().includes('complaint not found') ? 404 : 400);
    return Response.json({ success: false, error: message }, { status });
  }
}
