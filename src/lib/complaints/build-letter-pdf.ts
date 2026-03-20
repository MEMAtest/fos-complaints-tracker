import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ComplaintLetter, ComplaintRecord, ComplaintWorkspaceSettings } from './types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 54;
const HEADER_HEIGHT = 110;
const FOOTER_HEIGHT = 54;

const palette = {
  navy: rgb(0.07, 0.16, 0.34),
  blue: rgb(0.14, 0.39, 0.78),
  ink: rgb(0.08, 0.12, 0.22),
  slate: rgb(0.34, 0.39, 0.46),
  muted: rgb(0.49, 0.53, 0.61),
  border: rgb(0.84, 0.87, 0.92),
  panel: rgb(0.97, 0.98, 0.99),
  white: rgb(1, 1, 1),
};

const BODY_HEADINGS = new Set([
  'Summary of your complaint',
  'What happens next',
  'Current status of our investigation',
  'Why we need more time',
  'Your right to refer to the Financial Ombudsman Service',
  'Our understanding of your complaint',
  'Our review',
  'Our decision and reasons',
  'Redress and remedial action',
  'If you remain dissatisfied',
  'When you can refer the complaint',
  'What to provide',
  'Financial Ombudsman Service details',
]);

export async function buildComplaintLetterPdf(input: {
  complaint: ComplaintRecord;
  letter: ComplaintLetter;
  settings: ComplaintWorkspaceSettings;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];

  let page = addPage(pdf, pages, input.settings, regular, bold);
  let y = PAGE_HEIGHT - HEADER_HEIGHT - 34;

  const recipientBlock = [
    input.letter.recipientName || input.complaint.complainantName,
    input.complaint.complainantAddress,
    input.letter.recipientEmail || input.complaint.complainantEmail,
  ].filter(Boolean) as string[];

  recipientBlock.forEach((line) => {
    page.drawText(line, { x: MARGIN, y, size: 10.5, font: regular, color: palette.ink });
    y -= 14;
  });

  if (recipientBlock.length > 0) y -= 10;

  const metaLines = [
    `Complaint reference: ${input.complaint.complaintReference}`,
    `Letter type: ${formatTemplateLabel(input.letter.templateKey)}`,
    `Issue date: ${formatDateTime(input.letter.createdAt)}`,
  ];

  page.drawRectangle({
    x: MARGIN,
    y: y - 6,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 54,
    color: palette.panel,
    borderColor: palette.border,
    borderWidth: 1,
  });

  metaLines.forEach((line) => {
    page.drawText(line, { x: MARGIN + 12, y, size: 10, font: regular, color: palette.slate });
    y -= 13;
  });

  y -= 12;
  page.drawText(input.letter.subject, { x: MARGIN, y, size: 16, font: bold, color: palette.ink });
  y -= 24;

  for (const paragraph of splitParagraphs(input.letter.bodyText)) {
    const trimmed = paragraph.trim();
    if (isHeading(trimmed)) {
      if (y - 24 < FOOTER_HEIGHT + 12) {
        page = addPage(pdf, pages, input.settings, regular, bold);
        y = PAGE_HEIGHT - HEADER_HEIGHT - 34;
      }
      page.drawText(trimmed, { x: MARGIN, y, size: 11.5, font: bold, color: palette.blue });
      y -= 18;
      continue;
    }

    const lines = wrapText(paragraph, PAGE_WIDTH - MARGIN * 2, 11, regular);
    const neededHeight = Math.max(16, lines.length * 15);
    if (y - neededHeight < FOOTER_HEIGHT + 12) {
      page = addPage(pdf, pages, input.settings, regular, bold);
      y = PAGE_HEIGHT - HEADER_HEIGHT - 34;
    }

    if (lines.length === 0) {
      y -= 15;
      continue;
    }

    lines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y, size: 11, font: regular, color: palette.ink });
      y -= 15;
    });
    y -= 6;
  }

  pages.forEach((currentPage, index) => drawFooter(currentPage, regular, input.settings, index + 1, pages.length));
  return pdf.save();
}

function addPage(pdf: PDFDocument, pages: PDFPage[], settings: ComplaintWorkspaceSettings, regular: PDFFont, bold: PDFFont): PDFPage {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT, width: PAGE_WIDTH, height: HEADER_HEIGHT, color: palette.navy });
  page.drawRectangle({ x: PAGE_WIDTH - 110, y: PAGE_HEIGHT - HEADER_HEIGHT, width: 110, height: HEADER_HEIGHT, color: palette.blue, opacity: 0.12 });
  page.drawText(settings.organizationName || 'MEMA Consultants', {
    x: MARGIN,
    y: PAGE_HEIGHT - 42,
    size: 18,
    font: bold,
    color: palette.white,
  });
  page.drawText(settings.complaintsTeamName || 'Complaints Team', {
    x: MARGIN,
    y: PAGE_HEIGHT - 63,
    size: 10.5,
    font: regular,
    color: palette.white,
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - HEADER_HEIGHT - 8 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - HEADER_HEIGHT - 8 },
    thickness: 1,
    color: palette.border,
  });

  return page;
}

function drawFooter(page: PDFPage, regular: PDFFont, settings: ComplaintWorkspaceSettings, pageNumber: number, totalPages: number) {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_HEIGHT },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_HEIGHT },
    thickness: 0.75,
    color: palette.border,
  });

  const footerLines = [
    settings.organizationName || 'MEMA Consultants',
    settings.complaintsEmail,
    settings.complaintsPhone,
  ].filter(Boolean) as string[];

  page.drawText(footerLines.join(' · '), { x: MARGIN, y: 34, size: 8.5, font: regular, color: palette.muted });
  const pageLabel = `Page ${pageNumber} of ${totalPages}`;
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 8.5),
    y: 34,
    size: 8.5,
    font: regular,
    color: palette.muted,
  });
}

function splitParagraphs(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function wrapText(text: string, width: number, size: number, font: PDFFont): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
      return;
    }

    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
}

function formatTemplateLabel(templateKey: ComplaintLetter['templateKey']): string {
  switch (templateKey) {
    case 'acknowledgement':
      return 'Acknowledgement';
    case 'holding_response':
      return 'Delay response';
    case 'final_response':
      return 'Final response';
    case 'fos_referral':
      return 'FOS referral';
    case 'custom':
    default:
      return 'Custom correspondence';
  }
}

function isHeading(value: string): boolean {
  return BODY_HEADINGS.has(value);
}
