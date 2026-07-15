import { createEvidence } from "./evidenceService";
import {
  createProviderRun,
  getProviderRunsForJob,
  updateProviderRun,
} from "./researchProviderRunService";
import { researchProviders } from "./researchProviders/providerRegistry";
import { updateResearchJob } from "./researchService";
import type { ResearchJob } from "../types/ResearchJob";
import type { ResearchProviderRun } from "../types/ResearchProviderRun";
import type { EvidenceCandidate, ProviderRunStatus, ResearchCompany } from "../types/research";
import { toNewEvidence } from "../types/research";

type OrchestrationProviderSummary = {
  providerId: string;
  providerName: string;
  status: ProviderRunStatus;
  evidenceCount: number;
  errorMessage: string | null;
};

export type ResearchOrchestrationResult = {
  jobId: number;
  status: "Complete" | "Failed";
  providerResults: OrchestrationProviderSummary[];
};

const confidenceValues = new Set(["High", "Medium", "Low"]);

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function isDuplicateEvidenceError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("duplicate");
}

function validateEvidenceCandidate(candidate: EvidenceCandidate, company: ResearchCompany, researchJobId: number) {
  return (
    candidate.companyId === company.id &&
    candidate.researchJobId === researchJobId &&
    isNonEmpty(candidate.evidenceType) &&
    isNonEmpty(candidate.headline) &&
    isNonEmpty(candidate.summary) &&
    isNonEmpty(candidate.sourceName) &&
    isNonEmpty(candidate.sourceUrl) &&
    confidenceValues.has(candidate.confidence)
  );
}

async function createOrResetProviderRun(
  researchJobId: number,
  provider: { id: string; name: string },
  existingRunsByProviderId: Map<string, ResearchProviderRun>,
) {
  const startedAt = new Date().toISOString();
  const existingRun = existingRunsByProviderId.get(provider.id);

  if (existingRun) {
    return updateProviderRun(existingRun.id, {
      status: "Skipped",
      evidenceCount: 0,
      startedAt,
      completedAt: null,
      errorMessage: null,
    });
  }

  return createProviderRun({
    researchJobId,
    providerId: provider.id,
    providerName: provider.name,
    status: "Skipped",
    evidenceCount: 0,
    startedAt,
    completedAt: null,
    errorMessage: null,
  });
}

export async function runResearchJobWithMockProviders(
  job: ResearchJob,
  company: ResearchCompany,
): Promise<ResearchOrchestrationResult> {
  const startedAt = new Date().toISOString();
  const providerSummaries: OrchestrationProviderSummary[] = [];

  try {
    await updateResearchJob(job.id, {
      status: "Researching",
      startedAt,
      completedAt: null,
      provider: "mock-provider-registry",
      errorMessage: null,
    });

    const existingRuns = await getProviderRunsForJob(job.id);
    const existingRunsByProviderId = new Map(existingRuns.map((run) => [run.providerId, run]));

    for (const provider of researchProviders) {
      const providerRun = await createOrResetProviderRun(job.id, provider, existingRunsByProviderId);
      let status: ProviderRunStatus = "Failed";
      let evidenceCount = 0;
      let errorMessage: string | null = null;

      try {
        const result = await provider.researchCompany(company);
        status = result.status;
        errorMessage = result.errorMessage ?? null;

        const candidates = result.evidence.map<EvidenceCandidate>((candidate) => ({
          ...candidate,
          companyId: company.id,
          researchJobId: job.id,
        }));
        const validCandidates = candidates.filter((candidate) =>
          validateEvidenceCandidate(candidate, company, job.id),
        );

        for (const candidate of validCandidates) {
          try {
            await createEvidence(toNewEvidence(candidate));
            evidenceCount += 1;
          } catch (evidenceError) {
            if (!isDuplicateEvidenceError(evidenceError)) {
              throw evidenceError;
            }
          }
        }

        if (status === "Completed" && evidenceCount === 0) {
          status = "No Evidence";
        }
      } catch (providerError) {
        status = "Failed";
        errorMessage = providerError instanceof Error ? providerError.message : "Provider failed.";
      }

      await updateProviderRun(providerRun.id, {
        status,
        evidenceCount,
        completedAt: new Date().toISOString(),
        errorMessage,
      });

      providerSummaries.push({
        providerId: provider.id,
        providerName: provider.name,
        status,
        evidenceCount,
        errorMessage,
      });
    }

    const providerSummary = providerSummaries
      .map((summary) => `${summary.providerId}: ${summary.status} (${summary.evidenceCount})`)
      .join("; ");

    await updateResearchJob(job.id, {
      status: "Complete",
      completedAt: new Date().toISOString(),
      provider: providerSummary,
      errorMessage: null,
    });

    return {
      jobId: job.id,
      status: "Complete",
      providerResults: providerSummaries,
    };
  } catch (orchestrationError) {
    const errorMessage = orchestrationError instanceof Error ? orchestrationError.message : "Research orchestration failed.";

    await updateResearchJob(job.id, {
      status: "Failed",
      completedAt: new Date().toISOString(),
      provider: "mock-provider-registry",
      errorMessage,
    });

    return {
      jobId: job.id,
      status: "Failed",
      providerResults: providerSummaries,
    };
  }
}
