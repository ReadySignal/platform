import "server-only";

import {
  getVerifiedSourceUrls,
  normalizeSourceUrl,
  OPENAI_WEB_RESEARCH_MODEL,
  sourceMatchesCompanyWebsite,
} from "./openAIWebResearchProvider";
import type { ResearchCompany } from "../../types/research";

export type DiscoveryConfidence = "High" | "Medium" | "Low";
export type EmploymentStatus = "Current" | "Unclear" | "Former";

export type CompanyWebsiteFinding = {
  url: string;
  sourceName: string;
  sourceUrl: string;
  confidence: DiscoveryConfidence;
  identityEvidence: string;
};

export type PublicContactFinding = {
  fullName: string;
  currentTitle: string;
  department: string | null;
  managementLevel: string | null;
  location: string | null;
  sourceName: string;
  sourceUrl: string;
  confidence: DiscoveryConfidence;
  employmentStatus: EmploymentStatus;
  companyAssociationEvidence: string;
  responsibilitySummary: string | null;
  conflictingSignals: string[];
  missingInformation: string[];
};

export type CompanyDiscoveryResult = {
  website: CompanyWebsiteFinding | null;
  contacts: PublicContactFinding[];
};

export type ContactCandidateForValidation = {
  fullName: string;
  currentTitle: string;
};

type BusinessProfileForDiscovery = {
  productName: string;
  productDescription: string;
  valuePropositions: string[];
  customerProblems: string[];
  targetIndustries: string[];
  targetGeographies: string[];
  priorityTitles: string[];
  secondaryTitles: string[];
  relevantDepartments: string[];
  managementLevels: string[];
  excludedTitles: string[];
};

type OpenAIResponseItem = {
  type?: string;
  action?: { sources?: unknown };
  content?: Array<{ type?: string; text?: string; parsed?: unknown }>;
};

type OpenAIResponseBody = {
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output_parsed?: unknown;
  output_text?: string;
  output?: OpenAIResponseItem[];
};

const MAX_CONTACTS = 5;
const MAX_TOOL_CALLS = 6;
const MAX_OUTPUT_TOKENS = 6400;
const TIMEOUT_MS = 90000;
const DISALLOWED_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "zoominfo.com",
  "rocketreach.co",
  "signalhire.com",
];

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["website", "contacts"],
  properties: {
    website: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["url", "sourceName", "sourceUrl", "confidence", "identityEvidence"],
          properties: {
            url: { type: "string" },
            sourceName: { type: "string" },
            sourceUrl: { type: "string" },
            confidence: { type: "string", enum: ["High", "Medium", "Low"] },
            identityEvidence: { type: "string" },
          },
        },
      ],
    },
    contacts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "fullName",
          "currentTitle",
          "department",
          "managementLevel",
          "location",
          "sourceName",
          "sourceUrl",
          "confidence",
          "employmentStatus",
          "companyAssociationEvidence",
          "responsibilitySummary",
          "conflictingSignals",
          "missingInformation",
        ],
        properties: {
          fullName: { type: "string" },
          currentTitle: { type: "string" },
          department: { type: ["string", "null"] },
          managementLevel: { type: ["string", "null"] },
          location: { type: ["string", "null"] },
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
          employmentStatus: { type: "string", enum: ["Current", "Unclear", "Former"] },
          companyAssociationEvidence: { type: "string" },
          responsibilitySummary: { type: ["string", "null"] },
          conflictingSignals: { type: "array", items: { type: "string" } },
          missingInformation: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

const contactValidationOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["contacts"],
  properties: { contacts: outputSchema.properties.contacts },
};

function normalizeReference(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hostIsDisallowed(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return DISALLOWED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return true;
  }
}

function toOfficialOrigin(url: string) {
  const normalized = normalizeSourceUrl(url);
  if (!normalized || hostIsDisallowed(normalized)) return null;
  const parsed = new URL(normalized);
  return `${parsed.protocol}//${parsed.host}`;
}

function compactStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
}

function extractOutput(response: OpenAIResponseBody): unknown {
  if (response.output_parsed !== undefined) return response.output_parsed;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.parsed !== undefined) return content.parsed;
    }
  }

  const text = (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n") || response.output_text;

  if (!text) throw new Error("Company discovery response was empty.");
  return JSON.parse(text);
}

function buildPrompt(company: ResearchCompany, profile: BusinessProfileForDiscovery, researchContext: string | null) {
  return `Find the official website and a sourced shortlist of up to ${MAX_CONTACTS} relevant public contact candidates for the exact target company below.

Target company: ${company.name}
Known website: ${company.website || "Unknown"}
Known location: ${[company.hqCity, company.hqState || company.state, company.hqCountry].filter(Boolean).join(", ") || "Unknown"}
Existing buying signal to anchor the contact search: ${researchContext || "None supplied"}

Seller and offering context:
- Product: ${profile.productName}
- Description: ${profile.productDescription}
- Customer problems: ${profile.customerProblems.join(", ") || "Not specified"}
- Value propositions: ${profile.valuePropositions.join(", ") || "Not specified"}
- Target industries: ${profile.targetIndustries.join(", ") || "Not specified"}
- Preferred geographies: ${profile.targetGeographies.join(", ") || "Not specified"}

Target role guidance:
- Priority titles: ${profile.priorityTitles.join(", ") || "operations, maintenance, reliability, engineering, plant leadership"}
- Secondary titles: ${profile.secondaryTitles.join(", ") || "facilities, continuous improvement"}
- Departments: ${profile.relevantDepartments.join(", ") || "operations, maintenance, reliability, engineering"}
- Management levels: ${profile.managementLevels.join(", ") || "manager, director, vice president, head"}
- Excluded titles: ${profile.excludedTitles.join(", ") || "sales, marketing, human resources, finance"}

Use only public, citable pages. Prefer the company's own website, company newsroom, conference speaker pages, trade associations, and reputable news sources.
Do not use LinkedIn, social profiles, people-search sites, data brokers, guessed domains, guessed titles, guessed employment, emails, or phone numbers.
Search independently for several role-relevant people before stopping. Return fewer than ${MAX_CONTACTS} only when the allowed public sources cannot support more.
Prefer people whose responsibilities connect directly to the stated product, customer problems, and existing buying signal. Prefer people in the target geographies when a sourced location is available.
The official website is valid only when the cited page explicitly identifies ${company.name} and its source host matches the proposed website host.
Mark employment Current only when the cited page explicitly states the person's name, title, and current association with ${company.name}. Otherwise use Unclear or Former.
Put concise factual support in identityEvidence and companyAssociationEvidence. List every uncertainty in missingInformation and every contradiction in conflictingSignals.
Return no website or contacts when the public sources do not support them. Follow the structured output schema exactly.`;
}

function buildContactValidationPrompt(
  company: ResearchCompany,
  candidates: ContactCandidateForValidation[],
  researchContext: string | null,
) {
  const candidateList = candidates.map((candidate, index) =>
    `${index + 1}. ${candidate.fullName} - claimed title: ${candidate.currentTitle}`,
  ).join("\n");

  return `Validate the current employment and responsibility of these exact named contact candidates for ${company.name}.

Known company website: ${company.website || "Unknown"}
Buying signal context: ${researchContext || "None supplied"}

Candidates to validate:
${candidateList}

Search separately for every named candidate. Use only public, citable pages such as the company's own site, current conference speaker pages, trade associations, government records, and reputable news sources.
Do not use LinkedIn, social profiles, people-search sites, data brokers, guessed titles, guessed employment, emails, or phone numbers.
Return only candidates from the supplied list. Mark employment Current only when a cited page explicitly supports the person's full name, current title, and current association with ${company.name}. Use Former when a source explicitly contradicts the claimed current employment. Otherwise use Unclear.
Use High confidence only when the cited page directly supports the person's name, title, and company. List contradictions and missing facts explicitly. Omit a candidate when no allowed cited source mentions that person.
Follow the structured output schema exactly.`;
}

function validateWebsite(company: ResearchCompany, value: unknown, verifiedUrls: Set<string>): CompanyWebsiteFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const url = typeof item.url === "string" ? toOfficialOrigin(item.url) : null;
  const sourceUrl = typeof item.sourceUrl === "string" ? normalizeSourceUrl(item.sourceUrl) : null;
  const sourceName = typeof item.sourceName === "string" ? item.sourceName.trim() : "";
  const identityEvidence = typeof item.identityEvidence === "string" ? item.identityEvidence.trim() : "";
  const confidence = item.confidence;
  const companyName = normalizeReference(company.name);

  if (
    !url ||
    !sourceUrl ||
    !verifiedUrls.has(sourceUrl) ||
    hostIsDisallowed(sourceUrl) ||
    !sourceMatchesCompanyWebsite(sourceUrl, url) ||
    !sourceName ||
    !identityEvidence ||
    !normalizeReference(identityEvidence).includes(companyName) ||
    !["High", "Medium"].includes(String(confidence))
  ) {
    return null;
  }

  return { url, sourceName, sourceUrl, confidence: confidence as "High" | "Medium", identityEvidence };
}

function validateContact(company: ResearchCompany, value: unknown, verifiedUrls: Set<string>): PublicContactFinding | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const fullName = typeof item.fullName === "string" ? item.fullName.trim() : "";
  const currentTitle = typeof item.currentTitle === "string" ? item.currentTitle.trim() : "";
  const sourceName = typeof item.sourceName === "string" ? item.sourceName.trim() : "";
  const sourceUrl = typeof item.sourceUrl === "string" ? normalizeSourceUrl(item.sourceUrl) : null;
  const association = typeof item.companyAssociationEvidence === "string" ? item.companyAssociationEvidence.trim() : "";
  const confidence = String(item.confidence);
  let employmentStatus = String(item.employmentStatus) as EmploymentStatus;
  const associationReference = normalizeReference(association);
  const supportsIdentity = [company.name, fullName, currentTitle]
    .map(normalizeReference)
    .every((reference) => reference.length >= 2 && associationReference.includes(reference));

  if (
    !fullName ||
    fullName.split(/\s+/).length < 2 ||
    !currentTitle ||
    !sourceName ||
    !sourceUrl ||
    !verifiedUrls.has(sourceUrl) ||
    hostIsDisallowed(sourceUrl) ||
    !association ||
    !["High", "Medium", "Low"].includes(confidence) ||
    !["Current", "Unclear", "Former"].includes(employmentStatus)
  ) {
    return null;
  }

  if (employmentStatus === "Current" && (confidence !== "High" || !supportsIdentity)) {
    employmentStatus = "Unclear";
  }

  return {
    fullName,
    currentTitle,
    department: typeof item.department === "string" && item.department.trim() ? item.department.trim() : null,
    managementLevel: typeof item.managementLevel === "string" && item.managementLevel.trim() ? item.managementLevel.trim() : null,
    location: typeof item.location === "string" && item.location.trim() ? item.location.trim() : null,
    sourceName,
    sourceUrl,
    confidence: confidence as DiscoveryConfidence,
    employmentStatus,
    companyAssociationEvidence: association,
    responsibilitySummary:
      typeof item.responsibilitySummary === "string" && item.responsibilitySummary.trim()
        ? item.responsibilitySummary.trim()
        : null,
    conflictingSignals: compactStrings(item.conflictingSignals),
    missingInformation: compactStrings(item.missingInformation),
  };
}

export async function discoverCompanyAndContacts(
  company: ResearchCompany,
  profile: BusinessProfileForDiscovery,
  researchContext: string | null = null,
): Promise<CompanyDiscoveryResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_WEB_RESEARCH_MODEL,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        text: { format: { type: "json_schema", name: "company_identity_and_contacts", strict: true, schema: outputSchema } },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        max_tool_calls: MAX_TOOL_CALLS,
        truncation: "disabled",
        input: buildPrompt(company, profile, researchContext),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Company and contact discovery timed out. Try this company again.");
    }
    throw new Error("Company and contact discovery could not be completed.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Company and contact discovery failed with status ${response.status}.`);
  }

  const responseBody = (await response.json()) as OpenAIResponseBody;
  if (responseBody.status && responseBody.status !== "completed") {
    const reason = responseBody.incomplete_details?.reason?.trim() || "unknown reason";
    console.warn("[company-discovery] OpenAI response was incomplete.", {
      companyId: company.id,
      reason,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxToolCalls: MAX_TOOL_CALLS,
    });
    throw new Error(`Company and contact discovery response was incomplete (${reason}). Try again.`);
  }

  const parsed = extractOutput(responseBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Company and contact discovery response could not be validated.");
  }

  const output = parsed as Record<string, unknown>;
  const verifiedUrls = getVerifiedSourceUrls(responseBody);
  const website = validateWebsite(company, output.website, verifiedUrls);
  const contacts = (Array.isArray(output.contacts) ? output.contacts : [])
    .slice(0, MAX_CONTACTS)
    .map((item) => validateContact(company, item, verifiedUrls))
    .filter((item): item is PublicContactFinding => Boolean(item));

  return { website, contacts };
}

export async function validateContactCandidates(
  company: ResearchCompany,
  candidates: ContactCandidateForValidation[],
  researchContext: string | null = null,
): Promise<PublicContactFinding[]> {
  const requested = candidates.slice(0, MAX_CONTACTS);
  if (requested.length === 0) return [];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_WEB_RESEARCH_MODEL,
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        text: { format: { type: "json_schema", name: "contact_validation", strict: true, schema: contactValidationOutputSchema } },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        max_tool_calls: MAX_TOOL_CALLS,
        truncation: "disabled",
        input: buildContactValidationPrompt(company, requested, researchContext),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Contact validation timed out. Try this shortlist again.");
    }
    throw new Error("Contact validation could not be completed.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`Contact validation failed with status ${response.status}.`);
  const responseBody = (await response.json()) as OpenAIResponseBody;
  if (responseBody.status && responseBody.status !== "completed") {
    throw new Error("Contact validation response was incomplete. Try again.");
  }
  const parsed = extractOutput(responseBody);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Contact validation response could not be validated.");
  }

  const requestedNames = new Set(requested.map((candidate) => normalizeReference(candidate.fullName)));
  const output = parsed as Record<string, unknown>;
  const verifiedUrls = getVerifiedSourceUrls(responseBody);
  return (Array.isArray(output.contacts) ? output.contacts : [])
    .slice(0, MAX_CONTACTS)
    .map((item) => validateContact(company, item, verifiedUrls))
    .filter((item): item is PublicContactFinding => Boolean(item))
    .filter((item) => requestedNames.has(normalizeReference(item.fullName)));
}
