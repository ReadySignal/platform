import type { BusinessProfile } from "../types/BusinessProfile";

type CompanyMatchInput = {
  industry?: string | null;
  subIndustry?: string | null;
  employeeCount?: number | null;
  annualRevenue?: number | null;
  state?: string | null;
  hqState?: string | null;
  ownershipType?: string | null;
  companyType?: string | null;
};

type ContactMatchInput = {
  title?: string | null;
  department?: string | null;
  managementLevel?: string | null;
};

type SignalMatchInput = {
  signalType?: string | null;
  headline?: string | null;
  occurredAt?: string | null;
};

export type ProfileMatchResult = {
  matches: boolean;
  contributingRules: string[];
  missingInformation: string[];
  uncertainty: "Low" | "Medium" | "High";
};

export type SignalPriorityMatchResult = ProfileMatchResult & {
  priority: "ignored" | "high" | "medium" | "low" | "unknown";
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function listIncludes(list: string[], value: string | null | undefined) {
  const normalized = normalize(value);
  return Boolean(normalized && list.some((item) => normalized.includes(normalize(item)) || normalize(item).includes(normalized)));
}

function inRange(value: number | null | undefined, min: number | null, max: number | null) {
  if (typeof value !== "number") {
    return true;
  }

  if (typeof min === "number" && value < min) {
    return false;
  }

  if (typeof max === "number" && value > max) {
    return false;
  }

  return true;
}

function uncertaintyFor(missingInformation: string[], contributingRules: string[]) {
  if (missingInformation.length >= 3 || contributingRules.length === 0) {
    return "High";
  }

  if (missingInformation.length > 0) {
    return "Medium";
  }

  return "Low";
}

export function companyMatchesProfile(profile: BusinessProfile, company: CompanyMatchInput): ProfileMatchResult {
  const contributingRules: string[] = [];
  const missingInformation: string[] = [];

  if (!company.industry) missingInformation.push("company industry");
  if (!company.state && !company.hqState) missingInformation.push("company geography");
  if (company.employeeCount == null) missingInformation.push("employee count");
  if (company.annualRevenue == null) missingInformation.push("annual revenue");

  if (listIncludes(profile.excludedIndustries, company.industry)) {
    return {
      matches: false,
      contributingRules: ["excluded industry"],
      missingInformation,
      uncertainty: uncertaintyFor(missingInformation, contributingRules),
    };
  }

  if (listIncludes(profile.excludedCompanyTypes, company.companyType)) {
    return {
      matches: false,
      contributingRules: ["excluded company type"],
      missingInformation,
      uncertainty: uncertaintyFor(missingInformation, contributingRules),
    };
  }

  const industryMatches =
    profile.targetIndustries.length === 0 ||
    listIncludes(profile.targetIndustries, company.industry) ||
    listIncludes(profile.targetSubIndustries, company.subIndustry);
  const geographyMatches =
    profile.targetGeographies.length === 0 ||
    listIncludes(profile.targetGeographies, company.state) ||
    listIncludes(profile.targetGeographies, company.hqState);
  const ownershipMatches =
    profile.ownershipPreferences.length === 0 || listIncludes(profile.ownershipPreferences, company.ownershipType);
  const sizeMatches = inRange(company.employeeCount, profile.employeeMin, profile.employeeMax);
  const revenueMatches = inRange(company.annualRevenue, profile.revenueMin, profile.revenueMax);

  if (industryMatches) contributingRules.push("target industry");
  if (geographyMatches) contributingRules.push("target geography");
  if (ownershipMatches && profile.ownershipPreferences.length > 0) contributingRules.push("ownership preference");
  if (sizeMatches && (profile.employeeMin != null || profile.employeeMax != null)) contributingRules.push("company size range");
  if (revenueMatches && (profile.revenueMin != null || profile.revenueMax != null)) contributingRules.push("revenue range");

  return {
    matches: industryMatches && geographyMatches && ownershipMatches && sizeMatches && revenueMatches,
    contributingRules,
    missingInformation,
    uncertainty: uncertaintyFor(missingInformation, contributingRules),
  };
}

export function contactMatchesPersona(profile: BusinessProfile, contact: ContactMatchInput): ProfileMatchResult {
  const contributingRules: string[] = [];
  const missingInformation: string[] = [];

  if (!contact.title) missingInformation.push("contact title");
  if (!contact.department) missingInformation.push("contact department or function");
  if (!contact.managementLevel) missingInformation.push("management level");

  if (listIncludes(profile.excludedTitles, contact.title)) {
    return {
      matches: false,
      contributingRules: ["excluded title or department"],
      missingInformation,
      uncertainty: uncertaintyFor(missingInformation, contributingRules),
    };
  }

  const titleMatches =
    profile.priorityTitles.length === 0 ||
    listIncludes(profile.priorityTitles, contact.title) ||
    listIncludes(profile.secondaryTitles, contact.title);
  const departmentMatches =
    profile.relevantDepartments.length === 0 || listIncludes(profile.relevantDepartments, contact.department);
  const levelMatches = profile.managementLevels.length === 0 || listIncludes(profile.managementLevels, contact.managementLevel);

  if (titleMatches && (profile.priorityTitles.length > 0 || profile.secondaryTitles.length > 0)) contributingRules.push("declared title fit");
  if (departmentMatches) contributingRules.push("declared role or function fit");
  if (levelMatches && profile.managementLevels.length > 0) contributingRules.push("management level fit");

  return {
    matches: titleMatches && departmentMatches && levelMatches,
    contributingRules,
    missingInformation,
    uncertainty: uncertaintyFor(missingInformation, contributingRules),
  };
}

export function signalMatchesProfile(profile: BusinessProfile, signal: SignalMatchInput): SignalPriorityMatchResult {
  const text = `${signal.signalType || ""} ${signal.headline || ""}`;
  const missingInformation = signal.signalType || signal.headline ? [] : ["signal type or headline"];
  let priority: SignalPriorityMatchResult["priority"] = "unknown";
  const contributingRules: string[] = [];

  if (listIncludes(profile.ignoredSignals, text)) {
    priority = "ignored";
    contributingRules.push("ignored signal");
  } else if (listIncludes(profile.highPrioritySignals, text)) {
    priority = "high";
    contributingRules.push("high-priority signal");
  } else if (listIncludes(profile.mediumPrioritySignals, text)) {
    priority = "medium";
    contributingRules.push("medium-priority signal");
  } else if (listIncludes(profile.lowPrioritySignals, text)) {
    priority = "low";
    contributingRules.push("low-priority signal");
  }

  return {
    matches: priority !== "ignored" && priority !== "unknown",
    priority,
    contributingRules,
    missingInformation,
    uncertainty: uncertaintyFor(missingInformation, contributingRules),
  };
}
