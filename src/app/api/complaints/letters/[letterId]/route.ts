import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { buildComplaintLetterPdf } from '@/lib/complaints/build-letter-pdf';
import { getComplaintLetterContext, updateComplaintLetter } from '@/lib/complaints/repository';
import type { ComplaintLetterReviewDecisionCode, ComplaintLetterStatus, ComplaintWorkspaceActorRole } from '@/lib/complaints/types';

const VALID_LETTER_STATUSES: ComplaintLetterStatus[] = ['draft', 'generated', 'under_review', 'approved', 'rejected_for_rework', 'sent', 'superseded'];
const VALID_REVIEW_CODES: ComplaintLetterReviewDecisionCode[] = ['ready_to_issue', 'reasoning_strengthened', 'evidence_gap', 'template_non_compliant', 'redress_unclear', 'fos_rights_missing', 'other'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ letterId: string }> }) {
  try {
    await requireAuthenticatedUser(request, 'viewer');
    const { letterId } = await params;
    const context = await getComplaintLetterContext(letterId);
    if (!context) {
      return Response.json({ success: false, error: 'Letter not found.' }, { status: 404 });
    }

    const format = (request.nextUrl.searchParams.get('format') || 'pdf').toLowerCase();
    const fileStem = slugify(context.letter.subject);

    if (format === 'txt') {
      const body = `Subject: ${context.letter.subject}\n\n${context.letter.bodyText}`;
      return new Response(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileStem}.txt"`,
        },
      });
    }

    const pdfBytes = await buildComplaintLetterPdf(context);
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileStem}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to download complaint letter.' }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ letterId: string }> }) {
  try {
    const user = await requireAuthenticatedUser(request, 'operator');
    const { letterId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const rawEmail = typeof (body as { recipientEmail?: string }).recipientEmail === 'string'
      ? (body as { recipientEmail?: string }).recipientEmail!.trim()
      : null;
    if (rawEmail && !EMAIL_RE.test(rawEmail)) {
      return Response.json({ success: false, error: 'Invalid recipient email address.' }, { status: 400 });
    }

    const rawStatus = typeof (body as { status?: string }).status === 'string' ? (body as { status?: string }).status! : null;
    if (rawStatus && !VALID_LETTER_STATUSES.includes(rawStatus as ComplaintLetterStatus)) {
      return Response.json({ success: false, error: `Invalid letter status "${rawStatus}".` }, { status: 400 });
    }

    const rawReviewCode = typeof (body as { reviewDecisionCode?: string }).reviewDecisionCode === 'string'
      ? (body as { reviewDecisionCode?: string }).reviewDecisionCode!
      : null;
    if (rawReviewCode && !VALID_REVIEW_CODES.includes(rawReviewCode as ComplaintLetterReviewDecisionCode)) {
      return Response.json({ success: false, error: `Invalid review decision code "${rawReviewCode}".` }, { status: 400 });
    }

    const letter = await updateComplaintLetter({
      letterId,
      subject: typeof (body as { subject?: string }).subject === 'string' ? (body as { subject?: string }).subject : null,
      bodyText: typeof (body as { bodyText?: string }).bodyText === 'string' ? (body as { bodyText?: string }).bodyText : null,
      recipientName: typeof (body as { recipientName?: string }).recipientName === 'string' ? (body as { recipientName?: string }).recipientName : null,
      recipientEmail: rawEmail,
      status: rawStatus as ComplaintLetterStatus | null,
      approvalNote: typeof (body as { approvalNote?: string }).approvalNote === 'string' ? (body as { approvalNote?: string }).approvalNote : null,
      reviewDecisionCode: rawReviewCode as ComplaintLetterReviewDecisionCode | null,
      reviewDecisionNote: typeof (body as { reviewDecisionNote?: string }).reviewDecisionNote === 'string'
        ? (body as { reviewDecisionNote?: string }).reviewDecisionNote
        : null,
      reviewerNotes: typeof (body as { reviewerNotes?: string }).reviewerNotes === 'string' ? (body as { reviewerNotes?: string }).reviewerNotes : null,
      performedBy: user.fullName,
      performedByRole: user.role as ComplaintWorkspaceActorRole,
    });

    if (!letter) {
      return Response.json({ success: false, error: 'Letter not found.' }, { status: 404 });
    }

    return Response.json({ success: true, letter });
  } catch (error) {
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update complaint letter.' }, { status });
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'complaint-letter';
}
