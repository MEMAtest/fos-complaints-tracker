import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/session';
import { buildBoardPackData } from '@/lib/board-pack/repository';
import { buildBoardPackPdf } from '@/lib/board-pack/build-board-pack-pdf';
import { buildBoardPackPptx } from '@/lib/board-pack/build-board-pack-pptx';
import { recordBoardPackRun } from '@/lib/complaints/repository';
import type { BoardPackRequest } from '@/lib/board-pack/types';
import { clientKeyFromRequest, RateLimitError, rateLimitOrThrow } from '@/lib/server/rate-limit';
import { logRouteMetric } from '@/lib/server/route-metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: BoardPackRequest | null = null;
  let generatedBy: string | null = null;
  const startedAt = Date.now();
  let actor: string | null = null;
  try {
    const user = await requireAuthenticatedUser(request, 'manager');
    generatedBy = user.fullName;
    actor = user.email;
    rateLimitOrThrow(clientKeyFromRequest(request, `board-pack-generate:${user.email}`), 10, 600_000);
    body = await request.json();
    if (!body || typeof body !== 'object') {
      return Response.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const data = await buildBoardPackData(body);
    const fileStem = slugify(body.title || 'fos-complaints-board-pack');
    const generatedAt = new Date().toISOString().slice(0, 10);

    if (body.format === 'pptx') {
      const pptxBuffer = await buildBoardPackPptx(data);
      const fileName = `${fileStem}-${generatedAt}.pptx`;
      await recordBoardPackRun({
        format: 'pptx',
        status: 'success',
        title: data.title,
        fileName,
        generatedBy,
        requestPayload: body,
      });
      logRouteMetric({
        route: '/api/fos/board-pack/generate',
        method: 'POST',
        status: 200,
        durationMs: Date.now() - startedAt,
        actor,
        detail: { format: 'pptx', title: data.title },
      });
      return new Response(pptxBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(pptxBuffer.length),
        },
      });
    }

    const pdfBytes = await buildBoardPackPdf(data);
    const fileName = `${fileStem}-${generatedAt}.pdf`;
    await recordBoardPackRun({
      format: 'pdf',
      status: 'success',
      title: data.title,
      fileName,
      generatedBy,
      requestPayload: body,
    });
    logRouteMetric({
      route: '/api/fos/board-pack/generate',
      method: 'POST',
      status: 200,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { format: 'pdf', title: data.title },
    });
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    if (body) {
      await recordBoardPackRun({
        format: body.format || 'pdf',
        status: 'failed',
        title: body.title || 'FOS Complaints Board Pack',
        generatedBy,
        requestPayload: body,
      }).catch(() => undefined);
    }
    const status = 'status' in (error as object) ? Number((error as { status?: number }).status || 500) : 500;
    logRouteMetric({
      route: '/api/fos/board-pack/generate',
      method: 'POST',
      status,
      durationMs: Date.now() - startedAt,
      actor,
      detail: { format: body?.format || 'pdf', error: error instanceof Error ? error.message : 'Failed to generate board pack.' },
    });
    if (error instanceof RateLimitError) {
      return Response.json({ success: false, error: error.message }, { status, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate board pack.' }, { status });
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fos-complaints-board-pack';
}
