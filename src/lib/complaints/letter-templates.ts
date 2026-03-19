import type { ComplaintLetterTemplateKey, ComplaintRecord, ComplaintWorkspaceSettings } from './types';

export function buildComplaintLetterDraft(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey,
  settings: ComplaintWorkspaceSettings,
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
  const defaultBody = bodyForTemplate(complaint, templateKey, settings, recipientName || 'Customer');

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
      return `Complaint acknowledgement and next steps - ${complaint.complaintReference}`;
    case 'holding_response':
      return `Complaint delay response - ${complaint.complaintReference}`;
    case 'final_response':
      return `Final response and Ombudsman rights - ${complaint.complaintReference}`;
    case 'fos_referral':
      return `FOS referral information - ${complaint.complaintReference}`;
    case 'custom':
    default:
      return `Complaint correspondence - ${complaint.complaintReference}`;
  }
}

function bodyForTemplate(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey,
  settings: ComplaintWorkspaceSettings,
  recipientName: string
): string {
  const received = formatDate(complaint.receivedDate);
  const fourWeek = formatDate(complaint.fourWeekDueDate);
  const eightWeek = formatDate(complaint.eightWeekDueDate);
  const resolution = complaint.resolution || 'The recorded complaint file does not yet contain the final outcome narrative. Complete this section before issue.';
  const redress = complaint.compensationAmount != null
    ? `We have recorded redress of GBP ${complaint.compensationAmount.toFixed(2)}.${complaint.remedialAction ? ` ${complaint.remedialAction}` : ''}`
    : complaint.remedialAction
      ? complaint.remedialAction
      : 'No redress or remedial action is currently recorded. Confirm this position before issue.';
  const matterSummary = complaint.description || `The complaint concerns ${complaint.product || 'the matter raised'} involving ${complaint.firmName}.`;
  const rootCause = complaint.rootCause || 'Root cause classification is still to be confirmed.';

  switch (templateKey) {
    case 'acknowledgement':
      return [
        `Dear ${recipientName},`,
        '',
        `Complaint reference: ${complaint.complaintReference}`,
        `Date received: ${received}`,
        '',
        'Thank you for your complaint. This letter confirms that we have received it and opened our investigation.',
        '',
        'Summary of your complaint',
        matterSummary,
        '',
        'What happens next',
        'We are reviewing the information currently available, including our internal records and any supporting evidence you have provided.',
        `We aim to provide a further progress update by ${fourWeek} and a final response by ${eightWeek}. If we are not in a position to issue a final response within eight weeks, we will explain why and set out your right to refer the complaint to the Financial Ombudsman Service.`,
        'If there is any further information you would like us to consider, please send it to us as soon as possible so it can be included in our review.',
        '',
        ...signoffLines(settings),
      ].join('\n');
    case 'holding_response':
      return [
        `Dear ${recipientName},`,
        '',
        `Complaint reference: ${complaint.complaintReference}`,
        '',
        'We are writing to explain that we are not yet in a position to issue our final response to your complaint.',
        '',
        'Current status of our investigation',
        `We have reviewed the complaint details recorded to date and the matter remains under investigation. The current complaint summary is: ${matterSummary}`,
        `At present, the underlying cause is recorded as: ${rootCause}`,
        '',
        'Why we need more time',
        'Additional review is still required to complete our assessment fairly and to confirm whether any remedial action or redress is appropriate.',
        `We currently expect to issue our final response by ${eightWeek}. If this date changes, we will update you again.`,
        '',
        'Your right to refer to the Financial Ombudsman Service',
        `Because eight weeks have now passed since we received your complaint on ${received}, you may now refer the complaint to the Financial Ombudsman Service free of charge if you do not want to wait for our final response.`,
        fosRightsParagraph('delay_response'),
        lateReferralPositionParagraph(settings),
        'Enclosure when issued: Financial Ombudsman Service standard explanatory leaflet.',
        '',
        ...signoffLines(settings),
      ].join('\n');
    case 'final_response':
      return [
        `Dear ${recipientName},`,
        '',
        `Complaint reference: ${complaint.complaintReference}`,
        `Date received: ${received}`,
        '',
        'This letter is our final response to your complaint.',
        '',
        'Our understanding of your complaint',
        matterSummary,
        '',
        'Our review',
        'We have considered the information recorded on the complaint file, the chronology of events, the relevant correspondence, and any evidence supplied to us.',
        '',
        'Our decision and reasons',
        resolution,
        '',
        'Redress and remedial action',
        redress,
        '',
        'If you remain dissatisfied',
        'The Financial Ombudsman Service is a free and independent service. If you remain unhappy with our final response, you may be able to ask them to review your complaint.',
        fosRightsParagraph('final_response'),
        lateReferralPositionParagraph(settings),
        'Enclosure when issued: Financial Ombudsman Service standard explanatory leaflet.',
        '',
        ...signoffLines(settings),
      ].join('\n');
    case 'fos_referral':
      return [
        `Dear ${recipientName},`,
        '',
        `Complaint reference: ${complaint.complaintReference}`,
        '',
        'You have asked for information about referring your complaint to the Financial Ombudsman Service.',
        '',
        'When you can refer the complaint',
        'You may usually refer the complaint if you remain dissatisfied with our final response, or if we have not issued a final response within the applicable complaint-handling timeframe.',
        '',
        'What to provide',
        'When contacting the Financial Ombudsman Service, include your complaint reference, a copy of the relevant response letter, and any supporting evidence you want them to consider.',
        '',
        'Financial Ombudsman Service details',
        fosRightsParagraph('fos_referral'),
        lateReferralPositionParagraph(settings),
        'Enclosure when issued: Financial Ombudsman Service standard explanatory leaflet.',
        '',
        ...signoffLines(settings),
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
        ...signoffLines(settings),
      ].join('\n');
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'the relevant deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date);
}

function fosRightsParagraph(context: 'delay_response' | 'final_response' | 'fos_referral'): string {
  const firstSentence = context === 'delay_response'
    ? 'You should usually do so within 6 months of the date of this letter, unless a different regulatory time limit applies to your complaint.'
    : 'You should usually do so within 6 months of the date of this letter, unless a different regulatory time limit applies to your complaint.';

  return [
    firstSentence,
    'The Financial Ombudsman Service website is www.financial-ombudsman.org.uk.',
    'If you do not refer your complaint within the relevant time limit, the Ombudsman may be unable to consider it unless the applicable rules allow otherwise.',
  ].join(' ');
}

function lateReferralPositionParagraph(settings: ComplaintWorkspaceSettings): string {
  if (settings.lateReferralPosition === 'consent') {
    return 'If the Financial Ombudsman Service receives your complaint outside the applicable time limit, our organisation consents to the Ombudsman considering the complaint.';
  }

  if (settings.lateReferralPosition === 'do_not_consent') {
    return 'If the Financial Ombudsman Service receives your complaint outside the applicable time limit, our organisation will not usually consent to the Ombudsman considering the complaint unless we decide otherwise in the circumstances of the individual case.';
  }

  if (settings.lateReferralPosition === 'custom' && sanitize(settings.lateReferralCustomText)) {
    return sanitize(settings.lateReferralCustomText);
  }

  if (settings.lateReferralPosition === 'review_required' && sanitize(settings.lateReferralCustomText)) {
    return sanitize(settings.lateReferralCustomText);
  }

  return 'Template completion note before issue: confirm whether your organisation will or will not consent to the Financial Ombudsman Service considering a complaint referred outside the applicable time limit, and update this paragraph to match the wording required by DISP 1 Annex 3R.';
}

function signoffLines(settings: ComplaintWorkspaceSettings): string[] {
  return [
    'Yours sincerely,',
    settings.complaintsTeamName || 'Complaints Team',
    settings.organizationName || 'MEMA Consultants',
    ...contactLines(settings),
  ];
}

function contactLines(settings: ComplaintWorkspaceSettings): string[] {
  const lines = [
    sanitize(settings.complaintsEmail),
    sanitize(settings.complaintsPhone),
    sanitize(settings.complaintsAddress),
  ].filter(Boolean);

  return lines.length > 0 ? ['', ...lines] : [];
}

function sanitize(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMultiline(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}
