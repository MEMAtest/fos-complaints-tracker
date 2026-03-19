import { NextRequest } from 'next/server';
import { getComplaintEvidenceContent } from '@/lib/complaints/repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ evidenceId: string }> }) {
  try {
    const { evidenceId } = await params;
    const evidence = await getComplaintEvidenceContent(evidenceId);
    if (!evidence) {
      return Response.json({ success: false, error: 'Evidence not found.' }, { status: 404 });
    }

    return new Response(evidence.fileBytes, {
      headers: {
        'Content-Type': evidence.contentType,
        'Content-Disposition': `attachment; filename="${evidence.fileName.replace(/\"/g, '')}"`,
        'Content-Length': String(evidence.fileSize),
      },
    });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to download evidence.' }, { status: 500 });
  }
}
