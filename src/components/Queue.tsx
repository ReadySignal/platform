import Link from "next/link";
import { useState } from "react";
import type { CallOutcome } from "../types/CallOutcome";
import type { MissionOutcome } from "../types/MissionOutcome";
import type { Prospect } from "../types/Prospect";
import { calculateSignalScore } from "../lib/signalEngine";
import { getSignalCategory } from "../lib/signalLibrary";

type QueueProps = {
  prospects: Prospect[];
  completedIds: number[];
  savedOutcomesByProspectId: Record<number, CallOutcome>;
  missionOutcomesByProspectId: Record<number, MissionOutcome>;
  onCompleteConversation: (prospectId: number) => void;
  onEditOutcome: (prospectId: number) => void;
  onLogAnotherAttempt: (prospectId: number) => void;
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

function ReadinessDisclosure({ indicators }: { indicators: Array<{ label: string; active: boolean; status: string }> }) {
  const readyCount = indicators.filter((indicator) => indicator.active).length;

  return (
    <details className="rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
        <span>Before You Call &middot; {readyCount} of {indicators.length} ready</span>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Details</span>
      </summary>
      <div className="grid gap-2 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
        {indicators.map((indicator) => (
          <div key={indicator.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{indicator.label}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                indicator.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
              }`}
            >
              {indicator.status}
            </span>
          </div>
        ))}
      </div>
    </details>
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
  onCompleteConversation,
}: {
  prospect: Prospect;
  onCompleteConversation: () => void;
}) {
  const signal = calculateSignalScore(prospect);
  const signalCategory = getSignalCategory(prospect.signalId);
  const beforeCallIndicators = [
    {
      label: "Verified contact",
      active: Boolean(prospect.verifiedContact),
      status: prospect.verifiedContact ? "Ready" : "Missing",
    },
    {
      label: "Previous outreach",
      active: Boolean(prospect.noPreviousOutreach),
      status: prospect.noPreviousOutreach ? "None" : "Review",
    },
    {
      label: "Target account",
      active: Boolean(prospect.targetAccount),
      status: prospect.targetAccount ? "Yes" : "No",
    },
    {
      label: "Relevant context",
      active: Boolean(prospect.relevantContext),
      status: prospect.relevantContext ? "Ready" : "Limited",
    },
    {
      label: "Title fit",
      active: Boolean(prospect.titleMatch),
      status: prospect.titleMatch ? "Ready" : "Limited",
    },
    {
      label: "Company fit",
      active: Boolean(prospect.companySizeMatch || prospect.targetIndustry || prospect.targetState),
      status: prospect.companySizeMatch || prospect.targetIndustry || prospect.targetState ? "Ready" : "Limited",
    },
  ];
  const whyTodayLabel = prospect.whyTodayLabel || signalCategory.label;

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
            <p className="mt-3 text-base font-semibold text-slate-950">{whyTodayLabel}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{prospect.whyTodayReason || prospect.reason}</p>
            {prospect.signalOccurredAt ? (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Signal date: {new Date(prospect.signalOccurredAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>

        {prospect.callBrief ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-700">Call Brief</p>
            <div className="mt-3 grid gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-950">Why this contact</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{prospect.callBrief.whyThisContact}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Conversation angle</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{prospect.callBrief.conversationAngle}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Discovery Questions</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {prospect.callBrief.discoveryQuestions.map((question) => (
                    <li key={question} className="text-sm leading-6 text-slate-700">
                      {question}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ) : null}

        <ReadinessDisclosure indicators={beforeCallIndicators} />

        {!prospect.callBrief ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">Context</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{getContextSummary(prospect)}</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">Action</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">After the call, record the outcome so tomorrow&apos;s Mission can improve.</p>
            <button
              type="button"
              onClick={onCompleteConversation}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Complete Conversation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Queue({
  prospects,
  completedIds,
  savedOutcomesByProspectId,
  missionOutcomesByProspectId,
  onCompleteConversation,
  onEditOutcome,
  onLogAnotherAttempt,
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
          onCompleteConversation={() => onCompleteConversation(nextProspect.id)}
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
              const missionOutcome = missionOutcomesByProspectId[prospect.id];

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
                        {missionOutcome?.outcome ?? savedOutcome?.disposition ?? "Saved outcome"} |{" "}
                        {formatDateTime(missionOutcome?.occurredAt ?? savedOutcome?.createdAt ?? null)}
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

                  {reviewProspectId === prospect.id && (savedOutcome || missionOutcome) ? (
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
                              <dd className="text-slate-900">{missionOutcome?.outcome ?? savedOutcome?.disposition}</dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500">Learning</dt>
                              <dd className="text-slate-900">
                                {missionOutcome?.learnedSignal ?? savedOutcome?.notes ?? "No learning saved."}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-semibold text-slate-500">Completed</dt>
                              <dd className="text-slate-900">
                                {formatDateTime(missionOutcome?.occurredAt ?? savedOutcome?.createdAt ?? null)}
                              </dd>
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
