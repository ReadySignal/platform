import type { EvidenceConfidence, NewEvidence } from "../Evidence";

export type ProviderRunStatus = "Completed" | "No Evidence" | "Failed" | "Skipped";

export type ResearchCompany = {
  id: number;
  name: string;
  industry: string | null;
  state: string | null;
  employeeCount: number | null;
  isTargetAccount: boolean | null;
  website?: string | null;
  primaryIndustry?: string | null;
  subIndustry?: string | null;
  annualRevenue?: number | null;
  ownershipType?: string | null;
  ticker?: string | null;
  hqCity?: string | null;
  hqState?: string | null;
  hqCountry?: string | null;
  locationCount?: number | null;
};

export type EvidenceCandidate = {
  companyId: number;
  contactId?: number | null;
  researchJobId?: number | null;
  evidenceType: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt?: string | null;
  confidence: EvidenceConfidence;
};

export type ProviderResult = {
  status: ProviderRunStatus;
  evidence: EvidenceCandidate[];
  errorMessage?: string | null;
};

export type ResearchProvider = {
  id: string;
  name: string;
  researchCompany(company: ResearchCompany): Promise<ProviderResult>;
};

export function toNewEvidence(candidate: EvidenceCandidate): NewEvidence {
  return {
    companyId: candidate.companyId,
    contactId: candidate.contactId ?? null,
    researchJobId: candidate.researchJobId ?? null,
    evidenceType: candidate.evidenceType,
    headline: candidate.headline,
    summary: candidate.summary,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    publishedAt: candidate.publishedAt ?? null,
    confidence: candidate.confidence,
  };
}
