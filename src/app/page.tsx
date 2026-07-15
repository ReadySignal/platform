"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { MissionBar } from "../components/MissionBar";
import { Queue } from "../components/Queue";
import { TopNavigation } from "../components/TopNavigation";
import { getCallOutcomesForContactsBetween, saveCallOutcome, updateCallOutcome } from "../services/callOutcomeService";
import { getQueue } from "../services/queueService";
import type { CallOutcome } from "../types/CallOutcome";
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

function getLocalTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getLatestOutcomesByProspectId(prospects: Prospect[], outcomes: CallOutcome[]) {
  const prospectIdByContactId = new Map<number, number>();

  for (const prospect of prospects) {
    if (typeof prospect.contactId === "number") {
      prospectIdByContactId.set(prospect.contactId, prospect.id);
    }
  }

  return outcomes.reduce<Record<number, CallOutcome>>((acc, outcome) => {
    const prospectId = prospectIdByContactId.get(outcome.contactId);

    if (typeof prospectId !== "number") {
      return acc;
    }

    const current = acc[prospectId];
    if (!current || new Date(outcome.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      acc[prospectId] = outcome;
    }

    return acc;
  }, {});
}

function calculateProgress(prospects: Prospect[], outcomesByProspectId: Record<number, CallOutcome>) {
  const latestOutcomes = Object.values(outcomesByProspectId);
  const completedCount = latestOutcomes.length;

  return {
    completedIds: Object.keys(outcomesByProspectId).map(Number),
    opportunitiesRemaining: Math.max(0, prospects.length - completedCount),
    callsCompleted: completedCount,
    conversations: latestOutcomes.filter(
      (outcome) => outcome.disposition === "Conversation" || outcome.disposition === "Meeting Booked",
    ).length,
    meetings: latestOutcomes.filter((outcome) => outcome.disposition === "Meeting Booked").length,
  };
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
  const [outcomeMode, setOutcomeMode] = useState<"create" | "edit">("create");
  const [opportunitiesRemaining, setOpportunitiesRemaining] = useState(0);
  const [callsCompleted, setCallsCompleted] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [meetings, setMeetings] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      setQueueLoading(true);
      setQueueError(null);

      try {
        const includeDemo =
          typeof window !== "undefined" && new URLSearchParams(window.location.search).get("showDemo") === "1";
        const data = await getQueue({ includeDemo });
        setProspects(data);
        setOpportunitiesRemaining(data.length);

        try {
          const { startIso, endIso } = getLocalTodayRange();
          const contactIds = data
            .map((prospect) => prospect.contactId)
            .filter((contactId): contactId is number => typeof contactId === "number");
          const todayOutcomes = await getCallOutcomesForContactsBetween(contactIds, startIso, endIso);
          const outcomesByProspectId = getLatestOutcomesByProspectId(data, todayOutcomes);
          const restoredProgress = calculateProgress(data, outcomesByProspectId);

          setSavedOutcomesByProspectId(outcomesByProspectId);
          setCompletedIds(restoredProgress.completedIds);
          setOpportunitiesRemaining(restoredProgress.opportunitiesRemaining);
          setCallsCompleted(restoredProgress.callsCompleted);
          setConversations(restoredProgress.conversations);
          setMeetings(restoredProgress.meetings);
          setExpandedProspectId(
            data.find((prospect) => !restoredProgress.completedIds.includes(prospect.id))?.id ?? null,
          );
        } catch (error) {
          console.warn("Today call outcomes are not available yet:", error);
          setExpandedProspectId(data[0]?.id ?? null);
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
      const nextProgress = calculateProgress(prospects, nextOutcomesByProspectId);
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
