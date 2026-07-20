import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { clientKeyFromRequest, RateLimitError, rateLimitOrThrow } from '@/lib/server/rate-limit';
import { logRouteMetric } from '@/lib/server/route-metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ExportRequestBody {
  title: string;
  filters: Record<string, string | string[] | number[] | undefined>;
  kpis: {
    totalCases: number;
    upheldRate: number;
    notUpheldRate: number;
  };
  generatedAt: string;
}

const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const ROUTE = '/api/fos/export';
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_FILTER_ENTRIES = 20;
const EXPORT_RATE_LIMIT = parsePositiveInt(process.env.FOS_EXPORT_RATE_LIMIT, 20, 1, 1_000);
const EXPORT_RATE_WINDOW_MS = parsePositiveInt(
  process.env.FOS_EXPORT_RATE_WINDOW_MS,
  60_000,
  10_000,
  24 * 60 * 60_000
);

function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safePdfText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '?')
    .trim()
    .slice(0, maxLength);
}

function logExportMetric(startedAt: number, status: number, detail?: Record<string, unknown>) {
  logRouteMetric({ route: ROUTE, method: 'POST', status, durationMs: Date.now() - startedAt, detail });
}

function exportError(startedAt: number, status: number, message: string, detail?: Record<string, unknown>, headers?: HeadersInit) {
  logExportMetric(startedAt, status, detail);
  return Response.json({ success: false, error: message }, { status, headers });
}

async function readBoundedJson(request: Request): Promise<{ body?: unknown; error?: 'invalid_json' | 'request_too_large' }> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return { error: 'request_too_large' };
  }

  try {
    return { body: JSON.parse(rawBody) as unknown };
  } catch {
    return { error: 'invalid_json' };
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return exportError(startedAt, 413, 'Request body is too large.', { reason: 'request_too_large' });
    }

    const parsedBody = await readBoundedJson(request);
    if (parsedBody.error === 'request_too_large') {
      return exportError(startedAt, 413, 'Request body is too large.', { reason: 'request_too_large' });
    }
    if (parsedBody.error === 'invalid_json') {
      return exportError(startedAt, 400, 'Invalid JSON request body.', { reason: 'invalid_json' });
    }

    const body = parsedBody.body as ExportRequestBody;

    if (!body || typeof body !== 'object') {
      return exportError(startedAt, 400, 'Invalid request body.', { reason: 'invalid_body' });
    }

    const { kpis } = body;

    if (
      !kpis ||
      !Number.isInteger(kpis.totalCases) ||
      kpis.totalCases < 0 ||
      kpis.totalCases > 10_000_000 ||
      !Number.isFinite(kpis.upheldRate) ||
      kpis.upheldRate < 0 ||
      kpis.upheldRate > 1 ||
      !Number.isFinite(kpis.notUpheldRate) ||
      kpis.notUpheldRate < 0 ||
      kpis.notUpheldRate > 1
    ) {
      return exportError(startedAt, 400, 'Missing or invalid KPI values.', { reason: 'invalid_kpis' });
    }

    if (!body.filters || typeof body.filters !== 'object' || Array.isArray(body.filters)) {
      return exportError(startedAt, 400, 'Missing or invalid filters object.', { reason: 'invalid_filters' });
    }

    const rawFilterEntries = Object.entries(body.filters);
    if (rawFilterEntries.length > MAX_FILTER_ENTRIES) {
      return exportError(startedAt, 400, `A maximum of ${MAX_FILTER_ENTRIES} filters is allowed.`, { reason: 'too_many_filters' });
    }

    const title = safePdfText(body.title, 160);
    const generatedDate = body.generatedAt ? new Date(body.generatedAt) : new Date();
    if (Number.isNaN(generatedDate.getTime())) {
      return exportError(startedAt, 400, 'Invalid generatedAt date.', { reason: 'invalid_date' });
    }

    const filters = Object.fromEntries(
      rawFilterEntries.map(([key, value]) => {
        const safeKey = safePdfText(key, 50);
        const safeValue = Array.isArray(value)
          ? value.slice(0, 50).map((item) => safePdfText(item, 200))
          : safePdfText(value, 500);
        return [safeKey, safeValue];
      })
    );

    await rateLimitOrThrow(clientKeyFromRequest(request, 'fos-export'), EXPORT_RATE_LIMIT, EXPORT_RATE_WINDOW_MS);

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN;

    const darkBlue = rgb(0.1, 0.2, 0.4);
    const darkGrey = rgb(0.25, 0.25, 0.25);
    const medGrey = rgb(0.45, 0.45, 0.45);
    const lineGrey = rgb(0.8, 0.8, 0.8);

    // --- Header ---
    page.drawText('FOS Complaints Intelligence Report', {
      x: MARGIN,
      y,
      size: 20,
      font: helveticaBold,
      color: darkBlue,
    });
    y -= 28;

    // Subtitle
    if (title) {
      page.drawText(title, {
        x: MARGIN,
        y,
        size: 13,
        font: helvetica,
        color: darkGrey,
      });
      y -= 20;
    }

    // Date
    const dateStr = generatedDate.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

    page.drawText(`Generated: ${dateStr}`, {
      x: MARGIN,
      y,
      size: 10,
      font: helvetica,
      color: medGrey,
    });
    y -= 14;

    // Divider
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 1,
      color: lineGrey,
    });
    y -= 30;

    // --- Active Filters ---
    page.drawText('Active Filters', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: darkBlue,
    });
    y -= 22;

    const filterEntries = Object.entries(filters).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });

    if (filterEntries.length === 0) {
      page.drawText('No filters applied', {
        x: MARGIN + 10,
        y,
        size: 10,
        font: helvetica,
        color: medGrey,
      });
      y -= 16;
    } else {
      for (const [key, value] of filterEntries) {
        const display = Array.isArray(value) ? value.join(', ') : String(value);
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        // Truncate long filter values to fit on page
        const truncated = display.length > 80 ? display.slice(0, 77) + '...' : display;
        page.drawText(`${label}: ${truncated}`, {
          x: MARGIN + 10,
          y,
          size: 10,
          font: helvetica,
          color: darkGrey,
        });
        y -= 16;
      }
    }

    y -= 14;

    // Divider
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 1,
      color: lineGrey,
    });
    y -= 30;

    // --- Key Performance Indicators ---
    page.drawText('Key Performance Indicators', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: darkBlue,
    });
    y -= 28;

    const kpiItems = [
      { label: 'Total Cases', value: kpis.totalCases.toLocaleString() },
      { label: 'Upheld Rate', value: `${(kpis.upheldRate * 100).toFixed(1)}%` },
      { label: 'Not Upheld Rate', value: `${(kpis.notUpheldRate * 100).toFixed(1)}%` },
    ];

    // Draw KPI boxes side by side
    const boxWidth = (CONTENT_WIDTH - 20) / 3;
    const boxHeight = 60;

    for (let i = 0; i < kpiItems.length; i++) {
      const bx = MARGIN + i * (boxWidth + 10);

      // Box background
      page.drawRectangle({
        x: bx,
        y: y - boxHeight,
        width: boxWidth,
        height: boxHeight,
        color: rgb(0.95, 0.96, 0.98),
        borderColor: lineGrey,
        borderWidth: 0.5,
      });

      // KPI value (large, centered)
      const valueWidth = helveticaBold.widthOfTextAtSize(kpiItems[i].value, 20);
      page.drawText(kpiItems[i].value, {
        x: bx + (boxWidth - valueWidth) / 2,
        y: y - 28,
        size: 20,
        font: helveticaBold,
        color: darkBlue,
      });

      // KPI label (small, centered)
      const labelWidth = helvetica.widthOfTextAtSize(kpiItems[i].label, 9);
      page.drawText(kpiItems[i].label, {
        x: bx + (boxWidth - labelWidth) / 2,
        y: y - 46,
        size: 9,
        font: helvetica,
        color: medGrey,
      });
    }

    y -= boxHeight + 30;

    // --- Footer ---
    const footerY = MARGIN;
    page.drawLine({
      start: { x: MARGIN, y: footerY + 14 },
      end: { x: MARGIN + CONTENT_WIDTH, y: footerY + 14 },
      thickness: 0.5,
      color: lineGrey,
    });
    page.drawText('Generated by MEMA Consultants', {
      x: MARGIN,
      y: footerY,
      size: 8,
      font: helvetica,
      color: medGrey,
    });

    const pdfBytes = await pdfDoc.save();

    logExportMetric(startedAt, 200, { totalCases: kpis.totalCases, filterCount: filterEntries.length });

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fos-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Content-Length': String(pdfBytes.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return exportError(
        startedAt,
        error.status,
        'Too many export requests. Please try again later.',
        { reason: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds },
        { 'Retry-After': String(error.retryAfterSeconds) }
      );
    }

    return exportError(startedAt, 500, 'Failed to generate PDF.', {
      reason: 'export_failed',
      internalMessage: error instanceof Error ? error.message : 'Unknown export failure.',
    });
  }
}
