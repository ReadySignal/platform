import "server-only";

import type { CompanyResearchCandidate } from "./companyResearchByNameService";

export type RouteType = "email" | "phone";
export type RouteVerificationStatus = "verified" | "valid" | "possible" | "catch-all" | "unknown" | "invalid" | "do-not-use";
export type RouteConfidence = "High" | "Medium" | "Low";

export type ContactRouteAttempt = {
  provider: string;
  routeType: RouteType;
  status: RouteVerificationStatus;
  confidence: RouteConfidence;
  value: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  costEstimate: string;
  stoppedWaterfall: boolean;
  details: string[];
};

export type ContactRouteWaterfallResult = {
  companyName: string;
  companyUrl: string | null;
  contactName: string;
  contactTitle: string;
  attemptedCount: number;
  acceptedRoute: ContactRouteAttempt | null;
  attempts: ContactRouteAttempt[];
  warnings: string[];
};

type RouteProviderInput = {
  companyName: string;
  companyUrl: string | null;
  candidate: CompanyResearchCandidate;
};

type RouteProvider = {
  name: string;
  routeType: RouteType;
  isConfigured: () => boolean;
  findRoute: (input: RouteProviderInput) => Promise<ContactRouteAttempt>;
};

function splitName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length < 2) return null;
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function domainFromUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function routeConfidence(score: number | null, status: RouteVerificationStatus): RouteConfidence {
  if (status === "verified" && (score ?? 0) >= 90) return "High";
  if (status === "verified" || status === "valid") return "Medium";
  return "Low";
}

function mapHunterStatus(status: string | null | undefined): RouteVerificationStatus {
  if (status === "valid") return "verified";
  if (status === "accept_all") return "catch-all";
  if (status === "invalid" || status === "webmail" || status === "disposable") return "do-not-use";
  return "unknown";
}

type HunterEmailFinderResponse = {
  data?: {
    email?: string | null;
    score?: number | null;
    sources?: { uri?: string | null; domain?: string | null }[];
    verification?: { status?: string | null };
  };
  errors?: { details?: string; code?: string }[];
};

const hunterEmailProvider: RouteProvider = {
  name: "Hunter Email Finder",
  routeType: "email",
  isConfigured: () => Boolean(process.env.HUNTER_API_KEY),
  async findRoute({ companyName, companyUrl, candidate }) {
    const providerName = "Hunter Email Finder";
    const providerRouteType = "email" as const;
    const name = splitName(candidate.fullName);
    const domain = domainFromUrl(companyUrl);
    if (!name) {
      return {
        provider: providerName,
        routeType: providerRouteType,
        status: "unknown",
        confidence: "Low",
        value: null,
        sourceUrl: null,
        sourceName: null,
        costEstimate: "0 credits",
        stoppedWaterfall: false,
        details: ["Contact name could not be split into first and last name."],
      };
    }

    const params = new URLSearchParams({
      first_name: name.firstName,
      last_name: name.lastName,
      company: companyName,
      max_duration: "10",
      api_key: process.env.HUNTER_API_KEY || "",
    });
    if (domain) params.set("domain", domain);

    const response = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    const body = (await response.json()) as HunterEmailFinderResponse;
    if (!response.ok || !body.data) {
      return {
        provider: providerName,
        routeType: providerRouteType,
        status: "unknown",
        confidence: "Low",
        value: null,
        sourceUrl: null,
        sourceName: null,
        costEstimate: "up to 1 Hunter search credit",
        stoppedWaterfall: false,
        details: [body.errors?.[0]?.details || `Hunter returned HTTP ${response.status}.`],
      };
    }

    const status = mapHunterStatus(body.data.verification?.status);
    const score = body.data.score ?? null;
    const source = body.data.sources?.find((item) => item.uri) ?? null;
    return {
      provider: providerName,
      routeType: providerRouteType,
      status,
      confidence: routeConfidence(score, status),
      value: body.data.email ?? null,
      sourceUrl: source?.uri ?? null,
      sourceName: source?.domain ?? "Hunter",
      costEstimate: body.data.email ? "1 Hunter search credit" : "0 credits if no email was found",
      stoppedWaterfall: status === "verified",
      details: [
        `Hunter verification status: ${body.data.verification?.status ?? "unknown"}.`,
        score !== null ? `Hunter score: ${score}.` : "Hunter did not return a score.",
      ],
    };
  },
};

const providers: RouteProvider[] = [hunterEmailProvider];

function isRouteAcceptable(attempt: ContactRouteAttempt) {
  return attempt.status === "verified" && attempt.confidence !== "Low" && Boolean(attempt.value);
}

export async function verifyContactRouteWaterfall(input: RouteProviderInput): Promise<ContactRouteWaterfallResult> {
  const warnings: string[] = [];
  const attempts: ContactRouteAttempt[] = [];

  if (input.candidate.validationStatus !== "Validated" || input.candidate.employmentStatus !== "Current") {
    warnings.push("Route waterfall requires a current, validated contact before provider lookup.");
    return {
      companyName: input.companyName,
      companyUrl: input.companyUrl,
      contactName: input.candidate.fullName,
      contactTitle: input.candidate.currentTitle,
      attemptedCount: 0,
      acceptedRoute: null,
      attempts,
      warnings,
    };
  }

  for (const provider of providers) {
    if (!provider.isConfigured()) {
      attempts.push({
        provider: provider.name,
        routeType: provider.routeType,
        status: "unknown",
        confidence: "Low",
        value: null,
        sourceUrl: null,
        sourceName: null,
        costEstimate: "0 credits",
        stoppedWaterfall: false,
        details: [`${provider.name} is not configured.`],
      });
      continue;
    }

    const attempt = await provider.findRoute(input);
    attempts.push(attempt);
    if (isRouteAcceptable(attempt)) {
      return {
        companyName: input.companyName,
        companyUrl: input.companyUrl,
        contactName: input.candidate.fullName,
        contactTitle: input.candidate.currentTitle,
        attemptedCount: attempts.filter((item) => item.value || item.costEstimate !== "0 credits").length,
        acceptedRoute: attempt,
        attempts,
        warnings,
      };
    }
  }

  warnings.push("No provider returned a verified route.");
  return {
    companyName: input.companyName,
    companyUrl: input.companyUrl,
    contactName: input.candidate.fullName,
    contactTitle: input.candidate.currentTitle,
    attemptedCount: attempts.filter((item) => item.value || item.costEstimate !== "0 credits").length,
    acceptedRoute: null,
    attempts,
    warnings,
  };
}
