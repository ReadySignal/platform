export type MissionOutcomeValue =
  | "Voicemail"
  | "No Answer"
  | "Wrong Person"
  | "Meeting Booked"
  | "Follow Up"
  | "Timing"
  | "No Budget"
  | "Already Customer"
  | "Not Interested"
  | "Disqualified";

export type MissionLearnedSignal =
  | "Maintenance owns this"
  | "Corporate owns this"
  | "Plant owns this"
  | "Reliability owns this"
  | "Quality owns this"
  | "Engineering owns this"
  | "Budget next quarter"
  | "Using competitor"
  | "Already solved internally"
  | "Other";

export type MissionOutcome = {
  id: number;
  missionId: string;
  companyId: number;
  contactId: number | null;
  businessProfileId: number | null;
  occurredAt: string;
  connected: boolean;
  outcome: MissionOutcomeValue;
  followUpDate: string | null;
  recommendedNextAction: string | null;
  reason: string | null;
  learnedSignal: string | null;
  notes: string | null;
  clientSubmissionId: string;
  createdAt: string;
};

export type NewMissionOutcome = {
  missionId: string;
  companyId: number;
  contactId?: number | null;
  businessProfileId?: number | null;
  connected: boolean;
  outcome: MissionOutcomeValue;
  followUpDate?: string | null;
  recommendedNextAction?: string | null;
  reason?: string | null;
  learnedSignal?: string | null;
  notes?: string | null;
  clientSubmissionId: string;
};
