"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import { promoteResearchedContactsToToday, type OpportunityPromotionResult } from "../../services/opportunityGenerationService";
import { getProviderRunsForJob } from "../../services/researchProviderRunService";
import { getResearchJob, getResearchJobs, summarizeResearchJobs } from "../../services/researchService";
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

function toComparableTime(value: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function getPrimaryProviderRun(providerRuns: ResearchProviderRun[]) {
  return providerRuns.find((run) => run.providerId === "openai-web-research") ?? providerRuns[0] ?? null;
}

function getRetryLabel(message: string | null | undefined) {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("incomplete")) {
    return "Incomplete response · Retry";
  }

  if (normalized.includes("timed out") || normalized.includes("longer than expected")) {
    return "Timed out · Retry";
  }

  if (normalized.includes("rate limit") || normalized.includes("quota")) {
    return "Rate limited · Retry";
  }

  if (normalized.includes("validated")) {
    return "Research response could not be validated · Retry";
  }

  return "Failed · Retry";
}

function getCompactStatus(
  job: ResearchJob,
  providerRuns: ResearchProviderRun[],
  isRunning: boolean,
  rowError: string | undefined,
) {
  if (isRunning || job.status === "Researching") {
    return "Researching...";
  }

  const primaryRun = getPrimaryProviderRun(providerRuns);

  if (primaryRun?.status === "Completed") {
    return `Completed · ${primaryRun.evidenceCount} evidence`;
  }

  if (primaryRun?.status === "No Evidence") {
    return "No evidence";
  }

  if (job.status === "Complete") {
    return "Completed";
  }

  if (primaryRun?.status === "Failed" || job.status === "Failed" || rowError) {
    return getRetryLabel(rowError || primaryRun?.errorMessage || job.errorMessage);
  }

  return job.status;
}

function compactStatusClass(statusText: string, visibleStatus: ResearchJob["status"]) {
  if (statusText.includes("Retry")) {
    return "bg-rose-50 text-rose-700";
  }

  if (statusText === "No evidence") {
    return "bg-amber-50 text-amber-700";
  }

  return statusClass(visibleStatus);
}

export default function ResearchQueuePage() {
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [providerRunsByJobId, setProviderRunsByJobId] = useState<Record<number, ResearchProviderRun[]>>({});
  const [expandedJobIds, setExpandedJobIds] = useState<number[]>([]);
  const [runningLiveJobIds, setRunningLiveJobIds] = useState<Record<number, boolean>>({});
  const [liveResearchErrorsByJobId, setLiveResearchErrorsByJobId] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPromotingOpportunities, setIsPromotingOpportunities] = useState(false);
  const [promotionResult, setPromotionResult] = useState<OpportunityPromotionResult | null>(null);
  const summary = summarizeResearchJobs(jobs);
  const progress = summary.total > 0 ? Math.round(((summary.complete + summary.failed) / summary.total) * 100) : 0;
  function getNeedsResearchRank(job: ResearchJob) {
    const providerRuns = providerRunsByJobId[job.id] || [];
    const primaryRun = getPrimaryProviderRun(providerRuns);
    const retryable = Boolean(liveResearchErrorsByJobId[job.id] || job.errorMessage || primaryRun?.status === "Failed");

    if (runningLiveJobIds[job.id] || job.status === "Researching") {
      return 0;
    }

    if (job.status === "Waiting" && !retryable) {
      return 1;
    }

    return 2;
  }

  const needsResearchJobs = jobs
    .filter((job) => job.status !== "Complete")
    .sort((a, b) => {
      const statusDelta = getNeedsResearchRank(a) - getNeedsResearchRank(b);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return toComparableTime(b.createdAt) - toComparableTime(a.createdAt);
    });
  const completedResearchJobs = jobs
    .filter((job) => job.status === "Complete")
    .sort((a, b) => toComparableTime(b.completedAt) - toComparableTime(a.completedAt));

  async function loadResearchQueue(options: { showLoading?: boolean } = {}) {
    const showLoading = options.showLoading ?? true;
    if (showLoading) {
      setIsLoading(true);
    }
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
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadResearchQueue();
  }, []);

  async function refreshResearchJob(jobId: number) {
    const [updatedJob, providerRuns] = await Promise.all([getResearchJob(jobId), getProviderRunsForJob(jobId)]);

    setJobs((current) => current.map((job) => (job.id === jobId ? updatedJob : job)));
    setProviderRunsByJobId((current) => ({
      ...current,
      [jobId]: providerRuns,
    }));
  }

  function toggleExpanded(jobId: number) {
    setExpandedJobIds((current) =>
      current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId],
    );
  }

  async function runLiveResearch(job: ResearchJob) {
    const confirmed = window.confirm(
      "Run live OpenAI web research for this company? This may incur OpenAI API usage costs.",
    );

    if (!confirmed) {
      return;
    }

    setRunningLiveJobIds((current) => ({ ...current, [job.id]: true }));
    setJobs((current) =>
      current.map((currentJob) =>
        currentJob.id === job.id
          ? { ...currentJob, status: "Researching", startedAt: new Date().toISOString(), errorMessage: null }
          : currentJob,
      ),
    );
    setLiveResearchErrorsByJobId((current) => {
      const next = { ...current };
      delete next[job.id];
      return next;
    });
    setError(null);

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

      await refreshResearchJob(job.id);
      setExpandedJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
    } catch (runError) {
      await refreshResearchJob(job.id);
      setExpandedJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
      setLiveResearchErrorsByJobId((current) => ({
        ...current,
        [job.id]: runError instanceof Error ? runError.message : "Failed to run live research.",
      }));
    } finally {
      setRunningLiveJobIds((current) => {
        const next = { ...current };
        delete next[job.id];
        return next;
      });
    }
  }

  async function addResearchedContactsToToday() {
    setIsPromotingOpportunities(true);
    setError(null);
    setPromotionResult(null);

    try {
      const result = await promoteResearchedContactsToToday();
      setPromotionResult(result);
      await loadResearchQueue({ showLoading: false });
    } catch (promotionError) {
      setError(
        promotionError instanceof Error
          ? promotionError.message
          : "Failed to add researched contacts to Today's Opportunities.",
      );
    } finally {
      setIsPromotingOpportunities(false);
    }
  }

  function renderResearchTable(sectionJobs: ResearchJob[], options: { showRunAction: boolean; emptyMessage: string }) {
    if (sectionJobs.length === 0) {
      return <p className="mt-4 text-sm text-slate-500">{options.emptyMessage}</p>;
    }

    return (
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sectionJobs.map((job) => {
              const providerRuns = providerRunsByJobId[job.id] || [];
              const expanded = expandedJobIds.includes(job.id);
              const isLiveRunning = Boolean(runningLiveJobIds[job.id]);
              const visibleStatus = isLiveRunning ? "Researching" : job.status;
              const rowError = liveResearchErrorsByJobId[job.id] || job.errorMessage || undefined;
              const compactStatus = getCompactStatus(job, providerRuns, isLiveRunning, rowError);
              const updatedAt = job.completedAt || job.startedAt || job.createdAt;

              return (
                <Fragment key={job.id}>
                  <tr>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                      <Link
                        href={`/companies/${job.companyId}`}
                        className="underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 hover:decoration-slate-500"
                      >
                        {job.companyName}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${compactStatusClass(compactStatus, visibleStatus)}`}>
                        {compactStatus}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(updatedAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(job.id)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          {expanded ? "Hide Providers" : "Show Providers"}
                        </button>
                        {options.showRunAction ? (
                          <button
                            type="button"
                            onClick={() => runLiveResearch(job)}
                            disabled={isLiveRunning || job.status === "Researching"}
                            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {isLiveRunning ? "Researching..." : "Run Live Research"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr key={`${job.id}-providers`}>
                      <td colSpan={4} className="bg-slate-50 px-3 py-3">
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
                                {run.errorMessage ? <p className="mt-1 text-sm text-rose-700">{run.errorMessage}</p> : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">
                            No provider runs yet. Run live research to collect source-backed evidence.
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
    );
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
                Track imported companies through live, source-backed research. Each company can run independently while the rest of the queue stays available.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={addResearchedContactsToToday}
                disabled={isPromotingOpportunities}
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isPromotingOpportunities ? "Adding..." : "Add researched contacts to Today"}
              </button>
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
          {promotionResult ? (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
              <p className="font-semibold">
                Evaluated {promotionResult.companiesEvaluated} companies and added {promotionResult.contactsAdded} contacts.
              </p>
              {promotionResult.skippedCompanies.length > 0 ? (
                <div className="mt-2">
                  <p className="font-semibold">Skipped companies</p>
                  <ul className="mt-1 space-y-1">
                    {promotionResult.skippedCompanies.map((company) => (
                      <li key={`${company.companyId}-${company.reason}`}>
                        {company.companyName}: {company.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Needs Research</p>
              <p className="mt-1 text-sm text-slate-500">Waiting, researching, and retryable companies.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
              {needsResearchJobs.length}
            </span>
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading research jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No research jobs yet. Import contacts, then choose Research.</p>
          ) : (
            renderResearchTable(needsResearchJobs, {
              showRunAction: true,
              emptyMessage: "No companies need research right now.",
            })
          )}
        </section>

        {!isLoading && jobs.length > 0 ? (
          <details className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.35)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              <span>Completed Research ({completedResearchJobs.length})</span>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Show</span>
            </summary>
            {renderResearchTable(completedResearchJobs, {
              showRunAction: false,
              emptyMessage: "No completed research jobs yet.",
            })}
          </details>
        ) : null}
      </div>
    </main>
  );
}
