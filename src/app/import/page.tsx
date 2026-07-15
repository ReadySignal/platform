"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import { parseRevenue } from "../../lib/importNormalization";
import {
  createImportCompanies,
  createImportContacts,
  createImportRun,
  getImportReferenceData,
  linkImportRunCompanies,
  updateImportCompanyIntelligence,
  type ImportCompanyInsert,
  type ImportCompanyUpdate,
  type ImportCompanyUpdateResult,
  type ImportContactInsert,
  type ImportReferenceCompany,
  type ImportReferenceContact,
} from "../../services/importService";
import { createWaitingResearchJobsForImportRun } from "../../services/researchService";
import type { ImportRun } from "../../types/ImportRun";

type SupportedField =
  | "first_name"
  | "last_name"
  | "title"
  | "company"
  | "company_website"
  | "company_linkedin_url"
  | "location"
  | "state"
  | "phone"
  | "mobile"
  | "email"
  | "industry"
  | "primary_industry"
  | "sub_industry"
  | "employee_count"
  | "annual_revenue"
  | "ownership_type"
  | "ticker"
  | "hq_city"
  | "hq_state"
  | "hq_country"
  | "location_count"
  | "naics_code"
  | "sic_code"
  | "previous_notes"
  | "last_contacted_at";

type ImportMode = "company" | "contact";

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

type ValidatedRow = {
  index: number;
  raw: Record<string, string>;
  values: Record<SupportedField, string>;
  errors: string[];
  warnings: string[];
  duplicate: boolean;
  duplicateReason: string | null;
};

type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newCompanies: number;
  existingCompanies: number;
  updatedCompanies: number;
  newContacts: number;
  possibleDuplicates: number;
};

const supportedFields: SupportedField[] = [
  "first_name",
  "last_name",
  "title",
  "company",
  "company_website",
  "company_linkedin_url",
  "location",
  "state",
  "phone",
  "mobile",
  "email",
  "industry",
  "primary_industry",
  "sub_industry",
  "employee_count",
  "annual_revenue",
  "ownership_type",
  "ticker",
  "hq_city",
  "hq_state",
  "hq_country",
  "location_count",
  "naics_code",
  "sic_code",
  "previous_notes",
  "last_contacted_at",
];
const requiredFieldsByMode: Record<ImportMode, SupportedField[]> = {
  company: ["company"],
  contact: ["first_name", "last_name", "title", "company"],
};

const fieldLabels: Record<SupportedField, string> = {
  first_name: "First name",
  last_name: "Last name",
  title: "Title",
  company: "Company",
  company_website: "Company website",
  company_linkedin_url: "Company LinkedIn",
  location: "Location",
  state: "State",
  phone: "Phone",
  mobile: "Mobile",
  email: "Email",
  industry: "Industry",
  primary_industry: "Primary industry",
  sub_industry: "Sub-industry",
  employee_count: "Employee count",
  annual_revenue: "Annual revenue",
  ownership_type: "Ownership",
  ticker: "Ticker",
  hq_city: "HQ city",
  hq_state: "HQ state",
  hq_country: "HQ country",
  location_count: "Locations",
  naics_code: "NAICS code",
  sic_code: "SIC code",
  previous_notes: "Previous notes",
  last_contacted_at: "Last contacted at",
};

const fieldAliases: Record<SupportedField, string[]> = {
  first_name: ["first_name", "firstname", "first name", "given name"],
  last_name: ["last_name", "lastname", "last name", "surname", "family name"],
  title: ["title", "job title", "role", "position"],
  company: ["company", "company name", "account", "account name", "organization", "organisation", "company name*"],
  company_website: [
    "company_website",
    "company website",
    "website",
    "domain",
    "url",
    "company url",
    "web address",
    "website url",
    "company website url",
  ],
  company_linkedin_url: [
    "company_linkedin_url",
    "company linkedin",
    "company linkedin url",
    "linkedin url",
    "linkedin company profile url",
    "company social url",
    "linkedin company url",
  ],
  location: ["location", "city", "office", "site"],
  state: ["state", "province", "region"],
  phone: ["phone", "direct phone", "direct_phone", "work phone"],
  mobile: ["mobile", "mobile phone", "cell", "cell phone"],
  email: ["email", "email address", "work email"],
  industry: ["industry", "sector", "industries"],
  primary_industry: ["primary_industry", "primary industry", "company primary industry", "zoominfo industry", "primary industry name"],
  sub_industry: [
    "sub_industry",
    "sub industry",
    "sub-industry",
    "company sub industry",
    "secondary industry",
    "sub industry name",
    "primary sub-industry",
    "primary sub industry",
  ],
  employee_count: ["employee_count", "employee count", "employees", "headcount", "company size", "employee range", "employees range"],
  annual_revenue: [
    "annual_revenue",
    "annual revenue",
    "revenue",
    "company revenue",
    "estimated revenue",
    "revenue range",
    "revenue (in 000s usd)",
  ],
  ownership_type: ["ownership_type", "ownership", "ownership type", "company ownership"],
  ticker: ["ticker", "stock ticker", "ticker symbol", "company ticker"],
  hq_city: ["hq_city", "hq city", "headquarters city", "company hq city", "hq location city", "company city"],
  hq_state: ["hq_state", "hq state", "headquarters state", "company hq state", "hq location state", "company state"],
  hq_country: ["hq_country", "hq country", "headquarters country", "company hq country", "company country"],
  location_count: ["location_count", "location count", "locations", "number of locations", "company locations", "# locations"],
  naics_code: ["naics_code", "naics", "naics code", "primary naics", "naics code 1"],
  sic_code: ["sic_code", "sic", "sic code", "primary sic", "sic code 1"],
  previous_notes: ["previous_notes", "previous notes", "notes", "context"],
  last_contacted_at: ["last_contacted_at", "last contacted", "last contact date"],
};

const companyUpdateFieldLabels: Record<string, string> = {
  industry: "Industry",
  state: "State",
  employee_count: "Employee count",
  website: "Website",
  linkedin_url: "LinkedIn",
  primary_industry: "Primary industry",
  sub_industry: "Sub-industry",
  annual_revenue: "Annual revenue",
  ownership_type: "Ownership",
  ticker: "Ticker",
  hq_city: "HQ city",
  hq_state: "HQ state",
  hq_country: "HQ country",
  location_count: "Locations",
  naics_code: "NAICS code",
  sic_code: "SIC code",
};

const stateAbbreviations: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeKey(value: string) {
  return normalize(value).replace(/[\s-]+/g, "_");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): ParsedCsv {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += char + nextChar;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (current.trim()) {
        lines.push(current);
      }
      current = "";
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    lines.push(current);
  }

  const headers = parseCsvLine(lines[0] || "").map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] || "";
      return acc;
    }, {});
  });

  return { headers, rows };
}

function detectMappings(headers: string[]) {
  return supportedFields.reduce<Record<SupportedField, string>>((acc, field) => {
    const aliases = fieldAliases[field].map(normalizeKey);
    const match = headers.find((header) => aliases.includes(normalizeKey(header)));
    acc[field] = match || "";
    return acc;
  }, {} as Record<SupportedField, string>);
}

function isMalformedEmail(value: string) {
  if (!value.trim()) {
    return false;
  }

  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toEmployeeCount(value: string) {
  if (!value.trim()) {
    return null;
  }

  const cleaned = value.replace(/[,+]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeState(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const lowercase = normalized.toLowerCase();
  if (stateAbbreviations[lowercase]) {
    return stateAbbreviations[lowercase];
  }

  if (/^[a-z]{2}$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized;
}

function normalizeWebsiteUrl(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return normalized.toLowerCase();
  }
}

function normalizeLinkedInUrl(value: string) {
  const normalized = normalizeWebsiteUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    return url.toString();
  } catch {
    return normalized;
  }
}

function toInteger(value: string) {
  if (!value.trim()) {
    return null;
  }

  const cleaned = value.replace(/[,+]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function buildCompanyIntelligenceValues(row: ValidatedRow, mappings: Record<SupportedField, string>): ImportCompanyUpdate {
  const primaryIndustry = normalizeOptionalText(row.values.primary_industry) || normalizeOptionalText(row.values.industry);
  const state = normalizeState(row.values.state) || normalizeState(row.values.hq_state);
  const hqState = normalizeState(row.values.hq_state) || state;
  const employeeCount = toEmployeeCount(row.values.employee_count);

  return {
    industry: primaryIndustry,
    state,
    employee_count: employeeCount ?? null,
    website: normalizeWebsiteUrl(row.values.company_website),
    linkedin_url: normalizeLinkedInUrl(row.values.company_linkedin_url),
    primary_industry: primaryIndustry,
    sub_industry: normalizeOptionalText(row.values.sub_industry),
    annual_revenue: parseRevenue(row.values.annual_revenue, mappings.annual_revenue),
    ownership_type: normalizeOptionalText(row.values.ownership_type),
    ticker: normalizeOptionalText(row.values.ticker)?.toUpperCase() || null,
    hq_city: normalizeOptionalText(row.values.hq_city),
    hq_state: hqState,
    hq_country: normalizeOptionalText(row.values.hq_country),
    location_count: toInteger(row.values.location_count),
    naics_code: normalizeOptionalText(row.values.naics_code),
    sic_code: normalizeOptionalText(row.values.sic_code),
  };
}

function buildNewCompanyValues(row: ValidatedRow, mappings: Record<SupportedField, string>): ImportCompanyInsert {
  const intelligence = buildCompanyIntelligenceValues(row, mappings);

  return {
    name: row.values.company,
    ...intelligence,
    industry: intelligence.industry || "Unknown",
    state: intelligence.state || "Unknown",
    employee_count: intelligence.employee_count ?? 0,
    is_target_account: false,
  };
}

function getMappedValue(row: Record<string, string>, field: SupportedField, mappings: Record<SupportedField, string>) {
  const header = mappings[field];
  return header ? (row[header] || "").trim() : "";
}

function contactDuplicateKey(firstName: string, lastName: string, company: string) {
  return `${normalize(firstName)}|${normalize(lastName)}|${normalize(company)}`;
}

function validateRows(
  rows: Record<string, string>[],
  mappings: Record<SupportedField, string>,
  referenceCompanies: ImportReferenceCompany[],
  referenceContacts: ImportReferenceContact[],
  importMode: ImportMode,
) {
  const existingCompanyNames = new Set(referenceCompanies.map((company) => normalize(company.name)));
  const seenCompanyNames = new Set<string>();
  const existingEmails = new Set(
    referenceContacts.map((contact) => normalize(contact.email || "")).filter(Boolean),
  );
  const existingNameCompanyKeys = new Set(
    referenceContacts.map((contact) =>
      contactDuplicateKey(contact.first_name || "", contact.last_name || "", contact.companies?.name || ""),
    ),
  );
  const seenEmails = new Set<string>();
  const seenNameCompanyKeys = new Set<string>();

  return rows.map<ValidatedRow>((row, index) => {
    const values = supportedFields.reduce<Record<SupportedField, string>>((acc, field) => {
      acc[field] = getMappedValue(row, field, mappings);
      return acc;
    }, {} as Record<SupportedField, string>);
    const errors: string[] = [];
    const warnings: string[] = [];
    const requiredFields = requiredFieldsByMode[importMode];

    for (const field of requiredFields) {
      if (!mappings[field]) {
        errors.push(`${fieldLabels[field]} is unmapped.`);
      } else if (!values[field]) {
        errors.push(`${fieldLabels[field]} is missing.`);
      }
    }

    if (isMalformedEmail(values.email)) {
      errors.push("Email is malformed.");
    }

    if (values.employee_count && toEmployeeCount(values.employee_count) === null) {
      errors.push("Employee count is malformed.");
    }

    if (values.annual_revenue && parseRevenue(values.annual_revenue, mappings.annual_revenue) === null) {
      errors.push("Annual revenue is malformed.");
    }

    if (values.location_count && toInteger(values.location_count) === null) {
      errors.push("Location count is malformed.");
    }

    const companyKey = normalize(values.company);
    const emailKey = normalize(values.email);
    const nameCompanyKey = contactDuplicateKey(values.first_name, values.last_name, values.company);
    const duplicateByCompany = Boolean(companyKey && seenCompanyNames.has(companyKey));
    const duplicateByEmail =
      importMode === "contact" && Boolean(emailKey && (existingEmails.has(emailKey) || seenEmails.has(emailKey)));
    const duplicateByName =
      importMode === "contact" && (existingNameCompanyKeys.has(nameCompanyKey) || seenNameCompanyKeys.has(nameCompanyKey));
    const duplicate = duplicateByEmail || duplicateByName;
    const duplicateReason = duplicateByEmail
      ? "Contact email already exists or repeats in this file."
      : duplicateByName
        ? "First name, last name, and company already exist or repeat in this file."
        : null;

    if (duplicateReason) {
      warnings.push(duplicateReason);
    }

    if (importMode === "company" && duplicateByCompany) {
      warnings.push("Company repeats in this file; only one company record will be imported.");
    }

    if (existingCompanyNames.has(normalize(values.company))) {
      warnings.push("Company already exists.");
    }

    if (emailKey && importMode === "contact") {
      seenEmails.add(emailKey);
    }
    if (importMode === "contact") {
      seenNameCompanyKeys.add(nameCompanyKey);
    }
    if (companyKey) {
      seenCompanyNames.add(companyKey);
    }

    return {
      index,
      raw: row,
      values,
      errors,
      warnings,
      duplicate,
      duplicateReason,
    };
  });
}

function buildSummary(
  validatedRows: ValidatedRow[],
  referenceCompanies: ImportReferenceCompany[],
  includeDuplicates: boolean,
  importMode: ImportMode,
  updatedCompanies = 0,
): ImportSummary {
  const validRows = validatedRows.filter((row) => row.errors.length === 0);
  const importableRows = importMode === "contact" ? validRows.filter((row) => includeDuplicates || !row.duplicate) : validRows;
  const existingCompanyNames = new Set(referenceCompanies.map((company) => normalize(company.name)));
  const newCompanyNames = new Set(
    importableRows
      .map((row) => row.values.company)
      .filter((company) => company && !existingCompanyNames.has(normalize(company)))
      .map(normalize),
  );
  const existingCompanies = new Set(
    importableRows
      .map((row) => row.values.company)
      .filter((company) => existingCompanyNames.has(normalize(company)))
      .map(normalize),
  );

  return {
    totalRows: validatedRows.length,
    validRows: validRows.length,
    invalidRows: validatedRows.length - validRows.length,
    newCompanies: newCompanyNames.size,
    existingCompanies: existingCompanies.size,
    updatedCompanies,
    newContacts: importMode === "contact" ? importableRows.length : 0,
    possibleDuplicates: importMode === "contact" ? validRows.filter((row) => row.duplicate).length : 0,
  };
}

function getUniqueCompanyRows(rows: ValidatedRow[]) {
  return Array.from(
    rows.reduce<Map<string, ValidatedRow>>((acc, row) => {
      const companyName = normalize(row.values.company);
      if (companyName && !acc.has(companyName)) {
        acc.set(companyName, row);
      }
      return acc;
    }, new Map()).values(),
  );
}

export default function ImportPage() {
  const [importMode, setImportMode] = useState<ImportMode>("company");
  const [fileName, setFileName] = useState("");
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [mappings, setMappings] = useState<Record<SupportedField, string>>(
    supportedFields.reduce<Record<SupportedField, string>>((acc, field) => {
      acc[field] = "";
      return acc;
    }, {} as Record<SupportedField, string>),
  );
  const [referenceCompanies, setReferenceCompanies] = useState<ImportReferenceCompany[]>([]);
  const [referenceContacts, setReferenceContacts] = useState<ImportReferenceContact[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingResearchJobs, setIsCreatingResearchJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);
  const [successRun, setSuccessRun] = useState<ImportRun | null>(null);
  const [companyUpdateResults, setCompanyUpdateResults] = useState<ImportCompanyUpdateResult[]>([]);

  const validatedRows = useMemo(
    () =>
      parsedCsv
        ? validateRows(parsedCsv.rows, mappings, referenceCompanies, referenceContacts, importMode)
        : [],
    [importMode, mappings, parsedCsv, referenceCompanies, referenceContacts],
  );
  const summary = useMemo(
    () => buildSummary(validatedRows, referenceCompanies, includeDuplicates, importMode, companyUpdateResults.length),
    [companyUpdateResults.length, importMode, includeDuplicates, referenceCompanies, validatedRows],
  );
  const requiredFields = requiredFieldsByMode[importMode];
  const unmappedRequiredFields = requiredFields.filter((field) => !mappings[field]);

  async function loadReferences() {
    setIsLoadingReferences(true);
    const referenceData = await getImportReferenceData();
    setReferenceCompanies(referenceData.companies);
    setReferenceContacts(referenceData.contacts);
    setIsLoadingReferences(false);
  }

  async function readFile(file: File) {
    setError(null);
    setSuccessRun(null);
    setCompanyUpdateResults([]);
    setResearchMessage(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.headers.length === 0) {
        throw new Error("No CSV headers found.");
      }

      setParsedCsv(parsed);
      setMappings(detectMappings(parsed.headers));
      await loadReferences();
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Failed to read CSV file.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      readFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      readFile(file);
    }
  }

  async function runImport() {
    if (!parsedCsv) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const validRows = validatedRows.filter((row) => row.errors.length === 0);
      const importableRows = importMode === "contact" ? validRows.filter((row) => includeDuplicates || !row.duplicate) : validRows;
      const companyByName = new Map(referenceCompanies.map((company) => [normalize(company.name), company]));
      const newCompanyValues = Array.from(
        getUniqueCompanyRows(importableRows).reduce<Map<string, ValidatedRow>>((acc, row) => {
          const companyName = normalize(row.values.company);
          if (!companyByName.has(companyName) && !acc.has(companyName)) {
            acc.set(companyName, row);
          }
          return acc;
        }, new Map()).values(),
      );
      const companiesToCreate: ImportCompanyInsert[] = newCompanyValues.map((row) => buildNewCompanyValues(row, mappings));
      const createdCompanies = await createImportCompanies(companiesToCreate);

      for (const company of createdCompanies) {
        companyByName.set(normalize(company.name), company);
      }

      const companyUpdateRows = Array.from(
        getUniqueCompanyRows(importableRows).reduce<Map<string, ValidatedRow>>((acc, row) => {
          const companyName = normalize(row.values.company);
          if (companyByName.has(companyName) && !newCompanyValues.includes(row) && !acc.has(companyName)) {
            acc.set(companyName, row);
          }
          return acc;
        }, new Map()).values(),
      );
      const updateResults = (
        await Promise.all(
          companyUpdateRows.map((row) => {
            const company = companyByName.get(normalize(row.values.company));
            return company ? updateImportCompanyIntelligence(company, buildCompanyIntelligenceValues(row, mappings)) : null;
          }),
        )
      ).filter((result): result is ImportCompanyUpdateResult => Boolean(result));

      const importRun = await createImportRun({
        fileName: fileName || (importMode === "company" ? "companies.csv" : "contacts.csv"),
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
        importedCompanies: createdCompanies.length,
        importedContacts: importMode === "contact" ? importableRows.length : 0,
      });
      const importedCompanyIds = getUniqueCompanyRows(importableRows)
        .map((row) => companyByName.get(normalize(row.values.company))?.id)
        .filter((companyId): companyId is string => Boolean(companyId));
      await linkImportRunCompanies(importRun.id, importedCompanyIds);

      if (importMode === "contact") {
        const contactsToCreate: ImportContactInsert[] = importableRows.flatMap((row) => {
          const company = companyByName.get(normalize(row.values.company));
          if (!company) {
            return [];
          }

          return [
            {
              company_id: company.id,
              import_run_id: importRun.id,
              first_name: row.values.first_name,
              last_name: row.values.last_name,
              title: row.values.title,
              location: row.values.location || null,
              phone: row.values.phone || null,
              mobile: row.values.mobile || null,
              email: row.values.email || null,
              relevant_context: row.values.previous_notes || null,
              why_today: row.values.last_contacted_at ? `Last contacted ${row.values.last_contacted_at}` : null,
              verified_contact: Boolean(row.values.email || row.values.phone || row.values.mobile),
              no_previous_outreach: !row.values.last_contacted_at,
            },
          ];
        });
        await createImportContacts(contactsToCreate);
      }

      setSuccessRun(importRun);
      setCompanyUpdateResults(updateResults);
      setResearchMessage(null);
      await loadReferences();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  async function queueResearch() {
    if (!successRun) {
      return;
    }

    setIsCreatingResearchJobs(true);
    setError(null);
    setResearchMessage(null);

    try {
      const result = await createWaitingResearchJobsForImportRun(successRun.id);
      setResearchMessage(
        `Created ${result.createdCount} waiting research jobs. Skipped ${result.skippedCount} companies that already had research jobs.`,
      );
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : "Failed to create research jobs.");
    } finally {
      setIsCreatingResearchJobs(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />
        <PageHeader
          eyebrow="CSV Import"
          title={importMode === "company" ? "Import Companies" : "Import Contacts"}
          supportingText={
            importMode === "company"
              ? "Upload and validate company intelligence before adding it to ReadySignal."
              : "Upload and validate a contact list before adding it to ReadySignal."
          }
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Upload</p>
            <p className="text-sm leading-6 text-slate-600">Choose a CSV, then confirm mappings and validation before import.</p>
          </div>

          <div className="mt-4 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {[
              ["company", "Company Import"],
              ["contact", "Contact Import"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setImportMode(mode as ImportMode);
                  setCompanyUpdateResults([]);
                  setSuccessRun(null);
                  setResearchMessage(null);
                }}
                className={
                  importMode === mode
                    ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:bg-slate-100"
          >
            <span className="text-sm font-semibold text-slate-800">
              {fileName ? fileName : "Drop a CSV here or choose a file"}
            </span>
            <span className="mt-1 text-sm text-slate-500">CSV parsing happens locally in your browser.</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
          </label>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
        </section>

        {parsedCsv ? (
          <>
            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Column Mapping</p>
                <p className="text-sm text-slate-600">Confirm required fields before import.</p>
              </div>

              {unmappedRequiredFields.length > 0 ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Required unmapped: {unmappedRequiredFields.map((field) => fieldLabels[field]).join(", ")}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {supportedFields.map((field) => (
                  <label key={field} className="text-sm">
                    <span className="font-semibold text-slate-700">
                      {fieldLabels[field]} {requiredFields.includes(field) ? "*" : ""}
                    </span>
                    <select
                      value={mappings[field]}
                      onChange={(event) => setMappings((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <option value="">Not mapped</option>
                      {parsedCsv.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Import Summary</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {isLoadingReferences ? "Checking existing companies and contacts..." : "Review before writing anything."}
                  </p>
                </div>
                {importMode === "contact" ? (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeDuplicates}
                      onChange={(event) => setIncludeDuplicates(event.target.checked)}
                    />
                    Include possible duplicates
                  </label>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Total rows", summary.totalRows],
                  ["Valid rows", summary.validRows],
                  ["Invalid rows", summary.invalidRows],
                  ["New companies", summary.newCompanies],
                  ["Existing companies", summary.existingCompanies],
                  ["Updated companies", summary.updatedCompanies],
                  ...(importMode === "contact"
                    ? [
                        ["New contacts", summary.newContacts],
                        ["Possible duplicates", summary.possibleDuplicates],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-2xl font-semibold text-slate-950">{value}</p>
                    <p className="text-sm text-slate-500">{label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={runImport}
                disabled={isImporting || unmappedRequiredFields.length > 0 || summary.validRows === 0}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isImporting ? "Importing..." : importMode === "company" ? "Import valid companies" : "Import valid records"}
              </button>

              {successRun ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">Import complete.</p>
                  <p className="mt-1">
                    Imported {successRun.importedCompanies} new companies
                    {companyUpdateResults.length > 0 ? `, updated ${companyUpdateResults.length} existing companies` : ""}
                    {importMode === "contact" ? `, and imported ${successRun.importedContacts} contacts.` : "."}
                  </p>
                  {companyUpdateResults.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="font-semibold">Updated company intelligence:</p>
                      {companyUpdateResults.slice(0, 5).map((result) => (
                        <p key={result.companyId}>
                          {result.companyName}: {result.updatedFields.map((field) => companyUpdateFieldLabels[field] || field).join(", ")}
                        </p>
                      ))}
                      {companyUpdateResults.length > 5 ? (
                        <p>{companyUpdateResults.length - 5} more companies updated.</p>
                      ) : null}
                    </div>
                  ) : null}
                  {researchMessage ? <p className="mt-2">{researchMessage}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={queueResearch}
                      disabled={isCreatingResearchJobs}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {isCreatingResearchJobs ? "Creating jobs..." : "Research Imported Companies"}
                    </button>
                    <Link
                      href="/analyze"
                      className={
                        importMode === "contact"
                          ? "inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                          : "hidden"
                      }
                    >
                      Analyze Imported Contacts
                    </Link>
                    <Link
                      href="/research"
                      className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      View Research Queue
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      Return to Today&apos;s Opportunities
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Preview</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-2">Row</th>
                      {importMode === "contact" ? <th className="px-3 py-2">Name</th> : null}
                      <th className="px-3 py-2">Company</th>
                      {importMode === "contact" ? <th className="px-3 py-2">Email</th> : null}
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedRows.slice(0, 20).map((row) => (
                      <tr key={row.index}>
                        <td className="px-3 py-2 text-slate-500">{row.index + 1}</td>
                        {importMode === "contact" ? (
                          <td className="px-3 py-2 text-slate-900">
                            {[row.values.first_name, row.values.last_name].filter(Boolean).join(" ") || "Missing"}
                          </td>
                        ) : null}
                        <td className="px-3 py-2 text-slate-700">{row.values.company || "Missing"}</td>
                        {importMode === "contact" ? (
                          <td className="px-3 py-2 text-slate-700">{row.values.email || "None"}</td>
                        ) : null}
                        <td className="px-3 py-2">
                          <span
                            className={
                              row.errors.length > 0
                                ? "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
                                : row.duplicate
                                  ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                                  : "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                            }
                          >
                            {row.errors.length > 0 ? "Invalid" : row.duplicate ? "Duplicate" : "Valid"}
                          </span>
                        </td>
                        <td className="max-w-md px-3 py-2 text-slate-600">
                          {[...row.errors, ...row.warnings].join(" ") || "Ready to import"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
