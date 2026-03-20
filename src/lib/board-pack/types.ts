import type { ComplaintLetterStatus } from '@/lib/complaints/types';

export interface BoardPackRequest {
  title: string;
  dateFrom: string;
  dateTo: string;
  firms: string[];
  products: string[];
  outcomes: string[];
  includeOperationalComplaints: boolean;
  includeComparison: boolean;
  includeRootCauseDeepDive: boolean;
  includeAppendix: boolean;
  executiveSummaryNote: string | null;
  boardFocusNote: string | null;
  actionSummaryNote: string | null;
  format: 'pdf' | 'pptx';
}

export interface BoardPackSection {
  key: string;
  title: string;
  status: 'included' | 'excluded';
}

export interface BoardPackPreview {
  success: boolean;
  sections: BoardPackSection[];
  metrics: {
    totalCases: number;
    upheldRate: number;
    complaintsOpen: number;
    overdueComplaints: number;
    fosReferredCount: number;
    appendixLetters: number;
    appendixEvidence: number;
  };
  branding: {
    organizationName: string;
    subtitle: string | null;
  };
  recentRuns: Array<{
    id: string;
    format: 'pdf' | 'pptx';
    status: 'success' | 'failed';
    title: string;
    fileName: string | null;
    createdAt: string;
  }>;
}

export interface BoardPackData {
  title: string;
  generatedAt: string;
  periodLabel: string;
  branding: {
    organizationName: string;
    subtitle: string | null;
    complaintsTeamName: string;
    complaintsEmail: string | null;
    complaintsPhone: string | null;
    complaintsAddress: string | null;
  };
  summary: {
    totalCases: number;
    upheldRate: number;
    notUpheldRate: number;
    totalComplaints: number;
    openComplaints: number;
    overdueComplaints: number;
    referredToFos: number;
  };
  topFirms: Array<{ firm: string; total: number; upheldRate: number; notUpheldRate: number }>;
  topProducts: Array<{ product: string; total: number; upheldRate: number }>;
  topRootCauses: Array<{ label: string; count: number }>;
  trends: Array<{ year: number; total: number; upheld: number; notUpheld: number }>;
  boardNotes: {
    executiveSummaryNote: string | null;
    boardFocusNote: string | null;
    actionSummaryNote: string | null;
  };
  appendix: {
    recentLetters: Array<{
      complaintReference: string;
      subject: string;
      status: ComplaintLetterStatus;
      recipientName: string | null;
      createdAt: string;
    }>;
    recentEvidence: Array<{
      complaintReference: string;
      fileName: string;
      category: string;
      summary: string | null;
      createdAt: string;
    }>;
    lateReferralText: string;
  };
  sections: BoardPackSection[];
}
