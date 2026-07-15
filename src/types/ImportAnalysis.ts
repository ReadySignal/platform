export type ImportedCompany = {
  id: string | number;
  name: string;
  industry: string | null;
  state: string | null;
  employeeCount: number | null;
  isTargetAccount: boolean | null;
};

export type ImportedContact = {
  id: string | number;
  companyId: string | number | null;
  firstName: string;
  lastName: string;
  title: string;
  location: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  relevantContext: string | null;
  whyToday: string | null;
  verifiedContact: boolean | null;
  noPreviousOutreach: boolean | null;
  company: ImportedCompany | null;
};

export type ScoreBreakdownItem = {
  label: string;
  points: number;
  detail: string;
};

export type ImportAnalysisCategory = "high" | "needs-info" | "low";

export type ImportedContactAnalysis = {
  contact: ImportedContact;
  score: number;
  category: ImportAnalysisCategory;
  primaryReason: string;
  breakdown: ScoreBreakdownItem[];
  warnings: string[];
  signalHeadline: string;
  signalDetails: string;
};
