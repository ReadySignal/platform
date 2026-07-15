"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { TopNavigation } from "../../components/TopNavigation";
import {
  createImportAnalysisSignals,
  getCompletedImportRuns,
  getContactsForImportRun,
} from "../../services/importAnalysisService";
import { createWaitingResearchJobsForImportRun } from "../../services/researchService";
import type {
  ImportedContact,
  ImportedContactAnalysis,
  ImportAnalysisCategory,
  ScoreBreakdownItem,
} from "../../types/ImportAnalysis";
import type { ImportRun } from "../../types/ImportRun";

const targetTitleTerms = [
  "operations",
  "plant",
  "maintenance",
  "reliability",
  "engineering",
  "engineer",
  "continuous improvement",
  "manager",
  "director",
  "vp",
  "head",
];
const targetIndustryTerms = [
  "manufacturing",
  "industrial",
  "machinery",
  "equipment",
  "automotive",
  "medical device",
  "packaging",
  "process",
  "food",
  "materials",
];
const targetStates = new Set(["OH", "WA", "NC", "MN", "TX", "KS"]);

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function hasKnownValue(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value > 0;
  }

  const normalized = normalize(value);
  return Boolean(normalized && normalized !== "unknown" && normalized !== "not available");
}

function addBreakdown(
  breakdown: ScoreBreakdownItem[],
  label: string,
  points: number,
  detail: string,
) {
  breakdown.push({ label, points, detail });
}

function categoryForScore(score: number): ImportAnalysisCategory {
  if (score >= 75) {
    return "high";
  }

  if (score >= 45) {
    return "needs-info";
  }

  return "low";
}

function getPrimaryReason(breakdown: ScoreBreakdownItem[]) {
  const strongest = [...breakdown].sort((a, b) => b.points - a.points)[0];
  return strongest?.detail || "Limited imported data is available for this contact.";
}

function buildWarnings(contact: ImportedContact) {
  const warnings: string[] = [];
  const company = contact.company;

  if (!contact.email) {
    warnings.push("Email missing");
  }
  if (!contact.phone && !contact.mobile) {
    warnings.push("Phone missing");
  }
  if (!hasKnownValue(company?.industry)) {
    warnings.push("Industry missing");
  }
  if (!hasKnownValue(company?.state)) {
    warnings.push("State missing");
  }
  if (!hasKnownValue(company?.employeeCount)) {
    warnings.push("Company size missing");
  }
  if (!hasKnownValue(contact.relevantContext)) {
    warnings.push("Context missing");
  }

  return warnings;
}

function analyzeContact(contact: ImportedContact): ImportedContactAnalysis {
  const company = contact.company;
  const breakdown: ScoreBreakdownItem[] = [];
  const normalizedTitle = normalize(contact.title);
  const normalizedIndustry = normalize(company?.industry);
  const state = (company?.state || "").trim().toUpperCase();

  const titleMatches = targetTitleTerms.filter((term) => normalizedTitle.includes(term));
  addBreakdown(
    breakdown,
    "Title relevance",
    titleMatches.length > 0 ? 20 : contact.title ? 6 : 0,
    titleMatches.length > 0
      ? `${contact.title} matches ${titleMatches.slice(0, 2).join(" and ")} outreach terms.`
      : contact.title
        ? "Title is present but does not strongly match the current outreach profile."
        : "Title is missing.",
  );

  const industryMatches = targetIndustryTerms.filter((term) => normalizedIndustry.includes(term));
  addBreakdown(
    breakdown,
    "Target industry",
    industryMatches.length > 0 ? 15 : hasKnownValue(company?.industry) ? 5 : 0,
    industryMatches.length > 0
      ? `${company?.industry} matches the current target industry profile.`
      : hasKnownValue(company?.industry)
        ? `${company?.industry} is known, but not a strong target-industry match.`
        : "Industry is missing.",
  );

  addBreakdown(
    breakdown,
    "Target state",
    targetStates.has(state) ? 10 : hasKnownValue(state) ? 4 : 0,
    targetStates.has(state)
      ? `${state} is in the current target-state list.`
      : hasKnownValue(state)
        ? `${state} is known, but outside the current target-state list.`
        : "State is missing.",
  );

  const employeeCount = company?.employeeCount ?? 0;
  addBreakdown(
    breakdown,
    "Company size",
    employeeCount >= 500 ? 10 : employeeCount > 0 ? 6 : 0,
    employeeCount >= 500
      ? `${employeeCount.toLocaleString()} employees indicates a larger account.`
      : employeeCount > 0
        ? `${employeeCount.toLocaleString()} employees gives some company-size context.`
        : "Employee count is missing.",
  );

  addBreakdown(
    breakdown,
    "Phone present",
    contact.phone ? 8 : 0,
    contact.phone ? "A direct phone number is present." : "Direct phone is missing.",
  );
  addBreakdown(
    breakdown,
    "Mobile present",
    contact.mobile ? 8 : 0,
    contact.mobile ? "A mobile number is present." : "Mobile number is missing.",
  );
  addBreakdown(
    breakdown,
    "Email present",
    contact.email ? 8 : 0,
    contact.email ? "An email address is present." : "Email is missing.",
  );
  addBreakdown(
    breakdown,
    "Verified contact",
    contact.verifiedContact ? 8 : 0,
    contact.verifiedContact ? "The imported row includes at least one verified contact channel." : "No verified contact channel is marked.",
  );
  addBreakdown(
    breakdown,
    "No previous outreach",
    contact.noPreviousOutreach ? 8 : 0,
    contact.noPreviousOutreach ? "The imported row indicates no previous outreach." : "Previous outreach may already exist.",
  );
  addBreakdown(
    breakdown,
    "Last-contacted context",
    contact.whyToday ? 5 : 0,
    contact.whyToday || "No last-contacted context was imported.",
  );
  addBreakdown(
    breakdown,
    "Relevant context",
    contact.relevantContext ? 10 : 0,
    contact.relevantContext || "No relevant context was imported.",
  );

  const score = Math.min(
    100,
    breakdown.reduce((sum, item) => sum + item.points, 0),
  );
  const name = `${contact.firstName} ${contact.lastName}`.trim() || "Imported contact";
  const signalHeadline = `${name} scored ${score} from imported list data`;
  const signalDetails = breakdown
    .filter((item) => item.points > 0)
    .map((item) => `${item.label}: ${item.detail}`)
    .join(" ");

  return {
    contact,
    score,
    category: categoryForScore(score),
    primaryReason: getPrimaryReason(breakdown.filter((item) => item.points > 0)),
    breakdown,
    warnings: buildWarnings(contact),
    signalHeadline,
    signalDetails: signalDetails || "This contact was analyzed using only imported list fields.",
  };
}

function groupLabel(category: ImportAnalysisCategory) {
  if (category === "high") {
    return "High-confidence opportunities";
  }

  if (category === "needs-info") {
    return "Needs more information";
  }

  return "Low-priority contacts";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AnalyzePage() {
  const [importRuns, setImportRuns] = useState<ImportRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<ImportedContact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreatingResearchJobs, setIsCreatingResearchJobs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadRuns() {
      setIsLoadingRuns(true);
      setError(null);

      try {
        const runs = await getCompletedImportRuns();
        setImportRuns(runs);
        setSelectedRunId(runs[0]?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load import runs.");
      } finally {
        setIsLoadingRuns(false);
      }
    }

    loadRuns();
  }, []);

  useEffect(() => {
    async function loadContacts() {
      if (!selectedRunId) {
        setContacts([]);
        return;
      }

      setIsLoadingContacts(true);
      setError(null);
      setSuccessMessage(null);
      setSelectedContactIds(new Set());

      try {
        const importedContacts = await getContactsForImportRun(selectedRunId);
        setContacts(importedContacts);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load imported contacts.");
      } finally {
        setIsLoadingContacts(false);
      }
    }

    loadContacts();
  }, [selectedRunId]);

  const analyses = useMemo(
    () => contacts.map(analyzeContact).sort((a, b) => b.score - a.score),
    [contacts],
  );
  const groupedAnalyses = useMemo(
    () => ({
      high: analyses.filter((analysis) => analysis.category === "high"),
      "needs-info": analyses.filter((analysis) => analysis.category === "needs-info"),
      low: analyses.filter((analysis) => analysis.category === "low"),
    }),
    [analyses],
  );
  const selectedRun = importRuns.find((run) => run.id === selectedRunId) ?? null;

  function toggleSelected(contactId: string | number) {
    setSelectedContactIds((current) => {
      const next = new Set(current);
      const key = String(contactId);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  async function addSelectedToOpportunities() {
    const selectedAnalyses = analyses.filter((analysis) => selectedContactIds.has(String(analysis.contact.id)));

    setIsAdding(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await createImportAnalysisSignals(
        selectedAnalyses
          .filter((analysis) => analysis.contact.companyId !== null)
          .map((analysis) => ({
            companyId: analysis.contact.companyId as string | number,
            contactId: analysis.contact.id,
            headline: analysis.signalHeadline,
            details: analysis.signalDetails,
            scorePoints: analysis.score,
          })),
      );

      setSuccessMessage(
        `Added ${result.insertedCount} opportunities. Skipped ${result.skippedDuplicateCount} that already had import-analysis signals.`,
      );
      setSelectedContactIds(new Set());
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Failed to add selected contacts.");
    } finally {
      setIsAdding(false);
    }
  }

  async function queueResearchForSelectedRun() {
    if (!selectedRunId) {
      return;
    }

    setIsCreatingResearchJobs(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await createWaitingResearchJobsForImportRun(selectedRunId);
      setSuccessMessage(
        `Created ${result.createdCount} research jobs. Skipped ${result.skippedCount} companies that already had research jobs.`,
      );
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : "Failed to create research jobs.");
    } finally {
      setIsCreatingResearchJobs(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />
        <PageHeader
          eyebrow="Import Analysis"
          title="Analyze Imported Contacts"
          supportingText="Rank contacts using only the information contained in the uploaded list."
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Source</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This analysis uses only the information in your uploaded list. Public research has not been added yet.
              </p>
            </div>

            <label className="min-w-full text-sm font-semibold text-slate-700 sm:min-w-72">
              Completed import run
              <select
                value={selectedRunId ?? ""}
                onChange={(event) => setSelectedRunId(event.target.value ? Number(event.target.value) : null)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={isLoadingRuns || importRuns.length === 0}
              >
                <option value="">Select an import</option>
                {importRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.fileName} - {formatDate(run.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedRun ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {[
                ["Total rows", selectedRun.totalRows],
                ["Valid rows", selectedRun.validRows],
                ["Imported companies", selectedRun.importedCompanies],
                ["Imported contacts", selectedRun.importedContacts],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-2xl font-semibold text-slate-950">{value}</p>
                  <p className="text-sm text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          {successMessage ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {successMessage}
            </p>
          ) : null}
        </section>

        {isLoadingContacts ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-600 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Loading imported contacts...
          </div>
        ) : selectedRunId && contacts.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-800 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            No contacts are linked to this import run yet. Run the Iteration 18 migration before importing new CSV files.
          </div>
        ) : analyses.length > 0 ? (
          <>
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">{selectedContactIds.size} selected</p>
                <p className="text-sm text-slate-500">Selected contacts become active queue opportunities through import-analysis signals.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={queueResearchForSelectedRun}
                  disabled={isCreatingResearchJobs || !selectedRunId}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {isCreatingResearchJobs ? "Creating research jobs..." : "Research Imported Companies"}
                </button>
                <button
                  type="button"
                  onClick={addSelectedToOpportunities}
                  disabled={isAdding || selectedContactIds.size === 0}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isAdding ? "Adding..." : "Add selected to Today's Opportunities"}
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Today&apos;s Opportunities
                </Link>
              </div>
            </section>

            {(["high", "needs-info", "low"] as ImportAnalysisCategory[]).map((category) => (
              <section
                key={category}
                className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                      {groupLabel(category)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{groupedAnalyses[category].length} contacts</p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-slate-100">
                  {groupedAnalyses[category].map((analysis) => {
                    const contact = analysis.contact;
                    const name = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown Contact";
                    const selected = selectedContactIds.has(String(contact.id));

                    return (
                      <article key={contact.id} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(contact.id)}
                            className="mt-1 h-4 w-4"
                            aria-label={`Select ${name}`}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-semibold text-slate-950">{name}</h2>
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {analysis.score}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {contact.title || "Unknown title"} at {contact.company?.name || "Unknown company"}
                            </p>
                            <p className="mt-2 text-sm font-medium text-slate-800">{analysis.primaryReason}</p>
                            {analysis.warnings.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {analysis.warnings.map((warning) => (
                                  <span
                                    key={warning}
                                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800"
                                  >
                                    {warning}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Score breakdown</p>
                          <div className="mt-2 space-y-2">
                            {analysis.breakdown
                              .filter((item) => item.points > 0)
                              .map((item) => (
                                <div key={item.label} className="flex gap-3 text-sm">
                                  <span className="w-8 shrink-0 font-semibold text-slate-950">+{item.points}</span>
                                  <span className="text-slate-600">{item.detail}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {groupedAnalyses[category].length === 0 ? (
                    <p className="py-4 text-sm text-slate-500">No contacts in this group.</p>
                  ) : null}
                </div>
              </section>
            ))}
          </>
        ) : null}
      </div>
    </main>
  );
}
