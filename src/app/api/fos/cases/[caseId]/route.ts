import { getCaseDetail } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteParams = {
  params: {
    caseId: string;
  };
};

export async function GET(_: Request, context: RouteParams) {
  try {
    const caseId = decodeURIComponent(context.params.caseId || '').trim();
    if (!caseId) {
      return Response.json({ success: false, error: 'Case ID is required.' }, { status: 400 });
    }

    const detail = await getCaseDetail(caseId);
    if (!detail) {
      return Response.json({ success: false, error: 'Case not found.' }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch case detail.',
      },
      { status: 500 }
    );
  }
}
