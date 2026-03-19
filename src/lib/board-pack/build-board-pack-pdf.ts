import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import type { BoardPackData } from './types';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 42;
const LINE_HEIGHT = 16;
const SECTION_GAP = 14;

export async function buildBoardPackPdf(data: BoardPackData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const theme = {
    navy: rgb(0.07, 0.12, 0.31),
    blue: rgb(0.13, 0.38, 0.86),
    slate: rgb(0.27, 0.31, 0.39),
    muted: rgb(0.45, 0.49, 0.58),
    border: rgb(0.84, 0.87, 0.91),
    panel: rgb(0.97, 0.98, 0.99),
    green: rgb(0.04, 0.58, 0.42),
    red: rgb(0.89, 0.2, 0.3),
  };

  const ensureSpace = (needed: number) => {
    if (y - needed > MARGIN) return;
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };

  const drawWrapped = (text: string, x: number, width: number, size = 10, font = regular, color = theme.slate) => {
    const words = text.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      page.drawText(line, { x, y, size, font, color });
      y -= LINE_HEIGHT;
      line = word;
      ensureSpace(LINE_HEIGHT + 20);
    }
    if (line) {
      page.drawText(line, { x, y, size, font, color });
      y -= LINE_HEIGHT;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(36);
    page.drawText(title, { x: MARGIN, y, size: 16, font: bold, color: theme.navy });
    y -= 12;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: theme.border });
    y -= 18;
  };

  const drawMetricStrip = () => {
    const metrics = [
      { label: 'FOS cases', value: formatNumber(data.summary.totalCases), tone: theme.navy },
      { label: 'Upheld rate', value: `${data.summary.upheldRate.toFixed(1)}%`, tone: theme.blue },
      { label: 'Open complaints', value: formatNumber(data.summary.openComplaints), tone: theme.green },
      { label: 'Overdue complaints', value: formatNumber(data.summary.overdueComplaints), tone: theme.red },
    ];
    const gap = 12;
    const boxWidth = (PAGE_WIDTH - MARGIN * 2 - gap * 3) / 4;
    const boxHeight = 70;
    ensureSpace(boxHeight + 12);
    metrics.forEach((metric, index) => {
      const x = MARGIN + index * (boxWidth + gap);
      page.drawRectangle({ x, y: y - boxHeight, width: boxWidth, height: boxHeight, color: theme.panel, borderColor: theme.border, borderWidth: 1 });
      page.drawText(metric.label, { x: x + 12, y: y - 18, size: 9, font: regular, color: theme.muted });
      page.drawText(metric.value, { x: x + 12, y: y - 44, size: 18, font: bold, color: metric.tone });
    });
    y -= boxHeight + SECTION_GAP;
  };

  page.drawText(data.title, { x: MARGIN, y, size: 22, font: bold, color: theme.navy });
  y -= 28;
  page.drawText('Board-ready complaints pack', { x: MARGIN, y, size: 12, font: regular, color: theme.slate });
  y -= 20;
  page.drawText(`Period: ${data.periodLabel}`, { x: MARGIN, y, size: 10, font: regular, color: theme.muted });
  y -= 14;
  page.drawText(`Generated: ${new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`, {
    x: MARGIN,
    y,
    size: 10,
    font: regular,
    color: theme.muted,
  });
  y -= 22;

  drawMetricStrip();

  drawSectionTitle('Executive summary');
  const executiveSummary = data.boardNotes.executiveSummaryNote
    || `The current FOS dataset shows ${formatNumber(data.summary.totalCases)} decisions in scope with an upheld rate of ${data.summary.upheldRate.toFixed(1)}%. Operational complaints data shows ${formatNumber(data.summary.openComplaints)} open complaints and ${formatNumber(data.summary.overdueComplaints)} overdue cases requiring immediate management attention.`;
  drawWrapped(executiveSummary, MARGIN, PAGE_WIDTH - MARGIN * 2, 11, regular, theme.slate);
  if (data.boardNotes.boardFocusNote) {
    y -= 4;
    drawWrapped(`Board focus: ${data.boardNotes.boardFocusNote}`, MARGIN, PAGE_WIDTH - MARGIN * 2, 10, bold, theme.navy);
  }

  drawSectionTitle('Outcome and trend overview');
  drawWrapped(`Upheld rate: ${data.summary.upheldRate.toFixed(1)}%. Not upheld rate: ${data.summary.notUpheldRate.toFixed(1)}%.`, MARGIN, PAGE_WIDTH - MARGIN * 2);
  y -= 4;
  data.trends.slice(0, 6).forEach((trend) => {
    ensureSpace(18);
    page.drawText(`${trend.year}`, { x: MARGIN, y, size: 10, font: bold, color: theme.navy });
    page.drawText(`${formatNumber(trend.total)} cases · ${formatNumber(trend.upheld)} upheld · ${formatNumber(trend.notUpheld)} not upheld`, {
      x: MARGIN + 60,
      y,
      size: 10,
      font: regular,
      color: theme.slate,
    });
    y -= 16;
  });

  drawSectionTitle('Firm and product concentration');
  const columnGap = 28;
  const colWidth = (PAGE_WIDTH - MARGIN * 2 - columnGap) / 2;
  const colTop = y;
  let leftY = colTop;
  let rightY = colTop;
  page.drawText('Top firms', { x: MARGIN, y: leftY, size: 11, font: bold, color: theme.navy });
  page.drawText('Top products', { x: MARGIN + colWidth + columnGap, y: rightY, size: 11, font: bold, color: theme.navy });
  leftY -= 18;
  rightY -= 18;
  data.topFirms.slice(0, 6).forEach((item) => {
    page.drawText(`${item.firm}`, { x: MARGIN, y: leftY, size: 10, font: regular, color: theme.slate });
    page.drawText(`${formatNumber(item.total)} · ${item.upheldRate.toFixed(1)}% upheld`, { x: MARGIN + colWidth - 110, y: leftY, size: 9, font: regular, color: theme.muted });
    leftY -= 15;
  });
  data.topProducts.slice(0, 6).forEach((item) => {
    page.drawText(`${item.product}`, { x: MARGIN + colWidth + columnGap, y: rightY, size: 10, font: regular, color: theme.slate });
    page.drawText(`${formatNumber(item.total)} · ${item.upheldRate.toFixed(1)}% upheld`, { x: MARGIN + colWidth + columnGap + colWidth - 110, y: rightY, size: 9, font: regular, color: theme.muted });
    rightY -= 15;
  });
  y = Math.min(leftY, rightY) - SECTION_GAP;

  drawSectionTitle('Root causes and operational health');
  const rootCauseSummary = data.topRootCauses.length > 0
    ? data.topRootCauses.map((item) => `${item.label} (${formatNumber(item.count)})`).join(', ')
    : 'No root-cause tags currently available.';
  drawWrapped(`Top root causes: ${rootCauseSummary}`, MARGIN, PAGE_WIDTH - MARGIN * 2);
  y -= 4;
  drawWrapped(`Operational complaints: ${formatNumber(data.summary.totalComplaints)} total complaints, ${formatNumber(data.summary.openComplaints)} open, ${formatNumber(data.summary.referredToFos)} referred to FOS, ${formatNumber(data.summary.overdueComplaints)} overdue.`, MARGIN, PAGE_WIDTH - MARGIN * 2);

  drawSectionTitle('Management actions');
  const actionSummary = data.boardNotes.actionSummaryNote
    || `Immediate management focus should be on overdue complaints, repeat root causes, and any firms or products with elevated upheld volumes.`;
  drawWrapped(actionSummary, MARGIN, PAGE_WIDTH - MARGIN * 2, 11, regular, theme.slate);

  if (data.sections.some((section) => section.key === 'appendix' && section.status === 'included')) {
    drawSectionTitle('Appendix');
    drawWrapped(
      `Included sections: ${data.sections.filter((section) => section.status === 'included').map((section) => section.title).join(', ')}.`,
      MARGIN,
      PAGE_WIDTH - MARGIN * 2,
      10,
      regular,
      theme.muted
    );
  }

  pages.forEach((pdfPage, index) => {
    pdfPage.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: PAGE_WIDTH - MARGIN, y: 28 }, thickness: 0.75, color: theme.border });
    pdfPage.drawText('MEMA Consultants · FOS Complaints Intelligence', { x: MARGIN, y: 14, size: 8, font: regular, color: theme.muted });
    pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(`Page ${index + 1} of ${pages.length}`, 8),
      y: 14,
      size: 8,
      font: regular,
      color: theme.muted,
    });
  });

  return pdfDoc.save();
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-GB');
}
