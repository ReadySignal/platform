import { getCallOutcomesForContactsBetween } from "./callOutcomeService";
import { getQueue } from "./queueService";
import type { CallOutcome } from "../types/CallOutcome";
import type { Mission, MissionProgress, TodaysMission } from "../types/Mission";
import type { Prospect } from "../types/Prospect";

function getLocalTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getLatestOutcomesByProspectId(prospects: Prospect[], outcomes: CallOutcome[]) {
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

export function calculateMissionProgress(
  missions: Mission[],
  outcomesByProspectId: Record<number, CallOutcome>,
): MissionProgress {
  const latestOutcomes = Object.values(outcomesByProspectId);
  const completedCount = latestOutcomes.length;

  return {
    completedIds: Object.keys(outcomesByProspectId).map(Number),
    opportunitiesRemaining: Math.max(0, missions.length - completedCount),
    callsCompleted: completedCount,
    conversations: latestOutcomes.filter(
      (outcome) => outcome.disposition === "Conversation" || outcome.disposition === "Meeting Booked",
    ).length,
    meetings: latestOutcomes.filter((outcome) => outcome.disposition === "Meeting Booked").length,
  };
}

function getPreviousInteractionSummary(prospect: Prospect, latestOutcome?: CallOutcome) {
  if (latestOutcome) {
    return `Latest outcome today: ${latestOutcome.disposition}`;
  }

  return prospect.noPreviousOutreach ? "No previous outreach recorded." : "Previous outreach should be reviewed.";
}

function getEstimatedValue(prospect: Prospect): Mission["estimatedValue"] {
  if (prospect.confidenceScore >= 80 && prospect.targetAccount) {
    return "High";
  }

  if (prospect.confidenceScore >= 60) {
    return "Medium";
  }

  return "Unknown";
}

function getDecisionExplanation(prospect: Prospect) {
  const reasons: string[] = [];

  if (prospect.targetState || prospect.targetAccount) {
    reasons.push("the account appears assigned to this SDR");
  }

  if (prospect.whyTodayReason) {
    reasons.push("verified or active intelligence creates a reason to call");
  }

  if (prospect.verifiedContact) {
    reasons.push("the contact has usable contact information");
  }

  if (prospect.noPreviousOutreach) {
    reasons.push("no recent outreach is recorded");
  }

  return reasons.length > 0
    ? `Recommended because ${reasons.join(", ")}.`
    : "Recommended as the best available mission based on the current intelligence set.";
}

function toMission(prospect: Prospect, latestOutcome?: CallOutcome): Mission {
  return {
    id: prospect.id,
    company: {
      id: prospect.companyId,
      name: prospect.company,
      location: prospect.location,
      targetAccount: Boolean(prospect.targetAccount),
    },
    primaryContact: {
      id: prospect.contactId,
      name: prospect.name,
      title: prospect.title,
      directPhone: prospect.directPhone,
      mobilePhone: prospect.mobilePhone,
      email: prospect.email,
    },
    missionScore: prospect.confidenceScore,
    confidence: prospect.confidence,
    whyToday: {
      category: prospect.whyTodayCategory,
      label: prospect.whyTodayLabel,
      reason: prospect.whyTodayReason || prospect.reason,
      occurredAt: prospect.signalOccurredAt || null,
    },
    callBrief: prospect.callBrief,
    supportingEvidence: prospect.signals,
    previousInteractionSummary: getPreviousInteractionSummary(prospect, latestOutcome),
    recommendedNextAction: latestOutcome ? "Review saved outcome or log another attempt." : "Start conversation.",
    estimatedValue: getEstimatedValue(prospect),
    decisionExplanation: getDecisionExplanation(prospect),
    prospect: {
      ...prospect,
      reason: prospect.whyTodayReason || prospect.reason,
      notes: prospect.notes || getDecisionExplanation(prospect),
    },
  };
}

export async function getTodaysMission(options: { includeDemo?: boolean } = {}): Promise<TodaysMission> {
  const prospects = await getQueue({ includeDemo: options.includeDemo });
  const contactIds = prospects
    .map((prospect) => prospect.contactId)
    .filter((contactId): contactId is number => typeof contactId === "number");
  const { startIso, endIso } = getLocalTodayRange();
  const todayOutcomes = contactIds.length > 0 ? await getCallOutcomesForContactsBetween(contactIds, startIso, endIso) : [];
  const outcomesByProspectId = getLatestOutcomesByProspectId(prospects, todayOutcomes);
  const missions = prospects.map((prospect) => toMission(prospect, outcomesByProspectId[prospect.id]));
  const progress = calculateMissionProgress(missions, outcomesByProspectId);

  return {
    missions,
    outcomesByProspectId,
    progress,
    nextMissionId: missions.find((mission) => !progress.completedIds.includes(mission.id))?.id ?? null,
  };
}
