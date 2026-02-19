import { getIngestionStatus } from '@/lib/fos/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const status = await getIngestionStatus();
    return Response.json({
      success: true,
      data: status,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch ingestion status.',
      },
      { status: 500 }
    );
  }
}
