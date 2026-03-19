import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { BoardPackData } from './types';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 42;

const theme = {
  ink: rgb(0.08, 0.12, 0.22),
  navy: rgb(0.07, 0.16, 0.34),
  blue: rgb(0.14, 0.39, 0.78),
  teal: rgb(0.05, 0.53, 0.47),
  amber: rgb(0.79, 0.46, 0.09),
  red: rgb(0.74, 0.18, 0.22),
  slate: rgb(0.32, 0.37, 0.46),
  muted: rgb(0.49, 0.53, 0.61),
  border: rgb(0.84, 0.87, 0.92),
  panel: rgb(0.97, 0.98, 0.99),
  panelWarm: rgb(0.99, 0.98, 0.95),
  white: rgb(1, 1, 1),
};

export async function buildBoardPackPdf(data: BoardPackData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];

  const cover = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(cover);
  drawCoverPage(cover, data, regular, bold);

  const summary = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(summary);
  drawSummaryPage(summary, data, regular, bold);

  const concentration = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(concentration);
  drawConcentrationPage(concentration, data, regular, bold);

  if (data.sections.some((section) => section.key === 'appendix' && section.status === 'included')) {
    const appendix = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(appendix);
    drawAppendixPage(appendix, data, regular, bold);
  }

  pages.forEach((page, index) => drawFooter(page, regular, data.branding.organizationName, index + 1, pages.length));
  return pdfDoc.save();
}

function drawCoverPage(page: PDFPage, data: BoardPackData, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.panel });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 210, width: PAGE_WIDTH, height: 210, color: theme.navy });
  page.drawRectangle({ x: PAGE_WIDTH - 160, y: PAGE_HEIGHT - 190, width: 220, height: 120, color: theme.blue, opacity: 0.18 });
  page.drawRectangle({ x: PAGE_WIDTH - 250, y: PAGE_HEIGHT - 240, width: 120, height: 160, color: theme.teal, opacity: 0.12 });

  page.drawText(data.branding.organizationName, { x: MARGIN, y: PAGE_HEIGHT - 48, size: 10, font: regular, color: theme.white });
  page.drawText(data.title, { x: MARGIN, y: PAGE_HEIGHT - 96, size: 28, font: bold, color: theme.white });
  page.drawText(data.branding.subtitle || 'Board-ready complaints and ombudsman intelligence pack', { x: MARGIN, y: PAGE_HEIGHT - 126, size: 13, font: regular, color: theme.white });

  drawRoundedPanel(page, MARGIN, PAGE_HEIGHT - 340, PAGE_WIDTH - MARGIN * 2, 112, theme.white, theme.border);
  page.drawText('Scope and reporting frame', { x: MARGIN + 18, y: PAGE_HEIGHT - 366, size: 12, font: bold, color: theme.ink });
  page.drawText(`Period: ${data.periodLabel}`, { x: MARGIN + 18, y: PAGE_HEIGHT - 392, size: 10, font: regular, color: theme.slate });
  page.drawText(`Generated: ${new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`, {
    x: MARGIN + 18,
    y: PAGE_HEIGHT - 408,
    size: 10,
    font: regular,
    color: theme.slate,
  });
  const included = data.sections.filter((section) => section.status === 'included').map((section) => section.title);
  drawWrappedText(page, included.join(' • '), MARGIN + 18, PAGE_HEIGHT - 434, PAGE_WIDTH - MARGIN * 2 - 36, 10, regular, theme.muted, 13);

  const cardWidth = (PAGE_WIDTH - MARGIN * 2 - 24) / 4;
  const metricY = 118;
  drawMetricCard(page, MARGIN, metricY, cardWidth, 82, 'FOS cases', formatNumber(data.summary.totalCases), theme.navy, regular, bold);
  drawMetricCard(page, MARGIN + cardWidth + 8, metricY, cardWidth, 82, 'Upheld rate', `${data.summary.upheldRate.toFixed(1)}%`, theme.blue, regular, bold);
  drawMetricCard(page, MARGIN + (cardWidth + 8) * 2, metricY, cardWidth, 82, 'Open complaints', formatNumber(data.summary.openComplaints), theme.teal, regular, bold);
  drawMetricCard(page, MARGIN + (cardWidth + 8) * 3, metricY, cardWidth, 82, 'Overdue complaints', formatNumber(data.summary.overdueComplaints), theme.red, regular, bold);
}

function drawSummaryPage(page: PDFPage, data: BoardPackData, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.white });
  drawPageTitle(page, 'Executive Summary', 'Clear complaint posture, regulatory context, and management focus.', regular, bold);

  drawRoundedPanel(page, MARGIN, 330, 480, 172, theme.panelWarm, theme.border);
  page.drawText('Executive overview', { x: MARGIN + 18, y: 478, size: 12, font: bold, color: theme.ink });
  const executiveSummary = data.boardNotes.executiveSummaryNote
    || `There are ${formatNumber(data.summary.totalCases)} FOS decisions in scope with an upheld rate of ${data.summary.upheldRate.toFixed(1)}%. The operational complaint book currently contains ${formatNumber(data.summary.openComplaints)} open complaints and ${formatNumber(data.summary.overdueComplaints)} overdue matters that require active management attention.`;
  drawWrappedText(page, executiveSummary, MARGIN + 18, 452, 444, 11, regular, theme.slate, 15);

  drawRoundedPanel(page, 546, 410, 254, 92, theme.panel, theme.border);
  page.drawText('Board focus', { x: 564, y: 478, size: 11, font: bold, color: theme.ink });
  drawWrappedText(page, data.boardNotes.boardFocusNote || 'Focus on overdue complaints, concentration risks, and recurring root-cause themes.', 564, 456, 218, 10, regular, theme.slate, 14);

  drawRoundedPanel(page, 546, 300, 254, 92, theme.panel, theme.border);
  page.drawText('Management action lens', { x: 564, y: 368, size: 11, font: bold, color: theme.ink });
  drawWrappedText(page, data.boardNotes.actionSummaryNote || 'Prioritise overdue matters, repeat complaint themes, and any population with rising upheld volumes.', 564, 346, 218, 10, regular, theme.slate, 14);

  drawRoundedPanel(page, MARGIN, 92, PAGE_WIDTH - MARGIN * 2, 188, theme.panel, theme.border);
  page.drawText('Trend and operational snapshot', { x: MARGIN + 18, y: 252, size: 12, font: bold, color: theme.ink });
  const leftX = MARGIN + 18;
  const rowYStart = 228;
  page.drawText('Year', { x: leftX, y: rowYStart, size: 9, font: bold, color: theme.muted });
  page.drawText('Total', { x: leftX + 72, y: rowYStart, size: 9, font: bold, color: theme.muted });
  page.drawText('Upheld', { x: leftX + 132, y: rowYStart, size: 9, font: bold, color: theme.muted });
  page.drawText('Not upheld', { x: leftX + 208, y: rowYStart, size: 9, font: bold, color: theme.muted });
  let rowY = rowYStart - 18;
  data.trends.slice(0, 6).forEach((trend) => {
    page.drawText(String(trend.year), { x: leftX, y: rowY, size: 10, font: regular, color: theme.ink });
    page.drawText(formatNumber(trend.total), { x: leftX + 72, y: rowY, size: 10, font: regular, color: theme.slate });
    page.drawText(formatNumber(trend.upheld), { x: leftX + 132, y: rowY, size: 10, font: regular, color: theme.slate });
    page.drawText(formatNumber(trend.notUpheld), { x: leftX + 208, y: rowY, size: 10, font: regular, color: theme.slate });
    rowY -= 18;
  });

  drawRoundedPanel(page, 496, 118, 304, 136, theme.white, theme.border);
  page.drawText('Operational posture', { x: 514, y: 226, size: 11, font: bold, color: theme.ink });
  const operationsLines = [
    `Total complaints: ${formatNumber(data.summary.totalComplaints)}`,
    `Open complaints: ${formatNumber(data.summary.openComplaints)}`,
    `Overdue complaints: ${formatNumber(data.summary.overdueComplaints)}`,
    `Referred to FOS: ${formatNumber(data.summary.referredToFos)}`,
    `Not upheld rate: ${data.summary.notUpheldRate.toFixed(1)}%`,
  ];
  operationsLines.forEach((line, index) => {
    page.drawText(line, { x: 514, y: 198 - index * 18, size: 10, font: regular, color: theme.slate });
  });
}

function drawConcentrationPage(page: PDFPage, data: BoardPackData, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.white });
  drawPageTitle(page, 'Concentration and Root-Cause View', 'Where volume, uphold rates, and complaint themes are clustering.', regular, bold);

  drawRoundedPanel(page, MARGIN, 184, 356, 318, theme.panel, theme.border);
  drawRoundedPanel(page, 444, 184, 356, 318, theme.panel, theme.border);
  page.drawText('Top firms', { x: MARGIN + 18, y: 474, size: 12, font: bold, color: theme.ink });
  page.drawText('Top products', { x: 462, y: 474, size: 12, font: bold, color: theme.ink });

  let firmY = 442;
  data.topFirms.slice(0, 6).forEach((item) => {
    drawMiniRowCard(page, MARGIN + 18, firmY, 320, 38, item.firm, `${formatNumber(item.total)} cases · ${item.upheldRate.toFixed(1)}% upheld`, regular, bold);
    firmY -= 46;
  });

  let productY = 442;
  data.topProducts.slice(0, 6).forEach((item) => {
    drawMiniRowCard(page, 462, productY, 320, 38, item.product, `${formatNumber(item.total)} cases · ${item.upheldRate.toFixed(1)}% upheld`, regular, bold);
    productY -= 46;
  });

  drawRoundedPanel(page, MARGIN, 54, PAGE_WIDTH - MARGIN * 2, 104, theme.panelWarm, theme.border);
  page.drawText('Root-cause and governance note', { x: MARGIN + 18, y: 130, size: 12, font: bold, color: theme.ink });
  const rootCauseText = data.topRootCauses.length > 0
    ? data.topRootCauses.map((item) => `${item.label} (${formatNumber(item.count)})`).join(' • ')
    : 'No root-cause tags currently available for this reporting scope.';
  drawWrappedText(page, `Top root causes: ${rootCauseText}`, MARGIN + 18, 108, PAGE_WIDTH - MARGIN * 2 - 36, 10.5, regular, theme.slate, 14);
  drawWrappedText(page, 'Use this page to challenge whether management attention is directed to the businesses, products, and recurring themes that are driving complaint exposure and upheld outcomes.', MARGIN + 18, 78, PAGE_WIDTH - MARGIN * 2 - 36, 10, regular, theme.muted, 13);
}

function drawAppendixPage(page: PDFPage, data: BoardPackData, regular: PDFFont, bold: PDFFont) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: theme.white });
  drawPageTitle(page, 'Appendix and Methodology', 'Scope notes, included sections, and supporting observations.', regular, bold);

  drawRoundedPanel(page, MARGIN, 362, PAGE_WIDTH - MARGIN * 2, 140, theme.panel, theme.border);
  page.drawText('Included sections', { x: MARGIN + 18, y: 474, size: 12, font: bold, color: theme.ink });
  const included = data.sections.filter((section) => section.status === 'included').map((section) => section.title);
  drawWrappedText(page, included.join(' • '), MARGIN + 18, 448, PAGE_WIDTH - MARGIN * 2 - 36, 10.5, regular, theme.slate, 14);
  page.drawText('Trend support', { x: MARGIN + 18, y: 396, size: 11, font: bold, color: theme.ink });
  drawWrappedText(page, data.trends.map((trend) => `${trend.year}: ${formatNumber(trend.total)} total, ${formatNumber(trend.upheld)} upheld, ${formatNumber(trend.notUpheld)} not upheld`).join(' | '), MARGIN + 18, 372, PAGE_WIDTH - MARGIN * 2 - 36, 10, regular, theme.slate, 13);

  drawRoundedPanel(page, MARGIN, 172, 360, 164, theme.panelWarm, theme.border);
  page.drawText('Recent complaint letters', { x: MARGIN + 18, y: 308, size: 12, font: bold, color: theme.ink });
  if (data.appendix.recentLetters.length === 0) {
    drawWrappedText(page, 'No complaint letters are currently available for the selected reporting scope.', MARGIN + 18, 284, 324, 10, regular, theme.muted, 14);
  } else {
    let y = 286;
    data.appendix.recentLetters.slice(0, 4).forEach((item) => {
      drawWrappedText(page, `${item.complaintReference} · ${item.subject}`, MARGIN + 18, y, 324, 9.5, bold, theme.ink, 12);
      y -= 14;
      drawWrappedText(page, `${item.status.toUpperCase()} · ${item.recipientName || 'No named recipient'} · ${new Date(item.createdAt).toLocaleString('en-GB', { dateStyle: 'medium' })}`, MARGIN + 18, y, 324, 9, regular, theme.slate, 12);
      y -= 20;
    });
  }

  drawRoundedPanel(page, 548, 172, 252, 164, theme.panel, theme.border);
  page.drawText('Recent complaint evidence', { x: 566, y: 308, size: 12, font: bold, color: theme.ink });
  if (data.appendix.recentEvidence.length === 0) {
    drawWrappedText(page, 'No complaint evidence entries are currently available for the selected reporting scope.', 566, 284, 216, 10, regular, theme.muted, 14);
  } else {
    let y = 286;
    data.appendix.recentEvidence.slice(0, 4).forEach((item) => {
      drawWrappedText(page, `${item.complaintReference} · ${item.fileName}`, 566, y, 216, 9.5, bold, theme.ink, 12);
      y -= 14;
      drawWrappedText(page, `${item.category} · ${item.summary || 'No summary recorded'}`, 566, y, 216, 9, regular, theme.slate, 12);
      y -= 20;
    });
  }

  drawRoundedPanel(page, MARGIN, 54, PAGE_WIDTH - MARGIN * 2, 96, theme.panelWarm, theme.border);
  page.drawText('Presentation and policy note', { x: MARGIN + 18, y: 126, size: 12, font: bold, color: theme.ink });
  drawWrappedText(page, 'This board pack is designed to support oversight discussions. It should be read alongside the underlying complaint register, remediation plans, and any complaint correspondence referenced in committee papers.', MARGIN + 18, 100, PAGE_WIDTH - MARGIN * 2 - 36, 10, regular, theme.slate, 13);
  drawWrappedText(page, data.appendix.lateReferralText, MARGIN + 18, 74, PAGE_WIDTH - MARGIN * 2 - 36, 9.5, regular, theme.muted, 12);
}

function drawPageTitle(page: PDFPage, title: string, subtitle: string, regular: PDFFont, bold: PDFFont) {
  page.drawText(title, { x: MARGIN, y: PAGE_HEIGHT - 54, size: 22, font: bold, color: theme.navy });
  page.drawText(subtitle, { x: MARGIN, y: PAGE_HEIGHT - 78, size: 10.5, font: regular, color: theme.muted });
  page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 92 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 92 }, thickness: 1, color: theme.border });
}

function drawMetricCard(page: PDFPage, x: number, y: number, width: number, height: number, label: string, value: string, accent: ReturnType<typeof rgb>, regular: PDFFont, bold: PDFFont) {
  drawRoundedPanel(page, x, y, width, height, theme.white, theme.border);
  page.drawRectangle({ x, y: y + height - 5, width, height: 5, color: accent });
  page.drawText(label, { x: x + 14, y: y + height - 24, size: 9, font: regular, color: theme.muted });
  page.drawText(value, { x: x + 14, y: y + 24, size: 20, font: bold, color: theme.ink });
}

function drawMiniRowCard(page: PDFPage, x: number, y: number, width: number, height: number, title: string, meta: string, regular: PDFFont, bold: PDFFont) {
  drawRoundedPanel(page, x, y, width, height, theme.white, theme.border);
  page.drawText(title, { x: x + 12, y: y + height - 15, size: 10, font: bold, color: theme.ink });
  page.drawText(meta, { x: x + 12, y: y + 10, size: 9, font: regular, color: theme.muted });
}

function drawRoundedPanel(page: PDFPage, x: number, y: number, width: number, height: number, fill: ReturnType<typeof rgb>, border: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color: fill, borderColor: border, borderWidth: 1 });
}

function drawWrappedText(page: PDFPage, text: string, x: number, y: number, width: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>, leading: number) {
  const lines = wrapText(text, width, size, font);
  let currentY = y;
  lines.forEach((line) => {
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= leading;
  });
}

function wrapText(text: string, width: number, size: number, font: PDFFont): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawFooter(page: PDFPage, regular: PDFFont, organizationName: string, pageNumber: number, totalPages: number) {
  page.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: PAGE_WIDTH - MARGIN, y: 28 }, thickness: 0.75, color: theme.border });
  page.drawText(`${organizationName} · FOS Complaints Intelligence`, { x: MARGIN, y: 14, size: 8, font: regular, color: theme.muted });
  const text = `Page ${pageNumber} of ${totalPages}`;
  page.drawText(text, { x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(text, 8), y: 14, size: 8, font: regular, color: theme.muted });
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-GB');
}
