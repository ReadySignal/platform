export interface Prospect {
  id: number;
  contactId?: number;
  companyId?: string;
  name: string;
  title: string;
  company: string;
  location: string;
  reason: string;
  directPhone: string;
  mobilePhone: string;
  email: string;
  notes: string;
  callOpener: string;
  confidence: "High Confidence" | "Medium Confidence";
  confidenceScore: number;
  whyTodayCategory: string;
  whyTodayLabel?: string;
  whyTodayReason: string;
  callBrief?: {
    whyThisContact: string;
    conversationAngle: string;
    discoveryQuestions: string[];
  };
  signalId: string;
  signalDatabaseId?: number | null;
  signalOccurredAt?: string | null;
  targetAccount?: boolean;
  opportunityScore?: number;
  opportunityBreakdown?: Array<{
    label: string;
    points: number;
  }>;
  signals: Array<{
    id: number;
    signalType: string;
    headline: string;
    details: string | null;
    occurredAt: string | null;
    scorePoints: number;
  }>;
  titleMatch?: boolean;
  targetIndustry?: boolean;
  targetState?: boolean;
  companySizeMatch?: boolean;
  recentPromotion?: boolean;
  verifiedContact?: boolean;
  relevantContext?: boolean;
  noPreviousOutreach?: boolean;
  breakdown: {
    titleMatch: string;
    companyFit: string;
    timingSignals: string;
    contactQuality: string;
    relevantContext: string;
  };
}
