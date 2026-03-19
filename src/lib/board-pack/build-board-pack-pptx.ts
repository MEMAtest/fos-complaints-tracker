import PptxGenJS from 'pptxgenjs';
import type { BoardPackData } from './types';

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
  cover.background = { color: 'F7FAFC' };
  cover.addText(data.title, { x: 0.6, y: 0.6, w: 11.4, h: 0.6, fontSize: 26, bold: true, color: '10204A' });
  cover.addText('Board-ready complaints pack', { x: 0.6, y: 1.3, w: 4.5, h: 0.3, fontSize: 14, color: '475569' });
  cover.addText(`Period: ${data.periodLabel}`, { x: 0.6, y: 1.8, w: 4, h: 0.3, fontSize: 11, color: '64748B' });
  cover.addText(`Generated: ${new Date(data.generatedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`, { x: 0.6, y: 2.1, w: 5, h: 0.3, fontSize: 11, color: '64748B' });
  addMetricCard(cover, 0.6, 3.0, 'FOS cases', String(data.summary.totalCases), '10204A');
  addMetricCard(cover, 3.2, 3.0, 'Upheld rate', `${data.summary.upheldRate.toFixed(1)}%`, '2563EB');
  addMetricCard(cover, 5.8, 3.0, 'Open complaints', String(data.summary.openComplaints), '059669');
  addMetricCard(cover, 8.4, 3.0, 'Overdue complaints', String(data.summary.overdueComplaints), 'DC2626');

  const summary = pptx.addSlide();
  summary.addText('Executive summary', { x: 0.6, y: 0.5, w: 4, h: 0.4, fontSize: 22, bold: true, color: '10204A' });
  summary.addText(
    data.boardNotes.executiveSummaryNote
      || `The current FOS population shows ${data.summary.totalCases.toLocaleString('en-GB')} cases in scope with an upheld rate of ${data.summary.upheldRate.toFixed(1)}%. Operational complaints data shows ${data.summary.openComplaints.toLocaleString('en-GB')} open complaints and ${data.summary.overdueComplaints.toLocaleString('en-GB')} overdue cases requiring escalation.`,
    { x: 0.6, y: 1.2, w: 11.2, h: 1.6, fontSize: 15, color: '334155', breakLine: false, valign: 'top' }
  );
  summary.addText(`Board focus: ${data.boardNotes.boardFocusNote || 'Focus on overdue complaints, elevated upheld concentrations, and repeat root-cause themes.'}`, {
    x: 0.6,
    y: 3.0,
    w: 11.2,
    h: 0.8,
    fontSize: 14,
    bold: true,
    color: '10204A',
    fill: { color: 'E2E8F0' },
    margin: 0.16,
  });

  const concentration = pptx.addSlide();
  concentration.addText('Concentration overview', { x: 0.6, y: 0.5, w: 4.4, h: 0.4, fontSize: 22, bold: true, color: '10204A' });
  concentration.addText('Top firms', { x: 0.6, y: 1.2, w: 2.4, h: 0.3, fontSize: 14, bold: true, color: '10204A' });
  concentration.addText('Top products', { x: 6.3, y: 1.2, w: 2.4, h: 0.3, fontSize: 14, bold: true, color: '10204A' });
  data.topFirms.slice(0, 6).forEach((firm, index) => {
    concentration.addText(`${firm.firm}\n${firm.total.toLocaleString('en-GB')} cases · ${firm.upheldRate.toFixed(1)}% upheld`, {
      x: 0.6,
      y: 1.6 + index * 0.8,
      w: 5.0,
      h: 0.65,
      fontSize: 12,
      color: '334155',
      fill: { color: 'F8FAFC' },
      line: { color: 'CBD5E1', pt: 1 },
      margin: 0.12,
    });
  });
  data.topProducts.slice(0, 6).forEach((product, index) => {
    concentration.addText(`${product.product}\n${product.total.toLocaleString('en-GB')} cases · ${product.upheldRate.toFixed(1)}% upheld`, {
      x: 6.3,
      y: 1.6 + index * 0.8,
      w: 5.0,
      h: 0.65,
      fontSize: 12,
      color: '334155',
      fill: { color: 'F8FAFC' },
      line: { color: 'CBD5E1', pt: 1 },
      margin: 0.12,
    });
  });

  const risks = pptx.addSlide();
  risks.addText('Root causes and actions', { x: 0.6, y: 0.5, w: 4.4, h: 0.4, fontSize: 22, bold: true, color: '10204A' });
  risks.addText(`Top root causes: ${data.topRootCauses.map((item) => `${item.label} (${item.count})`).join(', ') || 'No tagged root causes yet.'}`, {
    x: 0.6,
    y: 1.2,
    w: 11,
    h: 1,
    fontSize: 15,
    color: '334155',
  });
  risks.addText(
    data.boardNotes.actionSummaryNote || 'Immediate actions should prioritise overdue complaints, recurring root causes, and any business lines with rising upheld concentrations.',
    {
      x: 0.6,
      y: 2.6,
      w: 11,
      h: 1.5,
      fontSize: 16,
      color: '10204A',
      fill: { color: 'E0F2FE' },
      line: { color: '93C5FD', pt: 1 },
      margin: 0.16,
    }
  );

  const appendix = pptx.addSlide();
  appendix.addText('Appendix', { x: 0.6, y: 0.5, w: 3.6, h: 0.4, fontSize: 22, bold: true, color: '10204A' });
  appendix.addText(`Included sections: ${data.sections.filter((section) => section.status === 'included').map((section) => section.title).join(', ')}`, {
    x: 0.6,
    y: 1.2,
    w: 11,
    h: 0.8,
    fontSize: 12,
    color: '475569',
  });
  appendix.addText(`Trend rows: ${data.trends.map((trend) => `${trend.year}: ${trend.total}`).join(' | ')}`, {
    x: 0.6,
    y: 2.0,
    w: 11,
    h: 1,
    fontSize: 12,
    color: '334155',
  });

  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}

function addMetricCard(slide: PptxGenJS.Slide, x: number, y: number, label: string, value: string, accent: string) {
  slide.addShape('roundRect', { x, y, w: 2.2, h: 1.2, fill: { color: 'FFFFFF' }, line: { color: 'CBD5E1', pt: 1 } });
  slide.addText(label, { x: x + 0.16, y: y + 0.16, w: 1.9, h: 0.22, fontSize: 10, color: '64748B' });
  slide.addText(value, { x: x + 0.16, y: y + 0.48, w: 1.9, h: 0.4, fontSize: 20, bold: true, color: accent });
}
