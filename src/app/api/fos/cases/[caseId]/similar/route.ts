import { NextRequest } from 'next/server';
import { getSimilarCases, getCaseContext } from '@/lib/fos/cases-repository';
import { FOSSimilarCasesApiResponse } from '@/types/fos-dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    if (!caseId) {
      return Response.json({ success: false, error: 'Missing caseId.' }, { status: 400 });
    }

    const [cases, context] = await Promise.all([
      getSimilarCases(caseId, 10),
      getCaseContext(caseId),
    ]);

    if (!context) {
      return Response.json({ success: false, error: 'Case not found.' }, { status: 404 });
    }

    return Response.json(
      {
        success: true,
        data: { cases, context },
      } satisfies FOSSimilarCasesApiResponse,
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find similar cases.',
      },
      { status: 500 }
    );
  }
}
