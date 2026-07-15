import { supabase } from "../lib/supabase";
import type { ImportedContact } from "../types/ImportAnalysis";
import type { ImportRun } from "../types/ImportRun";

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

type ImportedContactRow = {
  id: string | number;
  company_id: string | number | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  location: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  relevant_context: string | null;
  why_today: string | null;
  verified_contact: boolean | null;
  no_previous_outreach: boolean | null;
  companies:
    | {
        id: string | number;
        name: string | null;
        industry: string | null;
        state: string | null;
        employee_count: number | null;
        is_target_account: boolean | null;
      }
    | Array<{
        id: string | number;
        name: string | null;
        industry: string | null;
        state: string | null;
        employee_count: number | null;
        is_target_account: boolean | null;
      }>
    | null;
};

export type AnalysisSignalInsert = {
  companyId: string | number;
  contactId: string | number;
  headline: string;
  details: string;
  scorePoints: number;
};

export type AnalysisSignalImportResult = {
  insertedCount: number;
  skippedDuplicateCount: number;
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

function toImportedContact(row: ImportedContactRow): ImportedContact {
  const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies;

  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    title: row.title || "",
    location: row.location,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    relevantContext: row.relevant_context,
    whyToday: row.why_today,
    verifiedContact: row.verified_contact,
    noPreviousOutreach: row.no_previous_outreach,
    company: company
      ? {
          id: company.id,
          name: company.name || "Unknown Company",
          industry: company.industry,
          state: company.state,
          employeeCount: company.employee_count,
          isTargetAccount: company.is_target_account,
        }
      : null,
  };
}

export async function getCompletedImportRuns(): Promise<ImportRun[]> {
  const { data, error } = await supabase
    .from("import_runs")
    .select("id, file_name, total_rows, valid_rows, invalid_rows, imported_companies, imported_contacts, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load import runs: ${error.message}`);
  }

  return ((data as ImportRunRow[]) || []).map(toImportRun);
}

export async function getContactsForImportRun(importRunId: number): Promise<ImportedContact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select(
      `
        id,
        company_id,
        first_name,
        last_name,
        title,
        location,
        phone,
        mobile,
        email,
        relevant_context,
        why_today,
        verified_contact,
        no_previous_outreach,
        companies:company_id (
          id,
          name,
          industry,
          state,
          employee_count,
          is_target_account
        )
      `,
    )
    .eq("import_run_id", importRunId)
    .order("last_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load imported contacts: ${error.message}`);
  }

  return (((data as unknown) as ImportedContactRow[]) || []).map(toImportedContact);
}

export async function createImportAnalysisSignals(
  signals: AnalysisSignalInsert[],
): Promise<AnalysisSignalImportResult> {
  if (signals.length === 0) {
    return { insertedCount: 0, skippedDuplicateCount: 0 };
  }

  const contactIds = signals.map((signal) => signal.contactId);
  const { data: existingSignals, error: existingError } = await supabase
    .from("signals")
    .select("id, contact_id")
    .eq("signal_type", "import-analysis")
    .in("contact_id", contactIds);

  if (existingError) {
    throw new Error(`Failed to check existing analysis signals: ${existingError.message}`);
  }

  const existingContactIds = new Set(
    (((existingSignals as Array<{ contact_id: string | number }>) || []).map((signal) => String(signal.contact_id))),
  );
  const signalsToCreate = signals.filter((signal) => !existingContactIds.has(String(signal.contactId)));

  if (signalsToCreate.length === 0) {
    return { insertedCount: 0, skippedDuplicateCount: signals.length };
  }

  const { error } = await supabase.from("signals").insert(
    signalsToCreate.map((signal) => ({
      company_id: signal.companyId,
      contact_id: signal.contactId,
      signal_type: "import-analysis",
      headline: signal.headline,
      details: signal.details,
      source_url: null,
      occurred_at: new Date().toISOString(),
      score_points: signal.scorePoints,
      is_active: true,
    })),
  );

  if (error) {
    throw new Error(`Failed to add contacts to today's opportunities: ${error.message}`);
  }

  return {
    insertedCount: signalsToCreate.length,
    skippedDuplicateCount: signals.length - signalsToCreate.length,
  };
}
