import { supabase } from "../lib/supabase";
import type { CreateResearchJobsResult, ResearchJob, ResearchJobSummary, ResearchStatus } from "../types/ResearchJob";
import type { ResearchCompany } from "../types/research";

type ResearchCompanyRow = {
  company_id: string | number | null;
  companies:
    | {
        id: string | number;
        name: string | null;
      }
    | Array<{
        id: string | number;
        name: string | null;
      }>
    | null;
};

type ImportRunCompanyRow = {
  company_id: string | number | null;
  companies:
    | {
        id: string | number;
        name: string | null;
      }
    | Array<{
        id: string | number;
        name: string | null;
      }>
    | null;
};

type ResearchJobRow = {
  id: string | number;
  company_id: string | number;
  status: ResearchStatus;
  started_at: string | null;
  completed_at: string | null;
  provider: string | null;
  error_message: string | null;
  created_at: string;
  companies:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
};

type ResearchCompanyDetailRow = {
  id: string | number;
  name: string | null;
  industry: string | null;
  state: string | null;
  employee_count: number | null;
  is_target_account: boolean | null;
  website: string | null;
  primary_industry: string | null;
  sub_industry: string | null;
  annual_revenue: number | null;
  ownership_type: string | null;
  ticker: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  location_count: number | null;
};

function toCompany(row: ResearchCompanyRow) {
  const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies;

  if (!company || row.company_id === null) {
    return null;
  }

  return {
    id: Number(row.company_id),
    name: company.name || "Unknown Company",
  };
}

function toLinkedCompany(row: ImportRunCompanyRow) {
  const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies;

  if (!company || row.company_id === null) {
    return null;
  }

  return {
    id: Number(row.company_id),
    name: company.name || "Unknown Company",
  };
}

function toResearchJob(row: ResearchJobRow): ResearchJob {
  const company = Array.isArray(row.companies) ? row.companies[0] ?? null : row.companies;

  return {
    id: Number(row.id),
    companyId: Number(row.company_id),
    companyName: company?.name || "Unknown Company",
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    provider: row.provider,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

function toResearchCompany(row: ResearchCompanyDetailRow): ResearchCompany {
  return {
    id: Number(row.id),
    name: row.name || "Unknown Company",
    industry: row.industry,
    state: row.state,
    employeeCount: row.employee_count,
    isTargetAccount: row.is_target_account,
    website: row.website,
    primaryIndustry: row.primary_industry,
    subIndustry: row.sub_industry,
    annualRevenue: row.annual_revenue,
    ownershipType: row.ownership_type,
    ticker: row.ticker,
    hqCity: row.hq_city,
    hqState: row.hq_state,
    hqCountry: row.hq_country,
    locationCount: row.location_count,
  };
}

export function summarizeResearchJobs(jobs: ResearchJob[]): ResearchJobSummary {
  return jobs.reduce<ResearchJobSummary>(
    (summary, job) => ({
      total: summary.total + 1,
      waiting: summary.waiting + (job.status === "Waiting" ? 1 : 0),
      researching: summary.researching + (job.status === "Researching" ? 1 : 0),
      complete: summary.complete + (job.status === "Complete" ? 1 : 0),
      failed: summary.failed + (job.status === "Failed" ? 1 : 0),
    }),
    { total: 0, waiting: 0, researching: 0, complete: 0, failed: 0 },
  );
}

export async function getResearchJobs(): Promise<ResearchJob[]> {
  const { data, error } = await supabase
    .from("research_jobs")
    .select(
      `
        id,
        company_id,
        status,
        started_at,
        completed_at,
        provider,
        error_message,
        created_at,
        companies:company_id (
          name
        )
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load research jobs: ${error.message}`);
  }

  return (((data as unknown) as ResearchJobRow[]) || []).map(toResearchJob);
}

export async function getResearchJob(researchJobId: number): Promise<ResearchJob> {
  const { data, error } = await supabase
    .from("research_jobs")
    .select(
      `
        id,
        company_id,
        status,
        started_at,
        completed_at,
        provider,
        error_message,
        created_at,
        companies:company_id (
          name
        )
      `,
    )
    .eq("id", researchJobId)
    .single();

  if (error) {
    throw new Error(`Failed to load research job: ${error.message}`);
  }

  return toResearchJob(data as ResearchJobRow);
}

export async function getResearchCompany(companyId: number): Promise<ResearchCompany> {
  const { data, error } = await supabase
    .from("companies")
    .select(`
      id,
      name,
      industry,
      state,
      employee_count,
      is_target_account,
      website,
      primary_industry,
      sub_industry,
      annual_revenue,
      ownership_type,
      ticker,
      hq_city,
      hq_state,
      hq_country,
      location_count
    `)
    .eq("id", companyId)
    .single();

  if (error) {
    throw new Error(`Failed to load research company: ${error.message}`);
  }

  return toResearchCompany(data as ResearchCompanyDetailRow);
}

export async function updateResearchJob(
  researchJobId: number,
  update: {
    status: ResearchStatus;
    startedAt?: string | null;
    completedAt?: string | null;
    provider?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  const payload: Record<string, string | null> = {
    status: update.status,
  };

  if (update.startedAt !== undefined) {
    payload.started_at = update.startedAt;
  }
  if (update.completedAt !== undefined) {
    payload.completed_at = update.completedAt;
  }
  if (update.provider !== undefined) {
    payload.provider = update.provider;
  }
  if (update.errorMessage !== undefined) {
    payload.error_message = update.errorMessage;
  }

  const { error } = await supabase
    .from("research_jobs")
    .update(payload)
    .eq("id", researchJobId);

  if (error) {
    throw new Error(`Failed to update research job: ${error.message}`);
  }
}

export async function createWaitingResearchJobsForImportRun(importRunId: number): Promise<CreateResearchJobsResult> {
  const companiesById = new Map<number, { id: number; name: string }>();

  const { data: linkedRows, error: linkedError } = await supabase
    .from("import_run_companies")
    .select(
      `
        company_id,
        companies:company_id (
          id,
          name
        )
      `,
    )
    .eq("import_run_id", importRunId);

  if (!linkedError) {
    for (const row of (((linkedRows as unknown) as ImportRunCompanyRow[]) || [])) {
      const company = toLinkedCompany(row);

      if (company) {
        companiesById.set(company.id, company);
      }
    }
  }

  const { data: contactRows, error: contactsError } = await supabase
    .from("contacts")
    .select(
      `
        company_id,
        companies:company_id (
          id,
          name
        )
      `,
    )
    .eq("import_run_id", importRunId);

  if (contactsError) {
    throw new Error(`Failed to load imported companies: ${contactsError.message}`);
  }

  for (const row of (((contactRows as unknown) as ResearchCompanyRow[]) || [])) {
    const company = toCompany(row);

    if (company) {
      companiesById.set(company.id, company);
    }
  }

  const companies = Array.from(companiesById.values());

  if (companies.length === 0) {
    return { createdCount: 0, skippedCount: 0 };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("research_jobs")
    .select("company_id")
    .in(
      "company_id",
      companies.map((company) => company.id),
    );

  if (existingError) {
    throw new Error(`Failed to check existing research jobs: ${existingError.message}`);
  }

  const existingCompanyIds = new Set(
    ((existingRows as Array<{ company_id: string | number }> | null) || []).map((row) => Number(row.company_id)),
  );
  const companiesToQueue = companies.filter((company) => !existingCompanyIds.has(company.id));

  if (companiesToQueue.length === 0) {
    return { createdCount: 0, skippedCount: companies.length };
  }

  const { error: insertError } = await supabase.from("research_jobs").insert(
    companiesToQueue.map((company) => ({
      company_id: company.id,
      status: "Waiting",
      provider: null,
      error_message: null,
    })),
  );

  if (insertError) {
    throw new Error(`Failed to create research jobs: ${insertError.message}`);
  }

  return {
    createdCount: companiesToQueue.length,
    skippedCount: companies.length - companiesToQueue.length,
  };
}
