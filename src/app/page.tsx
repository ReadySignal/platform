"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import { MissionBar } from "../components/MissionBar";
import { MissionOutcomeDialog } from "../components/MissionOutcomeDialog";
import { Queue } from "../components/Queue";
import { TopNavigation } from "../components/TopNavigation";
import { getTodaysMission } from "../services/missionEngine";
import type { CallOutcome } from "../types/CallOutcome";
import type { MissionOutcome, NewMissionOutcome } from "../types/MissionOutcome";
import type { Prospect } from "../types/Prospect";

export default function Home() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueRefreshing, setQueueRefreshing] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<number[]>([]);
  const [savedOutcomesByProspectId, setSavedOutcomesByProspectId] = useState<Record<number, CallOutcome>>({});
  const [missionOutcomesByProspectId, setMissionOutcomesByProspectId] = useState<Record<number, MissionOutcome>>({});
  const [missionOutcomeProspectId, setMissionOutcomeProspectId] = useState<number | null>(null);
  const [editingMissionOutcomeId, setEditingMissionOutcomeId] = useState<number | null>(null);
  const [savingMissionOutcome, setSavingMissionOutcome] = useState(false);
  const [missionOutcomeError, setMissionOutcomeError] = useState<string | null>(null);
  const [opportunitiesRemaining, setOpportunitiesRemaining] = useState(0);
  const [callsCompleted, setCallsCompleted] = useState(0);
  const [conversations, setConversations] = useState(0);
  const [meetings, setMeetings] = useState(0);
  const loadRequestIdRef = useRef(0);

  const loadQueue = useCallback(async (options: { initial?: boolean; showSuccess?: boolean; reconcile?: boolean } = {}) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
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

        if (requestId !== loadRequestIdRef.current) {
          return;
        }

        setProspects(data);
        setSavedOutcomesByProspectId(todaysMission.outcomesByProspectId);
        setMissionOutcomesByProspectId(todaysMission.missionOutcomesByProspectId);
        setCompletedIds(todaysMission.progress.completedIds);
        setOpportunitiesRemaining(todaysMission.progress.opportunitiesRemaining);
        setCallsCompleted(todaysMission.progress.callsCompleted);
        setConversations(todaysMission.progress.conversations);
        setMeetings(todaysMission.progress.meetings);
        if (options.showSuccess) {
          setRefreshMessage(
            contactsAdded > 0
              ? `Opportunities updated \u00b7 ${contactsAdded} added`
              : "Opportunities are already up to date.",
          );
        }
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        console.error("Failed to load queue:", error);
        setQueueError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setQueueLoading(false);
          setQueueRefreshing(false);
        }
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

  const completeConversation = (prospectId: number) => {
    setMissionOutcomeProspectId(prospectId);
    setEditingMissionOutcomeId(null);
    setMissionOutcomeError(null);
  };

  const editOutcome = (prospectId: number) => {
    const missionOutcome = missionOutcomesByProspectId[prospectId];
    if (missionOutcome) {
      setMissionOutcomeProspectId(prospectId);
      setEditingMissionOutcomeId(missionOutcome.id);
      setMissionOutcomeError(null);
      return;
    }

    setMissionOutcomeError("This is a historical call outcome. New activity is recorded with Complete Conversation.");
  };

  const saveMissionOutcome = async (outcome: NewMissionOutcome) => {
    setSavingMissionOutcome(true);
    setMissionOutcomeError(null);

    try {
      const response = await fetch(
        editingMissionOutcomeId ? `/api/mission-outcomes/${editingMissionOutcomeId}` : "/api/mission-outcomes",
        {
        method: editingMissionOutcomeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcome),
        },
      );
      const payload = (await response.json()) as { error?: string; outcome?: MissionOutcome };

      if (!response.ok || !payload.outcome) {
        throw new Error(payload.error || "Failed to save mission outcome.");
      }

      setMissionOutcomeProspectId(null);
      setEditingMissionOutcomeId(null);
      await loadQueue();
    } catch (error) {
      setMissionOutcomeError(error instanceof Error ? error.message : "Failed to save mission outcome.");
    } finally {
      setSavingMissionOutcome(false);
    }
  };

  const isQueueComplete = prospects.length > 0 && completedIds.length === prospects.length;
  const missionOutcomeProspect = prospects.find((prospect) => prospect.id === missionOutcomeProspectId) ?? null;
  const editingMissionOutcome = editingMissionOutcomeId
    ? Object.values(missionOutcomesByProspectId).find((outcome) => outcome.id === editingMissionOutcomeId) ?? null
    : null;

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
        ) : prospects.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
            <p className="text-sm font-semibold text-slate-900">No ready opportunities yet.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Import contacts, run company research, or refresh after research completes to build Today&apos;s Mission.
            </p>
          </div>
        ) : isQueueComplete ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm font-semibold text-emerald-800 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.4)]">
              Today&apos;s queue is complete.
            </div>
            <Queue
              prospects={prospects}
              completedIds={completedIds}
              savedOutcomesByProspectId={savedOutcomesByProspectId}
              missionOutcomesByProspectId={missionOutcomesByProspectId}
              onCompleteConversation={completeConversation}
              onEditOutcome={editOutcome}
              onLogAnotherAttempt={completeConversation}
            />
          </>
        ) : (
          <Queue
            prospects={prospects}
            completedIds={completedIds}
            savedOutcomesByProspectId={savedOutcomesByProspectId}
            missionOutcomesByProspectId={missionOutcomesByProspectId}
            onCompleteConversation={completeConversation}
            onEditOutcome={editOutcome}
            onLogAnotherAttempt={completeConversation}
          />
        )}
        {missionOutcomeProspect ? (
          <MissionOutcomeDialog
            prospect={missionOutcomeProspect}
            isSaving={savingMissionOutcome}
            error={missionOutcomeError}
            initialOutcome={editingMissionOutcome}
            onSave={saveMissionOutcome}
            onClose={() => {
              if (!savingMissionOutcome) {
                setMissionOutcomeProspectId(null);
                setEditingMissionOutcomeId(null);
                setMissionOutcomeError(null);
              }
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
