import "server-only";

import { createEvidence, getEvidenceForCompany } from "./evidenceService";
import {
  createProviderRun,
  getProviderRunsForJob,
  updateProviderRun,
} from "./researchProviderRunService";
import {
  OpenAIResearchProviderError,
  openAIWebResearchProvider,
} from "./researchProviders/openAIWebResearchProvider";
import { updateResearchJob } from "./researchService";
import type { ResearchJob } from "../types/ResearchJob";
import type { ResearchProviderRun } from "../types/ResearchProviderRun";
import type { EvidenceCandidate, ProviderRunStatus, ResearchCompany } from "../types/research";
import { toNewEvidence } from "../types/research";

export type LiveResearchResult = {
  jobId: number;
  status: "Complete" | "Failed";
  providerStatus: ProviderRunStatus;
  evidenceCount: number;
  errorMessage: string | null;
};

const confidenceValues = new Set(["High", "Medium", "Low"]);
const maxStoredEvidencePerCompany = 10;

function isRetryableProviderError(error: unknown) {
  return error instanceof OpenAIResearchProviderError && (error.code === "timeout" || error.code === "validation");
}

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function isDuplicateEvidenceError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("duplicate");
}

function isUsableSourceUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateEvidenceCandidate(candidate: EvidenceCandidate, company: ResearchCompany, researchJobId: number) {
  return (
    candidate.companyId === company.id &&
    candidate.researchJobId === researchJobId &&
    isNonEmpty(candidate.evidenceType) &&
    isNonEmpty(candidate.headline) &&
    isNonEmpty(candidate.summary) &&
    isNonEmpty(candidate.sourceName) &&
    isUsableSourceUrl(candidate.sourceUrl) &&
    confidenceValues.has(candidate.confidence)
  );
}

async function createOrResetProviderRun(
  researchJobId: number,
  existingRunsByProviderId: Map<string, ResearchProviderRun>,
) {
  const startedAt = new Date().toISOString();
  const existingRun = existingRunsByProviderId.get(openAIWebResearchProvider.id);

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
    providerId: openAIWebResearchProvider.id,
    providerName: openAIWebResearchProvider.name,
    status: "Skipped",
    evidenceCount: 0,
    startedAt,
    completedAt: null,
    errorMessage: null,
  });
}

export async function runLiveResearchJob(
  job: ResearchJob,
  company: ResearchCompany,
): Promise<LiveResearchResult> {
  const startedAt = new Date().toISOString();
  let providerRun: ResearchProviderRun | null = null;
  let providerStatus: ProviderRunStatus = "Failed";
  let evidenceCount = 0;
  let providerErrorMessage: string | null = null;

  try {
    await updateResearchJob(job.id, {
      status: "Researching",
      startedAt,
      completedAt: null,
      provider: openAIWebResearchProvider.id,
      errorMessage: null,
    });

    const existingRuns = await getProviderRunsForJob(job.id);
    const existingRunsByProviderId = new Map(existingRuns.map((run) => [run.providerId, run]));
    providerRun = await createOrResetProviderRun(job.id, existingRunsByProviderId);

    try {
      const result = await openAIWebResearchProvider.researchCompany(company);
      const existingEvidence = await getEvidenceForCompany(company.id);
      const remainingSlots = Math.max(0, maxStoredEvidencePerCompany - existingEvidence.length);
      const candidates = result.evidence
        .map<EvidenceCandidate>((candidate) => ({
          ...candidate,
          companyId: company.id,
          contactId: null,
          researchJobId: job.id,
        }))
        .filter((candidate) => validateEvidenceCandidate(candidate, company, job.id))
        .slice(0, remainingSlots);

      for (const candidate of candidates) {
        try {
          await createEvidence(toNewEvidence(candidate));
          evidenceCount += 1;
        } catch (evidenceError) {
          if (!isDuplicateEvidenceError(evidenceError)) {
            throw evidenceError;
          }
        }
      }

      providerStatus = evidenceCount > 0 ? "Completed" : "No Evidence";
      providerErrorMessage = result.errorMessage ?? null;
    } catch (providerError) {
      if (providerError instanceof OpenAIResearchProviderError && providerError.fatal) {
        throw providerError;
      }

      providerStatus = "Failed";
      providerErrorMessage = providerError instanceof Error ? providerError.message : "OpenAI provider failed.";
    }

    await updateProviderRun(providerRun.id, {
      status: providerStatus,
      evidenceCount,
      completedAt: new Date().toISOString(),
      errorMessage: providerErrorMessage,
    });

    await updateResearchJob(job.id, {
      status: "Complete",
      completedAt: new Date().toISOString(),
      provider: `${openAIWebResearchProvider.id}: ${providerStatus} (${evidenceCount})`,
      errorMessage: null,
    });

    console.info(
      `[research] Live research finished for job ${job.id}: ${providerStatus}, ${evidenceCount} evidence records.`,
    );

    return {
      jobId: job.id,
      status: "Complete",
      providerStatus,
      evidenceCount,
      errorMessage: providerErrorMessage,
    };
  } catch (orchestrationError) {
    const errorMessage =
      orchestrationError instanceof Error ? orchestrationError.message : "Live research orchestration failed.";
    const retryableProviderError = isRetryableProviderError(orchestrationError);

    await updateResearchJob(job.id, {
      status: retryableProviderError ? "Waiting" : "Failed",
      startedAt: retryableProviderError ? null : undefined,
      completedAt: retryableProviderError ? null : new Date().toISOString(),
      provider: openAIWebResearchProvider.id,
      errorMessage,
    });

    if (retryableProviderError) {
      console.warn(`[research] Reset live research job ${job.id} to Waiting after retryable provider error.`);
    }

    if (providerRun) {
      await updateProviderRun(providerRun.id, {
        status: "Failed",
        evidenceCount,
        completedAt: new Date().toISOString(),
        errorMessage,
      });
    }

    return {
      jobId: job.id,
      status: "Failed",
      providerStatus: "Failed",
      evidenceCount,
      errorMessage,
    };
  }
}
