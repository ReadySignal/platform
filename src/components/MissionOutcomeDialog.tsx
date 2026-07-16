import { useMemo, useState } from "react";
import type { MissionOutcome, MissionOutcomeValue, MissionLearnedSignal, NewMissionOutcome } from "../types/MissionOutcome";
import type { Prospect } from "../types/Prospect";

type MissionOutcomeDialogProps = {
  prospect: Prospect;
  isSaving: boolean;
  error: string | null;
  initialOutcome?: MissionOutcome | null;
  onSave: (outcome: NewMissionOutcome) => void;
  onClose: () => void;
};

const noConnectOutcomes: MissionOutcomeValue[] = ["Voicemail", "No Answer"];
const connectedOutcomes: MissionOutcomeValue[] = [
  "Meeting Booked",
  "Follow Up",
  "Wrong Person",
  "Timing",
  "No Budget",
  "Already Customer",
  "Not Interested",
  "Disqualified",
];
const learnedSignals: MissionLearnedSignal[] = [
  "Maintenance owns this",
  "Corporate owns this",
  "Plant owns this",
  "Reliability owns this",
  "Quality owns this",
  "Engineering owns this",
  "Budget next quarter",
  "Using competitor",
  "Already solved internally",
  "Other",
];

function getFollowUpDate(option: string) {
  const now = new Date();
  if (option === "tomorrow") return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9).toISOString();
  if (option === "next-week") return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 9).toISOString();
  if (option === "next-month") return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 9).toISOString();
  return null;
}

export function MissionOutcomeDialog({ prospect, isSaving, error, initialOutcome, onSave, onClose }: MissionOutcomeDialogProps) {
  const [clientSubmissionId] = useState(() => initialOutcome?.clientSubmissionId || crypto.randomUUID());
  const [step, setStep] = useState<"connected" | "outcome" | "follow-up" | "learning">(
    initialOutcome ? "learning" : "connected",
  );
  const [connected, setConnected] = useState<boolean | null>(initialOutcome?.connected ?? null);
  const [outcome, setOutcome] = useState<MissionOutcomeValue | null>(initialOutcome?.outcome ?? null);
  const [followUpChoice, setFollowUpChoice] = useState(initialOutcome?.followUpDate ? "custom" : "none");
  const [customFollowUpDate, setCustomFollowUpDate] = useState(
    initialOutcome?.followUpDate ? initialOutcome.followUpDate.slice(0, 10) : "",
  );
  const [learnedSignal, setLearnedSignal] = useState<MissionLearnedSignal | null>(
    (initialOutcome?.learnedSignal as MissionLearnedSignal | null) ?? null,
  );
  const [notes, setNotes] = useState(initialOutcome?.notes ?? "");

  const needsFollowUp = outcome === "Follow Up" || outcome === "Timing";
  const followUpTimingComplete =
    !needsFollowUp ||
    followUpChoice === "none" ||
    (followUpChoice === "custom" ? Boolean(customFollowUpDate) : Boolean(getFollowUpDate(followUpChoice)));
  const followUpDate = useMemo(() => {
    if (!needsFollowUp) return null;
    if (followUpChoice === "custom" && customFollowUpDate) {
      return new Date(`${customFollowUpDate}T09:00:00`).toISOString();
    }

    return getFollowUpDate(followUpChoice);
  }, [customFollowUpDate, followUpChoice, needsFollowUp]);

  function buildPayload(): NewMissionOutcome | null {
    if (connected === null || !outcome || !prospect.companyId) return null;
    return {
      missionId: String(prospect.id),
      companyId: Number(prospect.companyId),
      contactId: prospect.contactId ?? null,
      connected,
      outcome,
      followUpDate,
      recommendedNextAction: followUpDate ? `Follow up with ${prospect.name}.` : null,
      reason: learnedSignal,
      learnedSignal,
      notes,
      clientSubmissionId,
    };
  }

  function save() {
    const payload = buildPayload();
    if (payload && followUpTimingComplete) onSave(payload);
  }

  function selectOutcome(item: MissionOutcomeValue) {
    setOutcome(item);
    if (item !== "Follow Up" && item !== "Timing") {
      setFollowUpChoice("none");
      setCustomFollowUpDate("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              {initialOutcome ? "Edit Mission Outcome" : "Complete Conversation"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{prospect.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{prospect.company}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600">
            Close
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            {error}
          </p>
        ) : null}

        {step === "connected" ? (
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-950">Did you connect?</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Yes", true],
                ["No", false],
              ].map(([label, value]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => {
                    setConnected(Boolean(value));
                    setStep("outcome");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "outcome" ? (
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-950">What happened?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(connected ? connectedOutcomes : noConnectOutcomes).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    selectOutcome(item);
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    outcome === item
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("connected")}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(needsFollowUp ? "follow-up" : "learning")}
                disabled={!outcome}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "follow-up" ? (
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-950">When should this come back?</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["Tomorrow", "tomorrow"],
                ["Next Week", "next-week"],
                ["Next Month", "next-month"],
                ["Custom Date", "custom"],
                ["No Reminder", "none"],
              ].map(([label, value]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFollowUpChoice(value);
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    followUpChoice === value
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {followUpChoice === "custom" ? (
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <label className="text-sm font-semibold text-slate-800" htmlFor="custom-follow-up">
                Custom Date
              </label>
              <input
                id="custom-follow-up"
                type="date"
                value={customFollowUpDate}
                onChange={(event) => {
                  setCustomFollowUpDate(event.target.value);
                  setFollowUpChoice("custom");
                }}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            ) : null}
            <div className="mt-4 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("outcome")}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("learning")}
                disabled={!followUpTimingComplete}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === "learning" ? (
          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-950">Did you learn anything?</p>
            <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {learnedSignals.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLearnedSignal((current) => (current === item ? null : item))}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    learnedSignal === item
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 200))}
              placeholder="Optional detail, 200 characters max"
              className="mt-3 h-20 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(needsFollowUp ? "follow-up" : "outcome")}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving || !outcome || connected === null || !followUpTimingComplete}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSaving ? "Saving..." : "Save Outcome"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
