"use client";

import Link from "next/link";
import { useState } from "react";
import type { CallOutcome } from "../types/CallOutcome";
import type { Prospect } from "../types/Prospect";
import { calculateSignalScore } from "../lib/signalEngine";
import { getSignalCategory, getSignalStyleClasses } from "../lib/signalLibrary";
import { ConfidenceScore } from "./ConfidenceScore";
import { DispositionPanel } from "./DispositionPanel";

type ProspectCardProps = {
  prospect: Prospect;
  index: number;
  isExpanded: boolean;
  isDispositionOpen: boolean;
  isCompleted: boolean;
  selectedDisposition: string | null;
  notes: string;
  savedOutcome: CallOutcome | null;
  isSavingOutcome: boolean;
  outcomeError: string | null;
  onToggleExpanded: () => void;
  onStartConversation: () => void;
  onLogAnotherAttempt: () => void;
  onDispositionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSaveOutcome: () => void;
  onCancelDisposition: () => void;
};

export function ProspectCard({
  prospect,
  index,
  isExpanded,
  isDispositionOpen,
  isCompleted,
  selectedDisposition,
  notes,
  savedOutcome,
  isSavingOutcome,
  outcomeError,
  onToggleExpanded,
  onStartConversation,
  onLogAnotherAttempt,
  onDispositionChange,
  onNotesChange,
  onSaveOutcome,
  onCancelDisposition,
}: ProspectCardProps) {
  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const signal = calculateSignalScore(prospect);
  const signalCategory = getSignalCategory(prospect.signalId);
  const signalStyleClasses = getSignalStyleClasses(signalCategory.style);

  const formatOccurredDate = (occurredAt: string | null) => {
    if (!occurredAt) {
      return "Date unavailable";
    }

    const parsed = new Date(occurredAt);
    if (Number.isNaN(parsed.getTime())) {
      return "Date unavailable";
    }

    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const savedOutcomeDate = savedOutcome ? formatOccurredDate(savedOutcome.createdAt) : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)] transition duration-200">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-slate-900">{prospect.name}</p>
              <span className="text-sm text-slate-400">•</span>
              <p className="truncate text-sm text-slate-600">{prospect.title}</p>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {prospect.companyId ? (
                <Link
                  href={`/companies/${prospect.companyId}`}
                  className="truncate font-medium text-slate-700 transition hover:text-slate-950"
                >
                  {prospect.company}
                </Link>
              ) : (
                <span className="truncate">{prospect.company}</span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
                {signal.score}%
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium ${signalStyleClasses}`}>
                {signalCategory.label}
              </span>
              <span className="truncate text-slate-500">{prospect.whyTodayReason}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isCompleted ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Completed
            </span>
          ) : null}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            {isExpanded ? "Close" : "Open"}
          </button>
          <div className="text-sm font-medium text-slate-400">{isExpanded ? "▾" : "▸"}</div>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Phone
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{prospect.directPhone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Mobile
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{prospect.mobilePhone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Email
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{prospect.email}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Relevant Context
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{prospect.notes}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Signal Timeline
                </p>

                {prospect.signals.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {prospect.signals.map((signalItem) => {
                      const signalItemCategory = getSignalCategory(signalItem.signalType);

                      return (
                        <div
                          key={signalItem.id}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {signalItemCategory.label}
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              +{signalItem.scorePoints}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">{signalItem.headline}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatOccurredDate(signalItem.occurredAt)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No additional active signals.</p>
                )}
              </div>

              <ConfidenceScore prospect={prospect} />

              <div>
                <button
                  type="button"
                  onClick={() => setIsWhyOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Why {signal.score}%?
                  <span className="text-slate-400">{isWhyOpen ? "▾" : "▸"}</span>
                </button>

                {isWhyOpen ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="space-y-2 text-sm text-slate-700">
                      {signal.breakdown.map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-slate-900">{item.label}</p>
                            <span className="text-sm font-semibold text-slate-600">+{item.points}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">
                            {item.label === "Timing Signal"
                              ? `${signalCategory.label}: ${signalCategory.description}`
                              : item.points > 0
                                ? `${item.label} contributed to the signal score.`
                                : `${item.label} did not contribute to the current score.`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Call outcome
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Capture the outcome for {prospect.name} and keep the queue moving.
              </p>
              {savedOutcome ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                  <p className="font-semibold">{savedOutcome.disposition}</p>
                  {savedOutcome.notes ? <p className="mt-1 leading-6">{savedOutcome.notes}</p> : null}
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Saved {savedOutcomeDate}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={savedOutcome ? onLogAnotherAttempt : onStartConversation}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-slate-700"
              >
                {savedOutcome ? "Log another attempt" : "Start Conversation"}
              </button>

              {isDispositionOpen ? (
                <div className="mt-4">
                  <DispositionPanel
                    selectedDisposition={selectedDisposition}
                    notes={notes}
                    isSaving={isSavingOutcome}
                    error={outcomeError}
                    onDispositionChange={onDispositionChange}
                    onNotesChange={onNotesChange}
                    onSave={onSaveOutcome}
                    onCancel={onCancelDisposition}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
