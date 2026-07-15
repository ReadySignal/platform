export type EvidenceConfidence = "High" | "Medium" | "Low";

export type Evidence = {
  id: number;
  companyId: number;
  contactId: number | null;
  researchJobId: number | null;
  evidenceType: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string | null;
  discoveredAt: string;
  confidence: EvidenceConfidence;
  isActive: boolean;
  createdAt: string;
};

export type NewEvidence = {
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
