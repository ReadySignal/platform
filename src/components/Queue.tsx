import Link from "next/link";
import { useState } from "react";
import type { CallOutcome } from "../types/CallOutcome";
import type { Prospect } from "../types/Prospect";
import { calculateSignalScore } from "../lib/signalEngine";
import { getSignalCategory } from "../lib/signalLibrary";
import { DispositionPanel } from "./DispositionPanel";

type QueueProps = {
  prospects: Prospect[];
  completedIds: number[];
  expandedProspectId: number | null;
  activeDispositionId: number | null;
  selectedDisposition: string | null;
  notes: string;
  savedOutcomesByProspectId: Record<number, CallOutcome>;
  savingOutcomeId: number | null;
  outcomeError: string | null;
  onToggleExpanded: (prospectId: number) => void;
  onStartConversation: (prospectId: number) => void;
  onEditOutcome: (prospectId: number) => void;
  onLogAnotherAttempt: (prospectId: number) => void;
  onDispositionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSaveOutcome: (prospectId: number) => void;
  onCancelDisposition: () => void;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Time unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Time unavailable";
  }

  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getContextSummary(prospect: Prospect) {
  const source = prospect.notes || prospect.whyTodayReason || prospect.reason;
  const [firstSentence] = source.split(/(?<=[.!?])\s+/);
  return firstSentence || source;
}

function ConfidenceBreakdown({ prospect }: { prospect: Prospect }) {
  const signal = calculateSignalScore(prospect);

  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Confidence</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">{signal.score}%</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-600">
            Breakdown
          </span>
        </div>
      </summary>
      <div className="mt-4 space-y-2">
        {signal.breakdown.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm text-slate-600">
                {item.points > 0 ? `${item.label} supports this call.` : `${item.label} is not adding confidence yet.`}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-700">+{item.points}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        active ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs">{active ? "Confirmed" : "Needs attention"}</p>
    </div>
  );
}

function CompanyLink({ prospect, className }: { prospect: Prospect; className: string }) {
  if (!prospect.companyId) {
    return <span className={className}>{prospect.company}</span>;
  }

  return (
    <Link
      href={`/companies/${prospect.companyId}`}
      className={`${className} font-medium underline decoration-slate-300 underline-offset-4 transition hover:text-slate-950 hover:decoration-slate-500`}
    >
      {prospect.company}
    </Link>
  );
}

function PrimaryWorkspace({
  prospect,
  isDispositionOpen,
  selectedDisposition,
  notes,
  isSavingOutcome,
  outcomeError,
  onStartConversation,
  onDispositionChange,
  onNotesChange,
  onSaveOutcome,
  onCancelDisposition,
}: {
  prospect: Prospect;
  isDispositionOpen: boolean;
  selectedDisposition: string | null;
  notes: string;
  isSavingOutcome: boolean;
  outcomeError: string | null;
  onStartConversation: () => void;
  onDispositionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSaveOutcome: () => void;
  onCancelDisposition: () => void;
}) {
  const signal = calculateSignalScore(prospect);
  const signalCategory = getSignalCategory(prospect.signalId);
  const beforeCallIndicators = [
    { label: "Verified contact", active: Boolean(prospect.verifiedContact) },
    { label: "No previous outreach", active: Boolean(prospect.noPreviousOutreach) },
    { label: "Target account", active: Boolean(prospect.targetAccount) },
    { label: "Relevant context", active: Boolean(prospect.relevantContext) },
    { label: "Title fit", active: Boolean(prospect.titleMatch) },
    { label: "Company fit", active: Boolean(prospect.companySizeMatch || prospect.targetIndustry || prospect.targetState) },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.5)] sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Next Opportunity</p>
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Who</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{prospect.name}</h1>
              <p className="mt-2 text-base text-slate-600">{prospect.title}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
                <CompanyLink prospect={prospect} className="text-slate-600" />
                <span>|</span>
                <span>{prospect.location}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Confidence</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-950">{signal.score}%</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <ConfidenceBreakdown prospect={prospect} />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Why Today</p>
            <p className="mt-3 text-base font-semibold text-slate-950">{signalCategory.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{prospect.whyTodayReason || prospect.reason}</p>
            {prospect.signalOccurredAt ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Signal date: {new Date(prospect.signalOccurredAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Before You Call</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {beforeCallIndicators.map((indicator) => (
              <Indicator key={indicator.label} label={indicator.label} active={indicator.active} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Context</p>
          <p className="mt-3 text-sm leading-6 text-slate-700">{getContextSummary(prospect)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">Action</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">Open the disposition workspace when the call is underway.</p>
            <button
              type="button"
              onClick={onStartConversation}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Start Conversation
            </button>
          </div>

          {isDispositionOpen ? (
            <div className="mt-4 text-slate-950">
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
    </section>
  );
}

export function Queue({
  prospects,
  completedIds,
  activeDispositionId,
  selectedDisposition,
  notes,
  savedOutcomesByProspectId,
  savingOutcomeId,
  outcomeError,
  onStartConversation,
  onEditOutcome,
  onLogAnotherAttempt,
  onDispositionChange,
  onNotesChange,
  onSaveOutcome,
  onCancelDisposition,
}: QueueProps) {
  const [reviewProspectId, setReviewProspectId] = useState<number | null>(null);
  const nextProspect = prospects.find((prospect) => !completedIds.includes(prospect.id)) ?? null;
  const upcomingProspects = prospects.filter(
    (prospect) => !completedIds.includes(prospect.id) && prospect.id !== nextProspect?.id,
  );
  const completedProspects = prospects.filter((prospect) => completedIds.includes(prospect.id));

  return (
    <section className="space-y-4">
      {nextProspect ? (
        <PrimaryWorkspace
          prospect={nextProspect}
          isDispositionOpen={activeDispositionId === nextProspect.id}
          selectedDisposition={selectedDisposition}
          notes={notes}
          isSavingOutcome={savingOutcomeId === nextProspect.id}
          outcomeError={activeDispositionId === nextProspect.id ? outcomeError : null}
          onStartConversation={() => onStartConversation(nextProspect.id)}
          onDispositionChange={onDispositionChange}
          onNotesChange={onNotesChange}
          onSaveOutcome={() => onSaveOutcome(nextProspect.id)}
          onCancelDisposition={onCancelDisposition}
        />
      ) : null}

      <details className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
          Upcoming Opportunities ({upcomingProspects.length})
        </summary>
        <div className="mt-3 divide-y divide-slate-200">
          {upcomingProspects.length > 0 ? (
            upcomingProspects.map((prospect) => {
              const signal = calculateSignalScore(prospect);

              return (
                <div key={prospect.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{prospect.name}</p>
                    <CompanyLink prospect={prospect} className="mt-1 block truncate text-sm text-slate-500" />
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-700">
                    {signal.score}%
                  </span>
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-sm text-slate-500">No upcoming incomplete prospects.</p>
          )}
        </div>
      </details>

      <details className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.35)]">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
          Completed Today ({completedProspects.length})
        </summary>
        <div className="mt-3 divide-y divide-slate-200">
          {completedProspects.length > 0 ? (
            completedProspects.map((prospect) => {
              const savedOutcome = savedOutcomesByProspectId[prospect.id];
              const isDispositionOpen = activeDispositionId === prospect.id;

              return (
                <div key={prospect.id} className="py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setReviewProspectId((current) => (current === prospect.id ? null : prospect.id))}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{prospect.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {savedOutcome?.disposition ?? "Saved outcome"} | {formatDateTime(savedOutcome?.createdAt ?? null)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onLogAnotherAttempt(prospect.id)}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Log another attempt
                    </button>
                  </div>

                  {reviewProspectId === prospect.id && savedOutcome ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Completed Opportunity
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-950">{prospect.name}</p>
                          <CompanyLink prospect={prospect} className="mt-1 inline-block text-sm text-slate-600" />
                          <dl className="mt-3 grid gap-2 text-sm">
                            <div>
                              <dt className="font-semibold text-slate-500">Disposition</dt>
                              <dd className="text-slate-900">{savedOutcome.disposition}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500">Note</dt>
                              <dd className="text-slate-900">{savedOutcome.notes || "No note saved."}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500">Completed</dt>
                              <dd className="text-slate-900">{formatDateTime(savedOutcome.createdAt)}</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => onEditOutcome(prospect.id)}
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                          >
                            Edit outcome
                          </button>
                          <button
                            type="button"
                            onClick={() => onLogAnotherAttempt(prospect.id)}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Log another attempt
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isDispositionOpen ? (
                    <div className="mt-3">
                      <DispositionPanel
                        selectedDisposition={selectedDisposition}
                        notes={notes}
                        isSaving={savingOutcomeId === prospect.id}
                        error={outcomeError}
                        onDispositionChange={onDispositionChange}
                        onNotesChange={onNotesChange}
                        onSave={() => onSaveOutcome(prospect.id)}
                        onCancel={onCancelDisposition}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-sm text-slate-500">No completed prospects yet today.</p>
          )}
        </div>
      </details>
    </section>
  );
}
