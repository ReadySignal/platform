"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Header } from "../components/Header";
import { MissionBar } from "../components/MissionBar";
import { Queue } from "../components/Queue";
import { TopNavigation } from "../components/TopNavigation";
import { saveCallOutcome, updateCallOutcome } from "../services/callOutcomeService";
import { calculateMissionProgress, getTodaysMission } from "../services/missionEngine";
import type { CallOutcome } from "../types/CallOutcome";
import type { Mission } from "../types/Mission";
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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [savedOutcomesByProspectId, setSavedOutcomesByProspectId] = useState<Record<number, CallOutcome>>({});
  const [expandedProspectId, setExpandedProspectId] = useState<number | null>(null);
  const [activeDispositionId, setActiveDispositionId] = useState<number | null>(null);
  const [selectedDisposition, setSelectedDisposition] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [savingOutcomeId, setSavingOutcomeId] = useState<number | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeMode, setOutcomeMode] = useState<"create" | "edit">("create");
  const [opportunitiesRemaining, setOpportunitiesRemaining] = useState(0);
  const [callsCompleted, setCallsCompleted] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [meetings, setMeetings] = useState(0);

  const loadQueue = useCallback(async (options: { initial?: boolean; showSuccess?: boolean; reconcile?: boolean } = {}) => {
    const initial = options.initial ?? false;
    if (initial) {
      setQueueLoading(true);
    } else {
      setQueueRefreshing(true);
    }
      setQueueError(null);
      setRefreshMessage(null);

      try {
        let contactsAdded = 0;

        if (options.reconcile) {
          const response = await fetch("/api/opportunities/reconcile", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          const payload = (await response.json()) as {
            error?: string;
            result?: { contactsAdded: number };
          };

          if (!response.ok) {
            throw new Error(payload.error || "Failed to reconcile researched opportunities.");
          }

          contactsAdded = payload.result?.contactsAdded ?? 0;
        }

        const includeDemo =
          typeof window !== "undefined" && new URLSearchParams(window.location.search).get("showDemo") === "1";
        const todaysMission = await getTodaysMission({ includeDemo });
        const data = todaysMission.missions.map((mission) => mission.prospect);

        setMissions(todaysMission.missions);
        setProspects(data);
        setSavedOutcomesByProspectId(todaysMission.outcomesByProspectId);
        setCompletedIds(todaysMission.progress.completedIds);
        setOpportunitiesRemaining(todaysMission.progress.opportunitiesRemaining);
        setCallsCompleted(todaysMission.progress.callsCompleted);
        setConversations(todaysMission.progress.conversations);
        setMeetings(todaysMission.progress.meetings);
        setExpandedProspectId((current) => {
          if (current && todaysMission.missions.some((mission) => mission.id === current)) {
            return current;
          }

          return todaysMission.nextMissionId;
        });

        if (options.showSuccess) {
          setRefreshMessage(
            contactsAdded > 0
              ? `Opportunities updated \u00b7 ${contactsAdded} added`
              : "Opportunities are already up to date.",
          );
        }
      } catch (error) {
        console.error("Failed to load queue:", error);
        setQueueError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setQueueLoading(false);
        setQueueRefreshing(false);
      }
  }, []);

  useEffect(() => {
    loadQueue({ initial: true });
  }, [loadQueue]);

  useEffect(() => {
    function handleFocus() {
      if (document.visibilityState === "visible") {
        loadQueue();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [loadQueue]);

  const toggleExpanded = (prospectId: number) => {
    setExpandedProspectId((current) => (current === prospectId ? null : prospectId));
  };

  const startConversation = (prospectId: number) => {
    setExpandedProspectId(prospectId);
    setActiveDispositionId(prospectId);
    setSelectedDisposition(null);
    setNotes("");
    setOutcomeError(null);
    setOutcomeMode("create");
  };

  const editOutcome = (prospectId: number) => {
    const savedOutcome = savedOutcomesByProspectId[prospectId];

    if (!savedOutcome) {
      setOutcomeError("No saved outcome is available to edit.");
      return;
    }

    setExpandedProspectId(prospectId);
    setActiveDispositionId(prospectId);
    setSelectedDisposition(savedOutcome.disposition);
    setNotes(savedOutcome.notes ?? "");
    setOutcomeError(null);
    setOutcomeMode("edit");
  };

  const cancelDisposition = () => {
    setActiveDispositionId(null);
    setSelectedDisposition(null);
    setNotes("");
    setOutcomeError(null);
    setOutcomeMode("create");
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

    setSavingOutcomeId(prospectId);
    setOutcomeError(null);

    try {
      const existingOutcome = savedOutcomesByProspectId[prospectId];
      const savedOutcome =
        outcomeMode === "edit" && existingOutcome
          ? await updateCallOutcome(existingOutcome.id, {
              disposition: selectedDisposition,
              notes,
            })
          : await saveCallOutcome({
              contactId: prospect.contactId,
              signalId: prospect.signalDatabaseId ?? null,
              disposition: selectedDisposition,
              notes,
            });
      const nextOutcomesByProspectId = {
        ...savedOutcomesByProspectId,
        [prospectId]: savedOutcome,
      };
      const nextProgress = calculateMissionProgress(missions, nextOutcomesByProspectId);
      const nextExpandedProspectId = findNextIncompleteProspectId(prospectId, nextProgress.completedIds, prospects);

      setSavedOutcomesByProspectId(nextOutcomesByProspectId);
      setCompletedIds(nextProgress.completedIds);
      setOpportunitiesRemaining(nextProgress.opportunitiesRemaining);
      setCallsCompleted(nextProgress.callsCompleted);
      setConversations(nextProgress.conversations);
      setMeetings(nextProgress.meetings);
      setExpandedProspectId(nextExpandedProspectId);
      setActiveDispositionId(null);
      setSelectedDisposition(null);
      setNotes("");
      setOutcomeMode("create");
    } catch (error) {
      console.error("Failed to save outcome:", error);
      setOutcomeError(error instanceof Error ? error.message : "Failed to save call outcome. Try again.");
    } finally {
      setSavingOutcomeId(null);
    }
  };

  const isQueueComplete = prospects.length > 0 && completedIds.length === prospects.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <TopNavigation />
        <Header
          opportunitiesRemaining={opportunitiesRemaining}
          callsCompleted={callsCompleted}
          conversations={conversations}
          meetings={meetings}
        />
        <section className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_10px_35px_-28px_rgba(15,23,42,0.4)]">
          <Link
            href="/import"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Add Contacts
          </Link>
          <Link
            href="/research"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            View Research Queue
          </Link>
          <button
            type="button"
            onClick={() => loadQueue({ showSuccess: true, reconcile: true })}
            disabled={queueRefreshing}
            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {queueRefreshing ? "Refreshing..." : "Refresh Opportunities"}
          </button>
          {refreshMessage ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {refreshMessage}
            </span>
          ) : null}
        </section>
        <MissionBar
          opportunitiesRemaining={opportunitiesRemaining}
          callsCompleted={callsCompleted}
          conversations={conversations}
          meetings={meetings}
        />
        {queueLoading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-600 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Loading live queue...
          </div>
        ) : queueError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            Failed to load live queue: {queueError}
          </div>
        ) : isQueueComplete ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm font-semibold text-emerald-800 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
              Today&apos;s queue is complete.
            </div>
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
              onEditOutcome={editOutcome}
              onLogAnotherAttempt={startConversation}
              onDispositionChange={setSelectedDisposition}
              onNotesChange={setNotes}
              onSaveOutcome={saveOutcome}
              onCancelDisposition={cancelDisposition}
            />
          </>
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
            onEditOutcome={editOutcome}
            onLogAnotherAttempt={startConversation}
            onDispositionChange={setSelectedDisposition}
            onNotesChange={setNotes}
            onSaveOutcome={saveOutcome}
            onCancelDisposition={cancelDisposition}
          />
        )}
      </div>
    </main>
  );
}
