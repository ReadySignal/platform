import type { CallOutcome } from "./CallOutcome";
import type { Company } from "./Company";
import type { Evidence } from "./Evidence";

export type CompanySignal = {
  id: number;
  signalType: string;
  headline: string;
  details: string | null;
  occurredAt: string | null;
  scorePoints: number;
};

export type CompanyContact = {
  id: number;
  name: string;
  title: string;
  location: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  relevantContext: string | null;
  whyToday: string | null;
  verifiedContact: boolean;
  noPreviousOutreach: boolean;
  activeSignals: CompanySignal[];
  callOutcomes: CallOutcome[];
};

export type ContactScoreBreakdown = {
  titleRelevance: number;
  evidenceRelevance: number;
  previousOutreach: number;
  verifiedContactInformation: number;
  importedContext: number;
};

export type RankedCompanyContact = CompanyContact & {
  overallScore: number;
  scoreBreakdown: ContactScoreBreakdown;
  companyRank: number;
  recommended: boolean;
  whyThisContact: string;
  previousOutreachStatus: string;
};

export type SalesInsight = {
  hasSufficientEvidence: boolean;
  whyThisContact: string;
  conversationAngle: string;
  discoveryQuestions: string[];
};

export type CompanyActivityItem =
  | {
      id: string;
      type: "signal";
      contactName: string;
      label: string;
      detail: string | null;
      date: string | null;
      scorePoints: number;
    }
  | {
      id: string;
      type: "outcome";
      contactName: string;
      label: string;
      detail: string | null;
      date: string | null;
    };

export type CompanyIntelligence = {
  company: Company;
  contacts: CompanyContact[];
  rankedContacts: RankedCompanyContact[];
  salesInsight: SalesInsight | null;
  evidence: Evidence[];
  activityTimeline: CompanyActivityItem[];
};
