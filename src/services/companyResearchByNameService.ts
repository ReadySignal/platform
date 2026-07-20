import "server-only";

import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { getEvidenceForCompany } from "./evidenceService";
import { getCompanyIntelligence } from "./companyIntelligenceService";
import { runLiveResearchJob } from "./liveResearchOrchestrator";
import { getResearchCompany, getResearchJob } from "./researchService";
import type { Evidence } from "../types/Evidence";
import type { RankedCompanyContact } from "../types/CompanyIntelligence";

export type CompanyResearchEvidence = {
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  confidence: "High" | "Medium" | "Low";
  publishedAt: string | null;
};

export type CompanyResearchCandidate = {
  fullName: string;
  currentTitle: string;
  sourceName: string;
  sourceUrl: string;
  employmentStatus: "Current" | "Unclear" | "Former";
  validationStatus: "Not Validated" | "Validating" | "Validated" | "Failed";
  roleFitLevel: "Strong" | "Possible" | "Weak" | null;
};

export type CompanyResearchByNameResult = {
  companyId: number;
  companyName: string;
  companyUrl: string | null;
  evidence: CompanyResearchEvidence[];
  bestCandidate: CompanyResearchCandidate | null;
};

type CompanyRow = { id: string | number; name: string; website: string | null };
type ResearchJobRow = { id: string | number; status: string };

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function findCompanyByName(companyName: string): Promise<CompanyRow | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, website")
    .ilike("name", companyName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find company: ${error.message}`);
  }

  return (data as CompanyRow | null) || null;
}

async function createCompanyByName(companyName: string, companyUrl: string | null): Promise<CompanyRow> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("companies")
    .insert({
      name: companyName,
      industry: "Unknown",
      state: "Unknown",
      employee_count: 0,
      is_target_account: true,
      website: companyUrl,
    })
    .select("id, name, website")
    .single();

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`);
  }

  return data as CompanyRow;
}

/**
 * Starts real (paid) research only when this company hasn't already been
 * researched or isn't currently being researched - matches the Research
 * Engine's own "don't research the same company repeatedly" rule instead of
 * spending on every request for a company that already has evidence.
 */
async function ensureLiveResearch(companyId: number): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: jobRows, error } = await supabaseAdmin
    .from("research_jobs")
    .select("id, status")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load research jobs: ${error.message}`);
  }

  const jobs = (jobRows as ResearchJobRow[] | null) || [];
  const latest = jobs[0];

  if (latest && (latest.status === "Complete" || latest.status === "Researching")) {
    return;
  }

  let jobId: number;

  if (latest && latest.status === "Waiting") {
    jobId = Number(latest.id);
  } else {
    const { data: created, error: createError } = await supabaseAdmin
      .from("research_jobs")
      .insert({ company_id: companyId, status: "Waiting", provider: null, error_message: null })
      .select("id")
      .single();

    if (createError) {
      throw new Error(`Failed to create research job: ${createError.message}`);
    }

    jobId = Number((created as { id: string | number }).id);
  }

  const job = await getResearchJob(jobId);
  const company = await getResearchCompany(companyId);
  await runLiveResearchJob(job, company);
}

/**
 * Only returns a person when they're actually named in a sourced evidence
 * record. Imported contacts have no stored source URL of their own, so
 * inventing one would claim a public source that doesn't exist - staying
 * conservative here means no candidate rather than an unsourced one.
 */
function findCandidateWithEvidenceSource(
  contacts: RankedCompanyContact[],
  evidence: CompanyResearchEvidence[],
): CompanyResearchCandidate | null {
  const byScore = [...contacts].sort((a, b) => b.overallScore - a.overallScore);

  for (const contact of byScore) {
    if (!contact.name?.trim() || !contact.title?.trim()) {
      continue;
    }

    const nameLower = contact.name.toLowerCase();
    const matchingEvidence = evidence.find(
      (item) => item.headline.toLowerCase().includes(nameLower) || item.summary.toLowerCase().includes(nameLower),
    );

    if (!matchingEvidence) {
      continue;
    }

    return {
      fullName: contact.name,
      currentTitle: contact.title,
      sourceName: matchingEvidence.sourceName,
      sourceUrl: matchingEvidence.sourceUrl,
      employmentStatus: "Current",
      validationStatus: contact.verifiedContact ? "Validated" : "Not Validated",
      roleFitLevel: contact.overallScore >= 70 ? "Strong" : contact.overallScore >= 45 ? "Possible" : "Weak",
    };
  }

  return null;
}

export async function researchCompanyByName(
  companyName: string,
  companyUrl: string | null = null,
): Promise<CompanyResearchByNameResult> {
  const normalized = normalizeName(companyName);

  if (!normalized) {
    throw new Error("companyName is required.");
  }

  const company = (await findCompanyByName(normalized)) || (await createCompanyByName(normalized, companyUrl));
  const companyId = Number(company.id);

  await ensureLiveResearch(companyId);

  const [evidenceRows, intelligence] = await Promise.all([
    getEvidenceForCompany(companyId),
    getCompanyIntelligence(String(companyId)).catch(() => null),
  ]);

  const evidence: CompanyResearchEvidence[] = evidenceRows.map((item: Evidence) => ({
    headline: item.headline,
    summary: item.summary,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    confidence: item.confidence,
    publishedAt: item.publishedAt,
  }));

  const bestCandidate = intelligence ? findCandidateWithEvidenceSource(intelligence.rankedContacts, evidence) : null;

  return {
    companyId,
    companyName: company.name,
    companyUrl: company.website,
    evidence,
    bestCandidate,
  };
}
