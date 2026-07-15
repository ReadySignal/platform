import { supabase } from "../lib/supabase";
import type { NewImportRun, ImportRun } from "../types/ImportRun";
import type { ImportRunCompany } from "../types/ImportRunCompany";

export type ImportCompanyInsert = {
  name: string;
  industry: string;
  state: string;
  employee_count: number;
  is_target_account: boolean;
  website?: string | null;
  linkedin_url?: string | null;
  primary_industry?: string | null;
  sub_industry?: string | null;
  annual_revenue?: number | null;
  ownership_type?: string | null;
  ticker?: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  hq_country?: string | null;
  location_count?: number | null;
  naics_code?: string | null;
  sic_code?: string | null;
};

export type ImportCompanyUpdate = {
  industry?: string | null;
  state?: string | null;
  employee_count?: number | null;
  website?: string | null;
  linkedin_url?: string | null;
  primary_industry?: string | null;
  sub_industry?: string | null;
  annual_revenue?: number | null;
  ownership_type?: string | null;
  ticker?: string | null;
  hq_city?: string | null;
  hq_state?: string | null;
  hq_country?: string | null;
  location_count?: number | null;
  naics_code?: string | null;
  sic_code?: string | null;
};

export type ImportCompanyUpdateResult = {
  companyId: string;
  companyName: string;
  updatedFields: string[];
};

export type ImportContactInsert = {
  company_id: string | number;
  import_run_id: number;
  first_name: string;
  last_name: string;
  title: string;
  location: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  relevant_context: string | null;
  why_today: string | null;
  verified_contact: boolean;
  no_previous_outreach: boolean;
};

export type ImportReferenceCompany = {
  id: string;
  name: string;
  industry: string | null;
  state: string | null;
  employee_count: number | null;
  website: string | null;
  linkedin_url: string | null;
  primary_industry: string | null;
  sub_industry: string | null;
  annual_revenue: number | null;
  ownership_type: string | null;
  ticker: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  location_count: number | null;
  naics_code: string | null;
  sic_code: string | null;
};

export type ImportReferenceContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  companies: { name: string | null } | null;
};

type ImportReferenceContactRow = Omit<ImportReferenceContact, "companies"> & {
  companies: { name: string | null } | Array<{ name: string | null }> | null;
};

type ImportRunRow = {
  id: number;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_companies: number;
  imported_contacts: number;
  created_at: string;
};

function toImportRun(row: ImportRunRow): ImportRun {
  return {
    id: row.id,
    fileName: row.file_name,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    invalidRows: row.invalid_rows,
    importedCompanies: row.imported_companies,
    importedContacts: row.imported_contacts,
    createdAt: row.created_at,
  };
}

export async function getImportReferenceData() {
  const [companiesResult, contactsResult] = await Promise.all([
    supabase.from("companies").select(`
      id,
      name,
      industry,
      state,
      employee_count,
      website,
      linkedin_url,
      primary_industry,
      sub_industry,
      annual_revenue,
      ownership_type,
      ticker,
      hq_city,
      hq_state,
      hq_country,
      location_count,
      naics_code,
      sic_code
    `),
    supabase.from("contacts").select("id, first_name, last_name, email, companies:company_id ( name )"),
  ]);

  if (companiesResult.error) {
    throw new Error(`Failed to fetch companies: ${companiesResult.error.message}`);
  }

  if (contactsResult.error) {
    throw new Error(`Failed to fetch contacts: ${contactsResult.error.message}`);
  }

  return {
    companies: ((companiesResult.data as ImportReferenceCompany[]) || []),
    contacts: (((contactsResult.data as unknown) as ImportReferenceContactRow[]) || []).map((contact) => ({
      ...contact,
      companies: Array.isArray(contact.companies) ? contact.companies[0] ?? null : contact.companies,
    })),
  };
}

export async function createImportCompanies(companies: ImportCompanyInsert[]) {
  if (companies.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("companies")
    .insert(companies)
    .select(`
      id,
      name,
      industry,
      state,
      employee_count,
      website,
      linkedin_url,
      primary_industry,
      sub_industry,
      annual_revenue,
      ownership_type,
      ticker,
      hq_city,
      hq_state,
      hq_country,
      location_count,
      naics_code,
      sic_code
    `);

  if (error) {
    throw new Error(`Failed to import companies: ${error.message}`);
  }

  return (data as ImportReferenceCompany[]) || [];
}

export async function updateImportCompanyIntelligence(
  company: ImportReferenceCompany,
  importedValues: ImportCompanyUpdate,
): Promise<ImportCompanyUpdateResult | null> {
  const update: Partial<ImportCompanyUpdate> = {};
  const updatedFields: string[] = [];
  const comparableFields: Array<keyof ImportCompanyUpdate> = [
    "industry",
    "state",
    "employee_count",
    "website",
    "linkedin_url",
    "primary_industry",
    "sub_industry",
    "annual_revenue",
    "ownership_type",
    "ticker",
    "hq_city",
    "hq_state",
    "hq_country",
    "location_count",
    "naics_code",
    "sic_code",
  ];

  for (const field of comparableFields) {
    const importedValue = importedValues[field];
    if (importedValue === null || importedValue === undefined || importedValue === "") {
      continue;
    }

    const currentValue = company[field];
    if (String(currentValue ?? "") === String(importedValue)) {
      continue;
    }

    update[field] = importedValue as never;
    updatedFields.push(field);
  }

  if (updatedFields.length === 0) {
    return null;
  }

  const { error } = await supabase
    .from("companies")
    .update(update)
    .eq("id", company.id);

  if (error) {
    throw new Error(`Failed to update company intelligence: ${error.message}`);
  }

  return {
    companyId: company.id,
    companyName: company.name,
    updatedFields,
  };
}

export async function createImportContacts(contacts: ImportContactInsert[]) {
  if (contacts.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(contacts)
    .select("id");

  if (error) {
    throw new Error(`Failed to import contacts: ${error.message}`);
  }

  return (data as Array<{ id: string | number }>) || [];
}

export async function createImportRun(run: NewImportRun): Promise<ImportRun> {
  const { data, error } = await supabase
    .from("import_runs")
    .insert({
      file_name: run.fileName,
      total_rows: run.totalRows,
      valid_rows: run.validRows,
      invalid_rows: run.invalidRows,
      imported_companies: run.importedCompanies,
      imported_contacts: run.importedContacts,
    })
    .select("id, file_name, total_rows, valid_rows, invalid_rows, imported_companies, imported_contacts, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to record import run: ${error.message}`);
  }

  return toImportRun(data as ImportRunRow);
}

export async function linkImportRunCompanies(
  importRunId: number,
  companyIds: Array<string | number>,
): Promise<ImportRunCompany[]> {
  const uniqueCompanyIds = Array.from(new Set(companyIds.map((companyId) => Number(companyId)))).filter(Number.isFinite);

  if (uniqueCompanyIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("import_run_companies")
    .insert(
      uniqueCompanyIds.map((companyId) => ({
        import_run_id: importRunId,
        company_id: companyId,
      })),
    )
    .select("import_run_id, company_id, created_at");

  if (error) {
    throw new Error(`Failed to link companies to import run: ${error.message}`);
  }

  return ((data as Array<{ import_run_id: number; company_id: number; created_at: string }> | null) || []).map(
    (row) => ({
      importRunId: row.import_run_id,
      companyId: row.company_id,
      createdAt: row.created_at,
    }),
  );
}
