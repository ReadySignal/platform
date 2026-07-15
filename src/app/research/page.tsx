"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import { runResearchJobWithMockProviders } from "../../services/researchOrchestrator";
import { getProviderRunsForJob } from "../../services/researchProviderRunService";
import { getResearchCompany, getResearchJobs, summarizeResearchJobs } from "../../services/researchService";
import type { ResearchJob } from "../../types/ResearchJob";
import type { ResearchProviderRun } from "../../types/ResearchProviderRun";

function formatDate(value: string | null) {
  if (!value) {
    return "Not started";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusClass(status: ResearchJob["status"]) {
  if (status === "Complete") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Failed") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "Researching") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

function providerStatusClass(status: ResearchProviderRun["status"]) {
  if (status === "Completed") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Failed") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "No Evidence") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ResearchQueuePage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [providerRunsByJobId, setProviderRunsByJobId] = useState<Record<number, ResearchProviderRun[]>>({});
  const [expandedJobIds, setExpandedJobIds] = useState<number[]>([]);
  const [runningJobId, setRunningJobId] = useState<number | null>(null);
  const [runningLiveJobId, setRunningLiveJobId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveResearchMessage, setLiveResearchMessage] = useState<string | null>(null);
  const summary = summarizeResearchJobs(jobs);
  const progress = summary.total > 0 ? Math.round(((summary.complete + summary.failed) / summary.total) * 100) : 0;

  async function loadResearchQueue() {
    setIsLoading(true);
    setError(null);

    try {
      const loadedJobs = await getResearchJobs();
      setJobs(loadedJobs);

      const providerRunEntries = await Promise.all(
        loadedJobs.map(async (job) => {
          try {
            return [job.id, await getProviderRunsForJob(job.id)] as const;
          } catch (providerRunError) {
            console.warn(`Provider runs are not available for research job ${job.id}:`, providerRunError);
            return [job.id, []] as const;
          }
        }),
      );

      setProviderRunsByJobId(Object.fromEntries(providerRunEntries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load research queue.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadResearchQueue();
  }, []);

  function toggleExpanded(jobId: number) {
    setExpandedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  async function runMockResearch(job: ResearchJob) {
    setRunningJobId(job.id);
    setError(null);
    setLiveResearchMessage(null);

    try {
      const company = await getResearchCompany(job.companyId);
      await runResearchJobWithMockProviders(job, company);
      await loadResearchQueue();
      setExpandedJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Failed to run mock research.");
    } finally {
      setRunningJobId(null);
    }
  }

  async function runLiveResearch(job: ResearchJob) {
    const confirmed = window.confirm(
      "Run live OpenAI web research for this company? This may incur OpenAI API usage costs.",
    );

    if (!confirmed) {
      return;
    }

    setRunningLiveJobId(job.id);
    setError(null);
    setLiveResearchMessage(null);

    try {
      const response = await fetch("/api/research/run-live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId: job.id }),
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: { providerStatus: string; evidenceCount: number };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Live research failed.");
      }

      await loadResearchQueue();
      setExpandedJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
      setLiveResearchMessage(
        `Live research finished: ${payload.result?.providerStatus || "Complete"} with ${
          payload.result?.evidenceCount ?? 0
        } evidence records stored.`,
      );
    } catch (runError) {
      await loadResearchQueue();
      setExpandedJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
      setError(runError instanceof Error ? runError.message : "Failed to run live research.");
    } finally {
      setRunningLiveJobId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />
        <PageHeader
          eyebrow="Research"
          title="Research Queue"
          supportingText="Track companies waiting for evidence-backed research."
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Progress</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This framework tracks which imported companies are waiting for research. No external providers, AI, or evidence collection run in this version.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/import"
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Import Contacts
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Return to Today&apos;s Opportunities
              </Link>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>{progress}% processed</span>
              <span>{summary.complete + summary.failed} of {summary.total}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total", summary.total],
              ["Waiting", summary.waiting],
              ["Researching", summary.researching],
              ["Complete", summary.complete],
              ["Failed", summary.failed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-2xl font-semibold text-slate-950">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          {liveResearchMessage ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {liveResearchMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Jobs</p>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading research jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No research jobs yet. Import contacts, then choose Research.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Started</th>
                    <th className="px-3 py-2">Completed</th>
                    <th className="px-3 py-2">Error</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map((job) => {
                    const providerRuns = providerRunsByJobId[job.id] || [];
                    const expanded = expandedJobIds.includes(job.id);

                    return (
                      <Fragment key={job.id}>
                        <tr>
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            <Link
                              href={`/companies/${job.companyId}`}
                              className="underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 hover:decoration-slate-500"
                            >
                              {job.companyName}
                            </Link>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(job.status)}`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{formatDate(job.startedAt)}</td>
                          <td className="px-3 py-3 text-slate-600">{formatDate(job.completedAt)}</td>
                          <td className="max-w-sm px-3 py-3 text-slate-600">{job.errorMessage || "None"}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpanded(job.id)}
                                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                {expanded ? "Hide Providers" : "Show Providers"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runMockResearch(job)}
                                disabled={runningJobId === job.id || runningLiveJobId === job.id || job.status === "Researching"}
                                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {runningJobId === job.id ? "Running..." : "Run Mock Research"}
                              </button>
                              <button
                                type="button"
                                onClick={() => runLiveResearch(job)}
                                disabled={runningLiveJobId === job.id || runningJobId === job.id || job.status === "Researching"}
                                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                {runningLiveJobId === job.id ? "Running live..." : "Run Live Research"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${job.id}-providers`}>
                            <td colSpan={6} className="bg-slate-50 px-3 py-3">
                              {providerRuns.length > 0 ? (
                                <div className="grid gap-2 md:grid-cols-3">
                                  {providerRuns.map((run) => (
                                    <div key={run.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-900">{run.providerName}</p>
                                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${providerStatusClass(run.status)}`}>
                                          {run.status}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm text-slate-600">{run.evidenceCount} evidence records</p>
                                      {run.errorMessage ? (
                                        <p className="mt-1 text-sm text-rose-700">{run.errorMessage}</p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500">
                                  No provider runs yet. Use Run Mock Research to execute the registered mock providers.
                                </p>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
