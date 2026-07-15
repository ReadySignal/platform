import "server-only";

import { runLiveResearchJob } from "../../../../services/liveResearchOrchestrator";
import { getResearchCompany, getResearchJob } from "../../../../services/researchService";

export const runtime = "nodejs";

const runningLiveResearchJobIds = new Set<number>();

export async function POST(request: Request) {
  let jobId: number | null = null;

  try {
    const body = (await request.json()) as { jobId?: unknown };
    jobId = typeof body.jobId === "number" ? body.jobId : Number(body.jobId);

    if (!Number.isFinite(jobId)) {
      return Response.json({ error: "Missing research job id." }, { status: 400 });
    }

    if (runningLiveResearchJobIds.has(jobId)) {
      return Response.json({ error: "Live research is already running for this job." }, { status: 409 });
    }

    runningLiveResearchJobIds.add(jobId);
    const job = await getResearchJob(jobId);

    if (job.status === "Researching") {
      return Response.json({ error: "Live research is already running for this job." }, { status: 409 });
    }

    const company = await getResearchCompany(job.companyId);
    const result = await runLiveResearchJob(job, company);

    if (result.status === "Failed") {
      return Response.json({ error: result.errorMessage || "Live research failed.", result }, { status: 500 });
    }

    return Response.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live research failed.";
    console.error(`[research] Live research route failed for job ${jobId ?? "unknown"}: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  } finally {
    if (jobId !== null && Number.isFinite(jobId)) {
      runningLiveResearchJobIds.delete(jobId);
    }
  }
}
