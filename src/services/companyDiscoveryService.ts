import "server-only";

import { getSupabaseAdmin } from "../lib/supabaseAdmin";
import { getResearchCompany } from "./researchService";
import {
  discoverCompanyAndContacts,
  type CompanyDiscoveryResult,
  type DiscoveryConfidence,
  type EmploymentStatus,
  type PublicContactFinding,
} from "./researchProviders/openAICompanyDiscoveryProvider";

type BusinessProfileRow = {
  id: string | number;
  product_name: string;
  product_description: string;
  value_propositions: unknown;
  customer_problems: unknown;
  target_industries: unknown;
  target_geographies: unknown;
  priority_titles: unknown;
  secondary_titles: unknown;
  relevant_departments: unknown;
  management_levels: unknown;
  excluded_titles: unknown;
};

const DEFAULT_PRIORITY_TITLES = [
  "maintenance manager",
  "reliability manager",
  "engineering manager",
  "plant manager",
  "director of maintenance",
  "director of engineering",
  "vice president of operations",
  "vp operations",
];
const DEFAULT_SECONDARY_TITLES = ["facilities manager", "continuous improvement manager", "operations manager"];
const DEFAULT_MANAGEMENT_LEVELS = ["manager", "director", "vice president", "vp", "head"];

type DiscoveryRunRow = {
  id: string | number;
  status: "Waiting" | "Running" | "Complete" | "Failed";
  created_at: string;
};

type DiscoveryCandidateRow = {
  id: string | number;
  full_name: string;
  current_title: string;
  source_name: string;
  source_url: string;
  confidence: DiscoveryConfidence;
  employment_status: EmploymentStatus;
  validation_status: "Not Validated" | "Validating" | "Validated" | "Failed";
  validation_confidence: DiscoveryConfidence | null;
  role_fit_score: number | null;
  role_fit_level: "Strong" | "Possible" | "Weak" | null;
  contributing_rules: unknown;
  conflicting_signals: unknown;
  missing_information: unknown;
  validation_warnings: unknown;
  company_association_evidence: string | null;
  created_at: string;
};

export type SourcedDiscoveryCandidate = {
  id: number;
  fullName: string;
  currentTitle: string;
  sourceName: string;
  sourceUrl: string;
  confidence: DiscoveryConfidence;
  employmentStatus: EmploymentStatus;
  validationStatus: "Not Validated" | "Validating" | "Validated" | "Failed";
  validationConfidence: DiscoveryConfidence | null;
  roleFitScore: number | null;
  roleFitLevel: "Strong" | "Possible" | "Weak" | null;
  confidenceReasons: string[];
  conflictingSignals: string[];
  missingInformation: string[];
  validationWarnings: string[];
  companyAssociationEvidence: string | null;
};

export type CompanyDiscoverySummary = {
  websiteUpdated: boolean;
  website: CompanyDiscoveryResult["website"];
  candidates: SourcedDiscoveryCandidate[];
};

export async function persistContactValidations(companyId: number, contacts: PublicContactFinding[]) {
  const supabase = getSupabaseAdmin();
  for (const contact of contacts) {
    const validated = contact.employmentStatus === "Current" &&
      contact.confidence === "High" &&
      contact.conflictingSignals.length === 0;
    const validationStatus = validated
      ? "Validated"
      : contact.employmentStatus === "Former" || contact.confidence === "Low"
        ? "Failed"
        : "Not Validated";
    const { error } = await supabase
      .from("contact_discovery_candidates")
      .update({
        current_title: contact.currentTitle,
        source_name: contact.sourceName,
        source_url: contact.sourceUrl,
        confidence: contact.confidence,
        employment_status: contact.employmentStatus,
        employment_verified_at: validated ? new Date().toISOString() : null,
        company_association_evidence: contact.companyAssociationEvidence,
        validation_status: validationStatus,
        validated_at: validated ? new Date().toISOString() : null,
        validation_source_name: contact.sourceName,
        validation_source_url: contact.sourceUrl,
        validation_confidence: contact.confidence,
        conflicting_signals: contact.conflictingSignals,
        missing_information: contact.missingInformation,
      })
      .eq("company_id", companyId)
      .eq("full_name", contact.fullName);
    if (error) throw new Error(`Failed to save validation for ${contact.fullName}: ${error.message}`);
  }
}

async function getStoredWebsite(companyId: number): Promise<CompanyDiscoveryResult["website"]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("companies")
    .select("website, website_source_url, website_confidence")
    .eq("id", companyId)
    .single();
  if (error) throw new Error(`Failed to load company website provenance: ${error.message}`);
  const row = data as {
    website: string | null;
    website_source_url: string | null;
    website_confidence: DiscoveryConfidence | null;
  };
  if (!row.website || !row.website_source_url || !row.website_confidence) return null;
  return {
    url: row.website,
    sourceName: "Stored verified company source",
    sourceUrl: row.website_source_url,
    confidence: row.website_confidence,
    identityEvidence: "Verified in a previous public company discovery run.",
  };
}

function toStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function includesTerm(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.find((term) => term.trim() && normalized.includes(term.toLowerCase()));
}

function toOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).origin;
  } catch {
    return null;
  }
}

export function scoreContactRole(
  contact: Pick<PublicContactFinding, "currentTitle" | "department" | "managementLevel" | "confidence" | "employmentStatus">,
  profile: {
    priorityTitles: string[];
    secondaryTitles: string[];
    relevantDepartments: string[];
    managementLevels: string[];
    excludedTitles: string[];
  },
) {
  const contributingRules: string[] = [];
  let score = 0;
  const excluded = includesTerm(contact.currentTitle, profile.excludedTitles);

  if (excluded) {
    return { score: 0, level: "Weak" as const, contributingRules: [`Excluded title matched: ${excluded}`] };
  }

  const priorityTitle = includesTerm(contact.currentTitle, profile.priorityTitles);
  const secondaryTitle = includesTerm(contact.currentTitle, profile.secondaryTitles);
  const department = includesTerm(contact.department || contact.currentTitle, profile.relevantDepartments);
  const managementLevel = includesTerm(contact.managementLevel || contact.currentTitle, profile.managementLevels);

  if (priorityTitle) {
    score += 45;
    contributingRules.push(`Priority title matched: ${priorityTitle}`);
  } else if (secondaryTitle) {
    score += 30;
    contributingRules.push(`Secondary title matched: ${secondaryTitle}`);
  }
  if (department) {
    score += 25;
    contributingRules.push(`Relevant department matched: ${department}`);
  }
  if (managementLevel) {
    score += 10;
    contributingRules.push(`Management level matched: ${managementLevel}`);
  }
  if (contact.employmentStatus === "Current") {
    score += 10;
    contributingRules.push("Current employment is source-supported");
  }
  if (contact.confidence === "High") {
    score += 10;
    contributingRules.push("High source confidence");
  } else if (contact.confidence === "Medium") {
    score += 5;
    contributingRules.push("Medium source confidence");
  }

  score = Math.min(100, score);
  return {
    score,
    level: score >= 70 ? ("Strong" as const) : score >= 45 ? ("Possible" as const) : ("Weak" as const),
    contributingRules,
  };
}

async function getActiveProfile() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, product_name, product_description, value_propositions, customer_problems, target_industries, target_geographies, priority_titles, secondary_titles, relevant_departments, management_levels, excluded_titles",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load active business profile: ${error.message}`);
  if (!data) return null;
  const row = data as BusinessProfileRow;
  const priorityTitles = toStrings(row.priority_titles);
  const secondaryTitles = toStrings(row.secondary_titles);
  const managementLevels = toStrings(row.management_levels);
  return {
    id: Number(row.id),
    productName: row.product_name,
    productDescription: row.product_description,
    valuePropositions: toStrings(row.value_propositions),
    customerProblems: toStrings(row.customer_problems),
    targetIndustries: toStrings(row.target_industries),
    targetGeographies: toStrings(row.target_geographies),
    priorityTitles: priorityTitles.length > 0 ? priorityTitles : DEFAULT_PRIORITY_TITLES,
    secondaryTitles: secondaryTitles.length > 0 ? secondaryTitles : DEFAULT_SECONDARY_TITLES,
    relevantDepartments: toStrings(row.relevant_departments),
    managementLevels: managementLevels.length > 0 ? managementLevels : DEFAULT_MANAGEMENT_LEVELS,
    excludedTitles: toStrings(row.excluded_titles),
  };
}

function toCandidate(row: DiscoveryCandidateRow): SourcedDiscoveryCandidate {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    currentTitle: row.current_title,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    confidence: row.confidence,
    employmentStatus: row.employment_status,
    validationStatus: row.validation_status,
    validationConfidence: row.validation_confidence,
    roleFitScore: row.role_fit_score,
    roleFitLevel: row.role_fit_level,
    confidenceReasons: toStrings(row.contributing_rules),
    conflictingSignals: toStrings(row.conflicting_signals),
    missingInformation: toStrings(row.missing_information),
    validationWarnings: toStrings(row.validation_warnings),
    companyAssociationEvidence: row.company_association_evidence,
  };
}

export async function getDiscoveryCandidates(companyId: number): Promise<SourcedDiscoveryCandidate[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contact_discovery_candidates")
    .select(
      "id, full_name, current_title, source_name, source_url, confidence, employment_status, validation_status, validation_confidence, role_fit_score, role_fit_level, contributing_rules, conflicting_signals, missing_information, validation_warnings, company_association_evidence, created_at",
    )
    .eq("company_id", companyId)
    .neq("review_status", "Rejected")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load contact discovery candidates: ${error.message}`);

  const confidenceWeight = { High: 3, Medium: 2, Low: 1 };
  const validationWeight = { Validated: 4, Validating: 3, "Not Validated": 2, Failed: 1 };
  const employmentWeight = { Current: 3, Unclear: 2, Former: 1 };
  const promotionEligible = (candidate: SourcedDiscoveryCandidate) =>
    candidate.employmentStatus === "Current" &&
    candidate.confidence === "High" &&
    candidate.validationStatus === "Validated" &&
    (candidate.roleFitLevel === "Strong" || candidate.roleFitLevel === "Possible");

  const sorted = (((data as DiscoveryCandidateRow[] | null) || []).map(toCandidate)).sort((a, b) =>
    Number(promotionEligible(b)) - Number(promotionEligible(a)) ||
    (b.roleFitScore ?? -1) - (a.roleFitScore ?? -1) ||
    employmentWeight[b.employmentStatus] - employmentWeight[a.employmentStatus] ||
    validationWeight[b.validationStatus] - validationWeight[a.validationStatus] ||
    confidenceWeight[b.confidence] - confidenceWeight[a.confidence],
  );

  const seen = new Set<string>();
  return sorted.filter((candidate) => {
    const key = candidate.fullName.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function persistDiscoveryRun(
  runId: number,
  companyId: number,
  profile: NonNullable<Awaited<ReturnType<typeof getActiveProfile>>>,
  result: CompanyDiscoveryResult,
) {
  const supabase = getSupabaseAdmin();
  const candidateRows = result.contacts.map((contact) => {
    const roleFit = scoreContactRole(contact, profile);
    const validated =
      contact.employmentStatus === "Current" &&
      contact.confidence === "High" &&
      contact.conflictingSignals.length === 0;
    const validationStatus = validated
      ? "Validated"
      : contact.employmentStatus === "Former" || contact.confidence === "Low"
        ? "Failed"
        : "Not Validated";
    const validationWarnings = [
      ...(contact.employmentStatus !== "Current" ? [`Employment is ${contact.employmentStatus}`] : []),
      ...(contact.confidence !== "High" ? [`Source confidence is ${contact.confidence}`] : []),
    ];

    return {
      contact_discovery_run_id: runId,
      company_id: companyId,
      full_name: contact.fullName,
      current_title: contact.currentTitle,
      department: contact.department,
      management_level: contact.managementLevel,
      location: contact.location,
      professional_profile_url: null,
      relevance_summary: `${contact.currentTitle} identified from a public source for manual review.`,
      matched_persona_rules: roleFit.contributingRules,
      evidence_connections: [],
      source_name: contact.sourceName,
      source_url: contact.sourceUrl,
      confidence: contact.confidence,
      employment_status: contact.employmentStatus,
      employment_verified_at: validated ? new Date().toISOString() : null,
      company_association_evidence: contact.companyAssociationEvidence,
      validation_status: validationStatus,
      validated_at: validated ? new Date().toISOString() : null,
      responsibility_summary: contact.responsibilitySummary,
      responsibility_evidence: contact.responsibilitySummary,
      validation_source_name: contact.sourceName,
      validation_source_url: contact.sourceUrl,
      validation_confidence: validated ? "High" : contact.confidence,
      role_fit_score: roleFit.score,
      role_fit_level: roleFit.level,
      contributing_rules: roleFit.contributingRules,
      conflicting_signals: contact.conflictingSignals,
      missing_information: contact.missingInformation,
      validation_warnings: validationWarnings,
      review_status: "Pending",
    };
  });

  if (candidateRows.length > 0) {
    const { error } = await supabase.from("contact_discovery_candidates").insert(candidateRows);
    if (error) throw new Error(`Failed to save contact discovery candidates: ${error.message}`);
  }

  let websiteUpdated = false;
  if (result.website) {
    const { data: company } = await supabase
      .from("companies")
      .select("website, website_source_url")
      .eq("id", companyId)
      .single();
    const current = company as { website: string | null; website_source_url: string | null } | null;
    const currentWebsite = current?.website;
    const currentOrigin = toOrigin(currentWebsite || null);
    if (!currentWebsite || currentOrigin === result.website.url) {
      const { error } = await supabase
        .from("companies")
        .update({
          website: result.website.url,
          website_source_url: result.website.sourceUrl,
          website_confidence: result.website.confidence,
          website_verified_at: new Date().toISOString(),
        })
        .eq("id", companyId);
      if (error) throw new Error(`Failed to save verified company website: ${error.message}`);
      websiteUpdated = !currentWebsite || !current?.website_source_url;
    }
  }

  const { error: runError } = await supabase
    .from("contact_discovery_runs")
    .update({ status: "Complete", candidates_found: candidateRows.length, completed_at: new Date().toISOString(), error_message: null })
    .eq("id", runId);
  if (runError) throw new Error(`Failed to complete contact discovery run: ${runError.message}`);

  return websiteUpdated;
}

export async function ensureCompanyDiscovery(
  companyId: number,
  forceRefresh = false,
  researchContext: string | null = null,
): Promise<CompanyDiscoverySummary> {
  const profile = await getActiveProfile();
  if (!profile) return { websiteUpdated: false, website: null, candidates: [] };
  const supabase = getSupabaseAdmin();
  const { data: runs, error: runsError } = await supabase
    .from("contact_discovery_runs")
    .select("id, status, created_at")
    .eq("company_id", companyId)
    .eq("business_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (runsError) throw new Error(`Failed to load contact discovery runs: ${runsError.message}`);
  const latest = ((runs as DiscoveryRunRow[] | null) || [])[0];
  const completedRecently =
    latest?.status === "Complete" && Date.now() - new Date(latest.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  if ((!forceRefresh && completedRecently) || latest?.status === "Running") {
    return {
      websiteUpdated: false,
      website: await getStoredWebsite(companyId),
      candidates: await getDiscoveryCandidates(companyId),
    };
  }

  const { data: created, error: createError } = await supabase
    .from("contact_discovery_runs")
    .insert({ company_id: companyId, business_profile_id: profile.id, status: "Running", requested_count: 5, started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (createError) throw new Error(`Failed to start contact discovery: ${createError.message}`);
  const runId = Number((created as { id: string | number }).id);

  try {
    const company = await getResearchCompany(companyId);
    const result = await discoverCompanyAndContacts(company, profile, researchContext);
    const websiteUpdated = await persistDiscoveryRun(runId, companyId, profile, result);
    return {
      websiteUpdated,
      website: await getStoredWebsite(companyId),
      candidates: await getDiscoveryCandidates(companyId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contact discovery failed.";
    await supabase
      .from("contact_discovery_runs")
      .update({ status: "Failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", runId);
    throw error;
  }
}
