import { supabase } from "../lib/supabase";
import type { NewImportRun, ImportRun } from "../types/ImportRun";

export type ImportCompanyInsert = {
  name: string;
  industry: string;
  state: string;
  employee_count: number;
  is_target_account: boolean;
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
    supabase.from("companies").select("id, name"),
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
    .select("id, name");

  if (error) {
    throw new Error(`Failed to import companies: ${error.message}`);
  }

  return (data as ImportReferenceCompany[]) || [];
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
