"use client";

import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { MissionBar } from "../components/MissionBar";
import { Queue } from "../components/Queue";
import { getCompanies } from "../lib/queries/companies";
import { getCallOutcomesForContact, saveCallOutcome } from "../services/callOutcomeService";
import { getQueue } from "../services/queueService";
import type { CallOutcome } from "../types/CallOutcome";
import type { Company } from "../types/Company";
import type { Prospect } from "../types/Prospect";

function findNextIncompleteProspectId(
  completedProspectId: number,
  completedIds: number[],
  prospects: Prospect[],
) {
  const currentIndex = prospects.findIndex((prospect) => prospect.id === completedProspectId);

  if (currentIndex === -1) {
    return prospects.find((prospect) => !completedIds.includes(prospect.id))?.id ?? null;
  }

  for (let offset = 1; offset <= prospects.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % prospects.length;
    const candidate = prospects[nextIndex];

    if (!completedIds.includes(candidate.id)) {
      return candidate.id;
    }
  }

  return null;
}

export default function Home() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [savedOutcomesByProspectId, setSavedOutcomesByProspectId] = useState<Record<number, CallOutcome>>({});
  const [expandedProspectId, setExpandedProspectId] = useState<number | null>(null);
  const [activeDispositionId, setActiveDispositionId] = useState<number | null>(null);
  const [selectedDisposition, setSelectedDisposition] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [savingOutcomeId, setSavingOutcomeId] = useState<number | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [signalsRemaining, setSignalsRemaining] = useState(25);
  const [callsCompleted, setCallsCompleted] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [meetings, setMeetings] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [isTopRankWhyOpen, setIsTopRankWhyOpen] = useState(false);

  useEffect(() => {
    async function loadQueue() {
      setQueueLoading(true);
      setQueueError(null);

      try {
        const data = await getQueue();
        setProspects(data);

        try {
          const latestOutcomes = await Promise.all(
            data.map(async (prospect) => {
              if (typeof prospect.contactId !== "number") {
                return [prospect.id, null] as const;
              }

              const outcomes = await getCallOutcomesForContact(prospect.contactId);
              return [prospect.id, outcomes[0] ?? null] as const;
            }),
          );
          const outcomesByProspectId = latestOutcomes.reduce<Record<number, CallOutcome>>(
            (acc, [prospectId, outcome]) => {
              if (outcome) {
                acc[prospectId] = outcome;
              }

              return acc;
            },
            {},
          );
          const restoredCompletedIds = Object.keys(outcomesByProspectId).map(Number);

          setSavedOutcomesByProspectId(outcomesByProspectId);
          setCompletedIds(restoredCompletedIds);
          setCallsCompleted(restoredCompletedIds.length);
          setConversations(
            Object.values(outcomesByProspectId).filter(
              (outcome) => outcome.disposition === "Conversation" || outcome.disposition === "Meeting Booked",
            ).length,
          );
          setMeetings(
            Object.values(outcomesByProspectId).filter((outcome) => outcome.disposition === "Meeting Booked").length,
          );
          setSignalsRemaining(Math.max(0, 25 - restoredCompletedIds.length));
        } catch (error) {
          console.warn("Call outcomes are not available yet:", error);
        }
      } catch (error) {
        console.error("Failed to load queue:", error);
        setQueueError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setQueueLoading(false);
      }
    }

    loadQueue();
  }, []);

  useEffect(() => {
    async function loadCompanies() {
      setCompaniesLoading(true);
      setCompaniesError(null);

      try {
        const data = await getCompanies();
        setCompanies(data);
      } catch (error) {
        console.error("Failed to load companies:", error);
        setCompaniesError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setCompaniesLoading(false);
      }
    }

    loadCompanies();
  }, []);

  const toggleExpanded = (prospectId: number) => {
    setExpandedProspectId((current) => (current === prospectId ? null : prospectId));
  };

  const startConversation = (prospectId: number) => {
    const savedOutcome = savedOutcomesByProspectId[prospectId];

    setExpandedProspectId(prospectId);
    setActiveDispositionId(prospectId);
    setSelectedDisposition(savedOutcome?.disposition ?? null);
    setNotes(savedOutcome?.notes ?? "");
    setOutcomeError(null);
  };

  const cancelDisposition = () => {
    setActiveDispositionId(null);
    setSelectedDisposition(null);
    setNotes("");
    setOutcomeError(null);
  };

  const saveOutcome = async (prospectId: number) => {
    if (!selectedDisposition) {
      return;
    }

    const prospect = prospects.find((item) => item.id === prospectId);

    if (!prospect) {
      setOutcomeError("Could not find the selected prospect. Refresh the queue and try again.");
      return;
    }

    if (typeof prospect.contactId !== "number") {
      setOutcomeError("This prospect is missing a Supabase contact id, so the outcome cannot be saved.");
      return;
    }

    const wasCompleted = completedIds.includes(prospectId);

    setSavingOutcomeId(prospectId);
    setOutcomeError(null);

    try {
      const savedOutcome = await saveCallOutcome({
        contactId: prospect.contactId,
        signalId: prospect.signalDatabaseId ?? null,
        disposition: selectedDisposition,
        notes,
      });

      const nextCompletedIds = wasCompleted ? completedIds : [...completedIds, prospectId];
      const nextExpandedProspectId = findNextIncompleteProspectId(prospectId, nextCompletedIds, prospects);

      setSavedOutcomesByProspectId((current) => ({
        ...current,
        [prospectId]: savedOutcome,
      }));
      setCompletedIds(nextCompletedIds);
      setExpandedProspectId(nextExpandedProspectId);
      setActiveDispositionId(null);
      setSelectedDisposition(null);
      setNotes("");

      if (!wasCompleted) {
        setSignalsRemaining((current) => Math.max(0, current - 1));
        setCallsCompleted((current) => current + 1);

        if (selectedDisposition === "Conversation" || selectedDisposition === "Meeting Booked") {
          setConversations((current) => current + 1);
        }

        if (selectedDisposition === "Meeting Booked") {
          setMeetings((current) => current + 1);
        }
      }
    } catch (error) {
      console.error("Failed to save outcome:", error);
      setOutcomeError(error instanceof Error ? error.message : "Failed to save call outcome. Try again.");
    } finally {
      setSavingOutcomeId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Header />
        <MissionBar
          signalsRemaining={signalsRemaining}
          callsCompleted={callsCompleted}
          conversations={conversations}
          meetings={meetings}
        />
        {!queueLoading && !queueError && prospects.length > 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            <button
              type="button"
              onClick={() => setIsTopRankWhyOpen((current) => !current)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              Why was this ranked #1?
              <span className="text-slate-400">{isTopRankWhyOpen ? "▾" : "▸"}</span>
            </button>

            {isTopRankWhyOpen ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  Opportunity Score: {prospects[0].opportunityScore ?? 0}
                </p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Breakdown
                </p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {(prospects[0].opportunityBreakdown || []).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="font-semibold text-slate-800">+{item.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {queueLoading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-600 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Loading live queue...
          </div>
        ) : queueError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Failed to load live queue: {queueError}
          </div>
        ) : (
          <Queue
            prospects={prospects}
            completedIds={completedIds}
            expandedProspectId={expandedProspectId}
            activeDispositionId={activeDispositionId}
            selectedDisposition={selectedDisposition}
            notes={notes}
            savedOutcomesByProspectId={savedOutcomesByProspectId}
            savingOutcomeId={savingOutcomeId}
            outcomeError={outcomeError}
            onToggleExpanded={toggleExpanded}
            onStartConversation={startConversation}
            onDispositionChange={setSelectedDisposition}
            onNotesChange={setNotes}
            onSaveOutcome={saveOutcome}
            onCancelDisposition={cancelDisposition}
          />
        )}
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                Company Sources
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {companiesLoading
                  ? "Loading companies..."
                  : companiesError
                    ? companiesError
                    : `${companies.length} companies from Supabase`}
              </p>
            </div>

            {!companiesLoading && !companiesError && companies.length > 0 ? (
              <div className="space-y-2">
                {companies.map((company) => (
                  <div key={company.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-slate-900">{company.name}</p>
                      <div className="flex flex-wrap gap-2 text-[12px] text-slate-600">
                        <span>{company.industry}</span>
                        <span>•</span>
                        <span>{company.state}</span>
                        <span>•</span>
                        <span>{company.employee_count.toLocaleString()} employees</span>
                        <span>•</span>
                        <span className={company.is_target_account ? "font-medium text-emerald-700" : "text-slate-500"}>
                          {company.is_target_account ? "Target Account: Yes" : "Target Account: No"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-center text-sm text-slate-500">Loaded {prospects.length} live prospects</p>
      </div>
    </main>
  );
}
