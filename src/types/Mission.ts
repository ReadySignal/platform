import type { CallOutcome } from "./CallOutcome";
import type { MissionOutcome } from "./MissionOutcome";
import type { Prospect } from "./Prospect";

export type MissionConfidence = "High Confidence" | "Medium Confidence";

export type Mission = {
  id: number;
  company: {
    id?: string;
    name: string;
    location: string;
    targetAccount: boolean;
  };
  primaryContact: {
    id?: number;
    name: string;
    title: string;
    directPhone: string;
    mobilePhone: string;
    email: string;
  };
  missionScore: number;
  confidence: MissionConfidence;
  whyToday: {
    category: string;
    label?: string;
    reason: string;
    occurredAt: string | null;
  };
  callBrief?: {
    whyThisContact: string;
    conversationAngle: string;
    discoveryQuestions: string[];
  };
  supportingEvidence: Array<{
    id: number;
    signalType: string;
    headline: string;
    details: string | null;
    occurredAt: string | null;
    scorePoints: number;
  }>;
  previousInteractionSummary: string;
  recommendedNextAction: string;
  estimatedValue: "High" | "Medium" | "Unknown";
  decisionExplanation: string;
  prospect: Prospect;
};

export type MissionProgress = {
  completedIds: number[];
  opportunitiesRemaining: number;
  callsCompleted: number;
  conversations: number;
  meetings: number;
};

export type TodaysMission = {
  missions: Mission[];
  outcomesByProspectId: Record<number, CallOutcome>;
  missionOutcomesByProspectId: Record<number, MissionOutcome>;
  progress: MissionProgress;
  nextMissionId: number | null;
};
