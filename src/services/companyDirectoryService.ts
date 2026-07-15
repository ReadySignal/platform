import { supabase } from "../lib/supabase";

export type CompanyDirectorySort = "recently-researched" | "strongest-evidence" | "most-contacts" | "company-name";

export type CompanyDirectoryItem = {
  id: number;
  name: string;
  industry: string;
  state: string;
  hq: string;
  activeEvidenceCount: number;
  strongestEvidenceScore: number;
  contactCount: number;
  researchStatus: string;
  lastResearchedAt: string | null;
};

type CompanyDirectoryRow = {
  id: string | number;
  name: string | null;
  industry: string | null;
  state: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  is_demo: boolean | null;
  contacts: Array<{ id: string | number; is_demo: boolean | null }> | null;
  evidence: Array<{
    id: string | number;
    confidence: "High" | "Medium" | "Low" | null;
    is_active: boolean | null;
    published_at: string | null;
    discovered_at: string | null;
  }> | null;
  research_jobs: Array<{
    status: string | null;
    completed_at: string | null;
    created_at: string | null;
  }> | null;
};

const confidenceScore = {
  High: 3,
  Medium: 2,
  Low: 1,
};

function toComparableTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function toCompanyDirectoryItem(row: CompanyDirectoryRow): CompanyDirectoryItem {
  const activeEvidence = (row.evidence || []).filter((evidence) => evidence.is_active !== false);
  const latestResearchJob = [...(row.research_jobs || [])].sort(
    (a, b) => toComparableTime(b.completed_at ?? b.created_at) - toComparableTime(a.completed_at ?? a.created_at),
  )[0];
  const hq = [row.hq_city, row.hq_state, row.hq_country].filter(Boolean).join(", ");

  return {
    id: Number(row.id),
    name: row.name || "Unknown Company",
    industry: row.industry || "Unknown Industry",
    state: row.state || "Unknown",
    hq: hq || row.state || "Unknown",
    activeEvidenceCount: activeEvidence.length,
    strongestEvidenceScore: activeEvidence.reduce(
      (max, evidence) => Math.max(max, confidenceScore[evidence.confidence || "Low"]),
      0,
    ),
    contactCount: (row.contacts || []).filter((contact) => !contact.is_demo).length,
    researchStatus: latestResearchJob?.status || "Not queued",
    lastResearchedAt: latestResearchJob?.completed_at || null,
  };
}

export async function getCompanyDirectory(sort: CompanyDirectorySort = "recently-researched") {
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
        id,
        name,
        industry,
        state,
        hq_city,
        hq_state,
        hq_country,
        is_demo,
        contacts (
          id,
          is_demo
        ),
        evidence (
          id,
          confidence,
          is_active,
          published_at,
          discovered_at
        ),
        research_jobs (
          status,
          completed_at,
          created_at
        )
      `,
    )
    .or("is_demo.is.null,is_demo.eq.false");

  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  const companies = (((data as unknown) as CompanyDirectoryRow[]) || []).map(toCompanyDirectoryItem);

  return companies.sort((a, b) => {
    if (sort === "company-name") {
      return a.name.localeCompare(b.name);
    }

    if (sort === "most-contacts") {
      return b.contactCount - a.contactCount || a.name.localeCompare(b.name);
    }

    if (sort === "strongest-evidence") {
      return b.strongestEvidenceScore - a.strongestEvidenceScore || b.activeEvidenceCount - a.activeEvidenceCount || a.name.localeCompare(b.name);
    }

    return toComparableTime(b.lastResearchedAt) - toComparableTime(a.lastResearchedAt) || a.name.localeCompare(b.name);
  });
}
