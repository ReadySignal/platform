import { supabase } from "../lib/supabase";
import type { Evidence, NewEvidence } from "../types/Evidence";

type EvidenceRow = {
  id: string | number;
  company_id: string | number;
  contact_id: string | number | null;
  research_job_id: string | number | null;
  evidence_type: string;
  headline: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  discovered_at: string;
  confidence: Evidence["confidence"];
  is_active: boolean;
  created_at: string;
};

const evidenceSelect = `
  id,
  company_id,
  contact_id,
  research_job_id,
  evidence_type,
  headline,
  summary,
  source_name,
  source_url,
  published_at,
  discovered_at,
  confidence,
  is_active,
  created_at
`;

function toEvidence(row: EvidenceRow): Evidence {
  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    contactId: row.contact_id === null ? null : Number(row.contact_id),
    researchJobId: row.research_job_id === null ? null : Number(row.research_job_id),
    evidenceType: row.evidence_type,
    headline: row.headline,
    summary: row.summary,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    confidence: row.confidence,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function evidenceInsert(evidence: NewEvidence) {
  return {
    company_id: evidence.companyId,
    contact_id: evidence.contactId ?? null,
    research_job_id: evidence.researchJobId ?? null,
    evidence_type: evidence.evidenceType,
    headline: evidence.headline,
    summary: evidence.summary,
    source_name: evidence.sourceName,
    source_url: evidence.sourceUrl,
    published_at: evidence.publishedAt ?? null,
    confidence: evidence.confidence,
  };
}

export async function createEvidence(evidence: NewEvidence): Promise<Evidence> {
  const { data, error } = await supabase
    .from("evidence")
    .insert(evidenceInsert(evidence))
    .select(evidenceSelect)
    .single();

  if (error) {
    throw new Error(`Failed to create evidence: ${error.message}`);
  }

  return toEvidence(data as EvidenceRow);
}

export async function getEvidenceForCompany(companyId: number | string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(evidenceSelect)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("discovered_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch company evidence: ${error.message}`);
  }

  return (((data as unknown) as EvidenceRow[]) || []).map(toEvidence);
}

export async function getEvidenceForContact(contactId: number | string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(evidenceSelect)
    .eq("contact_id", contactId)
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("discovered_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch contact evidence: ${error.message}`);
  }

  return (((data as unknown) as EvidenceRow[]) || []).map(toEvidence);
}

export async function getEvidenceForResearchJob(researchJobId: number | string): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(evidenceSelect)
    .eq("research_job_id", researchJobId)
    .eq("is_active", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("discovered_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch research job evidence: ${error.message}`);
  }

  return (((data as unknown) as EvidenceRow[]) || []).map(toEvidence);
}
