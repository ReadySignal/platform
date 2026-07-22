import "server-only";

import type { EvidenceCandidate, ProviderResult, ResearchCompany, ResearchProvider } from "../../types/research";

export class OpenAIResearchProviderError extends Error {
  fatal: boolean;
  code: "timeout" | "validation" | "incomplete" | "provider-error";

  constructor(
    message: string,
    fatal = false,
    code: "timeout" | "validation" | "incomplete" | "provider-error" = "provider-error",
  ) {
    super(message);
    this.name = "OpenAIResearchProviderError";
    this.fatal = fatal;
    this.code = code;
  }
}

type OpenAIFinding = {
  evidenceType?: string;
  headline?: string;
  summary?: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string | null;
  confidence?: "High" | "Medium" | "Low";
};

type OpenAIResearchOutput = {
  findings?: OpenAIFinding[];
};

type OpenAIResponseOutputItem = {
  type?: string;
  status?: string;
  finish_reason?: string;
  action?: {
    sources?: unknown;
  };
  content?: Array<{
    type?: string;
    text?: string;
    parsed?: unknown;
    refusal?: string;
    annotations?: Array<{
      type?: string;
      url?: string;
      title?: string;
    }>;
  }>;
};

type OpenAIResponseBody = {
  status?: string;
  finish_reason?: string;
  incomplete_details?: {
    reason?: string;
  };
  output_parsed?: unknown;
  output_text?: string;
  output?: OpenAIResponseOutputItem[];
};

export const OPENAI_WEB_RESEARCH_MODEL = "gpt-5.5";
export const OPENAI_WEB_RESEARCH_MAX_FINDINGS = 10;
export const OPENAI_WEB_RESEARCH_TIMEOUT_MS = 90000;
export const OPENAI_WEB_RESEARCH_MAX_OUTPUT_TOKENS = 2400;
export const OPENAI_WEB_RESEARCH_MAX_TOOL_CALLS = 4;
export const OPENAI_WEB_RESEARCH_CONTEXT_SIZE = "low";
export const OPENAI_WEB_RESEARCH_TIMEOUT_MESSAGE = "Research took longer than expected. Try this company again.";
export const OPENAI_WEB_RESEARCH_VALIDATION_MESSAGE =
  "Research response could not be validated. Try this company again.";
export const OPENAI_WEB_RESEARCH_INCOMPLETE_MESSAGE = "Research response was incomplete. Try this company again.";

const researchOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "evidenceType",
          "headline",
          "summary",
          "sourceName",
          "sourceUrl",
          "publishedAt",
          "confidence",
        ],
        properties: {
          evidenceType: { type: "string" },
          headline: { type: "string" },
          summary: { type: "string" },
          sourceName: { type: "string" },
          sourceUrl: { type: "string" },
          publishedAt: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
        },
      },
    },
  },
};

const researchWindowDays = 90;
const allowedEvidenceTypes = [
  "expansion",
  "new facility",
  "capital investment",
  "major hiring",
  "acquisition",
  "leadership change",
  "new product line",
  "modernization or reliability initiative",
  "relevant industry news",
];

function formatCompanyFacts(company: ResearchCompany) {
  const hq = [company.hqCity, company.hqState || company.state, company.hqCountry].filter(Boolean).join(", ");

  return [
    `Company: ${company.name}`,
    `Website: ${company.website || "Unknown"}`,
    `Industry: ${company.primaryIndustry || company.industry || "Unknown"}`,
    `Sub-industry: ${company.subIndustry || "Unknown"}`,
    `Employees: ${company.employeeCount ?? "Unknown"}`,
    `Revenue: ${company.annualRevenue ?? "Unknown"}`,
    `Ownership: ${company.ownershipType || "Unknown"}`,
    `Ticker: ${company.ticker || "Unknown"}`,
    `HQ: ${hq || "Unknown"}`,
    `Locations: ${company.locationCount ?? "Unknown"}`,
  ].join("\n");
}

function buildPrompt(company: ResearchCompany) {
  return `Research public company-level business evidence for the target company below.
ReadySignal is the application performing the research, not the research subject.
Only return findings explicitly about ${company.name}. Do not return findings about ReadySignal or similarly named companies unless ${company.name} is ReadySignal.
Known company facts from the user's imported list:
${formatCompanyFacts(company)}

Window: last ${researchWindowDays} days. Prefer company newsroom/press releases, company website, reputable industry publications, and reputable news organizations.
Look only for: ${allowedEvidenceTypes.join(", ")}.
Only search for NEW developments. Do not repeat known company facts as findings.
Do not research contacts. Do not infer, invent, or include unsupported claims.
Propose at most 5 findings before validation.
Each finding must use one short headline and a one-sentence summary.
Do not include long article descriptions, background paragraphs, or repeated source details.
The response must follow the provided structured output schema.
`;
}

function getValidationError() {
  return new OpenAIResearchProviderError(OPENAI_WEB_RESEARCH_VALIDATION_MESSAGE, true, "validation");
}

function getIncompleteError() {
  return new OpenAIResearchProviderError(OPENAI_WEB_RESEARCH_INCOMPLETE_MESSAGE, true, "incomplete");
}

function logStructuredOutputValidationFailure(company: ResearchCompany, responseBody: unknown, validationErrors: string[], parsedField?: string) {
  const response = responseBody as OpenAIResponseBody;
  const structuredOutput = extractStructuredOutput(responseBody);
  const verifiedSourceUrls = getVerifiedSourceUrls(responseBody);

  console.warn("[research] OpenAI structured output validation failed.", {
    companyId: company.id,
    companyName: company.name,
    responseStatus: response.status,
    finishReason: getResponseFinishReason(responseBody),
    outputWasTruncated: wasResponseTruncated(responseBody),
    parsedField: parsedField ?? structuredOutput.parsedField,
    structuredOutputExisted: structuredOutput.parsedOutput !== undefined || Boolean(structuredOutput.rawOutputText.trim()),
    validationErrors,
    webSearchSourcesExisted: hasWebSearchSources(responseBody),
    urlCitationAnnotationsExisted: hasUrlCitationAnnotations(responseBody),
    verifiedSourcesExisted: verifiedSourceUrls.size > 0,
  });
}

function getResponseFinishReason(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  return response.finish_reason || (response.output || []).find((item) => item.finish_reason)?.finish_reason;
}

function wasResponseTruncated(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  const incompleteReason = response.incomplete_details?.reason?.toLowerCase() || "";
  const finishReason = getResponseFinishReason(responseBody)?.toLowerCase() || "";

  return (
    response.status === "incomplete" ||
    incompleteReason.includes("max_output") ||
    incompleteReason.includes("token") ||
    finishReason.includes("length") ||
    finishReason.includes("max_output") ||
    finishReason.includes("token")
  );
}

function extractStructuredOutput(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;

  if (response.output_parsed !== undefined) {
    return {
      parsedOutput: response.output_parsed,
      rawOutputText: JSON.stringify(response.output_parsed),
      parsedField: "output_parsed",
    };
  }

  for (const item of response.output || []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content || []) {
      if (content.parsed !== undefined) {
        return {
          parsedOutput: content.parsed,
          rawOutputText: JSON.stringify(content.parsed),
          parsedField: "output[].content[].parsed",
        };
      }
    }
  }

  const messageContentText = (response.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text || "")
    .join("\n")
    .trim();

  if (messageContentText) {
    return {
      parsedOutput: undefined,
      rawOutputText: messageContentText,
      parsedField: "output[].content[type=output_text].text",
    };
  }

  return {
    parsedOutput: undefined,
    rawOutputText: typeof response.output_text === "string" ? response.output_text : "",
    parsedField: typeof response.output_text === "string" ? "output_text" : "none",
  };
}

function hasRefusal(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  return (response.output || []).some((item) =>
    (item.content || []).some((content) => content.type === "refusal" || Boolean(content.refusal)),
  );
}

function hasWebSearchSources(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  return (response.output || []).some((item) => item.type === "web_search_call" && Boolean(item.action?.sources));
}

function hasUrlCitationAnnotations(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  return (response.output || []).some((item) =>
    (item.content || []).some((content) =>
      (content.annotations || []).some((annotation) => annotation.type === "url_citation"),
    ),
  );
}

function assertResearchOutputShape(value: unknown) {
  const validationErrors: string[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    validationErrors.push("Root output must be an object.");
    return { output: null, validationErrors };
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || !Array.isArray(record.findings)) {
    validationErrors.push("Root output must contain only a findings array.");
    return { output: null, validationErrors };
  }

  const findings: OpenAIFinding[] = [];

  record.findings.forEach((finding, index) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      validationErrors.push(`findings[${index}] must be an object.`);
      return;
    }

    const findingRecord = finding as Record<string, unknown>;
    const findingKeys = Object.keys(findingRecord);
    const requiredKeys = [
      "evidenceType",
      "headline",
      "summary",
      "sourceName",
      "sourceUrl",
      "publishedAt",
      "confidence",
    ];

    if (findingKeys.length !== requiredKeys.length || requiredKeys.some((key) => !findingKeys.includes(key))) {
      validationErrors.push(`findings[${index}] must contain exactly the required fields.`);
      return;
    }

    if (
      typeof findingRecord.evidenceType !== "string" ||
      typeof findingRecord.headline !== "string" ||
      typeof findingRecord.summary !== "string" ||
      typeof findingRecord.sourceName !== "string" ||
      typeof findingRecord.sourceUrl !== "string" ||
      (typeof findingRecord.publishedAt !== "string" && findingRecord.publishedAt !== null) ||
      !["High", "Medium", "Low"].includes(String(findingRecord.confidence))
    ) {
      validationErrors.push(`findings[${index}] has one or more invalid field types or confidence values.`);
      return;
    }

    findings.push(findingRecord as OpenAIFinding);
  });

  return {
    output: validationErrors.length > 0 ? null : { findings },
    validationErrors,
  };
}

function parseResearchOutput(company: ResearchCompany, responseBody: unknown): OpenAIResearchOutput {
  const response = responseBody as OpenAIResponseBody;

  if (response.status === "incomplete") {
    console.warn(`[research] OpenAI structured research response incomplete: ${response.incomplete_details?.reason || "unknown"}.`);
    const structuredOutput = extractStructuredOutput(responseBody);
    logStructuredOutputValidationFailure(
      company,
      responseBody,
      [`Response was incomplete before full structured output was available: ${response.incomplete_details?.reason || "unknown"}.`],
      structuredOutput.parsedField,
    );
    throw getIncompleteError();
  }

  if (response.status && response.status !== "completed") {
    console.warn(`[research] OpenAI structured research response had unexpected status: ${response.status}.`);
    const structuredOutput = extractStructuredOutput(responseBody);
    logStructuredOutputValidationFailure(
      company,
      responseBody,
      [`Response had unexpected status: ${response.status}.`],
      structuredOutput.parsedField,
    );
    throw getValidationError();
  }

  if (hasRefusal(responseBody)) {
    console.warn("[research] OpenAI structured research response was refused.");
    const structuredOutput = extractStructuredOutput(responseBody);
    logStructuredOutputValidationFailure(
      company,
      responseBody,
      ["Response contained a refusal."],
      structuredOutput.parsedField,
    );
    throw getValidationError();
  }

  const structuredOutput = extractStructuredOutput(responseBody);
  const rawOutputText = structuredOutput.rawOutputText.trim();

  if (!rawOutputText) {
    logStructuredOutputValidationFailure(company, responseBody, ["Raw structured output text was empty."], structuredOutput.parsedField);
    throw getValidationError();
  }

  let parsedOutput: unknown = structuredOutput.parsedOutput;
  if (parsedOutput === undefined) {
    try {
      parsedOutput = JSON.parse(rawOutputText);
    } catch {
      const truncated = wasResponseTruncated(responseBody);
      const validationErrors = truncated
        ? ["Structured output was truncated before complete JSON could be parsed."]
        : ["Raw structured output text was not valid JSON."];
      logStructuredOutputValidationFailure(company, responseBody, validationErrors, structuredOutput.parsedField);
      throw truncated ? getIncompleteError() : getValidationError();
    }
  }

  const { output, validationErrors } = assertResearchOutputShape(parsedOutput);
  if (!output) {
    logStructuredOutputValidationFailure(company, responseBody, validationErrors, structuredOutput.parsedField);
    throw getValidationError();
  }

  return output;
}

function normalizeSourceUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeCompanyReference(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceMatchesCompanyWebsite(sourceUrl: string, companyWebsite: string | null | undefined) {
  if (!companyWebsite) {
    return false;
  }

  try {
    const sourceHost = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, "");
    const companyUrl = companyWebsite.includes("://") ? companyWebsite : `https://${companyWebsite}`;
    const companyHost = new URL(companyUrl).hostname.toLowerCase().replace(/^www\./, "");

    return sourceHost === companyHost || sourceHost.endsWith(`.${companyHost}`);
  } catch {
    return false;
  }
}

function findingReferencesTargetCompany(company: ResearchCompany, finding: OpenAIFinding, sourceUrl: string) {
  const companyReference = normalizeCompanyReference(company.name);
  const findingReference = normalizeCompanyReference(
    [finding.headline, finding.summary, finding.sourceName].filter(Boolean).join(" "),
  );

  return (
    (companyReference.length >= 3 && findingReference.includes(companyReference)) ||
    sourceMatchesCompanyWebsite(sourceUrl, company.website)
  );
}

function collectUrlsFromUnknown(value: unknown, urls: Set<string>) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrlsFromUnknown(item, urls);
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (key.toLowerCase() === "url" && typeof nestedValue === "string") {
      const normalized = normalizeSourceUrl(nestedValue);
      if (normalized) {
        urls.add(normalized);
      }
    } else {
      collectUrlsFromUnknown(nestedValue, urls);
    }
  }
}

function getVerifiedSourceUrls(responseBody: unknown) {
  const response = responseBody as OpenAIResponseBody;
  const urls = new Set<string>();

  for (const item of response.output || []) {
    if (item.type === "web_search_call") {
      collectUrlsFromUnknown(item.action?.sources, urls);
    }

    if (item.type === "message") {
      for (const content of item.content || []) {
        for (const annotation of content.annotations || []) {
          if (annotation.type === "url_citation") {
            const normalized = normalizeSourceUrl(annotation.url);
            if (normalized) {
              urls.add(normalized);
            }
          }
        }
      }
    }
  }

  return urls;
}

function normalizeFinding(
  company: ResearchCompany,
  finding: OpenAIFinding,
  verifiedSourceUrls: Set<string>,
): EvidenceCandidate | null {
  const sourceUrl = finding.sourceUrl;
  const normalizedSourceUrl = normalizeSourceUrl(sourceUrl);

  if (
    !finding.evidenceType?.trim() ||
    !finding.headline?.trim() ||
    !finding.summary?.trim() ||
    !finding.sourceName?.trim() ||
    !normalizedSourceUrl ||
    !finding.confidence
  ) {
    return null;
  }

  if (!verifiedSourceUrls.has(normalizedSourceUrl)) {
    console.warn("[research] Discarded unsupported citation.", {
      companyId: company.id,
      companyName: company.name,
      sourceHost: normalizedSourceUrl ? new URL(normalizedSourceUrl).hostname : "unknown",
      verifiedSourcesExisted: verifiedSourceUrls.size > 0,
    });
    return null;
  }

  if (!findingReferencesTargetCompany(company, finding, normalizedSourceUrl)) {
    console.warn("[research] Discarded evidence about a different company.", {
      companyId: company.id,
      companyName: company.name,
      sourceHost: new URL(normalizedSourceUrl).hostname,
    });
    return null;
  }

  return {
    companyId: company.id,
    evidenceType: finding.evidenceType.trim(),
    headline: finding.headline.trim(),
    summary: finding.summary.trim(),
    sourceName: finding.sourceName.trim(),
    sourceUrl: normalizedSourceUrl,
    publishedAt: finding.publishedAt || null,
    confidence: finding.confidence,
  };
}

function getOpenAIRequestPayload(company: ResearchCompany) {
  return {
    model: OPENAI_WEB_RESEARCH_MODEL,
    tools: [{ type: "web_search", search_context_size: OPENAI_WEB_RESEARCH_CONTEXT_SIZE }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    text: {
      format: {
        type: "json_schema",
        name: "company_research_findings",
        strict: true,
        schema: researchOutputJsonSchema,
      },
    },
    max_output_tokens: OPENAI_WEB_RESEARCH_MAX_OUTPUT_TOKENS,
    max_tool_calls: OPENAI_WEB_RESEARCH_MAX_TOOL_CALLS,
    truncation: "disabled",
    input: buildPrompt(company),
  };
}

async function parseOpenAIError(response: Response) {
  if (response.status === 401) {
    return new OpenAIResearchProviderError("OpenAI API key is invalid or unauthorized.", true);
  }

  if (response.status === 429) {
    return new OpenAIResearchProviderError("OpenAI rate limit or quota exceeded.", true);
  }

  return new OpenAIResearchProviderError(`OpenAI research request failed with status ${response.status}.`, true);
}

export const openAIWebResearchProvider: ResearchProvider = {
  id: "openai-web-research",
  name: "OpenAI Web Research",
  async researchCompany(company): Promise<ProviderResult> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new OpenAIResearchProviderError("OpenAI API key is not configured.", true);
    }

    console.info(`[research] Starting OpenAI web research request for company ${company.id}.`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_WEB_RESEARCH_TIMEOUT_MS);
    const requestPayload = getOpenAIRequestPayload(company);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`[research] OpenAI web research timed out for company ${company.id}.`);
        throw new OpenAIResearchProviderError(OPENAI_WEB_RESEARCH_TIMEOUT_MESSAGE, true, "timeout");
      }

      throw new OpenAIResearchProviderError("OpenAI research request could not be completed.", true);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      console.error(`[research] OpenAI web research failed for company ${company.id}: ${response.status}`);
      throw await parseOpenAIError(response);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new OpenAIResearchProviderError("OpenAI returned malformed response JSON.", true);
    }

    const parsed = parseResearchOutput(company, responseBody);
    const verifiedSourceUrls = getVerifiedSourceUrls(responseBody);

    if ((parsed.findings || []).length === 0) {
      return {
        status: "No Evidence",
        evidence: [],
        errorMessage: "No evidence found.",
      };
    }

    if (verifiedSourceUrls.size === 0) {
      console.warn("[research] OpenAI web search returned findings without verifiable sources.", {
        companyId: company.id,
        companyName: company.name,
        parsedField: extractStructuredOutput(responseBody).parsedField,
        finishReason: getResponseFinishReason(responseBody),
        outputWasTruncated: wasResponseTruncated(responseBody),
        structuredOutputExisted: true,
        webSearchSourcesExisted: hasWebSearchSources(responseBody),
        urlCitationAnnotationsExisted: hasUrlCitationAnnotations(responseBody),
      });
      return {
        status: "No Evidence",
        evidence: [],
        errorMessage: "No evidence found.",
      };
    }

    const evidence = (parsed.findings || [])
      .slice(0, OPENAI_WEB_RESEARCH_MAX_FINDINGS)
      .map((finding) => normalizeFinding(company, finding, verifiedSourceUrls))
      .filter((finding): finding is EvidenceCandidate => Boolean(finding));

    return {
      status: evidence.length > 0 ? "Completed" : "No Evidence",
      evidence,
      errorMessage: evidence.length > 0 ? null : "No evidence found.",
    };
  },
};
