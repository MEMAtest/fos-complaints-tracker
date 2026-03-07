import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

export async function POST(request: Request) {
  try {
    let body: ExportRequestBody;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const { title, filters, kpis, generatedAt } = body;

    if (!kpis || typeof kpis.totalCases !== 'number' || typeof kpis.upheldRate !== 'number' || typeof kpis.notUpheldRate !== 'number') {
      return Response.json(
        { success: false, error: 'Missing or invalid kpis object. Required: totalCases, upheldRate, notUpheldRate (numbers).' },
        { status: 400 }
      );
    }

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
    const dateStr = generatedAt
      ? new Date(generatedAt).toLocaleString('en-GB', {
          dateStyle: 'long',
          timeStyle: 'short',
        })
      : new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

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

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fos-report-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Content-Length': String(pdfBytes.length),
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF.',
      },
      { status: 500 }
    );
  }
}
