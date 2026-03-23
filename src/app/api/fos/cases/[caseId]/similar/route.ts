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
    if (!caseId || caseId.length > 200 || !/^[a-zA-Z0-9_\-]+$/.test(caseId)) {
      return Response.json({ success: false, error: 'Invalid or missing caseId.' }, { status: 400 });
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
    console.error('[similar-cases]', error instanceof Error ? error.message : error);
    return Response.json(
      { success: false, error: 'Failed to find similar cases.' },
      { status: 500 }
    );
  }
}
