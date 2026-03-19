import PptxGenJS from 'pptxgenjs';
import type { BoardPackData } from './types';

const palette = {
  ink: '10203F',
  navy: '16335F',
  blue: '2F67D8',
  teal: '0F8A78',
  amber: 'C77717',
  red: 'C43B3B',
  slate: '334155',
  muted: '64748B',
  border: 'D7DEE7',
  panel: 'F8FAFC',
  warm: 'FBF7F0',
  white: 'FFFFFF',
};

export async function buildBoardPackPptx(data: BoardPackData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'MEMA Consultants';
  pptx.company = 'MEMA Consultants';
  pptx.subject = data.title;
  pptx.title = data.title;
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  };

  const cover = pptx.addSlide();
  drawSlideBase(cover);
  cover.addShape('rect', { x: 0, y: 0, w: 13.333, h: 2.25, fill: { color: palette.navy }, line: { color: palette.navy, pt: 0 } });
  cover.addShape('rect', { x: 10.6, y: 0.35, w: 2.4, h: 1.25, fill: { color: palette.blue, transparency: 78 }, line: { color: palette.blue, transparency: 100, pt: 0 } });
  cover.addText(data.branding.organizationName, { x: 0.7, y: 0.4, w: 4.4, h: 0.2, fontSize: 10, color: palette.white, bold: true });
  cover.addText(data.title, { x: 0.7, y: 0.82, w: 8.2, h: 0.45, fontSize: 24, bold: true, color: palette.white });
  cover.addText(data.branding.subtitle || 'Board-ready complaints and ombudsman intelligence pack', { x: 0.7, y: 1.28, w: 7.8, h: 0.24, fontSize: 12, color: 'E2E8F0' });
  addPanel(cover, 0.7, 2.05, 11.9, 1.15, 'Scope and reporting frame', palette.white, palette.border);
  cover.addText(`Period: ${data.periodLabel}`, { x: 0.95, y: 2.33, w: 3.8, h: 0.18, fontSize: 10, color: palette.slate });
  cover.addText(`Generated: ${new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`, { x: 0.95, y: 2.55, w: 4.5, h: 0.18, fontSize: 10, color: palette.slate });
  cover.addText(data.sections.filter((section) => section.status === 'included').map((section) => section.title).join(' • '), {
    x: 0.95,
    y: 2.78,
    w: 11.35,
    h: 0.25,
    fontSize: 9,
    color: palette.muted,
    breakLine: false,
    fit: 'shrink',
  });
  addMetricCard(cover, 0.7, 3.55, 2.95, 1.05, 'FOS cases', formatNumber(data.summary.totalCases), palette.navy);
  addMetricCard(cover, 3.83, 3.55, 2.95, 1.05, 'Upheld rate', `${data.summary.upheldRate.toFixed(1)}%`, palette.blue);
  addMetricCard(cover, 6.96, 3.55, 2.95, 1.05, 'Open complaints', formatNumber(data.summary.openComplaints), palette.teal);
  addMetricCard(cover, 10.09, 3.55, 2.23, 1.05, 'Overdue', formatNumber(data.summary.overdueComplaints), palette.red);
  addFooter(cover, 'Cover', data.branding.organizationName);

  const summary = pptx.addSlide();
  drawSlideBase(summary);
  addTitle(summary, 'Executive Summary', 'Clear complaint posture, regulatory context, and management focus.');
  addPanel(summary, 0.7, 1.3, 6.8, 2.35, 'Executive overview', palette.warm, palette.border);
  summary.addText(
    data.boardNotes.executiveSummaryNote
      || `There are ${formatNumber(data.summary.totalCases)} FOS decisions in scope with an upheld rate of ${data.summary.upheldRate.toFixed(1)}%. The current complaint book shows ${formatNumber(data.summary.openComplaints)} open complaints and ${formatNumber(data.summary.overdueComplaints)} overdue matters requiring active management attention.`,
    { x: 0.95, y: 1.64, w: 6.3, h: 1.7, fontSize: 14, color: palette.slate, valign: 'top' }
  );
  addPanel(summary, 7.75, 1.3, 2.85, 1.1, 'Board focus', palette.panel, palette.border);
  summary.addText(data.boardNotes.boardFocusNote || 'Focus on overdue complaints, concentration risks, and recurring root-cause themes.', {
    x: 8.0,
    y: 1.66,
    w: 2.35,
    h: 0.56,
    fontSize: 10,
    color: palette.slate,
    valign: 'top',
  });
  addPanel(summary, 10.75, 1.3, 1.85, 1.1, 'Action lens', palette.panel, palette.border);
  summary.addText('Use this pack to challenge pace, ownership, and remediation sufficiency.', {
    x: 11.0,
    y: 1.66,
    w: 1.35,
    h: 0.56,
    fontSize: 10,
    color: palette.slate,
    valign: 'top',
  });
  addPanel(summary, 7.75, 2.55, 4.85, 1.1, 'Operational posture', palette.panel, palette.border);
  summary.addText([
    `Total complaints: ${formatNumber(data.summary.totalComplaints)}`,
    `Open complaints: ${formatNumber(data.summary.openComplaints)}`,
    `Overdue complaints: ${formatNumber(data.summary.overdueComplaints)}`,
    `Referred to FOS: ${formatNumber(data.summary.referredToFos)}`,
  ].join('\n'), {
    x: 8.0,
    y: 2.9,
    w: 4.35,
    h: 0.58,
    fontSize: 10,
    color: palette.slate,
    breakLine: false,
  });
  addPanel(summary, 0.7, 3.95, 11.9, 1.0, 'Management action summary', palette.panel, palette.border);
  summary.addText(data.boardNotes.actionSummaryNote || 'Immediate focus should be on overdue matters, repeat complaint themes, and any firms or products with elevated upheld volumes.', {
    x: 0.95,
    y: 4.29,
    w: 11.35,
    h: 0.36,
    fontSize: 11,
    color: palette.slate,
  });
  addFooter(summary, 'Executive Summary', data.branding.organizationName);

  const trends = pptx.addSlide();
  drawSlideBase(trends);
  addTitle(trends, 'Outcome and Trend Overview', 'Direction of travel across case volume and complaint exposure.');
  addPanel(trends, 0.7, 1.25, 7.0, 3.2, 'Trend table', palette.panel, palette.border);
  trends.addText('Year', { x: 0.95, y: 1.62, w: 0.5, h: 0.18, fontSize: 9, bold: true, color: palette.muted });
  trends.addText('Total', { x: 2.0, y: 1.62, w: 0.6, h: 0.18, fontSize: 9, bold: true, color: palette.muted });
  trends.addText('Upheld', { x: 3.0, y: 1.62, w: 0.8, h: 0.18, fontSize: 9, bold: true, color: palette.muted });
  trends.addText('Not upheld', { x: 4.2, y: 1.62, w: 1.0, h: 0.18, fontSize: 9, bold: true, color: palette.muted });
  let trendY = 1.92;
  data.trends.slice(0, 7).forEach((trend) => {
    trends.addText(String(trend.year), { x: 0.95, y: trendY, w: 0.7, h: 0.16, fontSize: 10, color: palette.ink });
    trends.addText(formatNumber(trend.total), { x: 2.0, y: trendY, w: 0.8, h: 0.16, fontSize: 10, color: palette.slate });
    trends.addText(formatNumber(trend.upheld), { x: 3.0, y: trendY, w: 0.8, h: 0.16, fontSize: 10, color: palette.slate });
    trends.addText(formatNumber(trend.notUpheld), { x: 4.2, y: trendY, w: 1.0, h: 0.16, fontSize: 10, color: palette.slate });
    trendY += 0.32;
  });
  addPanel(trends, 7.95, 1.25, 4.65, 1.0, 'Outcome mix', palette.warm, palette.border);
  trends.addText(`Upheld: ${data.summary.upheldRate.toFixed(1)}%\nNot upheld: ${data.summary.notUpheldRate.toFixed(1)}%`, {
    x: 8.2,
    y: 1.62,
    w: 4.1,
    h: 0.42,
    fontSize: 11,
    color: palette.slate,
  });
  addPanel(trends, 7.95, 2.45, 4.65, 1.0, 'Complaints posture', palette.panel, palette.border);
  trends.addText(`Open: ${formatNumber(data.summary.openComplaints)}\nOverdue: ${formatNumber(data.summary.overdueComplaints)}\nFOS referred: ${formatNumber(data.summary.referredToFos)}`, {
    x: 8.2,
    y: 2.82,
    w: 4.1,
    h: 0.48,
    fontSize: 10.5,
    color: palette.slate,
  });
  addPanel(trends, 7.95, 3.65, 4.65, 0.8, 'Interpretation', palette.panel, palette.border);
  trends.addText('Use this page to test whether complaints and upheld outcomes are trending in a way that requires escalation or remediation.', {
    x: 8.2,
    y: 3.97,
    w: 4.1,
    h: 0.28,
    fontSize: 10,
    color: palette.slate,
  });
  addFooter(trends, 'Outcome and Trend Overview', data.branding.organizationName);

  const concentration = pptx.addSlide();
  drawSlideBase(concentration);
  addTitle(concentration, 'Concentration and Root-Cause View', 'Which firms, products, and themes are driving exposure.');
  addPanel(concentration, 0.7, 1.25, 5.95, 3.15, 'Top firms', palette.panel, palette.border);
  addPanel(concentration, 6.95, 1.25, 5.65, 3.15, 'Top products', palette.panel, palette.border);
  data.topFirms.slice(0, 6).forEach((item, index) => {
    addListItem(concentration, 0.95, 1.62 + index * 0.44, 5.45, item.firm, `${formatNumber(item.total)} cases · ${item.upheldRate.toFixed(1)}% upheld`);
  });
  data.topProducts.slice(0, 6).forEach((item, index) => {
    addListItem(concentration, 7.2, 1.62 + index * 0.44, 5.15, item.product, `${formatNumber(item.total)} cases · ${item.upheldRate.toFixed(1)}% upheld`);
  });
  addPanel(concentration, 0.7, 4.55, 11.9, 0.85, 'Root-cause note', palette.warm, palette.border);
  concentration.addText(
    data.topRootCauses.length > 0
      ? data.topRootCauses.map((item) => `${item.label} (${formatNumber(item.count)})`).join(' • ')
      : 'No root-cause tags are currently available for this scope.',
    { x: 0.95, y: 4.89, w: 11.35, h: 0.24, fontSize: 10.5, color: palette.slate }
  );
  addFooter(concentration, 'Concentration and Root-Cause View', data.branding.organizationName);

  if (data.sections.some((section) => section.key === 'appendix' && section.status === 'included')) {
    const appendix = pptx.addSlide();
    drawSlideBase(appendix);
    addTitle(appendix, 'Appendix and Methodology', 'Scope notes, supporting trends, and presentation guidance.');
    addPanel(appendix, 0.7, 1.25, 11.9, 1.1, 'Included sections', palette.panel, palette.border);
    appendix.addText(data.sections.filter((section) => section.status === 'included').map((section) => section.title).join(' • '), {
      x: 0.95,
      y: 1.65,
      w: 11.35,
      h: 0.3,
      fontSize: 10.5,
      color: palette.slate,
    });
    addPanel(appendix, 0.7, 2.55, 11.9, 1.1, 'Trend support', palette.panel, palette.border);
    appendix.addText(data.trends.map((trend) => `${trend.year}: ${formatNumber(trend.total)} total, ${formatNumber(trend.upheld)} upheld, ${formatNumber(trend.notUpheld)} not upheld`).join(' | '), {
      x: 0.95,
      y: 2.95,
      w: 11.35,
      h: 0.36,
      fontSize: 10,
      color: palette.slate,
      fit: 'shrink',
    });
    addPanel(appendix, 0.7, 3.85, 5.75, 1.0, 'Recent complaint letters', palette.warm, palette.border);
    appendix.addText(
      data.appendix.recentLetters.length > 0
        ? data.appendix.recentLetters.slice(0, 3).map((item) => `${item.complaintReference} · ${item.subject} · ${item.status}`).join('\n')
        : 'No complaint letters are currently available for the selected reporting scope.',
      {
        x: 0.95,
        y: 4.2,
        w: 5.25,
        h: 0.52,
        fontSize: 9.5,
        color: palette.slate,
        breakLine: false,
        fit: 'shrink',
      }
    );
    addPanel(appendix, 6.85, 3.85, 5.75, 1.0, 'Recent complaint evidence', palette.panel, palette.border);
    appendix.addText(
      data.appendix.recentEvidence.length > 0
        ? data.appendix.recentEvidence.slice(0, 3).map((item) => `${item.complaintReference} · ${item.fileName} · ${item.category}`).join('\n')
        : 'No complaint evidence entries are currently available for the selected reporting scope.',
      {
        x: 7.1,
        y: 4.2,
        w: 5.25,
        h: 0.52,
        fontSize: 9.5,
        color: palette.slate,
        breakLine: false,
        fit: 'shrink',
      }
    );
    addPanel(appendix, 0.7, 5.1, 11.9, 0.92, 'Presentation and policy note', palette.warm, palette.border);
    appendix.addText('Use the board pack alongside the complaint register, remediation actions, and supporting complaint correspondence. Management commentary should explain any material data gaps before circulation.', {
      x: 0.95,
      y: 5.42,
      w: 11.35,
      h: 0.22,
      fontSize: 10,
      color: palette.slate,
    });
    appendix.addText(data.appendix.lateReferralText, {
      x: 0.95,
      y: 5.69,
      w: 11.35,
      h: 0.18,
      fontSize: 9,
      color: palette.muted,
      fit: 'shrink',
    });
    addFooter(appendix, 'Appendix and Methodology', data.branding.organizationName);
  }

  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}

function drawSlideBase(slide: PptxGenJS.Slide) {
  slide.background = { color: palette.white };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: palette.navy }, line: { color: palette.navy, pt: 0 } });
}

function addTitle(slide: PptxGenJS.Slide, title: string, subtitle: string) {
  slide.addText(title, { x: 0.7, y: 0.42, w: 6.4, h: 0.35, fontSize: 22, bold: true, color: palette.ink });
  slide.addText(subtitle, { x: 0.7, y: 0.82, w: 9.8, h: 0.2, fontSize: 10.5, color: palette.muted });
  slide.addShape('line', { x: 0.7, y: 1.08, w: 11.9, h: 0, line: { color: palette.border, pt: 1 } });
}

function addPanel(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, title: string, fillColor: string, borderColor: string) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: fillColor }, line: { color: borderColor, pt: 1 } });
  slide.addText(title, { x: x + 0.22, y: y + 0.18, w: w - 0.44, h: 0.16, fontSize: 11, bold: true, color: palette.ink });
}

function addMetricCard(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, label: string, value: string, accent: string) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.06, fill: { color: palette.white }, line: { color: palette.border, pt: 1 } });
  slide.addShape('rect', { x, y, w, h: 0.06, fill: { color: accent }, line: { color: accent, pt: 0 } });
  slide.addText(label, { x: x + 0.16, y: y + 0.18, w: w - 0.32, h: 0.18, fontSize: 9, color: palette.muted });
  slide.addText(value, { x: x + 0.16, y: y + 0.46, w: w - 0.32, h: 0.28, fontSize: 18, bold: true, color: palette.ink });
}

function addListItem(slide: PptxGenJS.Slide, x: number, y: number, w: number, title: string, meta: string) {
  slide.addShape('roundRect', { x, y, w, h: 0.32, rectRadius: 0.04, fill: { color: palette.white }, line: { color: palette.border, pt: 1 } });
  slide.addText(title, { x: x + 0.14, y: y + 0.07, w: w * 0.58, h: 0.12, fontSize: 9.5, bold: true, color: palette.ink, fit: 'shrink' });
  slide.addText(meta, { x: x + w * 0.58, y: y + 0.07, w: w * 0.34, h: 0.12, fontSize: 8.5, color: palette.muted, align: 'right', fit: 'shrink' });
}

function addFooter(slide: PptxGenJS.Slide, sectionTitle: string, organizationName: string) {
  slide.addShape('line', { x: 0.7, y: 7.18, w: 11.9, h: 0, line: { color: palette.border, pt: 1 } });
  slide.addText(`${organizationName} · FOS Complaints Intelligence`, { x: 0.7, y: 7.02, w: 5.8, h: 0.12, fontSize: 8, color: palette.muted });
  slide.addText(sectionTitle, { x: 10.2, y: 7.02, w: 2.4, h: 0.12, fontSize: 8, color: palette.muted, align: 'right' });
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-GB');
}
