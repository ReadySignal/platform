export type ResearchStatus = "Waiting" | "Researching" | "Complete" | "Failed";

export type ResearchJob = {
  id: number;
  companyId: number;
  companyName: string;
  status: ResearchStatus;
  startedAt: string | null;
  completedAt: string | null;
  provider: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type ResearchJobSummary = {
  total: number;
  waiting: number;
  researching: number;
  complete: number;
  failed: number;
};

export type CreateResearchJobsResult = {
  createdCount: number;
  skippedCount: number;
};
