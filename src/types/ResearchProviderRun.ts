import type { ProviderRunStatus } from "./research";

export type ResearchProviderRun = {
  id: number;
  researchJobId: number;
  providerId: string;
  providerName: string;
  status: ProviderRunStatus;
  evidenceCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type NewResearchProviderRun = {
  researchJobId: number;
  providerId: string;
  providerName: string;
  status: ProviderRunStatus;
  evidenceCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
};

export type ResearchProviderRunUpdate = {
  status?: ProviderRunStatus;
  evidenceCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
};
