import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { getComplaintById } from '@/lib/complaints/repository';
import { buildComplaintLetterIntelligence, getComplaintLetterIntelligenceFromCorpus } from '@/lib/complaints/letter-intelligence';
import { getAdvisorBrief } from '@/lib/fos/repository';
import type { ComplaintLetterIntelligenceResponse, ComplaintLetterIntelligenceSourceScope } from '@/lib/complaints/types';

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

    if (!complaint.product?.trim()) {
      const payload: ComplaintLetterIntelligenceResponse = {
        success: true,
        data: null,
        reason: 'Add a product to this complaint to unlock FOS drafting intelligence.',
        meta: {
          complaintId: complaint.id,
          sourceScope: 'none',
          generatedAt: new Date().toISOString(),
        },
      };
      return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    }

    const brief = await getAdvisorBrief({
      product: complaint.product.trim(),
      rootCause: complaint.rootCause?.trim() || null,
      freeText: complaint.description?.trim() || null,
    });

    if (!brief) {
      const fallbackIntelligence = await getComplaintLetterIntelligenceFromCorpus(complaint);
      if (fallbackIntelligence) {
        const payload: ComplaintLetterIntelligenceResponse = {
          success: true,
          data: fallbackIntelligence,
          meta: {
            complaintId: complaint.id,
            sourceScope: fallbackIntelligence.sourceScope,
            generatedAt: fallbackIntelligence.generatedAt,
          },
        };
        return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
      }

      const payload: ComplaintLetterIntelligenceResponse = {
        success: true,
        data: null,
        reason: `No intelligence brief is available yet for ${complaint.product.trim()}.`,
        meta: {
          complaintId: complaint.id,
          sourceScope: 'none',
          generatedAt: new Date().toISOString(),
        },
      };
      return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
    }

    const sourceScope: Exclude<ComplaintLetterIntelligenceSourceScope, 'none'> = brief.query.rootCause ? 'product_root_cause' : 'product_only';
    const intelligence = buildComplaintLetterIntelligence(complaint, brief, sourceScope);
    const payload: ComplaintLetterIntelligenceResponse = {
      success: true,
      data: intelligence,
      meta: {
        complaintId: complaint.id,
        sourceScope,
        generatedAt: intelligence.generatedAt,
      },
    };

    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build complaint letter intelligence.',
      } satisfies ComplaintLetterIntelligenceResponse,
      { status: 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500 }
    );
  }
}
