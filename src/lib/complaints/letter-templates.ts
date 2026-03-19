import type { ComplaintLetterTemplateKey, ComplaintRecord } from './types';

export function buildComplaintLetterDraft(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey,
  overrides?: {
    subject?: string | null;
    bodyText?: string | null;
    recipientName?: string | null;
    recipientEmail?: string | null;
  }
): {
  subject: string;
  bodyText: string;
  recipientName: string | null;
  recipientEmail: string | null;
} {
  const recipientName = sanitize(overrides?.recipientName) || complaint.complainantName;
  const recipientEmail = sanitize(overrides?.recipientEmail) || complaint.complainantEmail;
  const defaultSubject = subjectForTemplate(complaint, templateKey);
  const defaultBody = bodyForTemplate(complaint, templateKey, recipientName || 'Customer');

  return {
    subject: sanitize(overrides?.subject) || defaultSubject,
    bodyText: sanitizeMultiline(overrides?.bodyText) || defaultBody,
    recipientName: recipientName || null,
    recipientEmail: recipientEmail || null,
  };
}

function subjectForTemplate(complaint: ComplaintRecord, templateKey: ComplaintLetterTemplateKey): string {
  switch (templateKey) {
    case 'acknowledgement':
      return `Complaint acknowledgement - ${complaint.complaintReference}`;
    case 'holding_response':
      return `Complaint update - ${complaint.complaintReference}`;
    case 'final_response':
      return `Final response - ${complaint.complaintReference}`;
    case 'fos_referral':
      return `FOS referral information - ${complaint.complaintReference}`;
    case 'custom':
    default:
      return `Complaint correspondence - ${complaint.complaintReference}`;
  }
}

function bodyForTemplate(complaint: ComplaintRecord, templateKey: ComplaintLetterTemplateKey, recipientName: string): string {
  const received = formatDate(complaint.receivedDate);
  const fourWeek = formatDate(complaint.fourWeekDueDate);
  const eightWeek = formatDate(complaint.eightWeekDueDate);
  const resolution = complaint.resolution || 'our investigation is ongoing.';
  const redress = complaint.compensationAmount != null ? `A redress payment of GBP ${complaint.compensationAmount.toFixed(2)} has been recorded.` : 'No redress payment has been recorded at this stage.';

  switch (templateKey) {
    case 'acknowledgement':
      return [
        `Dear ${recipientName},`,
        '',
        `We acknowledge receipt of your complaint (${complaint.complaintReference}) regarding ${complaint.product || 'the matter raised'} with ${complaint.firmName}.`,
        `We recorded your complaint on ${received}. Our team is reviewing the circumstances and will keep you updated as the investigation progresses.`,
        `We aim to provide a further update by ${fourWeek} and a final response by ${eightWeek}.`,
        '',
        'Yours sincerely,',
        'Complaints Team',
      ].join('\n');
    case 'holding_response':
      return [
        `Dear ${recipientName},`,
        '',
        `We are writing with an update on complaint ${complaint.complaintReference}. Our review is continuing and we need more time to complete the investigation thoroughly.`,
        `We expect to issue our final response by ${eightWeek}. If you are dissatisfied with the delay, you may refer the complaint to the Financial Ombudsman Service after that date.`,
        '',
        'Yours sincerely,',
        'Complaints Team',
      ].join('\n');
    case 'final_response':
      return [
        `Dear ${recipientName},`,
        '',
        `This is our final response to complaint ${complaint.complaintReference}.`,
        `Outcome: ${resolution}`,
        redress,
        'If you remain dissatisfied, you may refer the complaint to the Financial Ombudsman Service within the applicable time limit.',
        '',
        'Yours sincerely,',
        'Complaints Team',
      ].join('\n');
    case 'fos_referral':
      return [
        `Dear ${recipientName},`,
        '',
        `You may refer complaint ${complaint.complaintReference} to the Financial Ombudsman Service if you remain dissatisfied with our handling or final response.`,
        'Please include your complaint reference and any supporting evidence when you contact them.',
        '',
        'Yours sincerely,',
        'Complaints Team',
      ].join('\n');
    case 'custom':
    default:
      return [
        `Dear ${recipientName},`,
        '',
        `Re: complaint ${complaint.complaintReference}`,
        '',
        'Please replace this draft with the required correspondence.',
        '',
        'Yours sincerely,',
        'Complaints Team',
      ].join('\n');
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'the relevant deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
}

function sanitize(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMultiline(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
