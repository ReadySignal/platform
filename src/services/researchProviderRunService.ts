import { supabase } from "../lib/supabase";
import type {
  NewResearchProviderRun,
  ResearchProviderRun,
  ResearchProviderRunUpdate,
} from "../types/ResearchProviderRun";

type ResearchProviderRunRow = {
  id: string | number;
  research_job_id: string | number;
  provider_id: string;
  provider_name: string;
  status: ResearchProviderRun["status"];
  evidence_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

const providerRunSelect = `
  id,
  research_job_id,
  provider_id,
  provider_name,
  status,
  evidence_count,
  started_at,
  completed_at,
  error_message,
  created_at
`;

function toProviderRun(row: ResearchProviderRunRow): ResearchProviderRun {
  return {
    id: Number(row.id),
    researchJobId: Number(row.research_job_id),
    providerId: row.provider_id,
    providerName: row.provider_name,
    status: row.status,
    evidenceCount: row.evidence_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function createProviderRun(run: NewResearchProviderRun): Promise<ResearchProviderRun> {
  const { data, error } = await supabase
    .from("research_provider_runs")
    .insert({
      research_job_id: run.researchJobId,
      provider_id: run.providerId,
      provider_name: run.providerName,
      status: run.status,
      evidence_count: run.evidenceCount ?? 0,
      started_at: run.startedAt ?? null,
      completed_at: run.completedAt ?? null,
      error_message: run.errorMessage ?? null,
    })
    .select(providerRunSelect)
    .single();

  if (error) {
    throw new Error(`Failed to create provider run: ${error.message}`);
  }

  return toProviderRun(data as ResearchProviderRunRow);
}

export async function updateProviderRun(
  providerRunId: number,
  update: ResearchProviderRunUpdate,
): Promise<ResearchProviderRun> {
  const payload: Record<string, string | number | null> = {};

  if (update.status !== undefined) {
    payload.status = update.status;
  }
  if (update.evidenceCount !== undefined) {
    payload.evidence_count = update.evidenceCount;
  }
  if (update.startedAt !== undefined) {
    payload.started_at = update.startedAt;
  }
  if (update.completedAt !== undefined) {
    payload.completed_at = update.completedAt;
  }
  if (update.errorMessage !== undefined) {
    payload.error_message = update.errorMessage;
  }

  const { data, error } = await supabase
    .from("research_provider_runs")
    .update(payload)
    .eq("id", providerRunId)
    .select(providerRunSelect)
    .single();

  if (error) {
    throw new Error(`Failed to update provider run: ${error.message}`);
  }

  return toProviderRun(data as ResearchProviderRunRow);
}

export async function getProviderRunsForJob(researchJobId: number): Promise<ResearchProviderRun[]> {
  const { data, error } = await supabase
    .from("research_provider_runs")
    .select(providerRunSelect)
    .eq("research_job_id", researchJobId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch provider runs: ${error.message}`);
  }

  return (((data as unknown) as ResearchProviderRunRow[]) || []).map(toProviderRun);
}
