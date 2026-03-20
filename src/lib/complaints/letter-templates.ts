import type { ComplaintLetterTemplateKey, ComplaintRecord, ComplaintWorkspaceSettings } from './types';

export type ComplaintLetterDecisionPath = 'upheld' | 'not_upheld' | 'partially_upheld' | 'other';

export interface ComplaintLetterStructuredSection {
  key: string;
  label: string;
  value: string;
  placeholder: string;
}

export interface ComplaintLetterStructuredEditorState {
  templateKey: ComplaintLetterTemplateKey;
  sections: ComplaintLetterStructuredSection[];
  lockedSectionLabels: string[];
  decisionPath: ComplaintLetterDecisionPath | null;
}

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
  const structuredDefaults = getDefaultStructuredEditorState(complaint, templateKey);
  const defaultBody = structuredDefaults
    ? composeComplaintLetterBodyFromStructuredState(complaint, templateKey, settings, recipientName || 'Customer', structuredDefaults)
    : composeCustomBody(complaint, settings, recipientName || 'Customer');

  return {
    subject: sanitize(overrides?.subject) || defaultSubject,
    bodyText: sanitizeMultiline(overrides?.bodyText) || defaultBody,
    recipientName: recipientName || null,
    recipientEmail: recipientEmail || null,
  };
}

export function getComplaintLetterStructuredEditorState(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey,
  settings: ComplaintWorkspaceSettings,
  bodyText: string,
  recipientName: string
): ComplaintLetterStructuredEditorState | null {
  const defaults = getDefaultStructuredEditorState(complaint, templateKey);
  if (!defaults) return null;

  const parsed = parseStructuredEditorState(templateKey, bodyText, defaults);
  if (parsed) {
    return parsed;
  }

  const recomposed = composeComplaintLetterBodyFromStructuredState(
    complaint,
    templateKey,
    settings,
    recipientName,
    defaults
  );

  if (sanitizeMultiline(bodyText) === sanitizeMultiline(recomposed)) {
    return defaults;
  }

  return null;
}

export function composeComplaintLetterBodyFromStructuredState(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey,
  settings: ComplaintWorkspaceSettings,
  recipientName: string,
  state: ComplaintLetterStructuredEditorState
): string {
  const received = formatDate(complaint.receivedDate);
  const fourWeek = formatDate(complaint.fourWeekDueDate);
  const eightWeek = formatDate(complaint.eightWeekDueDate);

  const section = (key: string) => state.sections.find((item) => item.key === key)?.value.trim() || '';

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
        section('complaint_summary'),
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
        section('investigation_status'),
        '',
        'Why we need more time',
        section('delay_reason'),
        '',
        'Your right to refer to the Financial Ombudsman Service',
        `Because eight weeks have now passed since we received your complaint on ${received}, you may now refer the complaint to the Financial Ombudsman Service free of charge if you do not want to wait for our final response.`,
        fosRightsParagraph('delay_response'),
        lateReferralPositionParagraph(settings),
        'Enclosure when issued: Financial Ombudsman Service standard explanatory leaflet.',
        '',
        ...signoffLines(settings),
      ].join('\n');
    case 'final_response': {
      const decisionLead = decisionPathSentence(state.decisionPath);
      return [
        `Dear ${recipientName},`,
        '',
        `Complaint reference: ${complaint.complaintReference}`,
        `Date received: ${received}`,
        '',
        'This letter is our final response to your complaint.',
        '',
        'Our understanding of your complaint',
        section('complaint_summary'),
        '',
        'Our review',
        section('review_summary'),
        '',
        'Our decision and reasons',
        ...(decisionLead ? [decisionLead] : []),
        section('decision_reasons'),
        '',
        'Redress and remedial action',
        section('redress'),
        '',
        'If you remain dissatisfied',
        'The Financial Ombudsman Service is a free and independent service. If you remain unhappy with our final response, you may be able to ask them to review your complaint.',
        fosRightsParagraph('final_response'),
        lateReferralPositionParagraph(settings),
        'Enclosure when issued: Financial Ombudsman Service standard explanatory leaflet.',
        '',
        ...signoffLines(settings),
      ].join('\n');
    }
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
        section('what_to_provide'),
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
      return composeCustomBody(complaint, settings, recipientName);
  }
}

function getDefaultStructuredEditorState(
  complaint: ComplaintRecord,
  templateKey: ComplaintLetterTemplateKey
): ComplaintLetterStructuredEditorState | null {
  const matterSummary = complaint.description || `The complaint concerns ${complaint.product || 'the matter raised'} involving ${complaint.firmName}.`;
  const rootCause = complaint.rootCause || 'Root cause classification is still to be confirmed.';
  const resolution = complaint.resolution || 'Set out the final decision, the fair outcome, and the evidence that supports that position before issue.';
  const redress = complaint.compensationAmount != null
    ? `We have recorded redress of GBP ${complaint.compensationAmount.toFixed(2)}.${complaint.remedialAction ? ` ${complaint.remedialAction}` : ''}`
    : complaint.remedialAction
      ? complaint.remedialAction
      : 'Confirm whether any apology, remedial action, or financial redress is appropriate before issue.';

  switch (templateKey) {
    case 'acknowledgement':
      return {
        templateKey,
        decisionPath: null,
        lockedSectionLabels: ['What happens next', 'Ombudsman timing rights', 'Sign-off'],
        sections: [
          {
            key: 'complaint_summary',
            label: 'Complaint summary',
            value: matterSummary,
            placeholder: 'Summarise the complaint in customer-facing terms.',
          },
        ],
      };
    case 'holding_response':
      return {
        templateKey,
        decisionPath: null,
        lockedSectionLabels: ['Ombudsman timing rights', 'Standard explanatory leaflet note', 'Sign-off'],
        sections: [
          {
            key: 'investigation_status',
            label: 'Investigation status',
            value: `We have reviewed the complaint details recorded to date and the matter remains under investigation. The current complaint summary is: ${matterSummary}\n\nAt present, the underlying cause is recorded as: ${rootCause}`,
            placeholder: 'Explain the current investigation position and what has been reviewed so far.',
          },
          {
            key: 'delay_reason',
            label: 'Reason for delay',
            value: 'Additional review is still required to complete our assessment fairly and to confirm whether any remedial action or redress is appropriate.',
            placeholder: 'Explain clearly why more time is needed and what remains outstanding.',
          },
        ],
      };
    case 'final_response':
      return {
        templateKey,
        decisionPath: inferDecisionPath(complaint),
        lockedSectionLabels: ['Final-response introduction', 'FOS rights wording', 'Late-referral wording', 'Sign-off'],
        sections: [
          {
            key: 'complaint_summary',
            label: 'Complaint summary',
            value: matterSummary,
            placeholder: 'Summarise the complaint facts and customer position.',
          },
          {
            key: 'review_summary',
            label: 'Review completed',
            value: 'We have considered the information recorded on the complaint file, the chronology of events, the relevant correspondence, and any evidence supplied to us.',
            placeholder: 'Describe the review steps, records checked, and evidence considered.',
          },
          {
            key: 'decision_reasons',
            label: 'Decision reasons',
            value: resolution,
            placeholder: 'Set out the decision rationale, including findings and fairness analysis.',
          },
          {
            key: 'redress',
            label: 'Redress and remedial action',
            value: redress,
            placeholder: 'Set out apology, remediation, and any compensation clearly.',
          },
        ],
      };
    case 'fos_referral':
      return {
        templateKey,
        decisionPath: null,
        lockedSectionLabels: ['Referral eligibility wording', 'FOS contact wording', 'Late-referral wording', 'Sign-off'],
        sections: [
          {
            key: 'what_to_provide',
            label: 'Information to provide',
            value: 'When contacting the Financial Ombudsman Service, include your complaint reference, a copy of the relevant response letter, and any supporting evidence you want them to consider.',
            placeholder: 'List the documents or information the customer should take to FOS.',
          },
        ],
      };
    case 'custom':
    default:
      return null;
  }
}

function parseStructuredEditorState(
  templateKey: ComplaintLetterTemplateKey,
  bodyText: string,
  fallback: ComplaintLetterStructuredEditorState
): ComplaintLetterStructuredEditorState | null {
  const normalized = bodyText.replace(/\r\n/g, '\n');

  switch (templateKey) {
    case 'acknowledgement': {
      const summary = extractSectionValue(normalized, 'Summary of your complaint', 'What happens next');
      if (summary == null) return null;
      return {
        ...fallback,
        sections: replaceStructuredSectionValue(fallback.sections, 'complaint_summary', summary),
      };
    }
    case 'holding_response': {
      const investigationStatus = extractSectionValue(normalized, 'Current status of our investigation', 'Why we need more time');
      const delayReason = extractSectionValue(normalized, 'Why we need more time', 'Your right to refer to the Financial Ombudsman Service');
      if (investigationStatus == null || delayReason == null) return null;
      return {
        ...fallback,
        sections: replaceStructuredSectionValue(
          replaceStructuredSectionValue(fallback.sections, 'investigation_status', investigationStatus),
          'delay_reason',
          delayReason
        ),
      };
    }
    case 'final_response': {
      const complaintSummary = extractSectionValue(normalized, 'Our understanding of your complaint', 'Our review');
      const reviewSummary = extractSectionValue(normalized, 'Our review', 'Our decision and reasons');
      const decisionSection = extractSectionValue(normalized, 'Our decision and reasons', 'Redress and remedial action');
      const redress = extractSectionValue(normalized, 'Redress and remedial action', 'If you remain dissatisfied');
      if (complaintSummary == null || reviewSummary == null || decisionSection == null || redress == null) return null;
      const parsedDecision = parseDecisionSection(decisionSection, fallback.decisionPath || 'other');
      return {
        ...fallback,
        decisionPath: parsedDecision.decisionPath,
        sections: replaceStructuredSectionValue(
          replaceStructuredSectionValue(
            replaceStructuredSectionValue(
              replaceStructuredSectionValue(fallback.sections, 'complaint_summary', complaintSummary),
              'review_summary',
              reviewSummary
            ),
            'decision_reasons',
            parsedDecision.body
          ),
          'redress',
          redress
        ),
      };
    }
    case 'fos_referral': {
      const whatToProvide = extractSectionValue(normalized, 'What to provide', 'Financial Ombudsman Service details');
      if (whatToProvide == null) return null;
      return {
        ...fallback,
        sections: replaceStructuredSectionValue(fallback.sections, 'what_to_provide', whatToProvide),
      };
    }
    case 'custom':
    default:
      return null;
  }
}

function parseDecisionSection(
  rawValue: string,
  fallback: ComplaintLetterDecisionPath
): { decisionPath: ComplaintLetterDecisionPath; body: string } {
  const lines = rawValue.split('\n');
  const firstLine = sanitize(lines[0]);
  const remaining = lines.slice(1).join('\n').trim();

  const bySentence = new Map<string, ComplaintLetterDecisionPath>(
    (['upheld', 'not_upheld', 'partially_upheld', 'other'] as ComplaintLetterDecisionPath[]).flatMap((path) => {
      const sentence = decisionPathSentence(path);
      return sentence ? [[sentence, path]] : [];
    })
  );

  const decisionPath = bySentence.get(firstLine) || fallback;
  if (bySentence.has(firstLine)) {
    return { decisionPath, body: remaining || '' };
  }

  return { decisionPath: fallback, body: rawValue.trim() };
}

function replaceStructuredSectionValue(
  sections: ComplaintLetterStructuredSection[],
  key: string,
  value: string
): ComplaintLetterStructuredSection[] {
  return sections.map((section) => (
    section.key === key
      ? { ...section, value: value.trim() }
      : section
  ));
}

function extractSectionValue(bodyText: string, heading: string, nextHeading: string): string | null {
  const lines = bodyText.split('\n');
  const headingIndex = lines.findIndex((line) => sanitize(line) === heading);
  if (headingIndex === -1) return null;
  const nextHeadingIndex = lines.findIndex((line, index) => index > headingIndex && sanitize(line) === nextHeading);
  if (nextHeadingIndex === -1) return null;
  return lines.slice(headingIndex + 1, nextHeadingIndex).join('\n').trim();
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

function composeCustomBody(complaint: ComplaintRecord, settings: ComplaintWorkspaceSettings, recipientName: string): string {
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

function inferDecisionPath(complaint: ComplaintRecord): ComplaintLetterDecisionPath {
  const value = sanitize(complaint.fosOutcome).toLowerCase();
  if (!value) return 'other';
  if (value.includes('partial')) return 'partially_upheld';
  if (value.includes('not') && value.includes('upheld')) return 'not_upheld';
  if (value.includes('upheld')) return 'upheld';
  return 'other';
}

function decisionPathSentence(decisionPath: ComplaintLetterDecisionPath | null): string | null {
  switch (decisionPath) {
    case 'upheld':
      return 'After completing our review, we uphold your complaint.';
    case 'not_upheld':
      return 'After completing our review, we do not uphold your complaint.';
    case 'partially_upheld':
      return 'After completing our review, we partially uphold your complaint.';
    case 'other':
    case null:
    default:
      return null;
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
