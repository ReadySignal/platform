import "server-only";

import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { getEvidenceForCompany } from "./evidenceService";
import { getCompanyIntelligence } from "./companyIntelligenceService";
import { getActiveBusinessProfile } from "./businessProfileService";
import { ensureCompanyDiscovery, getDiscoveryCandidates, persistContactValidations, type SourcedDiscoveryCandidate } from "./companyDiscoveryService";
import { validateContactCandidates } from "./researchProviders/openAICompanyDiscoveryProvider";
import { isAllowedPublicResearchSource } from "./researchProviders/openAIWebResearchProvider";
import { runLiveResearchJob } from "./liveResearchOrchestrator";
import { getResearchCompany, getResearchJob } from "./researchService";
import type { Evidence } from "../types/Evidence";
import type { RankedCompanyContact } from "../types/CompanyIntelligence";

export type CompanyResearchEvidence = {
  evidenceType: string;
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
  confidence: "High" | "Medium" | "Low";
  validationConfidence: "High" | "Medium" | "Low" | null;
  confidenceReasons: string[];
  conflictingSignals: string[];
  missingInformation: string[];
};

export type CompanyResearchByNameResult = {
  companyId: number;
  companyName: string;
  companyUrl: string | null;
  companyUrlSource: string | null;
  companyUrlConfidence: "High" | "Medium" | "Low" | null;
  evidence: CompanyResearchEvidence[];
  candidates: CompanyResearchCandidate[];
  bestCandidate: CompanyResearchCandidate | null;
};

export type CompanyContactSearchResult = {
  companyId: number;
  companyName: string;
  companyUrl: string | null;
  candidates: CompanyResearchCandidate[];
  bestCandidate: CompanyResearchCandidate | null;
};

export type CompanyContactValidationResult = CompanyContactSearchResult & {
  attemptedCount: number;
  validatedCount: number;
};

type CompanyRow = {
  id: string | number;
  name: string;
  website: string | null;
  website_source_url: string | null;
  website_confidence: "High" | "Medium" | "Low" | null;
};
type ResearchJobRow = { id: string | number; status: string };

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const evidenceTypeWeight: Record<string, number> = {
  "modernization or reliability initiative": 100,
  "capital investment": 90,
  "new facility": 85,
  expansion: 80,
  "new product line": 75,
  "major hiring": 55,
  acquisition: 45,
  "leadership change": 30,
  "relevant industry news": 20,
};

function relevanceTerms(values: string[]) {
  const ignored = new Set(["about", "across", "after", "also", "from", "into", "more", "over", "that", "their", "this", "with"]);
  return Array.from(
    new Set(
      values
        .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
        .filter((term) => term.length >= 4 && !ignored.has(term)),
    ),
  );
}

function rankEvidence(
  evidence: CompanyResearchEvidence[],
  profile: Awaited<ReturnType<typeof getActiveBusinessProfile>>,
) {
  const terms = profile
    ? relevanceTerms([
        profile.productName,
        profile.productDescription,
        ...profile.valuePropositions,
        ...profile.customerProblems,
        ...profile.highPrioritySignals,
        ...profile.mediumPrioritySignals,
      ])
    : [];

  return [...evidence].sort((a, b) => {
    const score = (item: CompanyResearchEvidence) => {
      const haystack = `${item.evidenceType} ${item.headline} ${item.summary}`.toLowerCase();
      const profileMatches = terms.filter((term) => haystack.includes(term)).length;
      const confidence = item.confidence === "High" ? 10 : item.confidence === "Medium" ? 5 : 0;
      return (evidenceTypeWeight[item.evidenceType.toLowerCase()] ?? 0) + profileMatches * 4 + confidence;
    };
    return score(b) - score(a);
  });
}

async function findCompanyByName(companyName: string): Promise<CompanyRow | null> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id, name, website, website_source_url, website_confidence")
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
    .select("id, name, website, website_source_url, website_confidence")
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
async function ensureLiveResearch(companyId: number, forceAfterWebsiteResolution = false, forceRefresh = false): Promise<void> {
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

  if (latest?.status === "Researching" || (latest?.status === "Complete" && !forceAfterWebsiteResolution && !forceRefresh)) {
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
      confidence: "Medium",
      validationConfidence: contact.verifiedContact ? "Medium" : null,
      confidenceReasons: ["Imported contact is named in a stored public evidence record"],
      conflictingSignals: [],
      missingInformation: contact.verifiedContact ? [] : ["Contact identity has not been independently validated"],
    };
  }

  return null;
}

function toResearchCandidate(candidate: SourcedDiscoveryCandidate): CompanyResearchCandidate {
  return {
    fullName: candidate.fullName,
    currentTitle: candidate.currentTitle,
    sourceName: candidate.sourceName,
    sourceUrl: candidate.sourceUrl,
    employmentStatus: candidate.employmentStatus,
    validationStatus: candidate.validationStatus,
    roleFitLevel: candidate.roleFitLevel,
    confidence: candidate.confidence,
    validationConfidence: candidate.validationConfidence,
    confidenceReasons: candidate.confidenceReasons,
    conflictingSignals: candidate.conflictingSignals,
    missingInformation: candidate.missingInformation,
  };
}

export async function researchCompanyByName(
  companyName: string,
  companyUrl: string | null = null,
  forceRefresh = false,
): Promise<CompanyResearchByNameResult> {
  const normalized = normalizeName(companyName);

  if (!normalized) {
    throw new Error("companyName is required.");
  }

  const company = (await findCompanyByName(normalized)) || (await createCompanyByName(normalized, companyUrl));
  const companyId = Number(company.id);

  const discovery = await ensureCompanyDiscovery(companyId, forceRefresh);
  await ensureLiveResearch(companyId, discovery.websiteUpdated, forceRefresh);

  const [evidenceRows, intelligence, activeProfile] = await Promise.all([
    getEvidenceForCompany(companyId),
    getCompanyIntelligence(String(companyId)).catch(() => null),
    getActiveBusinessProfile().catch(() => null),
  ]);

  const evidence = rankEvidence(
    evidenceRows
      .filter((item: Evidence) => isAllowedPublicResearchSource(item.sourceUrl))
      .map((item: Evidence) => ({
        evidenceType: item.evidenceType,
        headline: item.headline,
        summary: item.summary,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        confidence: item.confidence,
        publishedAt: item.publishedAt,
      })),
    activeProfile,
  );

  const discoveredCandidates = discovery.candidates.length > 0 ? discovery.candidates : await getDiscoveryCandidates(companyId);
  const sourcedCandidates = discoveredCandidates.slice(0, 5).map(toResearchCandidate);
  const importedCandidate = intelligence ? findCandidateWithEvidenceSource(intelligence.rankedContacts, evidence) : null;
  const candidates = sourcedCandidates.length > 0 ? sourcedCandidates : importedCandidate ? [importedCandidate] : [];
  const bestCandidate = candidates[0] ?? null;

  const refreshedCompany = await findCompanyByName(normalized);

  return {
    companyId,
    companyName: company.name,
    companyUrl: refreshedCompany?.website ?? company.website,
    companyUrlSource: refreshedCompany?.website_source_url ?? discovery.website?.sourceUrl ?? null,
    companyUrlConfidence: refreshedCompany?.website_confidence ?? discovery.website?.confidence ?? null,
    evidence,
    candidates,
    bestCandidate,
  };
}

export async function findCompanyContactsByName(
  companyName: string,
  companyUrl: string | null = null,
  researchContext: string | null = null,
): Promise<CompanyContactSearchResult> {
  const normalized = normalizeName(companyName);
  if (!normalized) throw new Error("companyName is required.");

  const company = (await findCompanyByName(normalized)) || (await createCompanyByName(normalized, companyUrl));
  const companyId = Number(company.id);
  const context = researchContext?.trim().slice(0, 2_000) || null;
  const discovery = await ensureCompanyDiscovery(companyId, true, context);
  const discoveredCandidates = discovery.candidates.length > 0
    ? discovery.candidates
    : await getDiscoveryCandidates(companyId);
  const candidates = discoveredCandidates.slice(0, 5).map(toResearchCandidate);
  const refreshedCompany = await findCompanyByName(normalized);

  return {
    companyId,
    companyName: company.name,
    companyUrl: refreshedCompany?.website ?? company.website,
    candidates,
    bestCandidate: candidates[0] ?? null,
  };
}

export async function validateCompanyContactsByName(
  companyName: string,
  candidates: CompanyResearchCandidate[],
  companyUrl: string | null = null,
  researchContext: string | null = null,
): Promise<CompanyContactValidationResult> {
  const normalized = normalizeName(companyName);
  if (!normalized) throw new Error("companyName is required.");
  const requested = candidates.slice(0, 5);
  if (requested.length === 0) throw new Error("At least one contact candidate is required.");

  const company = (await findCompanyByName(normalized)) || (await createCompanyByName(normalized, companyUrl));
  const companyId = Number(company.id);
  const researchCompany = await getResearchCompany(companyId);
  const findings = await validateContactCandidates(
    researchCompany,
    requested.map((candidate) => ({ fullName: candidate.fullName, currentTitle: candidate.currentTitle })),
    researchContext?.trim().slice(0, 2_000) || null,
  );
  await persistContactValidations(companyId, findings);

  const byName = new Map(findings.map((finding) => [normalizeName(finding.fullName).toLowerCase(), finding]));
  const results = requested.map((candidate) => {
    const finding = byName.get(normalizeName(candidate.fullName).toLowerCase());
    if (!finding) {
      return {
        ...candidate,
        employmentStatus: "Unclear" as const,
        validationStatus: "Not Validated" as const,
        validationConfidence: null,
        missingInformation: Array.from(new Set([...candidate.missingInformation, "No allowed public source validated current employment"])),
      };
    }
    const validated = finding.employmentStatus === "Current" &&
      finding.confidence === "High" &&
      finding.conflictingSignals.length === 0;
    return {
      ...candidate,
      currentTitle: finding.currentTitle,
      sourceName: finding.sourceName,
      sourceUrl: finding.sourceUrl,
      employmentStatus: finding.employmentStatus,
      validationStatus: validated ? ("Validated" as const) : finding.employmentStatus === "Former" ? ("Failed" as const) : ("Not Validated" as const),
      confidence: finding.confidence,
      validationConfidence: validated ? ("High" as const) : finding.confidence,
      confidenceReasons: [finding.companyAssociationEvidence],
      conflictingSignals: finding.conflictingSignals,
      missingInformation: finding.missingInformation,
    };
  });
  const validatedCount = results.filter((candidate) => candidate.validationStatus === "Validated").length;
  return {
    companyId,
    companyName: company.name,
    companyUrl: company.website,
    candidates: results,
    bestCandidate: results.find((candidate) => candidate.validationStatus === "Validated") ?? results[0] ?? null,
    attemptedCount: requested.length,
    validatedCount,
  };
}
