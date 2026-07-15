import { supabase } from "../lib/supabase";
import type { CreateResearchJobsResult, ResearchJob, ResearchJobSummary, ResearchStatus } from "../types/ResearchJob";

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

export async function createWaitingResearchJobsForImportRun(importRunId: number): Promise<CreateResearchJobsResult> {
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

  const companiesById = new Map<number, { id: number; name: string }>();

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
