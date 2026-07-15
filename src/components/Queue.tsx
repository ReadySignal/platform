import type { Prospect } from "../types/Prospect";
import type { CallOutcome } from "../types/CallOutcome";
import { ProspectCard } from "./ProspectCard";

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
  onLogAnotherAttempt: (prospectId: number) => void;
  onDispositionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSaveOutcome: (prospectId: number) => void;
  onCancelDisposition: () => void;
};

export function Queue({
  prospects,
  completedIds,
  expandedProspectId,
  activeDispositionId,
  selectedDisposition,
  notes,
  savedOutcomesByProspectId,
  savingOutcomeId,
  outcomeError,
  onToggleExpanded,
  onStartConversation,
  onLogAnotherAttempt,
  onDispositionChange,
  onNotesChange,
  onSaveOutcome,
  onCancelDisposition,
}: QueueProps) {
  return (
    <section className="space-y-2">
      {prospects.map((prospect, index) => (
        <ProspectCard
          key={prospect.id}
          prospect={prospect}
          index={index}
          isExpanded={expandedProspectId === prospect.id}
          isDispositionOpen={activeDispositionId === prospect.id}
          isCompleted={completedIds.includes(prospect.id)}
          selectedDisposition={selectedDisposition}
          notes={notes}
          savedOutcome={savedOutcomesByProspectId[prospect.id] ?? null}
          isSavingOutcome={savingOutcomeId === prospect.id}
          outcomeError={activeDispositionId === prospect.id ? outcomeError : null}
          onToggleExpanded={() => onToggleExpanded(prospect.id)}
          onStartConversation={() => onStartConversation(prospect.id)}
          onLogAnotherAttempt={() => onLogAnotherAttempt(prospect.id)}
          onDispositionChange={onDispositionChange}
          onNotesChange={onNotesChange}
          onSaveOutcome={() => onSaveOutcome(prospect.id)}
          onCancelDisposition={onCancelDisposition}
        />
      ))}
    </section>
  );
}
