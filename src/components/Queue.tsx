import type { Prospect } from "../types/Prospect";
import { ProspectCard } from "./ProspectCard";

type QueueProps = {
  prospects: Prospect[];
  completedIds: number[];
  expandedProspectId: number | null;
  activeDispositionId: number | null;
  selectedDisposition: string | null;
  notes: string;
  onToggleExpanded: (prospectId: number) => void;
  onStartConversation: (prospectId: number) => void;
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
  onToggleExpanded,
  onStartConversation,
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
          onToggleExpanded={() => onToggleExpanded(prospect.id)}
          onStartConversation={() => onStartConversation(prospect.id)}
          onDispositionChange={onDispositionChange}
          onNotesChange={onNotesChange}
          onSaveOutcome={() => onSaveOutcome(prospect.id)}
          onCancelDisposition={onCancelDisposition}
        />
      ))}
    </section>
  );
}
